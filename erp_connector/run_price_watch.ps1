param(
  [string]$ProjectRoot = "",
  [string]$PythonPath = ""
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if(-not $ProjectRoot){
  $ProjectRoot = Split-Path -Parent $scriptDir
}

$connectorDir = Join-Path $ProjectRoot "erp_connector"
if(-not (Test-Path $connectorDir)){
  Write-Error "Pasta do conector nao encontrada: $connectorDir"
  exit 1
}

Set-Location $connectorDir

if(-not $PythonPath){
  $venvPython = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
  if(Test-Path $venvPython){
    $PythonPath = $venvPython
  } else {
    $cmd = Get-Command python -ErrorAction SilentlyContinue
    if($cmd){ $PythonPath = $cmd.Source }
  }
}

if(-not $PythonPath -or -not (Test-Path $PythonPath)){
  Write-Error "Python nao encontrado. Informe -PythonPath ou crie .venv em $connectorDir"
  exit 1
}

& $PythonPath "price_watch.py"
exit $LASTEXITCODE
