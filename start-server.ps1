param(
  [int]$Port = 8000
)

# Ensure we run in the project folder where the script lives
Set-Location -Path (Split-Path -Path $MyInvocation.MyCommand.Definition -Parent)

Write-Host "Using working directory: $(Get-Location)"

# If something is listening on the port, stop it
try{
  $conn = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
  if($conn){
      $existingPid = $conn.OwningProcess
      if($existingPid){
        Write-Host "Killing existing process on port $Port (PID $existingPid)"
        Stop-Process -Id $existingPid -Force -ErrorAction SilentlyContinue
      }
  }
}catch{ Write-Warning "Could not query existing TCP connections: $_" }

# Find python or py
$pythonCmd = $null
$py = Get-Command python -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -ErrorAction SilentlyContinue
if($py){ $pythonCmd = $py }
else { $pys = Get-Command py -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -ErrorAction SilentlyContinue; if($pys){ $pythonCmd = $pys } }

if(-not $pythonCmd){
  Write-Error "Python not found. Please install Python or ensure 'python' or 'py' is in PATH. Run 'python --version' to check."
  exit 1
}

Write-Host "Starting HTTP dev server (fallback to product.html) with: $pythonCmd dev_server.py $Port"
Start-Process -FilePath $pythonCmd -ArgumentList "dev_server.py","$Port" -WorkingDirectory (Get-Location)
Start-Sleep -Seconds 1

# Open admin page in browser (if exists) otherwise open root
$adminUrl = "http://localhost:$Port/admin/admin.html"
Start-Process "http://localhost:$Port"
if(Test-Path -Path "$(Join-Path (Get-Location) 'admin\admin.html')"){
  Start-Sleep -Milliseconds 200
  Start-Process $adminUrl
  Write-Host "Server started and browser opened at http://localhost:$Port and $adminUrl"
} else {
  Write-Host "Server started and browser opened at http://localhost:$Port"
}
