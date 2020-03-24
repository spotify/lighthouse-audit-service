import { OptionalStopOptions } from 'testcontainers/dist/test-container';

import { GlobalWithPostgres } from './global_setup';

const dbGlobal: GlobalWithPostgres = global;

export default async function globalTeardown(
  options?: OptionalStopOptions,
): Promise<void> {
  if (dbGlobal.__POSTGRES__) {
    await dbGlobal.__POSTGRES__.stop(options);
    delete dbGlobal.__POSTGRES__;
  }
}
