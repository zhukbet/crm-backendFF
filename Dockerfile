# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
# package-lock.json is intentionally not committed (see the repo's git-workflow notes in
# README), so `npm ci` isn't an option here — same reasoning as .github/workflows/ci.yml.
RUN npm install

FROM base AS build
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY prisma ./prisma
RUN npm install --omit=dev && npx prisma generate
COPY --from=build /app/dist ./dist

FROM runtime AS api
EXPOSE 3000
CMD ["node", "dist/main"]

FROM runtime AS workers
CMD ["node", "dist/worker"]
