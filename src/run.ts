import { startServer } from './index';

startServer({
  port: process.env.LAS_PORT ? Number(process.env.LAS_PORT) : undefined,
  cors: process.env.LAS_CORS ? Boolean(process.env.LAS_CORS) : undefined,
});
