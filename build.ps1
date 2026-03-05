# build.ps1 — Build Polarkivet for Windows and produce an NSIS installer
# Requires: Rust toolchain, Node.js, cargo-tauri, NSIS
#
# Run from the repo root in a PowerShell terminal:
#   .\build.ps1
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$AppName = "polarkivet"
$BundleDir = "src-tauri\target\release\bundle"

Write-Host "==> Building frontend..." -ForegroundColor Cyan
npm run build

Write-Host "==> Building Tauri app (release)..." -ForegroundColor Cyan
cargo tauri build --bundles nsis

$NsisDir = "$BundleDir\nsis"
$Installer = Get-ChildItem -Path $NsisDir -Filter "*.exe" | Select-Object -First 1

if ($null -eq $Installer) {
    Write-Error "NSIS installer not found in $NsisDir"
    exit 1
}

Write-Host ""
Write-Host "Done! Distributable files:" -ForegroundColor Green
Write-Host "  $($Installer.FullName)"
Write-Host ""
Write-Host "Distribute the .exe installer to users. No dependencies required on target machine."
