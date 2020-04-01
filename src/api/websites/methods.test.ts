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
import { Pool } from 'pg';
import { SQL } from 'sql-template-strings';

import { Audit } from '../audits';
import { Website } from './models';
import { getWebsiteByUrl, getWebsiteByAuditId, getWebsites } from './methods';

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

  describe('#getWebsiteByUrl', () => {
    let website: Website;

    beforeEach(() => {
      website = Website.build({
        url: 'https://spotify.com',
        audits: [Audit.buildForUrl('https://spotify.com')],
      });
      db.retrieveWebsiteByUrl.mockResolvedValueOnce(website);
    });

    it('returns the retrieved audit', async () => {
      await expect(
        getWebsiteByUrl(conn, 'https://spotify.com'),
      ).resolves.toMatchObject(website);
    });
  });

  describe('#getWebsiteByAuditId', () => {
    let audit: Audit;
    let website: Website;

    beforeEach(() => {
      audit = Audit.buildForUrl('https://spotify.com');
      website = Website.build({
        url: 'https://spotify.com',
        audits: [audit],
      });
      db.retrieveWebsiteByAuditId.mockResolvedValueOnce(website);
    });

    it('returns the retrieved audit', async () => {
      await expect(getWebsiteByAuditId(conn, audit.id)).resolves.toMatchObject(
        website,
      );
    });
  });

  describe('#getWebsiteList', () => {
    let website: Website;

    beforeEach(() => {
      website = Website.build({
        url: 'https://spotify.com',
        audits: [Audit.buildForUrl('https://spotify.com')],
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
