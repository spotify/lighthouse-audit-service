import { Router, Request, Response } from 'express';

import logger from '../../logger';
import { DbConnectionType } from '../../db';
import { AuditBody, triggerAudit, AuditOptions } from '.';

interface RequestWithBody<T> extends Request {
  body: T;
}

export function bindRoutes(router: Router, conn: DbConnectionType): void {
  logger.debug('attaching audit api routes...');

  router.post(
    '/v1/audits',
    async (req: RequestWithBody<AuditOptions>, res: Response<AuditBody>) => {
      const audit = await triggerAudit(conn, req.body);
      res.status(201).json(audit.body);
    },
  );
}
