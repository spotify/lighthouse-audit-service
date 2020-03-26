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
import { InvalidRequestError } from '../../errors';

interface RequestWithBody<T> extends Request {
  body: T;
}

interface RequestWithQuery<T> extends Request {
  query: T;
}

interface TriggerAuditRequest {
  url: string;
  options?: AuditOptions;
}

interface AuditListRequestParams {
  limit?: number;
  offset?: number;
}

interface AuditListResponse extends AuditListRequestParams {
  audits: AuditListItem[];
  total: number;
}

export function bindRoutes(router: Router, conn: DbConnectionType): void {
  logger.debug('attaching audit api routes...');

  router.post(
    '/v1/audits',
    async (
      req: RequestWithBody<TriggerAuditRequest>,
      res: Response<AuditBody>,
    ) => {
      const audit = await triggerAudit(req.body.url, conn, req.body.options);
      res.status(201).json(audit.body);
    },
  );

  router.get(
    '/v1/audits',
    async (
      req: RequestWithQuery<{
        limit: string;
        offset: string;
      }>,
      res: Response<AuditListResponse>,
    ) => {
      const { limit: limitStr = '25', offset: offsetStr = '0' } = req.query;
      const limit = +limitStr;
      const offset = +offsetStr;

      if (isNaN(limit))
        throw new InvalidRequestError(`limit must be a number.`);
      if (isNaN(offset))
        throw new InvalidRequestError(`offset must be a number.`);

      const [audits, total] = await getAudits({ limit, offset }, conn);
      res.json({ audits: audits.map(a => a.listItem), total, limit, offset });
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
