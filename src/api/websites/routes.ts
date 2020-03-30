import { Router, Request, Response } from 'express';

import { getWebsites } from './methods';
import { WebsiteListItem } from './models';
import { ListResponse, listOptionsFromQuery } from '../listHelpers';
import { DbConnectionType } from '../../db';

export function bindRoutes(router: Router, conn: DbConnectionType): void {
  router.get(
    '/v1/websites',
    async (req: Request, res: Response<ListResponse<WebsiteListItem>>) => {
      const response = await getWebsites(conn, listOptionsFromQuery(req.query));
      res.json(response);
    },
  );
}
