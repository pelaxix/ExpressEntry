param([string]$DataDir = 'D:\DevData\ExpressEntry')
$ErrorActionPreference = 'Stop'
$ProjectDir = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectDir
$Task = Get-ScheduledTask -TaskName 'Pelaxix-ExpressEntry' -ErrorAction SilentlyContinue
if ($Task) { Stop-ScheduledTask -TaskName 'Pelaxix-ExpressEntry'; Start-Sleep -Seconds 2 }
try {
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
