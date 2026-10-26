param([string]$DataDir = 'D:\DevData\ExpressEntry')
$ErrorActionPreference = 'Stop'
$ProjectDir = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectDir
$Task = Get-ScheduledTask -TaskName 'Pelaxix-ExpressEntry' -ErrorAction SilentlyContinue
if (-not $Task) { throw 'Scheduled task Pelaxix-ExpressEntry was not found. Run the installation script first.' }

# Prepare the new frontend without touching the files currently being served.
& git pull --ff-only
if ($LASTEXITCODE -ne 0) { throw 'Git pull failed. The running server was not stopped.' }
& npm.cmd ci
if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed. The running server was not stopped.' }
$StagingDir = Join-Path $ProjectDir 'dist-update'
& npm.cmd run build -- --outDir dist-update
if ($LASTEXITCODE -ne 0) { throw 'Build failed. The running server was not stopped.' }
if (-not (Test-Path (Join-Path $StagingDir 'index.html'))) { throw 'Build did not produce index.html. The running server was not stopped.' }

Write-Host 'Build complete. Restarting Express Entry...'
try {
    Stop-ScheduledTask -TaskName 'Pelaxix-ExpressEntry'
    Start-Sleep -Seconds 2
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
    # Keep old hashed assets available to browsers that already have the site open.
    $DistDir = Join-Path $ProjectDir 'dist'
    New-Item -ItemType Directory -Force -Path $DistDir | Out-Null
    Get-ChildItem -LiteralPath $StagingDir -Force | Copy-Item -Destination $DistDir -Recurse -Force
} finally {
    Start-ScheduledTask -TaskName 'Pelaxix-ExpressEntry'
}

# Starting a scheduled task only queues it; verify HTTP readiness before success.
$Ready = $false
$Deadline = (Get-Date).AddSeconds(45)
do {
    try {
        $Response = Invoke-WebRequest 'http://127.0.0.1:31007/' -UseBasicParsing -TimeoutSec 2
        if ($Response.StatusCode -eq 200) { $Ready = $true; break }
    } catch { }
    Start-Sleep -Seconds 1
} while ((Get-Date) -lt $Deadline)
if (-not $Ready) {
    $LogPath = Join-Path $DataDir ('logs\server-' + (Get-Date -Format 'yyyy-MM') + '.log')
    if (Test-Path $LogPath) { Get-Content $LogPath -Tail 40 | Out-Host }
    throw "Express Entry did not become ready on port 31007. Check $LogPath and the Pelaxix-ExpressEntry scheduled task."
}
Remove-Item -LiteralPath $StagingDir -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "Updated and verified: http://127.0.0.1:31007/ returned HTTP 200. Persistent data at $DataDir was preserved."
