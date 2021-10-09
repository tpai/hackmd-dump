FROM node:14-alpine

WORKDIR /app

COPY package.json .
COPY yarn.lock .

# Tell puppeteer to skip installing chrome
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Install dependencies
RUN yarn install --frozen-lockfile --production

# Add required assets
COPY index.js .

CMD ["node", "index.js"]
