param(
  [string]$TaskName = "BOXDASRACOES_ERP_Connector",
  [string]$ProjectRoot = "D:\Hicaro\BOXDASRACOES",
  [string]$PythonPath = ""
)

$scriptPath = Join-Path $ProjectRoot "erp_connector\run_connector.ps1"
if(-not (Test-Path $scriptPath)){
  Write-Error "Script não encontrado: $scriptPath"
  exit 1
}

$argParts = @(
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-File", ('"' + $scriptPath + '"'),
  "-ProjectRoot", ('"' + $ProjectRoot + '"')
)
if($PythonPath){
  $argParts += @("-PythonPath", ('"' + $PythonPath + '"'))
}

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument ($argParts -join ' ')
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -AllowStartIfOnBatteries -StartWhenAvailable
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERNAME" -LogonType Interactive -RunLevel Highest

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
Write-Host "Tarefa '$TaskName' criada/atualizada com sucesso."
Write-Host "Para iniciar agora: Start-ScheduledTask -TaskName '$TaskName'"
