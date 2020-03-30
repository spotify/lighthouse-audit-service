import fs from 'fs';
import path from 'path';
import SQL from 'sql-template-strings';
import { Pool } from 'pg';
import { v4 as uuid } from 'uuid';

import {
  persistAudit,
  retrieveAuditById,
  deleteAuditById,
  retrieveAuditList,
  retrieveAuditCount,
} from './db';
import { Audit } from './models';
import { NotFoundError } from '../../errors';

const LIGHTHOUSE_REPORT_FIXTURE = fs
  .readFileSync(path.join(__dirname, '__fixtures__', 'lighthouse-report.json'))
  .toString();

async function wait(ms: number = 0): Promise<void> {
  await new Promise(r => setTimeout(r, ms));
}

describe('audit db methods', () => {
  let conn: Pool;

  beforeAll(() => {
    conn = new Pool();
  });

  beforeEach(async () => {
    await conn.query(SQL`BEGIN;`);
  });

  afterEach(async () => {
    await conn.query(SQL`ROLLBACK;`);
  });

  afterAll(() => {
    conn.end();
  });

  describe('#persistAudit', () => {
    afterEach(async () => {
      await conn.query(SQL`DELETE FROM lighthouse_audits; COMMIT;`);
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

  describe('#retrieveAuditById', () => {
    describe('with null fields', () => {
      let audit: Audit;

      beforeEach(async () => {
        audit = Audit.buildForUrl('https://spotify.com');
        await persistAudit(conn, audit);
      });

      it('returns an audit for the id', async () => {
        const retrieivedAudit = await retrieveAuditById(conn, audit.id);
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
        await persistAudit(conn, audit);
      });

      it('returns an audit for the id', async () => {
        const retrieivedAudit = await retrieveAuditById(conn, audit.id);
        expect(retrieivedAudit.url).toBe(audit.url);
        expect(retrieivedAudit.timeCreated).toEqual(audit.timeCreated);
        expect(retrieivedAudit.timeCompleted).toEqual(audit.timeCompleted);
        expect(retrieivedAudit.report).toEqual(audit.report);
      });
    });

    describe('when id doesnt exist', () => {
      it('throws a NotFoundError', async () => {
        await expect(retrieveAuditById(conn, uuid())).rejects.toThrowError(
          NotFoundError,
        );
      });
    });
  });

  describe('#retrieveAuditList', () => {
    beforeEach(async () => {
      const first = persistAudit(
        conn,
        Audit.buildForUrl('https://spotify.com/se'),
      );
      await wait(10);
      const middle = persistAudit(
        conn,
        Audit.buildForUrl('https://spotify.com/gb'),
      );
      await wait(10);
      const last = persistAudit(
        conn,
        Audit.buildForUrl('https://spotify.com/en'),
      );
      await Promise.all([first, middle, last]);

      await conn.query(SQL`COMMIT;`);
    });

    afterEach(async () => {
      await conn.query(SQL`DELETE FROM lighthouse_audits; COMMIT;`);
      await wait();
    });

    it('returns the list of Audits', async () => {
      const audits = await retrieveAuditList(conn, {});
      expect(audits).toHaveLength(3);
      expect(typeof audits[0].id).toBe('string');
    });

    describe('when limit and offset are applied', () => {
      it('correctly filters the data', async () => {
        const audits = await retrieveAuditList(conn, { limit: 1 });
        expect(audits).toHaveLength(1);
        expect(audits[0].url).toBe('https://spotify.com/en');
      });

      it('correctly offsets the data', async () => {
        const audits = await retrieveAuditList(conn, { limit: 1, offset: 1 });
        expect(audits).toHaveLength(1);
        expect(audits[0].url).toBe('https://spotify.com/gb');
      });

      it('correctly returns when you page past the data', async () => {
        const audits = await retrieveAuditList(conn, { limit: 1, offset: 5 });
        expect(audits).toHaveLength(0);
      });
    });

    describe('when no rows are in the db', () => {
      beforeEach(async () => {
        await conn.query(SQL`DELETE FROM lighthouse_audits`);
      });

      it('returns correctly', async () => {
        const audits = await retrieveAuditList(conn, {});
        expect(audits).toHaveLength(0);
      });
    });
  });

  describe('#retrieveAuditCount', () => {
    beforeEach(async () => {
      await conn.query(SQL`DELETE FROM lighthouse_audits; COMMIT;`);

      const first = persistAudit(
        conn,
        Audit.buildForUrl('https://spotify.com/se'),
      );
      const middle = persistAudit(
        conn,
        Audit.buildForUrl('https://spotify.com/gb'),
      );
      const last = persistAudit(
        conn,
        Audit.buildForUrl('https://spotify.com/en'),
      );
      await Promise.all([first, middle, last]);
      await conn.query(SQL`COMMIT;`);
    });

    afterEach(async () => {
      await conn.query(SQL`DELETE FROM lighthouse_audits; COMMIT;`);
    });

    it('returns the count', async () => {
      await expect(retrieveAuditCount(conn)).resolves.toBe(3);
    });

    describe('when there are no entries', () => {
      beforeEach(async () => {
        await conn.query(SQL`DELETE FROM lighthouse_audits; COMMIT;`);
      });

      it('returns zero', async () => {
        await expect(retrieveAuditCount(conn)).resolves.toBe(0);
      });
    });
  });

  describe('#deleteAuditById', () => {
    let audit: Audit;

    beforeEach(async () => {
      audit = Audit.buildForUrl('https://spotify.com');
      await persistAudit(conn, audit);
    });

    it('deletes the audit for from the db', async () => {
      await expect(retrieveAuditById(conn, audit.id)).resolves.toBeInstanceOf(
        Audit,
      );
      await deleteAuditById(conn, audit.id);
      await expect(retrieveAuditById(conn, audit.id)).rejects.toThrowError(
        NotFoundError,
      );
    });

    it('returns the audit', async () => {
      const retrieivedAudit = await deleteAuditById(conn, audit.id);
      expect(retrieivedAudit.url).toBe(audit.url);
      expect(retrieivedAudit.timeCreated).toEqual(audit.timeCreated);
      expect(retrieivedAudit.timeCompleted).toEqual(audit.timeCompleted);
      expect(retrieivedAudit.report).toEqual(audit.report);
    });

    describe('when id doesnt exist', () => {
      it('throws a NotFoundError', async () => {
        await expect(deleteAuditById(conn, uuid())).rejects.toThrowError(
          NotFoundError,
        );
      });
    });
  });
});
