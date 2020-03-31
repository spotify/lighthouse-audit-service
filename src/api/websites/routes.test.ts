import path from 'path';
import fs from 'fs';
import express, { Application } from 'express';
import bodyParser from 'body-parser';
import { Pool } from 'pg';
import request from 'supertest';
import expressPromiseRouter from 'express-promise-router';

import { bindRoutes } from './routes';
import { Website, WebsiteListItem } from './models';
import { Audit } from '../audits';
import { configureErrorMiddleware } from '../../server';

const LIGHTHOUSE_REPORT_FIXTURE = fs
  .readFileSync(
    path.join(
      __dirname,
      '..',
      'audits',
      '__fixtures__',
      'lighthouse-report.json',
    ),
  )
  .toString();

jest.mock('./methods');

const methods = require.requireMock('./methods');

describe('audit routes', () => {
  let conn: Pool;
  let app: Application;

  beforeAll(async () => {
    conn = new Pool();
  });

  beforeEach(async () => {
    await conn.query('BEGIN;');

    app = express();
    app.use(bodyParser.json());
    const router = expressPromiseRouter();
    bindRoutes(router, conn);
    app.use(router);
    configureErrorMiddleware(app);
  });

  afterEach(async () => {
    await conn.query('ROLLBACK;');
  });

  afterAll(() => {
    conn.end();
  });

  describe('GET /v1/audits/:auditId/website', () => {
    let audit: Audit;
    let website: Website;

    beforeEach(() => {
      audit = Audit.buildForUrl('https://spotify.com').updateWithReport(
        JSON.parse(LIGHTHOUSE_REPORT_FIXTURE),
      );
      website = Website.build({
        url: 'https://spotify.com',
        audits: [audit],
      });
      methods.getWebsiteByAuditId.mockResolvedValueOnce(website);
    });

    it('returns the audit', async () => {
      await request(app)
        .get(`/v1/audits/${audit.id}/website`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200)
        .then(res => {
          expect(methods.getWebsiteByAuditId).toHaveBeenLastCalledWith(
            conn,
            audit.id,
          );

          expect(res.body.url).toBe('https://spotify.com');
          expect(res.body.audits).toHaveLength(1);
          expect(res.body.lastAudit.status).toBe('COMPLETED');
          expect(res.body.lastAudit.timeCreated).toEqual(
            audit.timeCreated?.toISOString(),
          );
          expect(res.body.lastAudit.timeCompleted).toEqual(
            audit.timeCompleted?.toISOString(),
          );
          expect(res.body.lastAudit.id).toEqual(audit.id);
        });
    });
  });

  describe('GET /v1/websites/:websiteUrl', () => {
    let website: Website;

    beforeEach(() => {
      website = Website.build({
        url: 'https://spotify.com',
        audits: [
          Audit.buildForUrl('https://spotify.com').updateWithReport(
            JSON.parse(LIGHTHOUSE_REPORT_FIXTURE),
          ),
        ],
      });
      methods.getWebsiteByUrl.mockResolvedValueOnce(website);
    });

    it('returns the audit', async () => {
      await request(app)
        .get(`/v1/websites/${encodeURIComponent('https://spotify.com')}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200)
        .then(res => {
          expect(methods.getWebsiteByUrl).toHaveBeenLastCalledWith(
            conn,
            'https://spotify.com',
          );
          expect(res.body.url).toBe('https://spotify.com');
          expect(res.body.audits).toHaveLength(1);
          expect(res.body.lastAudit.status).toBe('COMPLETED');
        });
    });
  });

  describe('GET /v1/websites', () => {
    let items: WebsiteListItem[];
    beforeEach(() => {
      items = [
        Website.build({
          url: 'https://spotify.com',
          audits: [
            Audit.buildForUrl('https://spotify.com').updateWithReport(
              JSON.parse(LIGHTHOUSE_REPORT_FIXTURE),
            ),
            Audit.buildForUrl('https://spotify.com').updateWithReport(
              JSON.parse(LIGHTHOUSE_REPORT_FIXTURE),
            ),
            Audit.buildForUrl('https://spotify.com').updateWithReport(
              JSON.parse(LIGHTHOUSE_REPORT_FIXTURE),
            ),
          ],
        }).listItem,
      ];

      methods.getWebsites.mockResolvedValueOnce({
        items,
        total: 1,
        limit: 25,
        offset: 0,
      });
    });

    it('returns the correct payload', async () => {
      await request(app)
        .get('/v1/websites')
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200)
        .then(res => {
          expect(res.body.items).toBeInstanceOf(Array);
          expect(res.body.total).toBe(1);
          expect(res.body.limit).toBe(25);
          expect(res.body.offset).toBe(0);
        });
    });

    it('allows limit and offset overrides', async () => {
      await request(app)
        .get('/v1/websites')
        .query({ limit: '5', offset: '5' })
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200)
        .then(() => {
          expect(methods.getWebsites).toHaveBeenCalledWith(conn, {
            limit: 5,
            offset: 5,
          });
        });
    });

    /* eslint-disable jest/expect-expect */
    describe('when invalid value is provided for limit', () => {
      /* eslint-disable jest/expect-expect */
      it('rejects 400', async () => {
        await request(app)
          .get('/v1/websites')
          .query({ limit: 'boop' })
          .set('Accept', 'application/json')
          .expect(400);
      });
      /* eslint-enable jest/expect-expect */
    });

    describe('when invalid value is provided for offset', () => {
      /* eslint-disable jest/expect-expect */
      it('rejects 400', async () => {
        await request(app)
          .get('/v1/websites')
          .query({ offset: 'boop' })
          .set('Accept', 'application/json')
          .expect(400);
      });
      /* eslint-enable jest/expect-expect */
    });
  });
});
