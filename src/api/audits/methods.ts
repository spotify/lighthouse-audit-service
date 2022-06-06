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
import lighthouse, { LighthouseConfig } from 'lighthouse';
import waitOn from 'wait-on';
import puppeteer from 'puppeteer';

import { Audit, AuditListItem } from './models';
import { persistAudit, retrieveAuditList, retrieveAuditCount } from './db';
import parentLogger from '../../logger';
import { DbConnectionType } from '../../db';
import { InvalidRequestError } from '../../errors';
import { listResponseFactory } from '../listHelpers';

const DEFAULT_UP_TIMEOUT = 30000;
const DEFAULT_CHROME_PORT = 9222;
const DEFAULT_CHROME_PATH = process.env.CHROME_PATH;

const HTTP_RE = /^https?:\/\//;

export {
  retrieveAuditById as getAudit,
  deleteAuditById as deleteAudit,
} from './db';

export interface AuditOptions {
  awaitAuditCompleted?: boolean;
  upTimeout?: number;
  chromePort?: number;
  chromePath?: string;
  lighthouseConfig?: LighthouseConfig;
  puppeteerArgs?: puppeteer.PuppeteerNodeLaunchOptions['args'];
}

/**
 * trigger the audit, storing it as an in-progress row in the db, and running the
 * actual audit non-blocking in the background.
 * @param url: string
 * @param conn: DbConnection
 * @param options: AuditOptions
 * @returns Promise<Audit>
 */
export async function triggerAudit(
  conn: DbConnectionType,
  url: string,
  options: AuditOptions = {},
): Promise<Audit> {
  if (!url)
    throw new InvalidRequestError(
      'No URL provided. URL is required for auditing.',
    );

  if (!HTTP_RE.test(url))
    throw new InvalidRequestError(
      `URL "${url}" does not contain a protocol (http or https).`,
    );

  const audit = Audit.buildForUrl(url);
  await persistAudit(conn, audit);

  if (options.awaitAuditCompleted) {
    await runAudit(audit, options);
    await persistAudit(conn, audit);
  } else {
    // run in background
    runAudit(audit, options).then(() => persistAudit(conn, audit));
  }

  return audit;
}

/**
 * check to see if the given list of strings includes a string that contains the given string
 * @param list: string[]
 * @param partialString: string
 */
function includesPartial(list: string[], partialString: string) {
  for (const str of list) {
    if (str.indexOf(partialString) >= 0) {
      return true;
    }
  }
  return false;
}

/**
 * trigger the audit, storing it as an in-progress row in the db, and running the
 * actual audit non-blocking in the background.
 * @param audit: Audit
 * @param conn: DbConnection
 * @param options: AuditOptions
 * @returns Audit
 */
async function runAudit(
  audit: Audit,
  options: AuditOptions = {},
): Promise<Audit> {
  const url = audit.url;
  const {
    upTimeout = DEFAULT_UP_TIMEOUT,
    chromePort = DEFAULT_CHROME_PORT,
    chromePath = DEFAULT_CHROME_PATH,
    lighthouseConfig = {},
    puppeteerArgs = [],
  } = options;

  const logger = parentLogger.child({ url, auditId: audit.id });
  logger.info(`Starting Lighthouse audit`);

  try {
    logger.debug('Waiting for URL to be UP ...');
    const u = new URL(url);
    // Remove the colon from the protocol
    const protocol = u.protocol.substring(0, u.protocol.length - 1);
    // Craft url and options according to waitOn specs
    const urlToWaitOn = `${protocol}-get://${u.host}${u.pathname}${u.search}`;
    const waitOnOpts = {
      resources: [urlToWaitOn],
      timeout: upTimeout,
      auth: u.username
        ? { username: u.username, password: u.password }
        : undefined,
    };
    await waitOn(waitOnOpts);
  } catch (err) {
    logger.error(`failed when waiting on the url to become available\n${err}`);
    audit.markCompleted();
    return audit;
  }

  let browser: puppeteer.Browser;
  try {
    logger.debug('Launching Chrome with Puppeteer ...');
    if (!includesPartial(puppeteerArgs, '--remote-debugging-port')) {
      puppeteerArgs.push(`--remote-debugging-port=${chromePort}`);
    }
    if (!includesPartial(puppeteerArgs, '--no-sandbox')) {
      puppeteerArgs.push('--no-sandbox');
    }
    const puppeteerOptions: puppeteer.PuppeteerNodeLaunchOptions = {
      args: puppeteerArgs,
    };
    if (chromePath) {
      puppeteerOptions.executablePath = chromePath;
    }
    browser = await puppeteer.launch(puppeteerOptions);
  } catch (err) {
    logger.error(`failed to launch puppeteer browser.\n${err}`);
    audit.markCompleted();
    return audit;
  }

  try {
    logger.debug('Running Lighthouse audit ...');
    const results = await lighthouse(
      url,
      {
        port: chromePort,
        disableStorageReset: true,
      },
      {
        extends: 'lighthouse:default',
        ...lighthouseConfig,
      },
    );

    const { lhr } = results;
    if (!lhr) {
      throw new Error('Lighthouse audit did not return a valid report.');
    }

    logger.info('Lighthouse audit run finished successfully.');
    audit.updateWithReport(lhr);
  } catch (err) {
    logger.error(`failed while running lighthouse audit.\n${err}`);
    audit.markCompleted();
  } finally {
    browser.close();
  }

  return audit;
}

export const getAudits = listResponseFactory<AuditListItem>(
  async (...args) => (await retrieveAuditList(...args)).map(a => a.listItem),
  retrieveAuditCount,
);
