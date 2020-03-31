import { AuditListItem, Audit } from '../audits';
import { WebsiteRow } from './db';

export interface WebsiteParams {
  url: string;
  audits: Audit[];
}

export interface WebsiteBody {
  url: string;
  lastAudit: AuditListItem;
  audits: AuditListItem[];
}

export interface WebsiteListItem extends WebsiteBody {}

export class Website {
  constructor(public url: string, public audits: Audit[]) {
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
      audits: row.audits_json.map(str => Audit.buildForDbRow(JSON.parse(str))),
    });
  }

  get lastAudit(): Audit {
    return this.audits[0];
  }

  get body(): WebsiteBody {
    return {
      url: this.url,
      audits: this.audits.map(a => a.listItem),
      lastAudit: this.lastAudit.listItem,
    };
  }

  get listItem(): WebsiteListItem {
    return this.body;
  }
}
