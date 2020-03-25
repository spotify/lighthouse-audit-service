/* eslint-disable jest/expect-expect */
import { Server } from 'http';
import request from 'supertest';
import getPort from 'get-port';

import startServer from './server';

describe('server scaffolding', () => {
  let server: Server;
  let port: number;

  beforeEach(async () => {
    port = await getPort();
    server = await startServer({ port });
  });

  afterEach(async () => {
    await new Promise(resolve => server.close(() => resolve()));
  });

  it('exposes a _ping endpoint', async () => {
    await request(`http://localhost:${port}`)
      .get(`/_ping`)
      .expect(200);
  });
});
