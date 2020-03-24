import startServer from './server';

startServer({
  port: process.env.LAS_PORT ? Number(process.env.LAS_PORT) : undefined,
});
