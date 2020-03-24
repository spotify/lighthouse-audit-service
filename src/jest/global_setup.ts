import { Duration, TemporalUnit } from 'node-duration';
import { GenericContainer, Wait, StartedTestContainer } from 'testcontainers';
import logger from '../logger';

import { awaitDbConnection, getDbConnection } from '../db';
import globalTeardown from './global_teardown';

export interface GlobalWithPostgres extends NodeJS.Global {
  __POSTGRES__?: StartedTestContainer;
}

const dbGlobal: GlobalWithPostgres = global;

export default async () => {
  const name = `las_test_container_${Math.random()
    .toString(36)
    .substring(2, 5)}`;

  logger.debug(`initializing container "${name}"`);

  const container = await new GenericContainer('postgres')
    .withName(name)
    .withExposedPorts(5432)
    .withEnv('POSTGRES_USER', 'postgres')
    .withEnv('POSTGRES_PASSWORD', 'postgres')
    .withEnv('POSTGRES_DB', 'postgres')
    .withWaitStrategy(
      Wait.forLogMessage('listening on IPv4 address "0.0.0.0", port 5432'),
    )
    .start();

  // The postgres docker container prints that it's ready for connections twice, so we
  // have to listen for another log line. However, this log message comes before the
  // container is actually ready, so we need to wait a little.
  await new Promise(resolve => {
    setTimeout(resolve, 3000);
  });

  // We have to use global setup because it's the only way in Jest to run code once before suite.
  // Unfortuantely Jest prevents us from writing globals that are read by the sutite.
  // So, we are forced to write the connection info to the ENV.
  process.env.PGUSER = process.env.PGPASSWORD = process.env.PGDATABASE =
    'postgres';
  process.env.PGHOST = container.getContainerIpAddress();
  process.env.PGPORT = `${container.getMappedPort(5432)}`;

  const dbConnection = getDbConnection();
  await awaitDbConnection(dbConnection);

  dbGlobal.__POSTGRES__ = container;
};

process.on('SIGINT', async () => {
  await globalTeardown({
    timeout: new Duration(2, TemporalUnit.SECONDS),
  });
  process.exit(1);
});
