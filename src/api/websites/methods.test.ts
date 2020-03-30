import { Pool } from 'pg';
import { SQL } from 'sql-template-strings';

import { Audit } from '../audits';
import { Website } from './models';
import { getWebsites } from './methods';

jest.mock('./db');

const db = require.requireMock('./db');

describe('audit methods', () => {
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

  describe('#getAuditList', () => {
    let website: Website;

    beforeEach(() => {
      website = Website.build({
        url: 'https://spotify.com',
        audits: [Audit.buildForUrl('https://spotify.com').listItem],
      });
      db.retrieveWebsiteList.mockResolvedValueOnce([website]);
      db.retrieveWebsiteTotal.mockResolvedValueOnce(1);
    });

    it('returns the audit list and count', async () => {
      await expect(
        getWebsites(conn, { limit: 5, offset: 10 }),
      ).resolves.toEqual({
        items: [website.listItem],
        total: 1,
        limit: 5,
        offset: 10,
      });
    });
  });
});
