$ErrorActionPreference = 'Stop'
$AgentRoot = Split-Path -Parent $PSScriptRoot
Set-Location $AgentRoot
node src\index.js --force @args
exit $LASTEXITCODE
