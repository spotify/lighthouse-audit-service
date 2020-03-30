import SQL from 'sql-template-strings';

import { Website, WebsiteListItem } from './models';
import { DbConnectionType } from '../../db';
import { ListRequest, addListRequestToQuery } from '../listHelpers';
import { Audit } from '../audits';

interface WebsiteListQueryRow {
  url: string;
  time_last_created: Date;
  audits_json: string[];
}

export async function retrieveWebsiteList(
  conn: DbConnectionType,
  options: ListRequest,
): Promise<WebsiteListItem[]> {
  const queryResult = await conn.query<WebsiteListQueryRow>(
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

  return queryResult.rows.map(
    r =>
      Website.build({
        url: r.url,
        audits: r.audits_json.map(
          str => Audit.buildForDbRow(JSON.parse(str)).listItem,
        ),
      }).listItem,
  );
}

export async function retrieveWebsiteTotal(
  conn: DbConnectionType,
): Promise<number> {
  const res = await conn.query<{ total_count: string }>(
    SQL`SELECT COUNT(distinct url) as total_count FROM lighthouse_audits`,
  );
  return +res.rows[0].total_count;
}
