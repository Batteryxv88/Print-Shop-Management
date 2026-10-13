#Requires -RunAsAdministrator
$TaskName = 'SL-SNMP-Counter-Agent'
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
Write-Host "Задание '$TaskName' удалено (если существовало)."
