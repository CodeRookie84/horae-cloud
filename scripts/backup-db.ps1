<#
.SYNOPSIS
  Backs up the Horae Supabase Postgres database to a timestamped, zipped file.

.DESCRIPTION
  Uses the Supabase CLI's `db dump` (no local pg_dump / Postgres install needed).
  Produces THREE SQL files per run — roles, schema, and data — and zips them into
  one archive. Old archives past the retention window are deleted.

  Restoring later: unzip, then run (against a fresh/target DB), in order:
      psql <DB_URL> -f roles.sql
      psql <DB_URL> -f schema.sql
      psql <DB_URL> -f data.sql
  (or `supabase db reset` against local, then apply the dumps).

.NOTES
  Config is read from scripts\.backup.env (gitignored). Required:
      SUPABASE_DB_URL   full Postgres connection string (see .backup.env.example)
  Optional:
      BACKUP_DIR        where to write archives (default: %USERPROFILE%\HoraeBackups)
      RETENTION_DAYS    delete archives older than this many days (default: 30)
#>

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

# --- Resolve paths -----------------------------------------------------------
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$EnvFile   = Join-Path $ScriptDir ".backup.env"

# --- Load .backup.env (KEY=VALUE lines) --------------------------------------
if (Test-Path $EnvFile) {
    Get-Content $EnvFile | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
            $k, $v = $line.Split("=", 2)
            Set-Item -Path "Env:$($k.Trim())" -Value $v.Trim()
        }
    }
}

$DbUrl         = $env:SUPABASE_DB_URL
$BackupDir     = if ($env:BACKUP_DIR)     { $env:BACKUP_DIR }     else { Join-Path $env:USERPROFILE "HoraeBackups" }
$RetentionDays = if ($env:RETENTION_DAYS) { [int]$env:RETENTION_DAYS } else { 30 }

if (-not $DbUrl) {
    Write-Error "SUPABASE_DB_URL is not set. Copy scripts\.backup.env.example to scripts\.backup.env and fill it in."
    exit 1
}

# --- Locate the Supabase CLI -------------------------------------------------
$SupabaseCmd = Get-Command supabase -ErrorAction SilentlyContinue
$Supabase = if ($SupabaseCmd) { $SupabaseCmd.Source } else { $null }
if (-not $Supabase) {
    foreach ($p in @("$env:USERPROFILE\scoop\shims\supabase.exe",
                     "$env:LOCALAPPDATA\Microsoft\WinGet\Links\supabase.exe",
                     "C:\Program Files\Supabase\supabase.exe")) {
        if (Test-Path $p) { $Supabase = $p; break }
    }
}
if (-not $Supabase) { Write-Error "supabase CLI not found on PATH."; exit 1 }

# --- Prepare output ----------------------------------------------------------
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
$Stamp   = Get-Date -Format "yyyy-MM-dd_HHmmss"
$WorkDir = Join-Path $env:TEMP "horae-backup-$Stamp"
New-Item -ItemType Directory -Force -Path $WorkDir | Out-Null
$LogFile = Join-Path $BackupDir "backup.log"

function Log($msg) {
    $stampedMsg = "$(Get-Date -Format s)  $msg"
    Write-Host $stampedMsg
    Add-Content -Path $LogFile -Value $stampedMsg -Encoding utf8
}

try {
    Log "Backup started -> $BackupDir"

    $roles  = Join-Path $WorkDir "roles.sql"
    $schema = Join-Path $WorkDir "schema.sql"
    $data   = Join-Path $WorkDir "data.sql"

    Log "Dumping roles..."
    & $Supabase db dump --db-url $DbUrl --role-only -f $roles
    if ($LASTEXITCODE -ne 0) { throw "role dump failed (exit $LASTEXITCODE)" }

    Log "Dumping schema..."
    & $Supabase db dump --db-url $DbUrl -f $schema
    if ($LASTEXITCODE -ne 0) { throw "schema dump failed (exit $LASTEXITCODE)" }

    Log "Dumping data..."
    & $Supabase db dump --db-url $DbUrl --data-only -f $data
    if ($LASTEXITCODE -ne 0) { throw "data dump failed (exit $LASTEXITCODE)" }

    $archive = Join-Path $BackupDir "horae-backup-$Stamp.zip"
    Log "Zipping -> $archive"
    Compress-Archive -Path "$WorkDir\*.sql" -DestinationPath $archive -Force
    $sizeMB = [math]::Round((Get-Item $archive).Length / 1MB, 2)
    Log "OK - archive is $sizeMB MB"

    # --- Retention -----------------------------------------------------------
    $cutoff = (Get-Date).AddDays(-$RetentionDays)
    Get-ChildItem $BackupDir -Filter "horae-backup-*.zip" |
        Where-Object { $_.LastWriteTime -lt $cutoff } |
        ForEach-Object { Log "Pruning old backup: $($_.Name)"; Remove-Item $_.FullName -Force }

    Log "Backup finished successfully."
}
catch {
    Log "ERROR: $_"
    exit 1
}
finally {
    Remove-Item -Recurse -Force $WorkDir -ErrorAction SilentlyContinue
}
