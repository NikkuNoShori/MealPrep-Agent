$ErrorActionPreference = "Stop"

git config core.hooksPath .githooks
Write-Host "Configured git hooks path: .githooks"

if (-not (Get-Command gitleaks -ErrorAction SilentlyContinue)) {
  Write-Host ""
  Write-Host "gitleaks is not installed. Install without Docker:"
  Write-Host "  winget install Gitleaks.Gitleaks"
  Write-Host "  scoop install gitleaks"
  Write-Host "https://github.com/gitleaks/gitleaks/releases"
}
