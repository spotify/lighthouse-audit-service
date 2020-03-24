/* eslint-disable jest/expect-expect */

import { Logger } from 'winston';
import { Server } from 'http';
import request from 'supertest';
import getPort from 'get-port';

import startServer from '.';

const logger = ({
  info: jest.fn(),
  debug: jest.fn(),
} as unknown) as Logger;

describe('server scaffolding', () => {
  let server: Server;
  let port: number;

  beforeEach(async () => {
    port = await getPort();
    server = await startServer({ port, logger });
  });

  afterEach(async () => {
    await new Promise(resolve => server.close(() => resolve()));
  });

  it('supports a custom logger', () => {
    expect(logger.info).toHaveBeenCalled();
  });

  it('supports a custom port', () => {
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining(port.toString()),
    );
  });

  it('exposes a _ping endpoint', async () => {
    await request(`http://localhost:${port}`)
      .get(`/_ping`)
      .expect(200);
  });
});
