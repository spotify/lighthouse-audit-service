import { Router, Request, Response } from 'express';
// @ts-ignore
import ReportGenerator from 'lighthouse/lighthouse-core/report/report-generator';

import logger from '../../logger';
import { DbConnectionType } from '../../db';
import { AuditBody } from './models';
import { triggerAudit, getAudit, deleteAudit, AuditOptions } from './methods';

interface RequestWithBody<T> extends Request {
  body: T;
}

interface PostAuditRequestBody {
  url: string;
  options?: AuditOptions;
}

export function bindRoutes(router: Router, conn: DbConnectionType): void {
  logger.debug('attaching audit api routes...');

  router.post(
    '/v1/audits',
    async (
      req: RequestWithBody<PostAuditRequestBody>,
      res: Response<AuditBody>,
    ) => {
      const audit = await triggerAudit(req.body.url, conn, req.body.options);
      res.status(201).json(audit.body);
    },
  );

  router.get(
    '/v1/audits/:auditId',
    async (
      req: Request<{ auditId: string }>,
      res: Response<AuditBody | string>,
    ) => {
      const audit = await getAudit(req.params.auditId, conn);
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
      const audit = await deleteAudit(req.params.auditId, conn);
      res.json(audit.body);
    },
  );
}
