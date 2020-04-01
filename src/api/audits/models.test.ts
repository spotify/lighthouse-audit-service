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

import { Audit, AuditStatus } from './models';

const UUID_RE = /^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i;

const LIGHTHOUSE_REPORT_FIXTURE = fs
  .readFileSync(path.join(__dirname, '__fixtures__', 'lighthouse-report.json'))
  .toString();

describe('audit models', () => {
  describe('Audit.build', () => {
    it('returns an audit', () => {
      const audit = Audit.build({
        id: 'foo',
        url: 'https://spotify.com',
        timeCreated: new Date(),
        timeCompleted: new Date(),
        report: JSON.parse(LIGHTHOUSE_REPORT_FIXTURE),
      });
      expect(audit.id).toMatchInlineSnapshot(`"foo"`);
      expect(audit.url).toMatchInlineSnapshot(`"https://spotify.com"`);
      expect(audit.timeCreated).toBeDefined();
      expect(audit.timeCompleted).toBeDefined();
      expect(audit.report).toBeInstanceOf(Object);
    });

    it('allows for null fields', () => {
      const audit = Audit.build({
        id: 'foo',
        url: 'https://spotify.com',
        timeCreated: new Date(),
      });
      expect(audit.id).toMatchInlineSnapshot(`"foo"`);
      expect(audit.url).toMatchInlineSnapshot(`"https://spotify.com"`);
      expect(audit.timeCreated).toBeDefined();
      expect(audit.timeCompleted).toBeUndefined();
      expect(audit.report).toBeUndefined();
    });
  });

  describe('Audit.buildForUrl', () => {
    it('creates a uuid and timeCreated', () => {
      const audit = Audit.buildForUrl('https://spotify.com');
      expect(audit.id).toMatch(UUID_RE);
      expect(audit.url).toMatchInlineSnapshot(`"https://spotify.com"`);
      expect(audit.timeCreated).toBeDefined();
      expect(audit.timeCompleted).toBeUndefined();
      expect(audit.report).toBeUndefined();
    });
  });

  describe('Audit.buildForDbRow', () => {
    it('creates a uuid and timeCreated', () => {
      const audit = Audit.buildForDbRow({
        id: 'foo',
        url: 'https://spotify.com',
        time_created: new Date(),
        time_completed: new Date(),
        report_json: JSON.parse(LIGHTHOUSE_REPORT_FIXTURE),
      });
      expect(audit.id).toBe('foo');
      expect(audit.url).toMatchInlineSnapshot(`"https://spotify.com"`);
      expect(audit.timeCreated).toBeDefined();
      expect(audit.timeCompleted).toBeDefined();
      expect(audit.report).toBeInstanceOf(Object);
    });
  });

  describe('audit.reportJson', () => {
    it('converts the report into a JSON string', () => {
      const audit = Audit.build({
        id: 'id',
        url: 'url',
        timeCreated: new Date(),
        timeCompleted: new Date(),
        report: JSON.parse(LIGHTHOUSE_REPORT_FIXTURE),
      });
      expect(audit.reportJson).toEqual(expect.any(String));
      expect(JSON.parse(audit.reportJson as string)).toEqual(audit.report);
    });

    describe('when the report is undefined', () => {
      it('returns undefined', () => {
        const audit = Audit.build({
          id: 'id',
          url: 'url',
          timeCreated: new Date(),
        });
        expect(audit.reportJson).toBeUndefined();
      });
    });
  });

  describe('audit.status', () => {
    it('returns COMPLETED when the report is completed', () => {
      const audit = Audit.build({
        id: 'id',
        url: 'url',
        timeCreated: new Date(),
        timeCompleted: new Date(),
        report: JSON.parse(LIGHTHOUSE_REPORT_FIXTURE),
      });
      expect(audit.status).toBe(AuditStatus.COMPLETED);
    });

    it('returns COMPLETED when the report is failed', () => {
      const audit = Audit.build({
        id: 'id',
        url: 'url',
        timeCreated: new Date(),
        timeCompleted: new Date(),
      });
      expect(audit.status).toBe(AuditStatus.FAILED);
    });

    it('returns RUNNING when the report is running', () => {
      const audit = Audit.build({
        id: 'id',
        url: 'url',
        timeCreated: new Date(),
      });
      expect(audit.status).toBe(AuditStatus.RUNNING);
    });
  });

  describe('audit.categories', () => {
    let audit: Audit;

    beforeEach(() => {
      audit = Audit.buildForUrl('https://spotify.com');
    });

    describe('when a report exists', () => {
      beforeEach(() => {
        audit.updateWithReport(JSON.parse(LIGHTHOUSE_REPORT_FIXTURE));
      });

      it('returns the abbreviated categories record', () => {
        expect(audit.categories).toMatchInlineSnapshot(`
          Object {
            "accessibility": Object {
              "id": "accessibility",
              "score": 0.79,
              "title": "Accessibility",
            },
            "best-practices": Object {
              "id": "best-practices",
              "score": 0.86,
              "title": "Best Practices",
            },
            "performance": Object {
              "id": "performance",
              "score": 0.35,
              "title": "Performance",
            },
            "pwa": Object {
              "id": "pwa",
              "score": 0.33,
              "title": "Progressive Web App",
            },
            "seo": Object {
              "id": "seo",
              "score": 0.99,
              "title": "SEO",
            },
          }
        `);
      });
    });

    describe('when no report exists', () => {
      it('returns undefined', () => {
        expect(audit.categories).toBeUndefined();
      });
    });
  });

  describe('audit.updateWithReport(report)', () => {
    it('sets the report', () => {
      const audit = Audit.buildForUrl('https://spotify.com');
      expect(audit.report).toBeUndefined();
      audit.updateWithReport(JSON.parse(LIGHTHOUSE_REPORT_FIXTURE));
      expect(audit.report).toBeInstanceOf(Object);
    });

    it('sets the time completed', () => {
      const audit = Audit.buildForUrl('https://spotify.com');
      expect(audit.timeCompleted).toBeUndefined();
      audit.updateWithReport(JSON.parse(LIGHTHOUSE_REPORT_FIXTURE));
      expect(audit.timeCompleted).toBeInstanceOf(Date);
    });
  });

  describe('audit.markCompleted()', () => {
    it('sets the time completed', () => {
      const audit = Audit.buildForUrl('https://spotify.com');
      expect(audit.timeCompleted).toBeUndefined();
      audit.markCompleted();
      expect(audit.timeCompleted).toBeInstanceOf(Date);
    });
  });
});
