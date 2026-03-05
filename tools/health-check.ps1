param(
  [int]$Port = 8125
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Section([string]$Title){
  Write-Host "`n=== $Title ===" -ForegroundColor Cyan
}

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

Write-Section "Project"
Write-Host "Root: $(Get-Location)"

$report = [ordered]@{
  timestamp = (Get-Date).ToString('s')
  root = (Get-Location).Path
  checks = @()
}

function Add-Check([string]$name, [bool]$ok, [string]$detail){
  $report.checks += [pscustomobject]@{ name = $name; ok = $ok; detail = $detail }
}

Write-Section "JavaScript syntax"
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if($nodeCmd){
  $jsFiles = Get-ChildItem -Path . -Recurse -File -Include *.js | Where-Object { $_.FullName -notmatch '\\node_modules\\' }
  $failed = @()
  foreach($f in $jsFiles){
    & node --check "$($f.FullName)" 2>$null
    if($LASTEXITCODE -ne 0){ $failed += $f.FullName }
  }
  if($failed.Count -eq 0){
    Add-Check "js-syntax" $true "OK ($($jsFiles.Count) arquivos)"
    Write-Host "OK: $($jsFiles.Count) arquivos verificados"
  } else {
    Add-Check "js-syntax" $false ("Falhas em: " + ($failed -join '; '))
    Write-Warning "Falhas de sintaxe JS encontradas"
  }
} else {
  Add-Check "js-syntax" $true "Node não encontrado; check de sintaxe JS ignorado"
  Write-Host "Node não encontrado; check de sintaxe JS ignorado"
}

Write-Section "HTTP smoke"
$pythonCandidates = @(
  "C:/Users/ikaru/AppData/Local/Programs/Python/Python313/python.exe",
  (Get-Command python -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -ErrorAction SilentlyContinue),
  (Get-Command py -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -ErrorAction SilentlyContinue)
) | Where-Object { $_ -and (Test-Path $_ -ErrorAction SilentlyContinue) }

if(-not $pythonCandidates -or $pythonCandidates.Count -eq 0){
  Add-Check "http-smoke" $false "Python não encontrado"
  Write-Warning "Python não encontrado para subir dev_server.py"
} else {
  $python = $pythonCandidates[0]
  $proc = $null
  try{
    $proc = Start-Process -FilePath $python -ArgumentList "dev_server.py", "$Port" -WorkingDirectory (Get-Location) -PassThru
    Start-Sleep -Seconds 2

    $urls = @(
      "http://localhost:$Port/index.html",
      "http://localhost:$Port/products.html",
      "http://localhost:$Port/product.html?id=1",
      "http://localhost:$Port/admin/admin.html"
    )

    $bad = @()
    foreach($u in $urls){
      try{
        $r = Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 10
        if([int]$r.StatusCode -ne 200){
          $bad += "$u => $([int]$r.StatusCode)"
        }
      } catch {
        $bad += "$u => ERR"
      }
    }

    if($bad.Count -eq 0){
      Add-Check "http-smoke" $true "OK (páginas principais 200)"
      Write-Host "OK: páginas principais responderam 200"
    } else {
      Add-Check "http-smoke" $false ($bad -join '; ')
      Write-Warning "Falhas HTTP em páginas principais"
    }
  } finally {
    if($proc){
      try{ Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue } catch {}
    }
  }
}

Write-Section "Legacy note"
$legacyExists = (Test-Path "_root.html") -and (Test-Path "_root127.html")
if($legacyExists){
  Add-Check "legacy-root-files" $true "_root.html e _root127.html presentes (legado)"
  Write-Host "Info: arquivos legados detectados (_root.html, _root127.html)"
} else {
  Add-Check "legacy-root-files" $true "Arquivos legados não encontrados"
  Write-Host "Info: arquivos legados não encontrados"
}

Write-Section "Summary"
$failedChecks = @($report.checks | Where-Object { -not $_.ok })
if($failedChecks.Count -eq 0){
  Write-Host "HEALTH CHECK: OK" -ForegroundColor Green
} else {
  Write-Host "HEALTH CHECK: COM ALERTAS" -ForegroundColor Yellow
  $failedChecks | ForEach-Object { Write-Host "- $($_.name): $($_.detail)" }
}

$reportPath = Join-Path $projectRoot "health-check-report.json"
$report | ConvertTo-Json -Depth 6 | Set-Content -Path $reportPath -Encoding UTF8
Write-Host "Relatório: $reportPath"
