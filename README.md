# Repo Maintenance Notes

This Repo is a fork of the [@spotify/lighthouse-audit-service](https://github.com/spotify/lighthouse-audit-service) repo.
All of the documentation after this section is from their original repo. I just wanted to add a section quickly listing
the branches of importance & how to use this repo.

- **master** - the main branch of this repo. If you have changes that you want to be able to use in fender, put up a PR
  against this branch like you would for any other repo & get approval and such as usual.
- **release_branch** - this branch contains an additional commit that we don't want in master (since it adds some
  otherwise-hidden folders to the repo) but is necessary for the fork to work in fender. The last commit on this branch
  should always match the commit hash at the end of https://github.com/klaviyo/fender/blob/master/backend/services/server-forms-performance-test/package.json#L13.
  Once you merge a change into master, to "release" it to fender, rebase this branch off of master and (if necessary)
  update the commit hash in fender to match the latest one in this branch in order for your changes to be accessible.
- **20220519_allow_user_to_pass_in_puppeteer_args** - this branch should _not_ be modified; it's currently being used
  in a PR against the original repo; once it hopefully gets merged in, we won't need to use this forked repo anymore.

# Lighthouse Audit Service

[![Actions Status](https://github.com/spotify/lighthouse-audit-service/workflows/Tests/badge.svg)](https://github.com/spotify/web-scripts/actions)
[![Version](https://img.shields.io/npm/v/@spotify/lighthouse-audit-service.svg)](https://www.npmjs.com/package/@spotify/lighthouse-audit-service)

A service meant to help you run, schedule, store, and monitor Lighthouse reports over time. The API is built with [Backstage](https://backstage.io) in mind, but can be used without!

## Usage

### With Docker

The simplest way to deploy the app is with [our image on Docker Hub](https://hub.docker.com/r/spotify/lighthouse-audit-service).

```sh
docker run spotify/lighthouse-audit-service:latest
```

Be sure to see "Configuring Postgres" - you will likely need to configure the Postgres credentials, even when trying the app out locally. A list of supported environment variables:

- `LAS_PORT`: which port to run the service on
- `LAS_CORS`: if true, enables the [cors express middleware](https://expressjs.com/en/resources/middleware/cors.html).
- all [environment variables from pg](https://node-postgres.com/features/connecting#Environment%20variables), which should be used to set credentials for accessing the db.

#### With Docker Compose

A simple way to trial this tool is with the following docker compose file which spins up a postgres container and connects it with the lighthouse image. This would not be a great way to run this in a production environment, but a fast way to test out this tool and see if it meets your needs.

```yaml
# docker-compose.yml
version: '3.1'

services:
  db:
    image: postgres:latest
    restart: always
    environment:
      POSTGRES_USER: dbuser
      POSTGRES_PASSWORD: example

  lighthouse:
    image: spotify/lighthouse-audit-service:latest
    environment:
      PGHOST: db
      PGUSER: dbuser
      PGPASSWORD: example
      LAS_PORT: 4008
    ports:
      - '4008:4008'
```

### As an npm package

Install the project:

```sh
yarn add @spotify/lighthouse-audit-service
```

Then, you may either start up the server as a standalone process:

```js
import { startServer } from '@spotify/lighthouse-audit-service';

startServer({
  port: 8080,
  cors: true,
  postgresConfig: {
    db: 'postgres',
    database: 'mydb',
    password: 'secretpassword',
    port: 3211,
  },
});
```

### As an express app

You may nest the [express app](https://expressjs.com/) that the lighthouse-audit-service exposes inside of another express app as a subapp by using `getApp` and `app.use()`:

```js
import express from 'express';
import { getApp as getLighthouseAuditServerApp } from '@spotify/lighthouse-audit-service';

async function startup() {
  const app = express();
  const lighthouseServer = await getLighthouseAuditServerApp();

  app.use('/lighthouse', lighthouseServer);

  const server = app.listen(4000, () => {
    console.log(
      'listening on 4000 - http://localhost:4000/lighthouse/v1/websites',
    );
  });

  // be sure to `.get()` the connection and end it as you close your custom server.
  server.on('close', () => {
    lighthouseServer.get('connection').end();
  });
}

startup();
```

### Configuring Postgres

You will need a Postgres database for lighthouse-audit-service to use to manage the stored audits. The database will be configured on app startup, so you need only initialize an empty database and provide credentials to lighthouse-audit-service.

You can set the Postgres credentials up either by setting [environment variables, which will be interpreted by pg](https://node-postgres.com/features/connecting#Environment%20variables):

```sh
PGUSER=dbuser \
PGHOST=database.server.com \
PGPASSWORD=secretpassword \
PGDATABASE=mydb \
PGPORT=3211 yarn start
```

..or, by [passing the config in programmatically](https://node-postgres.com/features/connecting#Programmatic) as `postgresConfig`:

```js
import { startServer } from '@spotify/lighthouse-audit-service';

startServer({
  port: 8080,
  cors: true,
  postgresConfig: {
    database: 'mydb',
    host: 'my.db.host',
    user: 'dbuser',
    password: 'secretpassword',
    port: 3211,
  },
});
```

Both `startServer` and `getApp` support this. Further, both of these methods support optionally passing a [pg client](https://node-postgres.com/) as an optional second argument.

```js
import { Pool } from 'pg';
const conn = new Pool();
startServer({}, conn);
```

## API

We offer a REST API, as well as some programmatic ways, to interact with lighthouse-audits-service.

### REST

We are currently [seeking contributions](https://github.com/spotify/lighthouse-audit-service/issues/23) on documenting the API in a sustainable way (aka with Swagger/OpenAPI, preferably generated). For now, the REST API includes:

#### Audit routes

- `GET /v1/audits` - list of all audits run
- `GET /v1/audits/:auditId` - get an audit, either as HTML or JSON depending on the `Accept` header of the request.
- `POST /v1/audits` - trigger a new audit
  - expected JSON payload:
    - `url: string` - url to audit
    - `options` - all optional
      - `awaitAuditCompleted: boolean` - makes awaiting `triggerAudit` wait until the audit has completed. By default, the audit runs in the background.
      - `upTimeout: number` - time in ms to wait for your site to be up (default 30000). We test that your URL is reachable before triggering Lighthouse (useful if this Lighthouse test will run for an ephemeral URL).
      - `chromePort: number` - chrome port for puppeteer to use
      - `chromePath: string` - chrome path for puppeteer to use
      - `lighthouseConfig: LighthouseConfig` - custom [Lighthouse config](https://github.com/GoogleChrome/lighthouse/blob/master/docs/configuration.md) to be used when running the audit.
- `DELETE /v1/audits/:auditId` - delete an audit

#### Website routes

- `GET /v1/websites` - list of audits grouped by url
- `GET /v1/websites/:websiteUrl` - get the audits associated with this url. _be sure to uri encode that url!_
- `GET /v1/audits/:auditId/website` - get the group of audits associated with the url used for this audit.

### Programatic

All of the API methods exposed on REST are also exposed programmatically.

#### Server

- `startServer(options?, conn?)` - start REST server
- `getApp(options?, conn?)` - return express app, ready to be started

#### Audit methods

- `getAudits(conn, listOptions?)` - list of all audits run
  - listOptions (all optional):
    - `limit` and `offset` for pagination
    - `where: SQLStatement` - using [sql-template-strings](https://www.npmjs.com/package/sql-template-strings), create a custom `WHERE` to inject into the query.
- `getAudit(conn, auditId)` - retrieve an Audit by id.
- `triggerAudit(conn, url, options?)` - trigger a new audit.
  - options (all optional):
    - `awaitAuditCompleted: boolean` - makes awaiting `triggerAudit` wait until the audit has completed. By default, the audit runs in the background.
    - `upTimeout: number` - time in ms to wait for your site to be up (default 30000). We test that your URL is reachable before triggering Lighthouse (useful if this Lighthouse test will run for an ephemeral URL).
    - `chromePort: number` - chrome port for puppeteer to use
    - `chromePath: string` - chrome path for puppeteer to use
    - `lighthouseConfig: LighthouseConfig` - custom [Lighthouse config](https://github.com/GoogleChrome/lighthouse/blob/master/docs/configuration.md) to be used when running the audit.
- `deleteAudit(conn, auditId)` - delete an Audit from the DB.
- `Audit` - class used by the Audit API.
  - properties:
    - `url: string`: the original url when the audit was requested
    - `status: string`: the status of the audit; `COMPLETED`, `FAILED`, or `RUNNING`
    - `timeCreated: string`: ISO-8601 time when the audit was created
    - `timeCompleted: string?`: nullable ISO 8601 time when the audit was completed, if it has completed
    - `report: LHR?`: nullable [LHR](https://github.com/GoogleChrome/lighthouse/blob/master/docs/understanding-results.md#lighthouse-result-object-lhr) object which contains the full Lighthouse audit.
      - rendering the HTML for an LHR [can be done programmatically by the Lighthouse package](). The lighthouse-audit-service REST API does this automatically.
    - `categories: LHRCategories`: nullable map of categories, stripped down to only include the scores. useful for lists of audits, when trying to keep the payload to a reasonable size.

#### Website methods

- `getWebsites(conn, listOptions?)` - list of audits grouped by url
  - listOptions (all optional):
    - `limit` and `offset` for pagination
    - `where: SQLStatement` - using [sql-template-strings](https://www.npmjs.com/package/sql-template-strings), create a custom `WHERE` to inject into the query.
- `getWebsiteByAuditId(conn, auditId)` - get Website associated with this audit.
- `getWebsiteByUrl()` - get Website associated with this url.
- `Website` - class used by the Website API.
  - properties:
    - `url: string`: the audited url
    - `audits: Audit[]`: list of Audits for that URL.

## Contributing

This project adheres to the [Open Code of Conduct][code-of-conduct]. By participating, you are expected to honor this code.

Publish should occur on merge using [web-scripts] and [semantic-release]. Please use conventional commits to signal what the new version should be.

External contributions and issues are welcome!

## License

Copyright 2020 Spotify AB.

Licensed under the Apache License, Version 2.0: http://www.apache.org/licenses/LICENSE-2.0

[code-of-conduct]: https://github.com/spotify/code-of-conduct/blob/master/code-of-conduct.md
[web-scripts]: https://github.com/spotify/web-scripts
[semantic-release]: https://github.com/semantic-release/semantic-release
