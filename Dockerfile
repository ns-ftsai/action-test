FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache git

COPY package.json package-lock.json ./
RUN npm install

COPY . .

RUN npm run build

ENTRYPOINT ["node", "/app/dist/main.js"]