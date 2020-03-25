import fs from 'fs';
import path from 'path';

import { Audit, AuditStatus } from './models';

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
      expect(audit.id).toEqual(
        expect.stringMatching(
          /^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i,
        ),
      );
      expect(audit.url).toMatchInlineSnapshot(`"https://spotify.com"`);
      expect(audit.timeCreated).toBeDefined();
      expect(audit.timeCompleted).toBeUndefined();
      expect(audit.report).toBeUndefined();
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
