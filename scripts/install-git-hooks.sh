#!/usr/bin/env sh
set -eu

git config core.hooksPath .githooks
echo "Configured git hooks path: .githooks"
echo "Ensure gitleaks is installed: https://github.com/gitleaks/gitleaks#installing"

