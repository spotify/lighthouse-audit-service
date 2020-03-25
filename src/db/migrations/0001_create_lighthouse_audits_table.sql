CREATE TABLE IF NOT EXISTS lighthouse_audits (
  id uuid PRIMARY KEY NOT NULL,
  url text NOT NULL,
  time_created timestamp NOT NULL,
  time_completed timestamp,
  report_json jsonb
);
