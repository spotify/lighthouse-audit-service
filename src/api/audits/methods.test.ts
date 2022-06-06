/*
 * Copyright 2020 Spotify AB
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { SQL } from 'sql-template-strings';

import { triggerAudit, getAudit, getAudits, deleteAudit } from './methods';
import { Audit, AuditStatus } from './models';
import { InvalidRequestError } from '../../errors';

async function wait(ms: number = 0): Promise<void> {
  await new Promise(r => setTimeout(r, ms));
}

jest.mock('./db');

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

const lighthouse = jest.requireMock('lighthouse');
const puppeteer = jest.requireMock('puppeteer');
const waitOn = jest.requireMock('wait-on');

const db = jest.requireMock('./db');

describe('audit methods', () => {
  let conn: Pool;

  beforeAll(() => {
    conn = new Pool();
  });

  beforeEach(async () => {
    await conn.query(SQL`BEGIN;`);
  });

  afterEach(async () => {
    // wait for the next tick to allow "background" persists to clear
    await wait();
    await conn.query(SQL`ROLLBACK;`);

    lighthouse.mockClear();
    puppeteer.launch.mockClear();
    waitOn.mockClear();
  });

  afterAll(() => {
    conn.end();
  });

  describe('#getAudit', () => {
    let audit: Audit;

    beforeEach(() => {
      audit = Audit.buildForUrl('https://spotify.com');
      db.retrieveAuditById.mockResolvedValueOnce(audit);
    });

    it('returns the retrieved audit', async () => {
      await expect(getAudit(conn, audit.id)).resolves.toMatchObject(audit);
    });
  });

  describe('#deleteAudit', () => {
    let audit: Audit;

    beforeEach(() => {
      audit = Audit.buildForUrl('https://spotify.com');
      db.deleteAuditById.mockResolvedValueOnce(audit);
    });

    it('returns the deleted audit', async () => {
      await expect(deleteAudit(conn, audit.id)).resolves.toMatchObject(audit);
    });
  });

  describe('#triggerAudit', () => {
    // ensure that we wait for any background writes that are still occurring wrap up
    // so that they don't infect other tests.
    afterEach(async () => {
      await wait(100);
    });

    it('returns a started audit', async () => {
      const audit = await triggerAudit(conn, 'https://spotify.com');
      expect(audit.status).toBe(AuditStatus.RUNNING);
    });

    it('kicks off lighthouse in the background', async () => {
      await triggerAudit(conn, 'https://spotify.com/es');
      await wait(); // wait for background job to flush
      expect(lighthouse).toHaveBeenCalledWith(
        'https://spotify.com/es',
        expect.objectContaining({ port: 9222 }),
        expect.objectContaining({
          extends: 'lighthouse:default',
        }),
      );
      expect(puppeteer.launch).toHaveBeenCalledWith(
        expect.objectContaining({
          args: ['--remote-debugging-port=9222', '--no-sandbox'],
        }),
      );
    });

    it('persists the triggered audit', async () => {
      const audit = await triggerAudit(conn, 'https://spotify.com');
      expect(db.persistAudit).toHaveBeenCalledWith(conn, audit);
    });

    describe('when using options', () => {
      it('passes the options along to lighthouse', async () => {
        await triggerAudit(conn, 'https://spotify.com', {
          upTimeout: 1234,
          chromePort: 1000,
          chromePath: 'some/path',
          lighthouseConfig: {
            settings: {
              emulatedFormFactor: 'mobile',
            },
          },
          puppeteerArgs: ['--incognito', '--no-sandbox'],
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
            args: [
              '--incognito',
              '--no-sandbox',
              '--remote-debugging-port=1000',
            ],
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

    describe('when using credentials in url', () => {
      it('passes the options along to lighthouse', async () => {
        await triggerAudit(conn, 'https://user:pass@spotify.com');
        await wait(); // wait for background job to flush
        expect(waitOn).toHaveBeenCalledWith(
          expect.objectContaining({
            auth: {
              username: 'user',
              password: 'pass',
            },
            resources: ['https-get://spotify.com/'],
          }),
        );
        expect(lighthouse).toHaveBeenCalledWith(
          'https://user:pass@spotify.com',
          expect.objectContaining({ port: 9222 }),
          expect.objectContaining({
            extends: 'lighthouse:default',
          }),
        );
      });
    });

    describe('when using awaitAuditCompleted', () => {
      it('returns a completed audit', async () => {
        const audit = await triggerAudit(conn, 'https://spotify.com', {
          awaitAuditCompleted: true,
        });
        expect(audit.status).toBe(AuditStatus.COMPLETED);
      });

      it('attaches the report to the audit', async () => {
        const audit = await triggerAudit(conn, 'https://spotify.com', {
          awaitAuditCompleted: true,
        });
        expect(audit).toBeTruthy();
      });

      it('persists the report', async () => {
        const audit = await triggerAudit(conn, 'https://spotify.com', {
          awaitAuditCompleted: true,
        });
        expect(db.persistAudit).toHaveBeenCalledWith(conn, audit);
      });
    });

    describe('when no url is provided', () => {
      it('throws an InvalidRequestError', async () => {
        // @ts-ignore
        await expect(triggerAudit(null, conn)).rejects.toThrowError(
          InvalidRequestError,
        );
      });
    });

    describe('when url does not contain protocol', () => {
      it('throws an InvalidRequestError', async () => {
        await expect(
          triggerAudit(conn, 'www.spotify.com'),
        ).rejects.toThrowError(InvalidRequestError);
      });
    });

    describe('when url is unreachable', () => {
      beforeEach(() => {
        waitOn.mockRejectedValueOnce(new Error('it never came up'));
      });

      it('returns a failed audit', async () => {
        const audit = await triggerAudit(conn, 'https://spotify.com', {
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
        const audit = await triggerAudit(conn, 'https://spotify.com', {
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
        const audit = await triggerAudit(conn, 'https://spotify.com', {
          awaitAuditCompleted: true,
        });
        expect(audit.status).toBe(AuditStatus.FAILED);
      });
    });
  });

  describe('#getAuditList', () => {
    let audit: Audit;

    beforeEach(() => {
      audit = Audit.buildForUrl('https://spotify.com');
      db.retrieveAuditList.mockResolvedValueOnce([audit]);
      db.retrieveAuditCount.mockResolvedValueOnce(1);
    });

    it('returns the audit list and count', async () => {
      await expect(getAudits(conn, { limit: 5, offset: 10 })).resolves.toEqual({
        items: [audit.listItem],
        total: 1,
        limit: 5,
        offset: 10,
      });
    });
  });
});
