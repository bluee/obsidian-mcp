FROM oven/bun:1 AS builder

WORKDIR /app

COPY package*.json ./
COPY bun.lockb* ./
RUN bun install

COPY src ./src
COPY tsconfig.json ./

RUN bun build ./src/main.ts --outdir build --target node

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

ENV HOST=0.0.0.0

EXPOSE 3000

ENTRYPOINT ["node", "build/main.js", "--http"]
