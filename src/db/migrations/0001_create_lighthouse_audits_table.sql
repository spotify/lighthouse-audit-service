CREATE TABLE IF NOT EXISTS lighthouse_audits (
  id uuid PRIMARY KEY NOT NULL,
  url text NOT NULL,
  date_created timestamp NOT NULL,
  date_completed timestamp,
  report_json jsonb
);
