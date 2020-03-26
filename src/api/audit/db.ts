import SQL from 'sql-template-strings';
import { LHR } from 'lighthouse';

import { NotFoundError } from '../../errors';
import { DbConnectionType } from '../../db';
import { Audit } from './models';

export interface AuditRow {
  id: string;
  url: string;
  time_created: Date;
  time_completed: Date | null;
  report_json: LHR | null;
}

export async function persistAudit(
  audit: Audit,
  conn: DbConnectionType,
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

export async function retrieveAuditById(
  auditId: string,
  conn: DbConnectionType,
): Promise<Audit> {
  const res = await conn.query<AuditRow>(SQL`
    SELECT * FROM lighthouse_audits WHERE id = ${auditId};
  `);
  if (res.rowCount === 0)
    throw new NotFoundError(`audit not found for id "${auditId}"`);
  return Audit.buildForDbRow(res.rows[0]);
}

export async function deleteAuditById(
  auditId: string,
  conn: DbConnectionType,
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
