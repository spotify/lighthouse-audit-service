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
import * as las from '.';

describe('external api', () => {
  const EXPECTED_METHODS = [
    'startServer',
    'getApp',
    'triggerAudit',
    'getAudit',
    'getAudits',
    'deleteAudit',
    'getWebsites',
    'getWebsiteByAuditId',
    'getWebsiteByUrl',
  ];

  const EXPECTED_MODELS = ['Audit', 'Website'];

  EXPECTED_METHODS.forEach(method => {
    it(`defines method ${method}`, () => {
      expect(las[method]).toEqual(expect.any(Function));
    });
  });

  EXPECTED_MODELS.forEach(model => {
    it(`defines model ${model}`, () => {
      expect(las[model].prototype).toBeDefined();
      expect(las[model].build).toBeDefined();
    });
  });
});
