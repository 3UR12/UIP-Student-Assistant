param(
    [string]$OutputDirectory = "dist"
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$ExtensionDirectory = Join-Path $RepoRoot "extension"
$ManifestPath = Join-Path $ExtensionDirectory "manifest.json"
$OutputPath = Join-Path $RepoRoot $OutputDirectory

if (-not (Test-Path $ManifestPath)) {
    throw "No se encontró extension/manifest.json. Ejecuta el script dentro del repositorio UIP-Student-Assistant."
}

$Manifest = Get-Content $ManifestPath -Raw | ConvertFrom-Json
$Version = [string]$Manifest.version

if ([string]::IsNullOrWhiteSpace($Version)) {
    throw "manifest.json no contiene una versión válida."
}

New-Item -ItemType Directory -Force -Path $OutputPath | Out-Null

$ZipName = "UIP-Student-Assistant-v$Version.zip"
$ZipPath = Join-Path $OutputPath $ZipName

if (Test-Path $ZipPath) {
    Remove-Item $ZipPath -Force
}

$Items = Get-ChildItem -Path $ExtensionDirectory -Force
if (-not $Items) {
    throw "La carpeta extension está vacía."
}

Compress-Archive -Path $Items.FullName -DestinationPath $ZipPath -CompressionLevel Optimal

$SizeMB = [math]::Round((Get-Item $ZipPath).Length / 1MB, 2)

Write-Host ""
Write-Host "UIP Student Assistant empaquetado correctamente." -ForegroundColor Green
Write-Host "Versión : $Version"
Write-Host "Archivo : $ZipPath"
Write-Host "Tamaño  : $SizeMB MB"
Write-Host ""
Write-Host "Comparte este ZIP. El receptor debe extraerlo y cargar la carpeta resultante desde edge://extensions o chrome://extensions usando 'Cargar descomprimida / Load unpacked'."
