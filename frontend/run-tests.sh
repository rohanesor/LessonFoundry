#!/usr/bin/env bash
# Run Playwright tests with the locally extracted browser libraries.
# If libnspr4/libnss3 are installed system-wide, this wrapper is unnecessary.
set -e
LIB_DIR="/tmp/lf-browser-libs/usr/lib/x86_64-linux-gnu"
if [ ! -d "$LIB_DIR" ]; then
  echo "Local browser libraries not found at $LIB_DIR"
  echo "Generate them with: ../scripts/fetch-browser-libs.sh"
  exit 1
fi
export LD_LIBRARY_PATH="$LIB_DIR${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
npx playwright test "$@"
