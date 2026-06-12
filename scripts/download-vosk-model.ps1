param(
  [switch]$Force,
  [ValidateSet("accurate", "small")]
  [string]$Quality = "accurate"
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$ModelsRoot = Join-Path $ProjectRoot "models\vosk"
$ExtractRoot = Join-Path $ModelsRoot "__vosk_extract"
$ModelOptions = @{
  accurate = @{
    Directory = "vosk-model-en-us-0.22-lgraph"
    Archive = "vosk-model-en-us-0.22-lgraph.zip"
    ExtractedDirectory = "vosk-model-en-us-0.22-lgraph"
    Url = "https://alphacephei.com/vosk/models/vosk-model-en-us-0.22-lgraph.zip"
    ExpectedSha256 = ""
  }
  small = @{
    Directory = "vosk-model-small-en-us"
    Archive = "vosk-model-small-en-us-0.15.zip"
    ExtractedDirectory = "vosk-model-small-en-us-0.15"
    Url = "https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip"
    ExpectedSha256 = "30f26242c4eb449f948e42cb302dd7a686cb29a3423a8367f99ff41780942498"
  }
}

$SelectedModel = $ModelOptions[$Quality]
$ModelDir = Join-Path $ModelsRoot $SelectedModel["Directory"]
$ArchivePath = Join-Path $ModelsRoot $SelectedModel["Archive"]
$ExtractedDir = Join-Path $ExtractRoot $SelectedModel["ExtractedDirectory"]
$ModelUrl = $SelectedModel["Url"]
$ExpectedSha256 = $SelectedModel["ExpectedSha256"]

function Test-VoskModelDir {
  param([string]$Path)

  return (
    (Test-Path (Join-Path $Path "am\final.mdl")) -and
    (Test-Path (Join-Path $Path "conf\model.conf")) -and
    (Test-Path (Join-Path $Path "graph\HCLr.fst")) -and
    (Test-Path (Join-Path $Path "graph\Gr.fst"))
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

if ((-not $Force) -and (Test-VoskModelDir $ModelDir)) {
  Write-Host "Vosk model already exists: $ModelDir"
  exit 0
}

New-Item -ItemType Directory -Force -Path $ModelsRoot | Out-Null

if ((-not $Force) -and (Test-Path $ArchivePath)) {
  Write-Host "Using cached Vosk archive: $ArchivePath"
  if ($ExpectedSha256) {
    $CachedSha256 = Get-Sha256Hex $ArchivePath
    if ($CachedSha256 -ne $ExpectedSha256) {
      Write-Warning "Cached Vosk archive checksum mismatch. Redownloading."
      Remove-Item -LiteralPath $ArchivePath -Force
    }
  }
}

if ((-not $Force) -and (Test-Path $ArchivePath)) {
  if ($ExpectedSha256) {
    Write-Host "Cached Vosk archive verified."
  } else {
    Write-Host "Using cached Vosk archive without checksum verification."
  }
} else {
  Write-Host "Downloading Vosk model from $ModelUrl"
  Invoke-WebRequest -Uri $ModelUrl -OutFile $ArchivePath -UseBasicParsing
}

if ($ExpectedSha256) {
  $ActualSha256 = Get-Sha256Hex $ArchivePath
  if ($ActualSha256 -ne $ExpectedSha256) {
    Remove-Item -LiteralPath $ArchivePath -Force
    throw "Downloaded Vosk model checksum mismatch. Expected $ExpectedSha256, got $ActualSha256."
  }
} else {
  Write-Warning "No pinned checksum is configured for $($SelectedModel["Archive"]). The archive was downloaded over HTTPS from alphacephei.com."
}

Remove-Item -LiteralPath $ExtractRoot -Recurse -Force -ErrorAction SilentlyContinue
Expand-Archive -LiteralPath $ArchivePath -DestinationPath $ExtractRoot -Force

if (-not (Test-VoskModelDir $ExtractedDir)) {
  throw "Extracted Vosk model is missing required files: $ExtractedDir"
}

Remove-Item -LiteralPath $ModelDir -Recurse -Force -ErrorAction SilentlyContinue
Move-Item -LiteralPath $ExtractedDir -Destination $ModelDir
Remove-Item -LiteralPath $ExtractRoot -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "Vosk model ready: $ModelDir"
