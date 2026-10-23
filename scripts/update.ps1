param([string]$DataDir = 'D:\DevData\ExpressEntry')
$ErrorActionPreference = 'Stop'
$ProjectDir = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectDir
$Task = Get-ScheduledTask -TaskName 'Pelaxix-ExpressEntry' -ErrorAction SilentlyContinue
if ($Task) { Stop-ScheduledTask -TaskName 'Pelaxix-ExpressEntry'; Start-Sleep -Seconds 2 }
try {
    # Stopping a PowerShell scheduled task can leave its Node child alive.
    # Match this project's absolute entry point so other Node apps are untouched.
    $ServerEntry = Join-Path $ProjectDir 'server\index.mjs'
    $EntryPattern = '(?i)(?:"|\s)' + [regex]::Escape($ServerEntry) + '(?:"|\s|$)'
    $NodeProcesses = Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
        Where-Object { $_.CommandLine -and $_.CommandLine -match $EntryPattern }
    foreach ($NodeProcess in $NodeProcesses) {
        Stop-Process -Id $NodeProcess.ProcessId -Force -ErrorAction SilentlyContinue
    }
    if ($NodeProcesses) { Start-Sleep -Seconds 1 }
    & git pull --ff-only
    if ($LASTEXITCODE -ne 0) { throw 'Git pull failed. Local changes were preserved.' }
    & npm.cmd ci
    if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'Build failed.' }
} finally {
    if ($Task) { Start-ScheduledTask -TaskName 'Pelaxix-ExpressEntry' }
}
Write-Host "Updated. Persistent data at $DataDir was preserved."
