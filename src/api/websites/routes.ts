import { Router, Request, Response } from 'express';

import { getWebsites, getWebsiteByUrl, getWebsiteByAuditId } from './methods';
import { WebsiteListItem, WebsiteBody } from './models';
import { ListResponse, listOptionsFromQuery } from '../listHelpers';
import { DbConnectionType } from '../../db';

export function bindRoutes(router: Router, conn: DbConnectionType): void {
  router.get(
    '/v1/audits/:auditId/website',
    async (req: Request<{ auditId: string }>, res: Response<WebsiteBody>) => {
      const response = await getWebsiteByAuditId(conn, req.params.auditId);
      res.json(response.body);
    },
  );

  router.get(
    '/v1/websites/:websiteUrl',
    async (
      req: Request<{ websiteUrl: string }>,
      res: Response<WebsiteBody>,
    ) => {
      const response = await getWebsiteByUrl(conn, req.params.websiteUrl);
      res.json(response.body);
    },
  );

  router.get(
    '/v1/websites',
    async (req: Request, res: Response<ListResponse<WebsiteListItem>>) => {
      const response = await getWebsites(conn, listOptionsFromQuery(req.query));
      res.json(response);
    },
  );
}
