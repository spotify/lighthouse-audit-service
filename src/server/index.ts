import express, {
  Application,
  Router,
  Request,
  Response,
  NextFunction,
} from 'express';
import corsMiddleware from 'cors';
import compression from 'compression';
import bodyParser from 'body-parser';
import expressPromiseRouter from 'express-promise-router';
import morgan from 'morgan';
import { Server } from 'http';
import { Pool, ConnectionConfig } from 'pg';

import logger from '../logger';
import { runDbMigrations, awaitDbConnection, DbConnectionType } from '../db';
import { bindRoutes as bindAuditRoutes } from '../api/audits/routes';
import { bindRoutes as bindWebsiteRoutes } from '../api/websites/routes';
import { StatusCodeError } from '../errors';

const DEFAULT_PORT = 3003;

export interface LighthouseAuditServiceOptions {
  port?: number;
  cors?: boolean;
  postgresConfig?: ConnectionConfig;
}

function configureMiddleware(
  app: Application,
  options: LighthouseAuditServiceOptions,
) {
  if (options.cors) {
    app.use(corsMiddleware());
  }
  app.use(compression());
  app.use(bodyParser.json());
  app.use(
    morgan('combined', {
      stream: {
        write(message: String) {
          logger.info(message);
        },
      },
    }),
  );
}

export function configureErrorMiddleware(app: Application) {
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof StatusCodeError) res.status(err.statusCode);
    res.send(err.message);
  });
}

function configureRoutes(router: Router, conn: DbConnectionType) {
  logger.debug('attaching routes...');
  router.get('/_ping', (_req, res) => res.sendStatus(200));
  bindAuditRoutes(router, conn);
  bindWebsiteRoutes(router, conn);
}

export async function getApp(
  options: LighthouseAuditServiceOptions = {},
  providedConn?: DbConnectionType,
): Promise<Application> {
  logger.debug('building express app...');
  const conn = providedConn || new Pool(options.postgresConfig);

  await awaitDbConnection(conn);
  await runDbMigrations(conn);

  const app = express();
  app.set('connection', conn);
  configureMiddleware(app, options);

  const router = expressPromiseRouter();
  configureRoutes(router, conn);
  app.use(router);

  configureErrorMiddleware(app);

  return app;
}

export async function startServer(
  options: LighthouseAuditServiceOptions = {},
  providedConn?: DbConnectionType,
): Promise<Server> {
  const { port = DEFAULT_PORT } = options;
  const conn = providedConn || new Pool(options.postgresConfig);
  const app = await getApp(options, conn);

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

    server.on('close', () => conn.end());
  });
}
