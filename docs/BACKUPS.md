# Backups

**Supabase Free does not give you downloadable automatic backups** (daily backups are a paid-plan feature). If the project is deleted, corrupted, or paused for too long, you are on your own. These procedures make you independent of that. The migration files in `supabase/migrations/` recreate the *structure*; you need backups for the *data*.

## What to back up
| Data | How | Not covered |
|---|---|---|
| Tables (products, categories, links, clicks, subscribers, messages, site settings, admin_profiles, saved_items) | `scripts/backup-db.sh` (pg_dump of `public`) | Supabase **Auth users** (the `auth` schema: shopper/admin accounts) |
| Images | `npm run backup:images` (downloads the whole bucket, incremental) | |
| Config | Keep `.env` values in a password manager | |

Re-creating Auth users is not possible from the dump; shoppers can simply sign in again with Google (they get new accounts, so their saved items are lost). The admin must be re-added to `admin_profiles` (see LAUNCH.md).

## Database backup
1. Supabase > Connect > **Session pooler** connection string (port 5432). Put it in `DATABASE_URL`.
2. Install PostgreSQL client tools (`pg_dump`, version >= your server's).
3. `DATABASE_URL='...' scripts/backup-db.sh` writes `backups/db/studio-south-<time>.sql.gz` and keeps the newest 12.
Tested here against PostgreSQL 16: backup, restore into an empty database, row counts identical (50,000 products / 99,800 links / 100,000 clicks). Restoring into a *new Supabase project* was not tested: run the migrations first, then restore data (use `--data-only` if you hit "already exists" errors).

## Image backup
`SUPABASE_STORAGE_BUCKET=product-images npm run backup:images -- /path/to/backups/images` (needs URL + service key). It skips files already downloaded, so weekly runs are quick. Tested against a mock Storage API (nested folders, incremental run); not run against your real bucket.
Alternative (no code): Supabase Storage supports an S3-compatible endpoint; `rclone sync` works against it (set up per Supabase docs).

## Practical schedule
| When | What |
|---|---|
| Weekly (e.g. Sunday) | `backup-db.sh` and `backup:images` |
| Before any bulk change (backfill, big import, migration) | `backup-db.sh` first |
| Monthly | Copy the newest backup **off your computer** (private cloud drive, encrypted) |
| Quarterly | **Test a restore** into a scratch database. An untested backup is a hope, not a backup |

Keep at least one copy that is not on the machine you work on. Backups contain subscriber e-mail addresses and messages: treat them as personal data, store them encrypted, and delete old ones.

## Automating (optional, example only, not tested)
`docs/examples/backup-workflow.yml` is a GitHub Actions workflow that runs the dump weekly and encrypts it. Use a **private** repository, store `DATABASE_URL` and the passphrase as repository secrets, and download the artifact monthly.

## Restore outline
1. New Supabase project (or the same one) -> run migrations `0001`...`0007` in order.
2. `gzip -dc backup.sql.gz | psql "$DATABASE_URL"` (expect harmless "already exists" noise if tables exist).
3. Re-upload the images bucket (`product-images`, public) from your backup folder (Supabase dashboard upload or S3/rclone), keeping the same paths so database URLs still match. If the project URL changed, update URLs in `products.main_image_url`, `product_images.url`, `categories.image_url`.
4. Re-add your admin row; set Render env vars to the new project's keys; redeploy.
