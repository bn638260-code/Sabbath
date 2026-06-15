param(
  [switch]$Force,
  [string]$PythonCommand = $env:SABBATHCUE_SIDECAR_PYTHON
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$SidecarDir = Join-Path $ProjectRoot "sidecars"
$OutputExe = Join-Path $SidecarDir "sherpa_worker.exe"
$BuildRoot = Join-Path $ProjectRoot "tmp\sherpa-sidecar"
$VenvDir = Join-Path $BuildRoot ".venv"
$WorkerScript = Join-Path $ProjectRoot "scripts\sherpa_worker.py"

if ([string]::IsNullOrWhiteSpace($PythonCommand)) {
  $PythonCommand = "python"
}

$PythonCommandParts = $PythonCommand.Trim() -split "\s+"
$PythonExe = $PythonCommandParts[0]
$PythonBaseArgs = @()
if ($PythonCommandParts.Length -gt 1) {
  $PythonBaseArgs = $PythonCommandParts[1..($PythonCommandParts.Length - 1)]
}

if ((-not $Force) -and (Test-Path $OutputExe)) {
  Write-Host "Sherpa sidecar already exists: $OutputExe"
  exit 0
}

if (-not (Test-Path $WorkerScript)) {
  throw "Sherpa worker script not found: $WorkerScript"
}

New-Item -ItemType Directory -Force -Path $SidecarDir | Out-Null
New-Item -ItemType Directory -Force -Path $BuildRoot | Out-Null

if ((-not $Force) -and (Test-Path (Join-Path $VenvDir "Scripts\python.exe"))) {
  Write-Host "Using existing Sherpa sidecar build venv: $VenvDir"
} else {
  Remove-Item -LiteralPath $VenvDir -Recurse -Force -ErrorAction SilentlyContinue
  Write-Host "Creating Sherpa sidecar build venv: $VenvDir"
  & $PythonExe @PythonBaseArgs -m venv $VenvDir
}

$Python = Join-Path $VenvDir "Scripts\python.exe"

Write-Host "Installing Sherpa sidecar build dependencies"
& $Python -m pip install --upgrade pip
& $Python -m pip install --only-binary=:all: sherpa-onnx numpy pyinstaller

$PyinstallerWork = Join-Path $BuildRoot "pyinstaller-work"
$PyinstallerSpec = Join-Path $BuildRoot "pyinstaller-spec"
Remove-Item -LiteralPath $PyinstallerWork -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $PyinstallerSpec -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "Building self-contained Sherpa worker sidecar"
& $Python -m PyInstaller `
  --onefile `
  --clean `
  --name sherpa_worker `
  --collect-all sherpa_onnx `
  --collect-all numpy `
  --distpath $SidecarDir `
  --workpath $PyinstallerWork `
  --specpath $PyinstallerSpec `
  $WorkerScript

if (-not (Test-Path $OutputExe)) {
  throw "Sherpa sidecar build did not produce expected executable: $OutputExe"
}

Write-Host "Sherpa sidecar ready: $OutputExe"
