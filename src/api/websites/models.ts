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
