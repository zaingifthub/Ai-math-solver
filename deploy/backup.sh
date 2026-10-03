#!/usr/bin/env bash
# Daily PostgreSQL backup with 14-day retention.
# Install: sudo cp deploy/backup.sh /usr/local/bin/ams-backup && sudo chmod +x /usr/local/bin/ams-backup
# Cron:    0 3 * * * /usr/local/bin/ams-backup >> /var/log/ai-math-solver/backup.log 2>&1
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/ai-math-solver}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/ai-math-solver}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

# Read DATABASE_URL from the app's .env
DATABASE_URL="$(grep -E '^DATABASE_URL=' "$APP_DIR/.env" | cut -d= -f2- | tr -d '"')"
DB_URL="${DATABASE_URL%%\?*}"   # strip ?schema=public for pg_dump

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y-%m-%d_%H%M)"
FILE="$BACKUP_DIR/db_$STAMP.sql.gz"

pg_dump --no-owner --no-privileges "$DB_URL" | gzip -9 > "$FILE"
chmod 600 "$FILE"
echo "$(date -Is) backup written: $FILE ($(du -h "$FILE" | cut -f1))"

find "$BACKUP_DIR" -name 'db_*.sql.gz' -mtime "+$RETENTION_DAYS" -delete

# Optional off-site copy (configure rclone first): rclone copy "$FILE" remote:ams-backups/
