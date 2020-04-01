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
