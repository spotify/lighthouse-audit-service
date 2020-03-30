import { AuditListItem, Audit } from '../audits';
import { WebsiteRow } from './db';

export interface WebsiteParams {
  url: string;
  audits: AuditListItem[];
}

export interface WebsiteListItem {
  url: string;
  lastAudit: AuditListItem;
  audits: AuditListItem[];
}

export class Website {
  constructor(public url: string, public audits: AuditListItem[]) {
    if (audits.length === 0) {
      throw new Error('Website should not be constructed with no audits! ');
    }
  }

  static build(params: WebsiteParams) {
    return new Website(params.url, params.audits);
  }

  static buildForDbRow(row: WebsiteRow): Website {
    return Website.build({
      url: row.url,
      audits: row.audits_json.map(
        str => Audit.buildForDbRow(JSON.parse(str)).listItem,
      ),
    });
  }

  get lastAudit(): AuditListItem {
    return this.audits[0];
  }

  get listItem(): WebsiteListItem {
    return {
      url: this.url,
      audits: this.audits,
      lastAudit: this.lastAudit,
    };
  }
}
