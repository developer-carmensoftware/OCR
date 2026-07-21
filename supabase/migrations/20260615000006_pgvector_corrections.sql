-- pgvector: add semantic embedding column to correction_feedback.
--
-- This migration is ADDITIVE and OPTIONAL. The correction matching flow still
-- works without embeddings (falls back to exact match). NULL value_embedding
-- rows are never passed to the HNSW index query (WHERE value_embedding IS NOT NULL).
--
-- Embedding model: text-embedding-3-small (OpenAI / OpenRouter) — 1536 dimensions.
-- Column is populated at correction-write time by correction_service.py
-- (guarded: if pgvector not available, write succeeds with NULL embedding).
--
-- Query pattern: nearest-neighbour filtered by (tenant_id, field_name):
--   SELECT original_value, corrected_value
--   FROM correction_feedback
--   WHERE tenant_id = $1 AND field_name = $2
--     AND value_embedding IS NOT NULL
--     AND deleted_at IS NULL
--   ORDER BY value_embedding <=> $3   -- cosine distance
--   LIMIT 5;
--
-- HNSW note: filtered HNSW can under-return when the WHERE clause is very selective.
-- The correction_service should over-fetch (LIMIT 20) and post-filter in Python.

create extension if not exists vector with schema extensions;

alter table correction_feedback
    add column if not exists value_embedding extensions.vector(1536);

-- HNSW index: fast approximate nearest-neighbour for cosine distance.
-- Partial index (IS NOT NULL) keeps the index small — only populated rows.
create index if not exists ix_correction_feedback_embedding
    on correction_feedback using hnsw (value_embedding extensions.vector_cosine_ops)
    where value_embedding is not null;
