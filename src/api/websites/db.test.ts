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
import SQL from 'sql-template-strings';
import { Pool } from 'pg';

import {
  retrieveWebsiteList,
  retrieveWebsiteTotal,
  retrieveWebsiteByUrl,
  retrieveWebsiteByAuditId,
} from './db';
import { Audit } from '../audits';
import { persistAudit } from '../audits/db';
import { NotFoundError } from '../../errors';

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

  describe('#retrieveWebsiteByUrl', () => {
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
      await wait(10);
      const last2 = persistAudit(
        conn,
        Audit.buildForUrl('https://spotify.com/en'),
      );
      await wait(10);
      const last3 = persistAudit(
        conn,
        Audit.buildForUrl('https://spotify.com/en'),
      );
      await Promise.all([first, middle, last, last2, last3]);

      await conn.query(SQL`COMMIT;`);
    });

    it('returns the website', async () => {
      const website = await retrieveWebsiteByUrl(
        conn,
        'https://spotify.com/en',
      );
      expect(website.url).toBe('https://spotify.com/en');
      expect(website.audits).toHaveLength(3);
      expect(website.lastAudit).toBeInstanceOf(Object);
    });

    describe('when url doesnt exist', () => {
      it('throws a NotFoundError', async () => {
        await expect(
          retrieveWebsiteByUrl(conn, 'https://spotify.com/de'),
        ).rejects.toThrowError(NotFoundError);
      });
    });
  });

  describe('#retrieveWebsiteByAuditId', () => {
    let audit: Audit;

    beforeEach(async () => {
      audit = Audit.buildForUrl('https://spotify.com/se');
      await persistAudit(conn, audit);
      await conn.query(SQL`COMMIT;`);
    });

    it('returns the website', async () => {
      const website = await retrieveWebsiteByAuditId(conn, audit.id);
      expect(website.url).toBe('https://spotify.com/se');
      expect(website.audits).toHaveLength(3);
      expect(website.lastAudit).toBeInstanceOf(Object);
    });

    it('pages properly', async () => {
      const website = await retrieveWebsiteByAuditId(
        conn,
        audit.id,
        { limit: 1, offset: 0 },
        { limit: 1, offset: 0 },
      );
      expect(website.url).toBe('https://spotify.com/se');
      expect(website.audits).toHaveLength(1);
      expect(website.lastAudit).toBeInstanceOf(Object);
    });

    describe('when url doesnt exist', () => {
      it('throws a NotFoundError', async () => {
        await expect(
          retrieveWebsiteByUrl(conn, 'https://spotify.com/de'),
        ).rejects.toThrowError(NotFoundError);
      });
    });
  });

  describe('#retrieveWebsiteList', () => {
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
      await wait(10);
      const last2 = persistAudit(
        conn,
        Audit.buildForUrl('https://spotify.com/en'),
      );
      await wait(10);
      const last3 = persistAudit(
        conn,
        Audit.buildForUrl('https://spotify.com/en'),
      );
      await Promise.all([first, middle, last, last2, last3]);

      await conn.query(SQL`COMMIT;`);
    });

    afterEach(async () => {
      await conn.query(SQL`DELETE FROM lighthouse_audits; COMMIT;`);
      await wait();
    });

    it('returns the list of Audits', async () => {
      const websites = await retrieveWebsiteList(conn, {});
      expect(websites).toHaveLength(3);
      expect(typeof websites[0].url).toBe('string');
    });

    it('groups the audits as expected', async () => {
      const websites = await retrieveWebsiteList(conn, {});
      expect(websites[0].audits).toHaveLength(3);
    });

    describe('when limit and offset are applied', () => {
      it('correctly filters the data', async () => {
        const websites = await retrieveWebsiteList(conn, { limit: 1 });
        expect(websites).toHaveLength(1);
        expect(websites[0].url).toBe('https://spotify.com/en');
      });

      it('correctly offsets the data', async () => {
        const websites = await retrieveWebsiteList(conn, {
          limit: 1,
          offset: 1,
        });
        expect(websites).toHaveLength(1);
        expect(websites[0].url).toBe('https://spotify.com/gb');
      });

      it('correctly returns when you page past the data', async () => {
        const websites = await retrieveWebsiteList(conn, {
          limit: 1,
          offset: 5,
        });
        expect(websites).toHaveLength(0);
      });
    });

    describe('when no rows are in the db', () => {
      beforeEach(async () => {
        await conn.query(SQL`DELETE
                             FROM lighthouse_audits`);
      });

      it('returns correctly', async () => {
        const audits = await retrieveWebsiteList(conn, {});
        expect(audits).toHaveLength(0);
      });
    });
  });

  describe('#retrieveAuditCount', () => {
    beforeEach(async () => {
      await conn.query(SQL`DELETE
                           FROM lighthouse_audits;
      COMMIT;`);

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
      await wait(10);
      const last2 = persistAudit(
        conn,
        Audit.buildForUrl('https://spotify.com/en'),
      );
      await wait(10);
      const last3 = persistAudit(
        conn,
        Audit.buildForUrl('https://spotify.com/en'),
      );
      await Promise.all([first, middle, last, last2, last3]);
      await conn.query(SQL`COMMIT;`);
    });

    afterEach(async () => {
      await conn.query(SQL`DELETE
                           FROM lighthouse_audits;
      COMMIT;`);
    });

    it('returns the count, properly grouped', async () => {
      await expect(retrieveWebsiteTotal(conn)).resolves.toBe(3);
    });

    describe('when there are no entries', () => {
      beforeEach(async () => {
        await conn.query(SQL`DELETE
                             FROM lighthouse_audits;
        COMMIT;`);
      });

      it('returns zero', async () => {
        await expect(retrieveWebsiteTotal(conn)).resolves.toBe(0);
      });
    });
  });
});
