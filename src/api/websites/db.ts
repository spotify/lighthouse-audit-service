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
import SQL from 'sql-template-strings';

import { Website } from './models';
import { DbConnectionType } from '../../db';
import { ListRequest, addListRequestToQuery } from '../listHelpers';
import { NotFoundError } from '../../errors';

export interface WebsiteRow {
  url: string;
  time_last_created: Date;
  audits_json: string[];
}

export async function retrieveWebsiteByUrl(
  conn: DbConnectionType,
  url: string,
): Promise<Website> {
  const res = await retrieveWebsiteList(conn, {
    where: SQL`WHERE url = ${url}`,
  });
  if (res.length === 0)
    throw new NotFoundError(`no audited website found for url "${url}"`);
  return res[0];
}

export async function retrieveWebsiteByAuditId(
  conn: DbConnectionType,
  auditId: string,
): Promise<Website> {
  const res = await retrieveWebsiteList(conn, {
    where: SQL`WHERE url IN (SELECT url FROM lighthouse_audits w WHERE w.id = ${auditId})`,
  });
  if (res.length === 0)
    throw new NotFoundError(`website found for audit id "${auditId}"`);
  return res[0];
}

export async function retrieveWebsiteList(
  conn: DbConnectionType,
  options: ListRequest,
): Promise<Website[]> {
  let query = SQL`
    SELECT
      distinct url,
      MAX(time_created) as time_last_created,
      array(
        SELECT to_json(n.*)::text
        FROM lighthouse_audits n
        WHERE n.url = o.url
        ORDER BY time_created DESC
      ) as audits_json
    FROM lighthouse_audits o
  `;
  if (options.where) {
    query.append(`\n`);
    query.append(options.where);
  }
  query = query.append(SQL`\nGROUP BY url`);
  query = query.append(SQL`\nORDER BY time_last_created DESC`);
  query = addListRequestToQuery(query, options);
  const queryResult = await conn.query<WebsiteRow>(query);
  return queryResult.rows.map(Website.buildForDbRow);
}

export async function retrieveWebsiteTotal(
  conn: DbConnectionType,
): Promise<number> {
  const res = await conn.query<{ total_count: string }>(
    SQL`SELECT COUNT(distinct url) as total_count FROM lighthouse_audits`,
  );
  return +res.rows[0].total_count;
}
