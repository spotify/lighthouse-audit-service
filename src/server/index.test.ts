/* eslint-disable jest/expect-expect */
import express from 'express';
import { Server } from 'http';
import request from 'supertest';
import getPort from 'get-port';

import { startServer, getApp } from '.';

describe('server exports', () => {
  describe('#startServer', () => {
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

  describe('#getApp', () => {
    it('exposes a _ping endpoint', async () => {
      const app = express();
      const las = await getApp();
      app.use('/', las);

      await request(app)
        .get(`/_ping`)
        .expect(200)
        .then(() => {
          expect(() => las.get('connection').end()).not.toThrow();
        });
    });
  });
});
