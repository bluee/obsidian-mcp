FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY src ./src
COPY tsconfig.json ./

RUN npx tsc

ENV HOST=0.0.0.0

EXPOSE 3000

ENTRYPOINT ["node", "build/main.js", "--http"]
