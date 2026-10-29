"""`EncryptedJSON` — the review payloads encrypted at rest.

Pins what is stored (a Fernet token, plus only the keys named readable), that what comes
back is what went in, that a row written before encryption still reads, and that the one
SQL filter on the email column (`ar_reconcile.latest_real_sample`) still compiles to a
plain JSON lookup on the readable key.
"""

import json
from unittest.mock import patch

from cryptography.fernet import Fernet
from sqlalchemy import select
from sqlalchemy.dialects import postgresql

from app.models.email_automation import EmailDocument
from app.models.encrypted_json import EncryptedJSON, read_stored

PG = postgresql.dialect()
PAYLOAD = {
    "extracted": {"doc_no": "INV-001", "details": [{"commis_amt": "1000", "tax_amt": "70"}]},
    "flags": ["mapping_guessed"],
    "doc_type": "ar_reconcile",
}


def test_stores_a_token_and_only_the_keys_named_readable():
    stored = EncryptedJSON(clear=("doc_type",)).process_bind_param(PAYLOAD, PG)
    assert set(stored) == {"enc", "doc_type"}
    assert stored["doc_type"] == "ar_reconcile"
    assert "INV-001" not in str(stored)  # nothing printed on the document is readable


def test_reads_back_what_went_in():
    t = EncryptedJSON(clear=("doc_type",))
    assert t.process_result_value(t.process_bind_param(PAYLOAD, PG), PG) == PAYLOAD


def test_without_clear_keys_nothing_is_readable():
    stored = EncryptedJSON().process_bind_param({"rows": [{"code": "103", "amount": 5}]}, PG)
    assert set(stored) == {"enc"}


def test_none_stays_none_both_ways():
    t = EncryptedJSON()
    assert t.process_bind_param(None, PG) is None
    assert t.process_result_value(None, PG) is None


def test_a_cleared_payload_is_sql_null_not_json_null():
    """The plain JSON type wrote Python None as the JSON value `null`, which `IS NOT NULL`
    still matches — `_finish` "cleared" rows into something SQL still saw as set."""
    assert EncryptedJSON().load_dialect_impl(PG).none_as_null is True


def test_assigning_none_is_always_a_change():
    """A token another key wrote reads as None, so None-to-None may still be clearing
    ciphertext — the ORM must write it. Real values compare as usual."""
    t = EncryptedJSON()
    assert t.compare_values(None, None) is False
    assert t.compare_values(PAYLOAD, dict(PAYLOAD)) is True
    assert t.compare_values(PAYLOAD, None) is False


def test_a_row_written_before_encryption_reads_as_it_stands():
    """No `enc` key = a plaintext row from before this type, or from the old code during a
    rolling deploy. Read it, don't fail on it; the backfill encrypts it later."""
    assert EncryptedJSON().process_result_value(PAYLOAD, PG) == PAYLOAD


def test_a_token_from_another_key_reads_as_none():
    stored = EncryptedJSON().process_bind_param(PAYLOAD, PG)
    with patch("app.models.encrypted_json.settings") as s:
        s.session_encryption_key = Fernet.generate_key().decode()
        assert EncryptedJSON().process_result_value(stored, PG) is None


def test_scripts_reading_raw_sql_get_the_same_value_from_text_or_dict():
    stored = EncryptedJSON(clear=("doc_type",)).process_bind_param(PAYLOAD, PG)
    assert read_stored(stored) == PAYLOAD
    assert read_stored(json.dumps(stored)) == PAYLOAD  # asyncpg hands JSONB over as text
    assert read_stored(json.dumps(PAYLOAD)) == PAYLOAD  # a plaintext row, as text


def test_the_doc_type_filter_still_compiles_to_a_json_lookup():
    stmt = select(EmailDocument.id).where(
        EmailDocument.review_payload["doc_type"].as_string() == "ar_reconcile"
    )
    sql = str(stmt.compile(dialect=PG))
    assert "review_payload ->> " in sql
