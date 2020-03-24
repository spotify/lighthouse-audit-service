import express, { Application } from 'express';
import morgan from 'morgan';
import { Logger } from 'winston';
import { Server } from 'http';

const DEFAULT_PORT = 3003;

import defaultLogger from '../logger';

export interface LighthouseAuditServiceOptions {
  port?: number;
  logger?: Logger;
}

function configureRoutes(app: Application, logger: Logger) {
  logger.debug('attaching routes...');
  app.use(
    morgan('combined', {
      stream: {
        write(message: String) {
          logger.info(message);
        },
      },
    }),
  );
  app.get('/_ping', (_req, res) => res.sendStatus(200));
}

export function getApp(logger: Logger = defaultLogger): Application {
  logger.debug('building express app...');
  const app = express();
  configureRoutes(app, logger);
  return app;
}

export default async function startServer({
  port = DEFAULT_PORT,
  logger = defaultLogger,
}: LighthouseAuditServiceOptions = {}): Promise<Server> {
  const app = getApp();

  logger.debug('starting application server...');
  return await new Promise((resolve, reject) => {
    const server = app.listen(port, (err?: Error) => {
      if (err) {
        reject(err);
        return;
      }
      logger.info(`listening on port ${port}`);
      resolve(server);
    });
  });
}
