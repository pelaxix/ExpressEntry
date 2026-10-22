param([string]$DataDir = 'D:\DevData\ExpressEntry', [switch]$InstallTask)
$ErrorActionPreference = 'Stop'
$ProjectDir = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectDir
$NodeMajor = [int]((& node --version).TrimStart('v').Split('.')[0])
if ($NodeMajor -lt 24) { throw 'Install Node.js 24 LTS or newer, then run setup again.' }
New-Item -ItemType Directory -Force -Path $DataDir | Out-Null
$ConfigPath = Join-Path $DataDir '.env'
if (-not (Test-Path $ConfigPath)) {
    $RandomBuffer = New-Object byte[] 24
    $Rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    $Rng.GetBytes($RandomBuffer)
    $Rng.Dispose()
    $AdminPassword = [Convert]::ToBase64String($RandomBuffer)
    $Config = @"
HOST=127.0.0.1
PORT=31007
PUBLIC_URL=https://ee.pelaxix.com
POLL_MINUTES=5
ADMIN_PASSWORD=$AdminPassword
BREVO_API_KEY=
ALERT_FROM_EMAIL=
"@
    [IO.File]::WriteAllText($ConfigPath, $Config, (New-Object Text.UTF8Encoding($false)))
    Write-Host "Configuration created: $ConfigPath"
    Write-Host "Administrator password: $AdminPassword"
    Write-Host 'Keep this password private. It is also saved in the configuration file.'
}
if (Test-Path (Join-Path $ProjectDir 'package-lock.json')) { & npm.cmd ci } else { & npm.cmd install }
if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
& npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'Build failed.' }
$env:DATA_DIR = $DataDir
if ($InstallTask) {
    $IsAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if (-not $IsAdmin) { throw 'Run PowerShell as Administrator to install the startup task.' }
    $NodePath = (Get-Command node.exe).Source
    $Runner = Join-Path $ProjectDir 'scripts\run.ps1'
    $Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$Runner`" -DataDir `"$DataDir`" -NodePath `"$NodePath`""
    $Action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $Arguments -WorkingDirectory $ProjectDir
    $Trigger = New-ScheduledTaskTrigger -AtStartup
    $Principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
    $Settings = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -StartWhenAvailable -MultipleInstances IgnoreNew
    Register-ScheduledTask -TaskName 'Pelaxix-ExpressEntry' -Action $Action -Trigger $Trigger -Principal $Principal -Settings $Settings -Force | Out-Null
    Start-ScheduledTask -TaskName 'Pelaxix-ExpressEntry'
    Write-Host 'Startup task installed and started: Pelaxix-ExpressEntry'
} else {
    Write-Host 'Ready. Start in this window with: .\scripts\run.ps1'
    Write-Host 'To run after reboot: rerun setup.ps1 -InstallTask from an elevated PowerShell.'
}
Write-Host "Add your Brevo key and verified sender to $ConfigPath, then restart the app."
Write-Host 'Open https://ee.pelaxix.com > Notifications, sign in, save your email address and enable alerts.'
