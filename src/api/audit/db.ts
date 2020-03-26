import SQL from 'sql-template-strings';

import { DbConnectionType } from '../../db';
import { Audit } from './models';

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
