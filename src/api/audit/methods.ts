import lighthouse, { LighthouseResponse } from 'lighthouse';
import waitOn from 'wait-on';
import puppeteer from 'puppeteer';

import { Audit } from './models';
import { persistAudit } from './db';
import parentLogger from '../../logger';
import { DbConnectionType } from '../../db';
import { InvalidRequestError } from '../../errors';

const DEFAULT_UP_TIMEOUT = 180000;
const DEFAULT_CHROME_PORT = 9222;

const HTTP_RE = /^https?:\/\//;

export interface AuditOptions {
  url: string;
  upTimeout?: number;
  chromePort?: number;
  chromePath?: string;
  emulatedFormFactor?: string;
}

function validateAuditOptions({ url }: AuditOptions): void {
  if (!url)
    throw new InvalidRequestError(
      'No URL provided. URL is required for auditing.',
    );

  if (!HTTP_RE.test(url))
    throw new InvalidRequestError(
      `URL "${url}" does not contain a protocol (http or https).`,
    );
}

export async function triggerAudit(
  conn: DbConnectionType,
  options: AuditOptions,
): Promise<Audit> {
  validateAuditOptions(options);
  const audit = Audit.buildForUrl(options.url);
  await persistAudit(conn, audit);
  runAndPersistAudit(conn, audit, options);
  return audit;
}

async function runAndPersistAudit(
  conn: DbConnectionType,
  audit: Audit,
  options: AuditOptions,
): Promise<Audit> {
  const logger = parentLogger.child({ url: audit.url });

  try {
    const lighthouseResponse = await runAudit(options);
    audit.updateWithReport(lighthouseResponse.lhr);
  } catch (err) {
    logger.warn(`running the audit failed. marking as complete.\n${err}`);
    audit.markCompleted();
  }

  await persistAudit(conn, audit);
  return audit;
}

async function runAudit(options: AuditOptions): Promise<LighthouseResponse> {
  validateAuditOptions(options);

  const {
    url,
    upTimeout = DEFAULT_UP_TIMEOUT,
    chromePort = DEFAULT_CHROME_PORT,
    chromePath = process.env.CHROME_PATH,
    emulatedFormFactor,
  } = options;

  const logger = parentLogger.child({ url });

  const urlWithoutProtocol = url.replace(HTTP_RE, '');
  const urlToWaitOn = `http-get://${urlWithoutProtocol}`;

  const waitOnOpts = {
    resources: [urlToWaitOn],
    timeout: upTimeout,
  };

  logger.info(`Starting Lighthouse audit on url: '${url}'`);

  // wait for URL to be UP
  logger.debug('Waiting for URL to be UP ...');
  await waitOn(waitOnOpts);

  // launch Chrome with Puppeteer
  logger.debug('Launching Chrome ...');
  const puppeteerOptions: puppeteer.LaunchOptions = {
    args: [`--remote-debugging-port=${chromePort}`, '--no-sandbox'],
  };
  if (chromePath) {
    puppeteerOptions.executablePath = chromePath;
  }
  const browser = await puppeteer.launch(puppeteerOptions);

  try {
    // run Lighthouse audit
    logger.debug('Running Lighthouse audit ...');

    const results = await lighthouse(
      url,
      {
        port: chromePort,
        disableStorageReset: true,
      },
      {
        extends: 'lighthouse:default',
        settings: { emulatedFormFactor },
      },
    );

    const lighthouseAuditReport = results.lhr;
    const lighthouseAuditReportJson = results.report;

    if (!lighthouseAuditReport || !lighthouseAuditReportJson) {
      throw new Error('Lighthouse audit did not return a valid report.');
    }

    logger.info('Lighthouse audit run finished successfully.');

    return results;
  } finally {
    browser.close();
  }
}
