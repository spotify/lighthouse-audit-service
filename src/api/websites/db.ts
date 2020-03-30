import SQL from 'sql-template-strings';

import { Website } from './models';
import { DbConnectionType } from '../../db';
import { ListRequest, addListRequestToQuery } from '../listHelpers';

export interface WebsiteRow {
  url: string;
  time_last_created: Date;
  audits_json: string[];
}

// TODO retrieve website by url
// export async function retrieveWebsiteByUrl(conn: DbConnectionType, url: string): Promise<Website> {

// }

// TODO retrieve website from audit id

export async function retrieveWebsiteList(
  conn: DbConnectionType,
  options: ListRequest,
): Promise<Website[]> {
  const queryResult = await conn.query<WebsiteRow>(
    addListRequestToQuery(
      SQL`
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
        GROUP BY url
        ORDER BY time_last_created DESC
      `,
      options,
    ),
  );

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
