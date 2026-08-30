<#
.SYNOPSIS
  Registers a daily Windows Scheduled Task that runs backup-db.ps1.

.DESCRIPTION
  Creates a task named "Horae DB Backup" that runs every day at the given time
  (default 02:30) whether or not you are logged in. Re-running this script updates
  the existing task.

  RUN THIS FROM AN ELEVATED (Administrator) PowerShell — registering a task that
  runs "whether logged in or not" requires admin rights.

.PARAMETER Time
  24h HH:mm to run daily. Default "02:30".

.EXAMPLE
  # In an Administrator PowerShell:
  powershell -ExecutionPolicy Bypass -File .\scripts\register-backup-task.ps1 -Time 02:30
#>

param([string]$Time = "02:30")

$ErrorActionPreference = "Stop"
$ScriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackupPs1  = Join-Path $ScriptDir "backup-db.ps1"
$TaskName   = "Horae DB Backup"

if (-not (Test-Path $BackupPs1)) { Write-Error "backup-db.ps1 not found next to this script."; exit 1 }

$action  = New-ScheduledTaskAction -Execute "powershell.exe" `
             -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$BackupPs1`""
$trigger = New-ScheduledTaskTrigger -Daily -At $Time
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopOnIdleEnd `
             -RunOnlyIfNetworkAvailable

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger `
    -Settings $settings -Description "Daily Supabase DB dump for Horae" `
    -RunLevel Highest -Force | Out-Null

Write-Host "Registered scheduled task '$TaskName' to run daily at $Time."
Write-Host "Test it now with:  Start-ScheduledTask -TaskName '$TaskName'"
Write-Host "Check history in Task Scheduler, or tail the log in your BACKUP_DIR\backup.log"
