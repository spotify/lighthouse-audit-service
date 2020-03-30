import { AuditListItem } from '../audits';

export interface WebsiteParams {
  url: string;
  audits: AuditListItem[];
}

export interface WebsiteListItem {
  url: string;
  timeLastAudited: Date;
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

  static buildForDbRow() {
    throw new Error('not implemented');
  }

  private _timeLastAudited?: Date;
  get timeLastAudited(): Date {
    if (!this._timeLastAudited) {
      this._timeLastAudited = this.audits.reduce(
        (res: Date, audit: AuditListItem): Date => {
          if (audit.timeCreated > res) return audit.timeCreated;
          return res;
        },
        this.audits[0].timeCreated,
      );
    }

    return this._timeLastAudited;
  }

  get listItem(): WebsiteListItem {
    return {
      url: this.url,
      timeLastAudited: this.timeLastAudited,
      audits: this.audits,
    };
  }
}
