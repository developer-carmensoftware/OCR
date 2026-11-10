"""OPENROUTER_API_KEY and OPENROUTER_API_KEYS: either one alone is a configured key."""

from app.config import Settings


def _settings(single: str, pool: str) -> Settings:
    # Init values beat the environment (CI sets OPENROUTER_API_KEY), and no .env is read.
    return Settings(_env_file=None, openrouter_api_key=single, openrouter_api_keys=pool)


def test_the_pool_alone_counts_as_a_configured_key():
    s = _settings("", "sk-a, sk-b")
    assert s.openrouter_api_key == "sk-a"
    assert s.openrouter_api_keys_list == ["sk-a", "sk-b"]


def test_the_single_key_alone_is_unchanged():
    s = _settings("sk-solo", "")
    assert s.openrouter_api_key == "sk-solo"
    assert s.openrouter_api_keys_list == ["sk-solo"]


def test_with_both_set_the_pool_still_decides_which_keys_are_called():
    s = _settings("sk-solo", "sk-a,sk-b")
    assert s.openrouter_api_key == "sk-solo"
    assert s.openrouter_api_keys_list == ["sk-a", "sk-b"]


def test_nothing_set_is_still_not_configured():
    assert _settings("", "").openrouter_api_key == ""
