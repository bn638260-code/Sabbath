param(
  [switch]$Force,
  [string]$PythonCommand = $env:SABBATHCUE_SIDECAR_PYTHON
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$SidecarDir = Join-Path $ProjectRoot "sidecars"
$OutputDir = Join-Path $SidecarDir "sherpa_worker"
$OutputExe = Join-Path $OutputDir "sherpa_worker.exe"
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

function Invoke-NativeCommand {
  param(
    [string]$Description,
    [string]$FilePath,
    [string[]]$Arguments
  )

  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$Description failed with exit code $LASTEXITCODE"
  }
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
if ($Force) {
  Remove-Item -LiteralPath $OutputDir -Recurse -Force -ErrorAction SilentlyContinue
}

if (Test-Path (Join-Path $VenvDir "Scripts\python.exe")) {
  Write-Host "Using existing Sherpa sidecar build venv: $VenvDir"
} else {
  Remove-Item -LiteralPath $VenvDir -Recurse -Force -ErrorAction SilentlyContinue
  Write-Host "Creating Sherpa sidecar build venv: $VenvDir"
  Invoke-NativeCommand "Creating Sherpa sidecar build venv" $PythonExe ($PythonBaseArgs + @("-m", "venv", $VenvDir))
}

$Python = Join-Path $VenvDir "Scripts\python.exe"

$DependencyProbe = "import importlib; [importlib.import_module(name) for name in ('sherpa_onnx', 'numpy', 'PyInstaller')]"
$null = & $Python -c $DependencyProbe 2>$null
if ($LASTEXITCODE -eq 0) {
  Write-Host "Sherpa sidecar build dependencies already installed"
} else {
  Write-Host "Installing Sherpa sidecar build dependencies"
  Invoke-NativeCommand "Upgrading pip" $Python @("-m", "pip", "install", "--upgrade", "pip")
  Invoke-NativeCommand "Installing Sherpa sidecar build dependencies" $Python @("-m", "pip", "install", "--only-binary=:all:", "sherpa-onnx", "numpy", "pyinstaller")
}

$PyinstallerWork = Join-Path $BuildRoot "pyinstaller-work"
$PyinstallerSpec = Join-Path $BuildRoot "pyinstaller-spec"
Remove-Item -LiteralPath $PyinstallerWork -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $PyinstallerSpec -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "Building self-contained Sherpa worker sidecar"
Invoke-NativeCommand "Building self-contained Sherpa worker sidecar" $Python @(
  "-m",
  "PyInstaller",
  "--onedir",
  "--clean",
  "--name",
  "sherpa_worker",
  "--collect-all",
  "sherpa_onnx",
  "--collect-all",
  "numpy",
  "--distpath",
  $SidecarDir,
  "--workpath",
  $PyinstallerWork,
  "--specpath",
  $PyinstallerSpec,
  $WorkerScript
)

if (-not (Test-Path $OutputExe)) {
  throw "Sherpa sidecar build did not produce expected executable: $OutputExe"
}

Write-Host "Sherpa sidecar ready: $OutputExe"
