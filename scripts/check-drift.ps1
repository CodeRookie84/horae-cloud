<#
.SYNOPSIS
  Docker-free check that your migrations match the LIVE database schema.

.DESCRIPTION
  `supabase db diff` needs Docker (a shadow database). This does not: it dumps the
  live schema via the Supabase CLI and lists every schema object (tables, columns,
  functions, policies, indexes) so you can compare it against supabase\migrations\.

  It writes the live schema to scripts\_drift\live_schema.sql and prints a summary.
  Reads SUPABASE_DB_URL from scripts\.backup.env (same as backup-db.ps1).

  For a true line-by-line diff, install Docker Desktop and run instead:
      supabase db diff --linked --schema public
#>

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$EnvFile   = Join-Path $ScriptDir ".backup.env"
if (Test-Path $EnvFile) {
    Get-Content $EnvFile | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
            $k, $v = $line.Split("=", 2); Set-Item -Path "Env:$($k.Trim())" -Value $v.Trim()
        }
    }
}
$DbUrl = $env:SUPABASE_DB_URL
if (-not $DbUrl) { Write-Error "SUPABASE_DB_URL not set (see .backup.env.example)."; exit 1 }

$OutDir = Join-Path $ScriptDir "_drift"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$Live = Join-Path $OutDir "live_schema.sql"

Write-Host "Dumping live schema..."
& supabase db dump --db-url $DbUrl -f $Live
if ($LASTEXITCODE -ne 0) { Write-Error "schema dump failed (exit $LASTEXITCODE)"; exit 1 }

Write-Host "`n=== Live schema objects (from $Live) ==="
$live = Get-Content $Live
Write-Host ("CREATE TABLE:    " + (($live | Select-String -Pattern 'CREATE TABLE').Count))
Write-Host ("CREATE FUNCTION: " + (($live | Select-String -Pattern 'CREATE (OR REPLACE )?FUNCTION').Count))
Write-Host ("CREATE POLICY:   " + (($live | Select-String -Pattern 'CREATE POLICY').Count))
Write-Host ("CREATE INDEX:    " + (($live | Select-String -Pattern 'CREATE (UNIQUE )?INDEX').Count))

Write-Host "`nTables in live DB:"
$live | Select-String -Pattern 'CREATE TABLE (IF NOT EXISTS )?"?(\w+)"?\."?(\w+)"?' |
    ForEach-Object { $_.Matches[0].Groups[3].Value } | Sort-Object -Unique | ForEach-Object { Write-Host "  - $_" }

Write-Host "`nCompare the above against the tables created across supabase\migrations\*.sql."
Write-Host "Saved full live schema to: $Live"
