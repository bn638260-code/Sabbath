param(
  [switch]$Force
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$ModelsRoot = Join-Path $ProjectRoot "models\sherpa"
$ExtractRoot = Join-Path $ModelsRoot "__sherpa_extract"
$ModelDirectory = "sherpa-onnx-streaming-zipformer-en-2023-06-26"
$Archive = "$ModelDirectory.tar.bz2"
$ArchivePath = Join-Path $ModelsRoot $Archive
$ModelDir = Join-Path $ModelsRoot $ModelDirectory
$ExtractedDir = Join-Path $ExtractRoot $ModelDirectory
$ModelUrl = "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/$Archive"
$ExpectedSha256 = "639e25b578e9e997131402199419c13a941f8e4e198e2da1ce57dbf5cf401282"

function Test-SherpaModelDir {
  param([string]$Path)

  return (
    (Test-Path (Join-Path $Path "tokens.txt")) -and
    ((Get-ChildItem -LiteralPath $Path -Filter "encoder*.onnx" -File -ErrorAction SilentlyContinue | Select-Object -First 1) -ne $null) -and
    ((Get-ChildItem -LiteralPath $Path -Filter "decoder*.onnx" -File -ErrorAction SilentlyContinue | Select-Object -First 1) -ne $null) -and
    ((Get-ChildItem -LiteralPath $Path -Filter "joiner*.onnx" -File -ErrorAction SilentlyContinue | Select-Object -First 1) -ne $null)
  )
}

function Get-Sha256Hex {
  param([string]$Path)

  $Stream = [System.IO.File]::OpenRead($Path)
  try {
    $Sha256 = [System.Security.Cryptography.SHA256]::Create()
    try {
      return ([System.BitConverter]::ToString($Sha256.ComputeHash($Stream)) -replace "-", "").ToLowerInvariant()
    } finally {
      $Sha256.Dispose()
    }
  } finally {
    $Stream.Dispose()
  }
}

if ((-not $Force) -and (Test-SherpaModelDir $ModelDir)) {
  Write-Host "Sherpa model already exists: $ModelDir"
  exit 0
}

New-Item -ItemType Directory -Force -Path $ModelsRoot | Out-Null

if ((-not $Force) -and (Test-Path $ArchivePath)) {
  Write-Host "Using cached Sherpa archive: $ArchivePath"
  if ($ExpectedSha256) {
    $CachedSha256 = Get-Sha256Hex $ArchivePath
    if ($CachedSha256 -ne $ExpectedSha256) {
      Write-Warning "Cached Sherpa archive checksum mismatch. Redownloading."
      Remove-Item -LiteralPath $ArchivePath -Force
    }
  }
}

if ((-not $Force) -and (Test-Path $ArchivePath)) {
  if ($ExpectedSha256) {
    Write-Host "Cached Sherpa archive verified."
  } else {
    Write-Host "Using cached Sherpa archive without checksum verification."
  }
} else {
  Write-Host "Downloading Sherpa model from $ModelUrl"
  Invoke-WebRequest -Uri $ModelUrl -OutFile $ArchivePath -UseBasicParsing
}

if ($ExpectedSha256) {
  $ActualSha256 = Get-Sha256Hex $ArchivePath
  if ($ActualSha256 -ne $ExpectedSha256) {
    Remove-Item -LiteralPath $ArchivePath -Force
    throw "Downloaded Sherpa model checksum mismatch. Expected $ExpectedSha256, got $ActualSha256."
  }
} else {
  Write-Warning "No pinned checksum is configured for $Archive. The archive was downloaded over HTTPS from github.com/k2-fsa/sherpa-onnx."
}

Remove-Item -LiteralPath $ExtractRoot -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $ExtractRoot | Out-Null

Write-Host "Extracting Sherpa model archive"
tar -xjf $ArchivePath -C $ExtractRoot

if (-not (Test-SherpaModelDir $ExtractedDir)) {
  throw "Extracted Sherpa model is missing required files: $ExtractedDir"
}

Remove-Item -LiteralPath $ModelDir -Recurse -Force -ErrorAction SilentlyContinue
Move-Item -LiteralPath $ExtractedDir -Destination $ModelDir
Remove-Item -LiteralPath $ExtractRoot -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "Sherpa model ready: $ModelDir"
