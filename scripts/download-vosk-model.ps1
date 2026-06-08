param(
  [switch]$Force
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$ModelsRoot = Join-Path $ProjectRoot "models\vosk"
$ModelDir = Join-Path $ModelsRoot "vosk-model-small-en-us"
$ArchivePath = Join-Path $ModelsRoot "vosk-model-small-en-us-0.15.zip"
$ExtractRoot = Join-Path $ModelsRoot "__vosk_extract"
$ExtractedDir = Join-Path $ExtractRoot "vosk-model-small-en-us-0.15"
$ModelUrl = "https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip"
$ExpectedSha256 = "30f26242c4eb449f948e42cb302dd7a686cb29a3423a8367f99ff41780942498"

function Test-VoskModelDir {
  param([string]$Path)

  return (
    (Test-Path (Join-Path $Path "am\final.mdl")) -and
    (Test-Path (Join-Path $Path "conf\model.conf")) -and
    (Test-Path (Join-Path $Path "graph\HCLr.fst")) -and
    (Test-Path (Join-Path $Path "graph\Gr.fst"))
  )
}

if ((-not $Force) -and (Test-VoskModelDir $ModelDir)) {
  Write-Host "Vosk model already exists: $ModelDir"
  exit 0
}

New-Item -ItemType Directory -Force -Path $ModelsRoot | Out-Null

if ((-not $Force) -and (Test-Path $ArchivePath)) {
  Write-Host "Using cached Vosk archive: $ArchivePath"
  $CachedSha256 = (Get-FileHash -Path $ArchivePath -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($CachedSha256 -ne $ExpectedSha256) {
    Write-Warning "Cached Vosk archive checksum mismatch. Redownloading."
    Remove-Item -LiteralPath $ArchivePath -Force
  }
}

if ((-not $Force) -and (Test-Path $ArchivePath)) {
  Write-Host "Cached Vosk archive verified."
} else {
  Write-Host "Downloading Vosk model from $ModelUrl"
  Invoke-WebRequest -Uri $ModelUrl -OutFile $ArchivePath -UseBasicParsing
}

$ActualSha256 = (Get-FileHash -Path $ArchivePath -Algorithm SHA256).Hash.ToLowerInvariant()
if ($ActualSha256 -ne $ExpectedSha256) {
  Remove-Item -LiteralPath $ArchivePath -Force
  throw "Downloaded Vosk model checksum mismatch. Expected $ExpectedSha256, got $ActualSha256."
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
