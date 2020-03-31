import { v4 as uuid } from 'uuid';

import { Website } from './models';
import { Audit } from '../audits';

describe('website models', () => {
  describe('constructor', () => {
    it('fails if the array of audits is empty', () => {
      expect(() =>
        Website.build({ url: 'https://spotify.com', audits: [] }),
      ).toThrowErrorMatchingInlineSnapshot(
        `"Website should not be constructed with no audits! "`,
      );
    });
  });

  describe('Website.build', () => {
    it('returns an website', () => {
      const url = 'https://spotify.com';
      const audits = [
        Audit.buildForUrl(url),
        Audit.buildForUrl(url),
        Audit.buildForUrl(url),
      ];
      const website = Website.build({
        url,
        audits,
      });
      expect(website.url).toMatchInlineSnapshot(`"https://spotify.com"`);
      expect(website.audits).toHaveLength(3);
    });
  });

  describe('website.lastAudit', () => {
    it('returns the most recent audit (trusts db query)', () => {
      const url = 'https://spotify.com';
      const audits = [
        Audit.build({
          id: uuid(),
          url,
          timeCreated: new Date('2020-03-01T00:00:00.000Z'),
        }),
        Audit.build({
          id: uuid(),
          url,
          timeCreated: new Date('2020-02-01T00:00:00.000Z'),
        }),
        Audit.build({
          id: uuid(),
          url,
          timeCreated: new Date('2020-01-01T00:00:00.000Z'),
        }),
      ];
      const website = Website.build({ url, audits });
      expect(website.lastAudit).toBe(audits[0]);
    });
  });
});
