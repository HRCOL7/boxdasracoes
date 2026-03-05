param(
  [int]$Port = 8126
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-PythonCommand {
  $candidates = @(
    "C:/Users/ikaru/AppData/Local/Programs/Python/Python313/python.exe",
    (Get-Command python -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -ErrorAction SilentlyContinue),
    (Get-Command py -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -ErrorAction SilentlyContinue)
  ) | Where-Object { $_ }

  foreach($candidate in $candidates){
    try {
      if(Test-Path $candidate){ return $candidate }
    } catch {}
  }

  return $null
}

function Normalize-LocalRef([string]$rawRef){
  if([string]::IsNullOrWhiteSpace($rawRef)){ return $null }
  $ref = $rawRef.Trim()

  if($ref -match '^(https?:)?//' -or $ref -match '^data:' -or $ref -match '^mailto:' -or $ref -match '^tel:' -or $ref -match '^#' -or $ref -match '^javascript:'){
    return $null
  }

  if($ref.Contains('${')){ return $null }

  $withoutQuery = ($ref -split '[?#]')[0]
  if([string]::IsNullOrWhiteSpace($withoutQuery)){ return $null }
  return $withoutQuery
}

function Extract-RefsFromHtml([string]$html){
  if([string]::IsNullOrWhiteSpace($html)){ return @() }

  $clean = [regex]::Replace($html, '<script(?![^>]*\bsrc\s*=)[\s\S]*?</script>', '', 'IgnoreCase')

  $pattern = '(?is)<(script|link|img)\b[^>]*?(?:src|href)\s*=\s*(?:"([^"]+)"|''([^'']+)'')'
  $matches = [regex]::Matches($clean, $pattern)

  $refs = New-Object System.Collections.Generic.List[string]
  foreach($m in $matches){
    $ref = if($m.Groups[2].Success){ $m.Groups[2].Value } else { $m.Groups[3].Value }
    if(-not [string]::IsNullOrWhiteSpace($ref)){
      $refs.Add($ref)
    }
  }

  return $refs
}

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$python = Get-PythonCommand
if(-not $python){
  Write-Error "Python não encontrado. Não foi possível subir dev_server.py"
  exit 1
}

$base = "http://localhost:$Port"
$pages = @(
  "/index.html",
  "/products.html",
  "/product.html?id=1",
  "/admin/admin.html",
  "/includes/header.html"
)

$server = $null
$report = [ordered]@{
  timestamp = (Get-Date).ToString('s')
  root = (Get-Location).Path
  base = $base
  pagesChecked = $pages
  missing = @()
  pageErrors = @()
}

try {
  $server = Start-Process -FilePath $python -ArgumentList "dev_server.py", "$Port" -WorkingDirectory (Get-Location) -PassThru
  Start-Sleep -Seconds 2

  $checkedAssets = New-Object 'System.Collections.Generic.HashSet[string]'

  foreach($page in $pages){
    $pageUrl = "$base$page"
    $pageResponse = $null

    try {
      $pageResponse = Invoke-WebRequest -Uri $pageUrl -UseBasicParsing -TimeoutSec 10
      if([int]$pageResponse.StatusCode -ge 400){
        $report.pageErrors += [pscustomobject]@{ page = $page; status = [int]$pageResponse.StatusCode; url = $pageUrl }
        continue
      }
    } catch {
      $status = 'ERR'
      try { $status = [int]$_.Exception.Response.StatusCode.value__ } catch {}
      $report.pageErrors += [pscustomobject]@{ page = $page; status = $status; url = $pageUrl }
      continue
    }

    $refsRaw = Extract-RefsFromHtml -html $pageResponse.Content
    foreach($raw in $refsRaw){
      $normalized = Normalize-LocalRef -rawRef $raw
      if(-not $normalized){ continue }

      $assetUrl = [uri]::new([uri]$pageUrl, $normalized).AbsoluteUri
      if($checkedAssets.Contains($assetUrl)){ continue }
      [void]$checkedAssets.Add($assetUrl)

      try {
        $assetResp = Invoke-WebRequest -Uri $assetUrl -UseBasicParsing -TimeoutSec 8
        if([int]$assetResp.StatusCode -ge 400){
          $report.missing += [pscustomobject]@{ page = $page; reference = $raw; normalized = $normalized; assetUrl = $assetUrl; status = [int]$assetResp.StatusCode }
        }
      } catch {
        $status = 'ERR'
        try { $status = [int]$_.Exception.Response.StatusCode.value__ } catch {}
        $report.missing += [pscustomobject]@{ page = $page; reference = $raw; normalized = $normalized; assetUrl = $assetUrl; status = $status }
      }
    }
  }
}
finally {
  if($server){
    try { Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue } catch {}
  }
}

$reportPath = Join-Path $projectRoot 'active-link-report.json'
$report | ConvertTo-Json -Depth 6 | Set-Content -Path $reportPath -Encoding UTF8

$missingCount = @($report.missing).Count
$pageErrCount = @($report.pageErrors).Count

if($pageErrCount -gt 0){
  Write-Warning "Foram encontrados erros de carregamento de página: $pageErrCount"
}

if($missingCount -eq 0 -and $pageErrCount -eq 0){
  Write-Host "ACTIVE LINK CHECK: OK" -ForegroundColor Green
} else {
  Write-Host "ACTIVE LINK CHECK: ALERTAS" -ForegroundColor Yellow
  if($pageErrCount -gt 0){
    Write-Host "- Page errors: $pageErrCount"
  }
  if($missingCount -gt 0){
    Write-Host "- Missing assets: $missingCount"
  }
}

Write-Host "Relatório: $reportPath"
