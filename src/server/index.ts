import express, {
  Application,
  Router,
  Request,
  Response,
  NextFunction,
} from 'express';
import cors from 'cors';
import compression from 'compression';
import bodyParser from 'body-parser';
import expressPromiseRouter from 'express-promise-router';
import morgan from 'morgan';
import { Server } from 'http';
import { Pool } from 'pg';

import logger from '../logger';
import { runDbMigrations, awaitDbConnection, DbConnectionType } from '../db';
import { bindRoutes as bindAuditRoutes } from '../api/audits';
import { bindRoutes as bindWebsiteRoutes } from '../api/websites';
import { StatusCodeError } from '../errors';

const DEFAULT_PORT = 3003;
const DEFAULT_CORS = true;

export interface LighthouseAuditServiceOptions {
  port?: number;
  useCors?: boolean;
}

function configureMiddleware(app: Application, useCors: boolean) {
  if (useCors) {
    app.use(cors());
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
  conn: DbConnectionType = new Pool(),
  useCors: boolean = DEFAULT_CORS,
): Promise<Application> {
  logger.debug('building express app...');

  await awaitDbConnection(conn);
  await runDbMigrations(conn);

  const app = express();
  configureMiddleware(app, useCors);

  const router = expressPromiseRouter();
  configureRoutes(router, conn);
  app.use(router);

  configureErrorMiddleware(app);

  return app;
}

export default async function startServer({
  port = DEFAULT_PORT,
  useCors = DEFAULT_CORS,
}: LighthouseAuditServiceOptions = {}): Promise<Server> {
  const conn = new Pool();
  const app = await getApp(conn, useCors);

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
