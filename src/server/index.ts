import express, { Application } from 'express';
import morgan from 'morgan';
import { Server } from 'http';

import logger from '../logger';
import {
  getDbConnection,
  runDbMigrations,
  awaitDbConnection,
  DbConnectionType,
} from '../db';

const DEFAULT_PORT = 3003;

export interface LighthouseAuditServiceOptions {
  port?: number;
}

function configureRoutes(app: Application) {
  logger.debug('attaching routes...');
  app.get('/_ping', (_req, res) => res.sendStatus(200));
}

export async function getApp(
  dbConnection: DbConnectionType = getDbConnection(),
): Promise<Application> {
  logger.debug('building express app...');

  await awaitDbConnection(dbConnection);
  await runDbMigrations(dbConnection);

  const app = express();

  app.use(
    morgan('combined', {
      stream: {
        write(message: String) {
          logger.info(message);
        },
      },
    }),
  );

  configureRoutes(app);

  return app;
}

export default async function startServer({
  port = DEFAULT_PORT,
}: LighthouseAuditServiceOptions = {}): Promise<Server> {
  const dbConnection = getDbConnection();
  const app = await getApp(dbConnection);

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

    server.on('close', () => dbConnection.end());
  });
}
