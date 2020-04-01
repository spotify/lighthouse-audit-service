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
declare module 'lighthouse' {
  export interface LHR {
    fetchTime: string;
    userAgent: string;
    finalUrl: string;
    lighthouseVersion: string;
    configSettings: {
      emulatedFormFactor: string;
    };
    categories: Record<string, LighthouseCategory>;
  }
  export interface LighthouseCategory {
    id: string;
    score: number;
    title: string;
    auditRefs: {
      id: string;
      group: string;
      weight: number;
    }[];
    description: string;
    manualDescription: string;
  }
  export interface LighthouseOptions {
    chromeFlags?: string[];
    port?: number;
    disableStorageReset?: boolean;
    emulatedFormFactor?: string;
  }
  export interface LighthouseConfig {}
  export interface LighthouseResponse {
    report: string;
    lhr: LHR;
  }
  export function lighthouse(
    url: string,
    opts: LighthouseOptions,
  ): Promise<LighthouseResponse>;
  export function lighthouse(
    url: string,
    opts: LighthouseOptions,
    config: LighthouseConfig | null,
  ): Promise<LighthouseResponse>;
  export default lighthouse;
}
