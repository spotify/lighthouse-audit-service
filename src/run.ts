import startServer from './server';

startServer({
  port: process.env.LAS_PORT ? Number(process.env.LAS_PORT) : undefined,
  useCors: process.env.LAS_USE_CORS
    ? Boolean(process.env.LAS_USE_CORS)
    : undefined,
});
