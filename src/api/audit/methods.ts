import lighthouse, { LighthouseConfig } from 'lighthouse';
import waitOn from 'wait-on';
import puppeteer from 'puppeteer';

import { Audit } from './models';
import { persistAudit, retrieveAuditById } from './db';
import parentLogger from '../../logger';
import { DbConnectionType } from '../../db';
import { InvalidRequestError } from '../../errors';

const DEFAULT_UP_TIMEOUT = 180000;
const DEFAULT_CHROME_PORT = 9222;

const HTTP_RE = /^https?:\/\//;

export interface AuditOptions {
  awaitAuditCompleted?: boolean;
  upTimeout?: number;
  chromePort?: number;
  chromePath?: string;
  lighthouseConfig?: LighthouseConfig;
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
  url: string,
  conn: DbConnectionType,
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
  await persistAudit(audit, conn);

  if (options.awaitAuditCompleted) {
    await runAudit(audit, options);
    await persistAudit(audit, conn);
  } else {
    // run in background
    runAudit(audit, options).then(() => persistAudit(audit, conn));
  }

  return audit;
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
    chromePath,
    lighthouseConfig = {},
  } = options;

  const logger = parentLogger.child({ url, auditId: audit.id });
  logger.info(`Starting Lighthouse audit`);

  try {
    logger.debug('Waiting for URL to be UP ...');
    const urlWithoutProtocol = url.replace(HTTP_RE, '');
    const urlToWaitOn = `http-get://${urlWithoutProtocol}`;
    const waitOnOpts = {
      resources: [urlToWaitOn],
      timeout: upTimeout,
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
    const puppeteerOptions: puppeteer.LaunchOptions = {
      args: [`--remote-debugging-port=${chromePort}`, '--no-sandbox'],
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

export async function getAudit(
  auditId: string,
  conn: DbConnectionType,
): Promise<Audit> {
  return await retrieveAuditById(auditId, conn);
}
