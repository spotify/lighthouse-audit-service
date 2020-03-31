import { startServer } from '.';
import logger from './logger';

startServer({
  port: process.env.LAS_PORT ? Number(process.env.LAS_PORT) : undefined,
  cors: process.env.LAS_CORS ? Boolean(process.env.LAS_CORS) : undefined,
}).catch(err => {
  logger.error(err);
  process.exit(1);
});

process.on('SIGINT', () => {
  logger.info('CTRL+C pressed; exiting.');
  process.exit(0);
});
