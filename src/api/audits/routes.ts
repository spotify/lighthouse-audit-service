import { Router, Request, Response } from 'express';
// @ts-ignore
import ReportGenerator from 'lighthouse/lighthouse-core/report/report-generator';

import logger from '../../logger';
import { DbConnectionType } from '../../db';
import { AuditBody, AuditListItem } from './models';
import {
  triggerAudit,
  getAudit,
  getAudits,
  deleteAudit,
  AuditOptions,
} from './methods';
import { ListResponse, listOptionsFromQuery } from '../listHelpers';

interface RequestWithBody<T> extends Request {
  body: T;
}

interface TriggerAuditRequest {
  url: string;
  options?: AuditOptions;
}

export function bindRoutes(router: Router, conn: DbConnectionType): void {
  logger.debug('attaching audit api routes...');

  router.post(
    '/v1/audits',
    async (
      req: RequestWithBody<TriggerAuditRequest>,
      res: Response<AuditBody>,
    ) => {
      const audit = await triggerAudit(conn, req.body.url, req.body.options);
      res.status(201).json(audit.body);
    },
  );

  router.get(
    '/v1/audits',
    async (req: Request, res: Response<ListResponse<AuditListItem>>) => {
      const response = await getAudits(conn, listOptionsFromQuery(req.query));
      res.json(response);
    },
  );

  router.get(
    '/v1/audits/:auditId',
    async (
      req: Request<{ auditId: string }>,
      res: Response<AuditBody | string>,
    ) => {
      const audit = await getAudit(conn, req.params.auditId);
      if (req.header('Accept') === 'application/json') {
        res.json(audit.body);
      } else {
        const html = ReportGenerator.generateReportHtml(audit.report);
        res.setHeader('Content-Type', 'text/html');
        res.send(html);
      }
    },
  );

  router.delete(
    '/v1/audits/:auditId',
    async (req: Request<{ auditId: string }>, res: Response<AuditBody>) => {
      const audit = await deleteAudit(conn, req.params.auditId);
      res.json(audit.body);
    },
  );
}
