#!/usr/bin/env bash
set -euo pipefail

# Headless CI launches only Chromium's shell. A restored cache skips the download, and apt
# runs only when the runner image lacks one of the shell's libraries: mirror stalls in
# `--with-deps` have held this step for ten minutes.
browsers="${PLAYWRIGHT_BROWSERS_PATH:-$HOME/.cache/ms-playwright}"
find_shell() { find "$browsers" -type f -name chrome-headless-shell 2>/dev/null | head -n 1; }
if [[ -z "$(find_shell)" ]]; then
  bun run test:e2e:install --only-shell
fi
shell="$(find_shell)"
test -n "$shell"
if ldd "$shell" | grep -q "not found"; then
  bun x playwright install-deps chromium
fi
