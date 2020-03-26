CREATE TABLE IF NOT EXISTS lighthouse_audits (
  id uuid PRIMARY KEY NOT NULL,
  url text NOT NULL,
  time_created timestamptz NOT NULL,
  time_completed timestamptz,
  report_json jsonb
);
