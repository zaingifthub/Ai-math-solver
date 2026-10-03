#!/usr/bin/env bash
# Zero-downtime-ish update on a VPS: pull, install, migrate, build, reload.
set -euo pipefail
cd "${APP_DIR:-/var/www/ai-math-solver}"

git pull --ff-only
npm ci
npx prisma migrate deploy
npm run build
# The standalone server needs the static assets and public folder next to it
cp -r .next/static .next/standalone/.next/
cp -r public .next/standalone/
cp .env .next/standalone/.env
pm2 reload ecosystem.config.cjs --update-env || pm2 start ecosystem.config.cjs
pm2 save
echo "Deployed $(git rev-parse --short HEAD)"
