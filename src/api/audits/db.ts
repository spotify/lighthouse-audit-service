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
import { LHR } from 'lighthouse';

import { NotFoundError } from '../../errors';
import { DbConnectionType } from '../../db';
import { Audit } from './models';
import { ListRequest, addListRequestToQuery } from '../listHelpers';

export interface AuditRow {
  id: string;
  url: string;
  time_created: Date;
  time_completed: Date | null;
  report_json: LHR | null;
}

export async function persistAudit(
  conn: DbConnectionType,
  audit: Audit,
): Promise<void> {
  await conn.query(SQL`
    INSERT INTO lighthouse_audits (id, url, time_created, time_completed, report_json)
    VALUES (
      ${audit.id},
      ${audit.url},
      ${audit.timeCreated.toISOString()},
      ${audit.timeCompleted ? audit.timeCompleted.toISOString() : null},
      ${audit.reportJson || null}
    )
    ON CONFLICT (id)
      DO UPDATE SET (url, time_created, time_completed, report_json) = (
        ${audit.url},
        ${audit.timeCreated.toISOString()},
        ${audit.timeCompleted ? audit.timeCompleted.toISOString() : null},
        ${audit.reportJson || null}
      )
      WHERE lighthouse_audits.id = ${audit.id};
  `);
}

export async function retrieveAuditList(
  conn: DbConnectionType,
  options: ListRequest = {},
): Promise<Audit[]> {
  let query = SQL`SELECT * FROM lighthouse_audits`;
  if (options.where) {
    query = query.append(SQL`\n`);
    query = query.append(options.where);
  }
  query = query.append(SQL`\nORDER BY time_created DESC`);
  query = addListRequestToQuery(query, options);
  const res = await conn.query<AuditRow>(query);
  return res.rows.map(Audit.buildForDbRow);
}

export async function retrieveAuditCount(
  conn: DbConnectionType,
): Promise<number> {
  const res = await conn.query<{ total_count: string }>(
    SQL`SELECT COUNT(*) as total_count FROM lighthouse_audits`,
  );
  return +res.rows[0].total_count;
}

export async function retrieveAuditById(
  conn: DbConnectionType,
  auditId: string,
): Promise<Audit> {
  const res = await retrieveAuditList(conn, {
    where: SQL`WHERE id = ${auditId}`,
  });
  if (res.length === 0)
    throw new NotFoundError(`audit not found for id "${auditId}"`);
  return res[0];
}

export async function deleteAuditById(
  conn: DbConnectionType,
  auditId: string,
): Promise<Audit> {
  const res = await conn.query<AuditRow>(SQL`
    DELETE FROM lighthouse_audits
      WHERE lighthouse_audits.id = ${auditId}
    RETURNING *;
  `);
  if (res.rowCount === 0)
    throw new NotFoundError(`audit not found for id "${auditId}"`);
  return Audit.buildForDbRow(res.rows[0]);
}
