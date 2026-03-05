param(
  [string[]]$ActivePages = @('index.html','products.html','product.html','admin/admin.html')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

function Normalize-LocalRef([string]$rawRef){
  if([string]::IsNullOrWhiteSpace($rawRef)){ return $null }
  $ref = $rawRef.Trim()
  if($ref -match '^(https?:)?//' -or $ref -match '^data:' -or $ref -match '^mailto:' -or $ref -match '^tel:' -or $ref -match '^#'){ return $null }
  $withoutQuery = ($ref -split '[?#]')[0]
  if([string]::IsNullOrWhiteSpace($withoutQuery)){ return $null }
  return $withoutQuery
}

function Get-ScriptRefsFromHtml([string]$absoluteHtmlPath){
  $refs = New-Object System.Collections.Generic.List[string]
  if(-not (Test-Path $absoluteHtmlPath)){ return $refs }

  $content = Get-Content -Path $absoluteHtmlPath -Raw
  $pattern = '(?is)<script\b[^>]*?\bsrc\s*=\s*(?:"([^"]+)"|''([^'']+)'')'
  $matches = [regex]::Matches($content, $pattern)
  foreach($m in $matches){
    $raw = if($m.Groups[1].Success){ $m.Groups[1].Value } else { $m.Groups[2].Value }
    $norm = Normalize-LocalRef $raw
    if(-not $norm){ continue }

    $resolved = Join-Path (Split-Path $absoluteHtmlPath -Parent) $norm
    try{
      $full = [System.IO.Path]::GetFullPath($resolved)
      $refs.Add($full)
    }catch{}
  }

  return $refs
}

function Get-FunctionCandidates([string]$filePath){
  $result = New-Object System.Collections.Generic.List[object]
  if(-not (Test-Path $filePath)){ return $result }

  $text = Get-Content -Path $filePath -Raw

  $decl = [regex]::Matches($text, '(?m)^\s*function\s+([A-Za-z_\$][A-Za-z0-9_\$]*)\s*\(')
  foreach($m in $decl){
    $name = $m.Groups[1].Value
    $result.Add([pscustomobject]@{ name = $name; kind = 'function-declaration'; file = $filePath })
  }

  $windowAssign = [regex]::Matches($text, '(?m)\bwindow\.([A-Za-z_\$][A-Za-z0-9_\$]*)\s*=\s*function\b')
  foreach($m in $windowAssign){
    $name = $m.Groups[1].Value
    $result.Add([pscustomobject]@{ name = $name; kind = 'window-assignment'; file = $filePath })
  }

  return $result
}

$activeHtmlFull = @()
foreach($p in $ActivePages){
  $full = Join-Path $projectRoot $p
  if(Test-Path $full){ $activeHtmlFull += [System.IO.Path]::GetFullPath($full) }
}

$allJs = Get-ChildItem -Path (Join-Path $projectRoot 'js') -File -Filter *.js -Recurse | ForEach-Object { $_.FullName }

$usedJs = New-Object 'System.Collections.Generic.HashSet[string]'
foreach($page in $activeHtmlFull){
  $refs = Get-ScriptRefsFromHtml $page
  foreach($r in $refs){
    if((Test-Path $r) -and $r.ToLowerInvariant().EndsWith('.js')){
      [void]$usedJs.Add($r)
    }
  }
}

$potentialUnusedJs = @()
foreach($js in $allJs){
  if(-not $usedJs.Contains($js)){
    $potentialUnusedJs += $js
  }
}

$corpusFiles = Get-ChildItem -Path $projectRoot -Recurse -File -Include *.js,*.html,*.md,*.py,*.ps1,*.toml
$corpus = ($corpusFiles | Get-Content -Raw) -join "`n"

$functionDefs = New-Object System.Collections.Generic.List[object]
foreach($js in $allJs){
  $candidates = Get-FunctionCandidates $js
  foreach($c in $candidates){ $functionDefs.Add($c) }
}

$seen = @{}
$potentialDeadFunctions = @()
foreach($f in $functionDefs){
  $key = "$($f.file)|$($f.name)|$($f.kind)"
  if($seen.ContainsKey($key)){ continue }
  $seen[$key] = $true

  $nameEsc = [regex]::Escape($f.name)
  $count = ([regex]::Matches($corpus, "\b$nameEsc\b", 'IgnoreCase')).Count

  if($count -le 1){
    $potentialDeadFunctions += [pscustomobject]@{
      name = $f.name
      kind = $f.kind
      occurrences = $count
      file = $f.file
    }
  }
}

$report = [ordered]@{
  timestamp = (Get-Date).ToString('s')
  root = $projectRoot
  activePages = $ActivePages
  activePagesFound = @($activeHtmlFull | ForEach-Object { $_.Substring($projectRoot.Length + 1).Replace('\','/') })
  jsFilesTotal = $allJs.Count
  jsFilesUsedByActivePages = @($usedJs).Count
  potentialUnusedJsFiles = @($potentialUnusedJs | ForEach-Object { $_.Substring($projectRoot.Length + 1).Replace('\','/') } | Sort-Object)
  potentialDeadFunctions = @($potentialDeadFunctions | ForEach-Object {
    [pscustomobject]@{
      name = $_.name
      kind = $_.kind
      occurrences = $_.occurrences
      file = $_.file.Substring($projectRoot.Length + 1).Replace('\','/')
    }
  } | Sort-Object file,name)
}

$reportPath = Join-Path $projectRoot 'dead-code-report.json'
$report | ConvertTo-Json -Depth 8 | Set-Content -Path $reportPath -Encoding UTF8

Write-Host "DEAD CODE SCAN: concluído"
Write-Host "- JS total: $($report.jsFilesTotal)"
Write-Host "- JS usados por páginas ativas: $($report.jsFilesUsedByActivePages)"
Write-Host "- JS potencialmente não usados: $($report.potentialUnusedJsFiles.Count)"
Write-Host "- Funções potencialmente mortas: $($report.potentialDeadFunctions.Count)"
Write-Host "Relatório: $reportPath"
