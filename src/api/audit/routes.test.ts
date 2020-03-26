import path from 'path';
import fs from 'fs';
import express, { Application } from 'express';
import bodyParser from 'body-parser';
import { Pool } from 'pg';
import request from 'supertest';
import expressPromiseRouter from 'express-promise-router';

import { bindRoutes } from './routes';
import { Audit } from './models';
import { configureErrorMiddleware } from '../../server';
import { InvalidRequestError } from '../../errors';

const UUID_RE = /^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i;
const ISO_DATETIME_RE = /\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z)/;

const LIGHTHOUSE_REPORT_FIXTURE = fs
  .readFileSync(path.join(__dirname, '__fixtures__', 'lighthouse-report.json'))
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

  describe('POST /v1/audits', () => {
    beforeEach(() => {
      methods.triggerAudit.mockResolvedValueOnce(
        Audit.buildForUrl('https://spotify.com').updateWithReport(
          JSON.parse(LIGHTHOUSE_REPORT_FIXTURE),
        ),
      );
    });

    afterEach(() => {
      methods.triggerAudit.mockReset();
    });

    it('uses the url from the body', async () => {
      const payload = { url: 'https://spotify.com' };
      await request(app)
        .post('/v1/audits')
        .set('Accept', 'application/json')
        .send(payload)
        .expect('Content-Type', /json/)
        .expect(201)
        .then(() => {
          expect(methods.triggerAudit).toHaveBeenCalledWith(
            payload.url,
            conn,
            undefined,
          );
        });
    });

    it('uses the options from the body', async () => {
      const payload = {
        url: 'https://spotify.com',
        options: { chromePort: 1234 },
      };
      await request(app)
        .post('/v1/audits')
        .set('Accept', 'application/json')
        .send(payload)
        .expect('Content-Type', /json/)
        .expect(201)
        .then(() => {
          expect(methods.triggerAudit).toHaveBeenCalledWith(payload.url, conn, {
            chromePort: 1234,
          });
        });
    });

    it('resolves with the body of the audit', async () => {
      const payload = {
        url: 'https://spotify.com',
        options: { chromePort: 1234 },
      };
      await request(app)
        .post('/v1/audits')
        .set('Accept', 'application/json')
        .send(payload)
        .expect('Content-Type', /json/)
        .expect(201)
        .then(res => {
          expect(res.body.url).toBe('https://spotify.com');
          expect(res.body.status).toBe('COMPLETED');
          expect(res.body.report).toBeInstanceOf(Object);
          expect(res.body.timeCreated).toMatch(ISO_DATETIME_RE);
          expect(res.body.timeCompleted).toMatch(ISO_DATETIME_RE);
          expect(res.body.id).toMatch(UUID_RE);
        });
    });

    describe('when a url is not provided', () => {
      beforeEach(() => {
        methods.triggerAudit.mockReset();
        methods.triggerAudit.mockImplementationOnce(() => {
          throw new InvalidRequestError('url must be provided');
        });
      });

      /* eslint-disable jest/expect-expect */
      it('responds 400', async () => {
        await request(app)
          .post('/v1/audits')
          .set('Accept', 'application/json')
          .send({})
          .expect(400);
      });
      /* eslint-enable jest/expect-expect */
    });
  });

  describe('GET /v1/audits', () => {
    let audits: Audit[];
    beforeEach(() => {
      audits = [
        Audit.buildForUrl('https://spotify.com'),
        Audit.buildForUrl('https://spotify.com'),
        Audit.buildForUrl('https://spotify.com'),
      ];

      methods.getAudits.mockResolvedValueOnce([audits, audits.length]);
    });

    it('returns the correct payload', async () => {
      await request(app)
        .get('/v1/audits')
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200)
        .then(res => {
          expect(res.body.audits[0].url).toBe(audits[0].url);
          expect(res.body.audits[0].report).toBeUndefined();
          expect(res.body.total).toBe(audits.length);
          expect(res.body.limit).toBe(25);
          expect(res.body.offset).toBe(0);
        });
    });

    it('allows limit and offset overrides', async () => {
      await request(app)
        .get('/v1/audits')
        .query({ limit: '5', offset: '5' })
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200)
        .then(res => {
          expect(methods.getAudits).toHaveBeenCalledWith(
            { limit: 5, offset: 5 },
            conn,
          );
          expect(res.body.limit).toBe(5);
          expect(res.body.offset).toBe(5);
        });
    });

    /* eslint-disable jest/expect-expect */
    describe('when invalid value is provided for limit', () => {
      /* eslint-disable jest/expect-expect */
      it('rejects 400', async () => {
        await request(app)
          .get('/v1/audits')
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
          .get('/v1/audits')
          .query({ offset: 'boop' })
          .set('Accept', 'application/json')
          .expect(400);
      });
      /* eslint-enable jest/expect-expect */
    });
  });

  describe('GET /v1/audits/:auditId', () => {
    let audit: Audit;

    beforeEach(() => {
      audit = Audit.buildForUrl('https://spotify.com').updateWithReport(
        JSON.parse(LIGHTHOUSE_REPORT_FIXTURE),
      );
      methods.getAudit.mockResolvedValueOnce(audit);
    });

    it('returns the audit', async () => {
      await request(app)
        .get(`/v1/audits/${audit.id}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200)
        .then(res => {
          expect(res.body.url).toBe('https://spotify.com');
          expect(res.body.status).toBe('COMPLETED');
          expect(res.body.report).toEqual(audit.report);
          expect(res.body.timeCreated).toEqual(
            audit.timeCreated?.toISOString(),
          );
          expect(res.body.timeCompleted).toEqual(
            audit.timeCompleted?.toISOString(),
          );
          expect(res.body.id).toEqual(audit.id);
        });
    });

    describe('when html is requested', () => {
      it('returns the html-rendered lighthouse report', async () => {
        await request(app)
          .get(`/v1/audits/${audit.id}`)
          .set('Accept', 'text/html')
          .expect('Content-Type', /html/)
          .expect(200)
          .then(res => {
            expect(res.text).toContain('<!doctype html>');
          });
      });
    });
  });

  describe('DELETE /v1/audits/:auditId', () => {
    let audit: Audit;

    beforeEach(() => {
      audit = Audit.buildForUrl('https://spotify.com').updateWithReport(
        JSON.parse(LIGHTHOUSE_REPORT_FIXTURE),
      );
      methods.deleteAudit.mockResolvedValueOnce(audit);
    });

    it('deletes the audit', async () => {
      await request(app)
        .delete(`/v1/audits/${audit.id}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200)
        .then(() => {
          expect(methods.deleteAudit).toHaveBeenCalledWith(audit.id, conn);
        });
    });

    it('returns the audit', async () => {
      await request(app)
        .delete(`/v1/audits/${audit.id}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200)
        .then(res => {
          expect(res.body.url).toBe('https://spotify.com');
          expect(res.body.status).toBe('COMPLETED');
          expect(res.body.report).toEqual(audit.report);
          expect(res.body.timeCreated).toEqual(
            audit.timeCreated?.toISOString(),
          );
          expect(res.body.timeCompleted).toEqual(
            audit.timeCompleted?.toISOString(),
          );
          expect(res.body.id).toEqual(audit.id);
        });
    });
  });
});
