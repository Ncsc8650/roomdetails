-- User approved preserving legacy workbook codes on 2026-10-13.
ALTER TABLE assets DROP CONSTRAINT assets_asset_number_check;
ALTER TABLE assets ADD CONSTRAINT assets_asset_number_check CHECK (
  asset_number ~ '^(7[0-9]{3}\.[0-9]{4}\.[0-9]{3}\.[0-9]{3}\.[0-9]{2}|7[0-9]{3}\.[0-9]{3}\.[0-9]{4}\.[0-9]{4}(\.[0-9])?(/[0-9]{2})?)$'
);
CREATE TABLE asset_import_batches (
  id text PRIMARY KEY,
  source_name text NOT NULL,
  content_hash text NOT NULL UNIQUE,
  division_id text NOT NULL REFERENCES divisions(id),
  created_by text NOT NULL REFERENCES user_accounts(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE asset_import_rows (
  id text PRIMARY KEY,
  batch_id text NOT NULL REFERENCES asset_import_batches(id),
  row_number integer NOT NULL CHECK(row_number>1),
  original_data jsonb NOT NULL,
  source_code text NOT NULL,
  asset_id text UNIQUE REFERENCES assets(id),
  status text NOT NULL CHECK(status IN ('imported','pending')),
  issue text NOT NULL DEFAULT '',
  UNIQUE(batch_id,row_number),
  CHECK((status='imported') = (asset_id IS NOT NULL))
);
