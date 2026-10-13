#Requires -RunAsAdministrator
<#
.SYNOPSIS
  Создаёт задание Планировщика Windows: ежедневный запуск SNMP-агента.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\scripts\install-task.ps1
#>

$ErrorActionPreference = 'Stop'

$AgentRoot = Split-Path -Parent $PSScriptRoot
$NodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $NodeCmd) {
    Write-Error "Node.js не найден в PATH. Установите Node 18+ с https://nodejs.org"
}
$Node = $NodeCmd.Source

$ConfigPath = Join-Path $AgentRoot 'config.json'
if (-not (Test-Path $ConfigPath)) {
    Write-Error "Нет config.json. Скопируйте config.example.json → config.json"
}

$config = Get-Content $ConfigPath -Raw | ConvertFrom-Json
$hour = 8
$minute = 0
if ($config.schedule) {
    if ($null -ne $config.schedule.runHour) { $hour = [int]$config.schedule.runHour }
    if ($null -ne $config.schedule.runMinute) { $minute = [int]$config.schedule.runMinute }
}

$TaskName = 'SL-SNMP-Counter-Agent'
$WorkDir = $AgentRoot
$Args = "src\index.js"
$Action = New-ScheduledTaskAction -Execute $Node -Argument $Args -WorkingDirectory $WorkDir
$Trigger = New-ScheduledTaskTrigger -Daily -At (Get-Date -Hour $hour -Minute $minute -Second 0)
$Settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable
$Principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest

Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -Principal $Principal `
    -Description 'Снятие счётчиков принтеров по SNMP и запись в Firestore (SL)' | Out-Null

Write-Host "OK: задание '$TaskName' создано. Запуск ежедневно в $($hour.ToString('00')):$($minute.ToString('00'))."
Write-Host "Проверка: schtasks /Query /TN $TaskName"
Write-Host "Ручной запуск: schtasks /Run /TN $TaskName"
