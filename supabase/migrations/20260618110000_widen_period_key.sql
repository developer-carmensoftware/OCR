-- period_key changed from YYYYMM (6) to YYYYMMDD (8) for daily document numbering.
ALTER TABLE document_sequences ALTER COLUMN period_key TYPE VARCHAR(8);
