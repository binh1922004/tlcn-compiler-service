FROM node:22-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install

FROM node:22-alpine
COPY . .
CMD ["npm", "run", "dev"]