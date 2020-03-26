import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

import { awaitDbConnection, runDbMigrations } from '../../db';
import { triggerAudit } from './methods';
import { AuditStatus } from './models';
import { SQL } from 'sql-template-strings';

async function wait(ms: number = 0): Promise<void> {
  await new Promise(r => setTimeout(r, ms));
}

jest.mock('lighthouse', () => {
  const LIGHTHOUSE_REPORT_FIXTURE = fs
    .readFileSync(
      path.join(__dirname, '__fixtures__', 'lighthouse-report.json'),
    )
    .toString();
  return jest.fn().mockResolvedValue({
    lhr: JSON.parse(LIGHTHOUSE_REPORT_FIXTURE),
    report: LIGHTHOUSE_REPORT_FIXTURE,
  });
});

jest.mock('puppeteer', () => ({
  launch: jest.fn().mockResolvedValue({
    close: jest.fn(),
  }),
}));

jest.mock('wait-on', () => jest.fn().mockResolvedValue(null));

const lighthouse = require.requireMock('lighthouse');
const puppeteer = require.requireMock('puppeteer');
const waitOn = require.requireMock('wait-on');

describe('audit methods', () => {
  let conn: Pool;

  beforeEach(async () => {
    conn = new Pool();
    await awaitDbConnection(conn);
    await runDbMigrations(conn);
  });

  afterEach(async () => {
    // wait for the next tick to allow "background" persists to clear
    await wait();
    conn.end();
    lighthouse.mockClear();
    puppeteer.launch.mockClear();
    waitOn.mockClear();
  });

  describe('#triggerAudit', () => {
    it('returns a started audit', async () => {
      const audit = await triggerAudit('https://spotify.com', conn);
      expect(audit.status).toBe(AuditStatus.RUNNING);
    });

    it('kicks off lighthouse in the background', async () => {
      await triggerAudit('https://spotify.com/es', conn);
      await wait(); // wait for background job to flush
      expect(lighthouse).toHaveBeenCalledWith(
        'https://spotify.com/es',
        expect.objectContaining({ port: 9222 }),
        expect.objectContaining({
          extends: 'lighthouse:default',
        }),
      );
    });

    it('persists the triggered audit', async () => {
      const audit = await triggerAudit('https://spotify.com', conn);
      const res = await conn.query(
        SQL`SELECT * FROM lighthouse_audits WHERE id = ${audit.id}`,
      );
      expect(res.rows[0].url).toBe('https://spotify.com');
    });

    describe('when using options', () => {
      it('passes the options along to lighthouse', async () => {
        await triggerAudit('https://spotify.com', conn, {
          upTimeout: 1234,
          chromePort: 1000,
          chromePath: 'some/path',
          lighthouseConfig: {
            settings: {
              emulatedFormFactor: 'mobile',
            },
          },
        });
        await wait(); // wait for background job to flush
        expect(waitOn).toHaveBeenCalledWith(
          expect.objectContaining({
            timeout: 1234,
          }),
        );
        expect(puppeteer.launch).toHaveBeenCalledWith(
          expect.objectContaining({
            executablePath: 'some/path',
          }),
        );
        expect(lighthouse).toHaveBeenCalledWith(
          'https://spotify.com',
          expect.objectContaining({ port: 1000 }),
          expect.objectContaining({
            settings: expect.objectContaining({ emulatedFormFactor: 'mobile' }),
          }),
        );
      });
    });

    describe('when using awaitAuditCompleted', () => {
      it('returns a completed audit', async () => {
        const audit = await triggerAudit('https://spotify.com', conn, {
          awaitAuditCompleted: true,
        });
        expect(audit.status).toBe(AuditStatus.COMPLETED);
      });

      it('attaches the report to the audit', async () => {
        const audit = await triggerAudit('https://spotify.com', conn, {
          awaitAuditCompleted: true,
        });
        expect(audit).toBeTruthy();
      });

      it('persists the report', async () => {
        const audit = await triggerAudit('https://spotify.com', conn, {
          awaitAuditCompleted: true,
        });
        const res = await conn.query(
          SQL`SELECT id FROM lighthouse_audits WHERE id = ${audit.id} AND report_json IS NOT NULL`,
        );
        expect(res.rows).toHaveLength(1);
      });
    });

    describe('when url is unreachable', () => {
      beforeEach(() => {
        waitOn.mockRejectedValueOnce(new Error('it never came up'));
      });

      it('returns a failed audit', async () => {
        const audit = await triggerAudit('https://spotify.com', conn, {
          awaitAuditCompleted: true,
        });
        expect(audit.status).toBe(AuditStatus.FAILED);
      });
    });

    describe('when puppeteer doesnt come up', () => {
      beforeEach(() => {
        puppeteer.launch.mockRejectedValueOnce(
          new Error('chrome wasnt installed or something'),
        );
      });

      it('returns a failed audit', async () => {
        const audit = await triggerAudit('https://spotify.com', conn, {
          awaitAuditCompleted: true,
        });
        expect(audit.status).toBe(AuditStatus.FAILED);
      });
    });

    describe('when lighthouse fails', () => {
      beforeEach(() => {
        lighthouse.mockRejectedValueOnce(
          new Error('lighthouse was misconfigured'),
        );
      });

      it('returns a failed audit', async () => {
        const audit = await triggerAudit('https://spotify.com', conn, {
          awaitAuditCompleted: true,
        });
        expect(audit.status).toBe(AuditStatus.FAILED);
      });
    });
  });
});
