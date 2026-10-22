param([string]$DataDir = 'D:\DevData\ExpressEntry', [string]$NodePath = 'node.exe')
$ErrorActionPreference = 'Stop'
$ProjectDir = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectDir
$env:DATA_DIR = $DataDir
$LogDir = Join-Path $DataDir 'logs'
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
& $NodePath (Join-Path $ProjectDir 'server\index.mjs') *>> (Join-Path $LogDir ('server-' + (Get-Date -Format 'yyyy-MM') + '.log'))
exit $LASTEXITCODE
