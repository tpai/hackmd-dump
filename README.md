Hackmd Dump
===

You can schedule a routine backup job for hackmd.

## Usage

Define env variables

```
cp .env.example .env
```

Launch service in local

```
docker-compose up
```

## Development

Execute app in dev mode

```
yarn && yarn dev
```

## Deployment

You can run deploy via Kubernetes, but make sure `.env` is well-defined.

```
yarn deploy
```
