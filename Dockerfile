# everything below sets up and runs lighthouse
FROM node:12

WORKDIR /app

# Install latest chrome dev package and fonts to support major charsets (Chinese, Japanese, Arabic, Hebrew, Thai and a few others)
# Note: this installs the necessary libs to make the bundled version of Chromium that Puppeteer
# installs, work.
RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
  && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
  && apt-get update \
  && apt-get install -y google-chrome-unstable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf \
  --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD true
ENV CHROME_PATH "google-chrome-unstable"

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD true

# do this instead of COPY node_modules to
# keep image as small as possible
COPY package.json /app
COPY yarn.lock app/
RUN yarn install --production

# yarn build must be run before building the docker container.
COPY cjs /app/cjs

ENTRYPOINT [ "yarn" ]
CMD [ "start" ]
