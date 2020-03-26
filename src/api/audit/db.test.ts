import fs from 'fs';
import path from 'path';
import SQL from 'sql-template-strings';
import { Pool } from 'pg';

import { awaitDbConnection, runDbMigrations } from '../../db';
import { persistAudit } from './db';
import { Audit } from './models';

const LIGHTHOUSE_REPORT_FIXTURE = fs
  .readFileSync(path.join(__dirname, '__fixtures__', 'lighthouse-report.json'))
  .toString();

describe('audit db methods', () => {
  let conn: Pool;

  beforeEach(async () => {
    conn = new Pool();
    await awaitDbConnection(conn);
    await runDbMigrations(conn);
  });

  afterEach(() => {
    conn.end();
  });

  it('creates a new audit', async () => {
    const audit = Audit.buildForUrl('https://spotify.com');
    await persistAudit(conn, audit);
    const resp = await conn.query(
      SQL`SELECT url FROM lighthouse_audits WHERE id = ${audit.id}`,
    );
    expect(resp.rows[0].url).toBe('https://spotify.com');
  });

  it('updates an existing audit', async () => {
    const audit = Audit.buildForUrl('https://spotify.com');
    await persistAudit(conn, audit);
    const resp = await conn.query(
      SQL`SELECT url, report_json FROM lighthouse_audits WHERE id = ${audit.id}`,
    );
    expect(resp.rows[0].url).toBe('https://spotify.com');
    expect(resp.rows[0].report_json).toBeFalsy();

    audit.updateWithReport(JSON.parse(LIGHTHOUSE_REPORT_FIXTURE));
    await persistAudit(conn, audit);
    const resp2 = await conn.query(
      SQL`SELECT url, report_json FROM lighthouse_audits WHERE id = ${audit.id}`,
    );
    expect(resp2.rows[0].url).toBe('https://spotify.com');
    expect(resp2.rows[0].report_json).toBeInstanceOf(Object);
    expect(resp2.rows[0].report_json).toEqual(
      JSON.parse(LIGHTHOUSE_REPORT_FIXTURE),
    );
  });
});
