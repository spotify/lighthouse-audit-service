/*
 * Copyright 2020 Spotify AB
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
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
      await new Promise(resolve => server.close(() => resolve(true)));
    });

    it('exposes a _ping endpoint', async () => {
      await request(`http://localhost:${port}`).get(`/_ping`).expect(200);
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
