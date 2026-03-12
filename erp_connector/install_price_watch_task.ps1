param(
  [string]$TaskName = "BOXDASRACOES_ERP_PriceWatch",
  [string]$ProjectRoot = "",
  [string]$PythonPath = ""
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if(-not $ProjectRoot){
  $ProjectRoot = Split-Path -Parent $scriptDir
}

$scriptPath = Join-Path $ProjectRoot "erp_connector\run_price_watch.ps1"
if(-not (Test-Path $scriptPath)){
  Write-Error "Script nao encontrado: $scriptPath"
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
$settings = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -AllowStartIfOnBatteries -StartWhenAvailable

try {
  $trigger = New-ScheduledTaskTrigger -AtStartup
  $principal = New-ScheduledTaskPrincipal -UserId "$env:USERNAME" -LogonType Interactive -RunLevel Highest
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force -ErrorAction Stop | Out-Null
  Write-Host "Tarefa '$TaskName' criada/atualizada com sucesso (gatilho: startup)."
} catch {
  Write-Warning "Falha ao criar tarefa em startup com privilegios elevados: $($_.Exception.Message)"
  Write-Host "Tentando fallback sem elevacao (gatilho: logon do usuario)..."

  $trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
  $principal = New-ScheduledTaskPrincipal -UserId "$env:USERNAME" -LogonType Interactive -RunLevel Limited
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force -ErrorAction Stop | Out-Null
  Write-Host "Tarefa '$TaskName' criada/atualizada com sucesso (gatilho: logon)."
}

Write-Host "Para iniciar agora: Start-ScheduledTask -TaskName '$TaskName'"
