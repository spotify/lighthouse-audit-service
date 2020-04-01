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
import { Client, Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import retry, { Options } from 'async-retry';

import logger from '../logger';

export type DbConnectionType = Client | Pool;

export async function runDbMigrations(conn: DbConnectionType): Promise<void> {
  logger.info('running db migrations...');
  const files = fs.readdirSync(path.join(__dirname, 'migrations')).sort();
  for (const file of files) {
    logger.debug(`running migration "${file}"...`);
    const sql = fs
      .readFileSync(path.join(__dirname, 'migrations', file))
      .toString();
    await conn.query(sql);
  }
}

async function getSchema(conn: DbConnectionType) {
  const sql = `SELECT * FROM pg_catalog.pg_tables WHERE schemaname != 'pg_catalog' AND schemaname != 'information_schema'`;
  const queryResult = await conn.query(sql);
  return queryResult.rows;
}

export async function awaitDbConnection(
  conn: DbConnectionType,
  options: Options = { maxRetryTime: 10000 },
): Promise<void> {
  logger.debug('awaiting db connection...');
  await retry(async () => {
    await Promise.race([
      getSchema(conn),
      new Promise((_res, rej) =>
        setTimeout(() => rej('failed to reach the db in 1000ms'), 1000),
      ),
    ]);
  }, options);
}
