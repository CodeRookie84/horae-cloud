# Horae ops scripts

Backup & maintenance tooling. These scripts use the **Supabase CLI** — no local
`pg_dump` or Docker needed.

## One-time setup
1. Copy the config template and fill it in:
   ```powershell
   Copy-Item scripts\.backup.env.example scripts\.backup.env
   ```
2. Open `scripts\.backup.env` and set `SUPABASE_DB_URL` (get the URI from
   Supabase Dashboard → Project Settings → Database → Connection string).
   Point `BACKUP_DIR` at a OneDrive/Google-Drive folder so backups leave this PC.
   `.backup.env` is gitignored — it holds your DB password, never commit it.

## Run a backup manually
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\backup-db.ps1
```
Writes `horae-backup-<timestamp>.zip` (roles + schema + data) to `BACKUP_DIR`,
prunes archives older than `RETENTION_DAYS` (default 30), and logs to
`BACKUP_DIR\backup.log`.

## Schedule daily backups
Run once **in an Administrator PowerShell**:
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\register-backup-task.ps1 -Time 02:30
```
Creates/updates the "Horae DB Backup" task. Test with
`Start-ScheduledTask -TaskName 'Horae DB Backup'`.

## Check schema drift (migrations vs live DB) — no Docker
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\check-drift.ps1
```
Dumps the live schema and lists its tables/functions/policies so you can compare
against `supabase\migrations\`. For a true line-by-line diff, install Docker
Desktop and run `supabase db diff --linked --schema public`.

## Restore (outline)
Unzip an archive, then against the target DB run `roles.sql`, `schema.sql`,
`data.sql` in that order (via `psql` or the Supabase SQL editor). Test restores
periodically — an untested backup is not a backup.
