# Deploying to a Hostinger VPS

Tested on Ubuntu 22.04/24.04 (Hostinger "KVM" VPS plans). Recommended minimum: **2 vCPU, 4 GB RAM**.

## 1. Prepare the server

SSH in as root (Hostinger hPanel → VPS → SSH access), then:

```bash
# Create a deploy user
adduser deploy && usermod -aG sudo deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy
# Firewall
ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw enable
```

Log in as `deploy` for the remaining steps.

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git nginx postgresql postgresql-contrib certbot python3-certbot-nginx
# Node.js 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

## 2. Database setup

```bash
sudo -u postgres psql <<'SQL'
CREATE USER mathsolver WITH PASSWORD 'REPLACE_WITH_STRONG_PASSWORD';
CREATE DATABASE mathsolver OWNER mathsolver;
SQL
```

PostgreSQL listens only on localhost by default — keep it that way.

## 3. Get the code

```bash
sudo mkdir -p /var/www/ai-math-solver /var/log/ai-math-solver
sudo chown -R deploy:deploy /var/www/ai-math-solver /var/log/ai-math-solver
git clone https://github.com/<you>/ai-math-solver.git /var/www/ai-math-solver
cd /var/www/ai-math-solver
cp .env.example .env
nano .env
```

## 4. Environment variables

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | ✅ | `https://yourdomain.com` (no trailing slash) |
| `DATABASE_URL` | ✅ | `postgresql://mathsolver:PASSWORD@localhost:5432/mathsolver?schema=public` |
| `NEXTAUTH_URL` | ✅ | Same as site URL |
| `NEXTAUTH_SECRET` | ✅ | `openssl rand -base64 32` |
| `ADMIN_EMAILS` | ✅ | Emails promoted to admin |
| `ANTHROPIC_API_KEY` | recommended | Enables AI explanations, tutor, photo OCR, word problems |
| `AI_MODEL` | – | Default `claude-opus-5-5` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | – | Google login. Redirect URI: `https://yourdomain.com/api/auth/callback/google` |
| `UPLOAD_DIR` | – | Default `./storage/uploads` (use an absolute path, e.g. `/var/www/ai-math-solver/storage/uploads`) |
| `CRON_SECRET` | ✅ | Random string for the cleanup endpoint |
| `STRIPE_*`, `NEXT_PUBLIC_STRIPE_ENABLED` | – | Billing (see below) |
| `RATE_LIMIT_STORE` | – | `memory` (single process) or `database` (multiple processes/servers) |
| `NEXT_PUBLIC_GA_ID` | – | Google Analytics 4 |

## 5. Build commands

```bash
npm ci
npx prisma migrate deploy
SEED_ADMIN_PASSWORD='a-strong-admin-password' npm run db:seed
npm run build
cp -r .next/static .next/standalone/.next/
cp -r public .next/standalone/
cp .env .next/standalone/.env
mkdir -p storage/uploads
```

## 6. Run with PM2

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup systemd   # run the printed command so the app starts on boot
curl -s http://127.0.0.1:3000/api/health
```

## 7. Domain configuration

In Hostinger hPanel → **Domains → DNS / Nameservers** (or your registrar):

| Type | Name | Value |
|---|---|---|
| A | @ | your VPS IPv4 |
| A | www | your VPS IPv4 |
| AAAA | @ | your VPS IPv6 (optional) |

Wait for DNS to propagate (`dig +short yourdomain.com`).

## 8. Nginx + SSL

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/ai-math-solver
sudo sed -i 's/example.com/yourdomain.com/g' /etc/nginx/sites-available/ai-math-solver
sudo ln -s /etc/nginx/sites-available/ai-math-solver /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# Free Let's Encrypt certificate with automatic HTTP→HTTPS redirect and renewal
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com --redirect
sudo certbot renew --dry-run
```

## 9. Scheduled jobs (cron)

```bash
crontab -e
```

```cron
# Hourly cleanup of expired uploads, rate-limit buckets and old guest data
0 * * * * curl -fsS -H "Authorization: Bearer YOUR_CRON_SECRET" https://yourdomain.com/api/cron/cleanup > /dev/null
# Nightly database backup at 03:00
0 3 * * * APP_DIR=/var/www/ai-math-solver /var/www/ai-math-solver/deploy/backup.sh >> /var/log/ai-math-solver/backup.log 2>&1
```

## 10. Backups

`deploy/backup.sh` writes gzipped `pg_dump` files to `/var/backups/ai-math-solver` and keeps 14 days. Also:

- Enable **Hostinger VPS snapshots/weekly backups** in hPanel.
- Copy dumps off-site (e.g. `rclone copy` to S3/Backblaze/Google Drive).
- **Restore:** `gunzip -c db_YYYY-MM-DD_HHMM.sql.gz | psql "postgresql://mathsolver:PASSWORD@localhost:5432/mathsolver"`

## 11. Stripe (when you are ready to charge)

1. Create products **Premium** and **Education** with monthly and yearly prices; copy the price IDs into `STRIPE_PRICE_*`.
2. Add `STRIPE_SECRET_KEY` and set `NEXT_PUBLIC_STRIPE_ENABLED=true`.
3. Webhook endpoint: `https://yourdomain.com/api/stripe/webhook` with events `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`. Put the signing secret in `STRIPE_WEBHOOK_SECRET`.
4. Enable the Customer Portal in Stripe settings.
5. Rebuild & reload.

## 12. Updating

```bash
cd /var/www/ai-math-solver && ./deploy/deploy.sh
```

## Alternative: Docker

```bash
echo "POSTGRES_PASSWORD=$(openssl rand -hex 16)" >> .env
docker compose up -d --build
# Seed content + admin (one-off container on the compose network; the app image has no dev tooling)
docker run --rm --network "$(basename "$PWD")_default" -v "$PWD":/src -w /src \
  -e DATABASE_URL="postgresql://mathsolver:$POSTGRES_PASSWORD@db:5432/mathsolver?schema=public" \
  -e ADMIN_EMAILS="you@yourdomain.com" -e SEED_ADMIN_PASSWORD="a-strong-password" \
  node:22 sh -c "npm ci && npm run db:seed"
```

Then use the same Nginx/Certbot setup (the app listens on `127.0.0.1:3000`).

## Troubleshooting

| Symptom | Fix |
|---|---|
| 502 Bad Gateway | `pm2 logs ai-math-solver`; check `.env` and that the build finished |
| CSS/JS 404 after deploy | You forgot to copy `.next/static` into `.next/standalone/.next/` |
| Google login error `redirect_uri_mismatch` | Add the exact callback URL in Google Cloud Console |
| Tutor responses arrive all at once | Make sure the Nginx `/api/` block has `proxy_buffering off` |
| Photo upload "413" | Raise `client_max_body_size` in Nginx |
