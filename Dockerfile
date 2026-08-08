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
# `prisma` (the CLI) is a devDependency, so a fresh `npm install --omit=dev` here wouldn't
# have it locally — `npx prisma generate` would then silently fetch the *latest* CLI from the
# registry instead of the pinned 5.22.0, generating an engine binary that doesn't match
# @prisma/client's version and crash-looping at runtime. Generating once in `build` (which has
# the full, correctly pinned toolchain) and copying the result here avoids that entirely.
RUN npm install --omit=dev
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/dist ./dist

FROM runtime AS api
EXPOSE 3000
CMD ["node", "dist/main"]

FROM runtime AS workers
CMD ["node", "dist/worker"]
