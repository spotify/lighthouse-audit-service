import fs from 'fs';
import path from 'path';
import SQL from 'sql-template-strings';
import { Pool } from 'pg';
import { v4 as uuid } from 'uuid';

import { awaitDbConnection, runDbMigrations } from '../../db';
import { persistAudit, retrieveAuditById, deleteAuditById } from './db';
import { Audit } from './models';
import { NotFoundError } from '../../errors';

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

  describe('#persistAudit', () => {
    it('creates a new audit', async () => {
      const audit = Audit.buildForUrl('https://spotify.com');
      await persistAudit(audit, conn);
      const resp = await conn.query(
        SQL`SELECT url FROM lighthouse_audits WHERE id = ${audit.id}`,
      );
      expect(resp.rows[0].url).toBe('https://spotify.com');
    });

    it('updates an existing audit', async () => {
      const audit = Audit.buildForUrl('https://spotify.com');
      await persistAudit(audit, conn);
      const resp = await conn.query(
        SQL`SELECT url, report_json FROM lighthouse_audits WHERE id = ${audit.id}`,
      );
      expect(resp.rows[0].url).toBe('https://spotify.com');
      expect(resp.rows[0].report_json).toBeFalsy();

      audit.updateWithReport(JSON.parse(LIGHTHOUSE_REPORT_FIXTURE));
      await persistAudit(audit, conn);
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

  describe('#retrieveAuditById', () => {
    describe('with null fields', () => {
      let audit: Audit;

      beforeEach(async () => {
        audit = Audit.buildForUrl('https://spotify.com');
        await persistAudit(audit, conn);
      });

      it('returns an audit for the id', async () => {
        const retrieivedAudit = await retrieveAuditById(audit.id, conn);
        expect(retrieivedAudit.url).toBe(audit.url);
        expect(retrieivedAudit.timeCreated).toEqual(audit.timeCreated);
        expect(retrieivedAudit.timeCompleted).toEqual(audit.timeCompleted);
        expect(retrieivedAudit.report).toEqual(audit.report);
      });
    });

    describe('when a report is set', () => {
      let audit: Audit;

      beforeEach(async () => {
        audit = Audit.buildForUrl('https://spotify.com').updateWithReport(
          JSON.parse(LIGHTHOUSE_REPORT_FIXTURE),
        );
        await persistAudit(audit, conn);
      });

      it('returns an audit for the id', async () => {
        const retrieivedAudit = await retrieveAuditById(audit.id, conn);
        expect(retrieivedAudit.url).toBe(audit.url);
        expect(retrieivedAudit.timeCreated).toEqual(audit.timeCreated);
        expect(retrieivedAudit.timeCompleted).toEqual(audit.timeCompleted);
        expect(retrieivedAudit.report).toEqual(audit.report);
      });
    });

    describe('when id doesnt exist', () => {
      it('throws a NotFoundError', async () => {
        await expect(retrieveAuditById(uuid(), conn)).rejects.toThrowError(
          NotFoundError,
        );
      });
    });
  });

  describe('#deleteAuditById', () => {
    let audit: Audit;

    beforeEach(async () => {
      audit = Audit.buildForUrl('https://spotify.com');
      await persistAudit(audit, conn);
    });

    it('deletes the audit for from the db', async () => {
      await expect(retrieveAuditById(audit.id, conn)).resolves.toBeInstanceOf(
        Audit,
      );
      await deleteAuditById(audit.id, conn);
      await expect(retrieveAuditById(audit.id, conn)).rejects.toThrowError(
        NotFoundError,
      );
    });

    it('returns the audit', async () => {
      const retrieivedAudit = await deleteAuditById(audit.id, conn);
      expect(retrieivedAudit.url).toBe(audit.url);
      expect(retrieivedAudit.timeCreated).toEqual(audit.timeCreated);
      expect(retrieivedAudit.timeCompleted).toEqual(audit.timeCompleted);
      expect(retrieivedAudit.report).toEqual(audit.report);
    });

    describe('when id doesnt exist', () => {
      it('throws a NotFoundError', async () => {
        await expect(deleteAuditById(uuid(), conn)).rejects.toThrowError(
          NotFoundError,
        );
      });
    });
  });
});
