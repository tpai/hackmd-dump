FROM node:20 AS build-env
COPY . /app
WORKDIR /app

RUN yarn install --production

FROM gcr.io/distroless/nodejs20-debian11
COPY --from=build-env /app /app
WORKDIR /app
CMD ["index.js"]
