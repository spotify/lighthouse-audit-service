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
import { Router, Request, Response } from 'express';

import { getWebsites, getWebsiteByUrl, getWebsiteByAuditId } from './methods';
import { WebsiteListItem, WebsiteBody } from './models';
import { ListResponse, listOptionsFromQuery } from '../listHelpers';
import { DbConnectionType } from '../../db';

export function bindRoutes(router: Router, conn: DbConnectionType): void {
  router.get(
    '/v1/audits/:auditId/website',
    async (req: Request<{ auditId: string }>, res: Response<WebsiteBody>) => {
      const response = await getWebsiteByAuditId(
        conn,
        req.params.auditId,
        listOptionsFromQuery(req.query),
        listOptionsFromQuery(req.query, 'audit-'),
      );
      res.json(response.body);
    },
  );

  router.get(
    '/v1/websites/:websiteUrl',
    async (
      req: Request<{ websiteUrl: string }>,
      res: Response<WebsiteBody>,
    ) => {
      const response = await getWebsiteByUrl(
        conn,
        req.params.websiteUrl,
        listOptionsFromQuery(req.query),
        listOptionsFromQuery(req.query, 'audit-'),
      );
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
