#!/usr/bin/env bash
# Dumps your Supabase Postgres database to a compressed file you can restore anywhere.
#   DATABASE_URL='postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres' scripts/backup-db.sh
# Use the "Session pooler" connection string (port 5432) from Supabase > Project Settings > Database > Connect.
# Needs the PostgreSQL client tools (pg_dump), version >= your Supabase server's (see Settings > Infrastructure).
# What it saves: all your tables (products, categories, links, clicks, subscribers, messages, settings, admin_profiles, saved_items).
# What it does NOT save: Storage files (use `npm run backup:images`) and Supabase Auth users (accounts in the auth schema).
set -euo pipefail
: "${DATABASE_URL:?Set DATABASE_URL to your Supabase connection string}"
mkdir -p "${BACKUP_DIR:-backups/db}"
F="${BACKUP_DIR:-backups/db}/studio-south-$(date -u +%Y%m%d-%H%M%S).sql.gz"
pg_dump "$DATABASE_URL" --schema=public --no-owner --no-privileges --clean --if-exists | gzip -9 > "$F"
test "$(gzip -dc "$F" | grep -c '^CREATE TABLE')" -ge 5 || { echo "Backup looks empty or incomplete: $F" >&2; exit 1; }
echo "Backup written: $F ($(du -h "$F" | cut -f1))"
# keep the newest 12, delete older ones
ls -1t "${BACKUP_DIR:-backups/db}"/*.sql.gz 2>/dev/null | tail -n +13 | xargs -r rm -f
