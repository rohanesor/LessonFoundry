#!/usr/bin/env bash
# Download and extract libnspr4/libnss3 locally so Chromium can run without
# system-wide installation (useful in restricted containers).
set -e
DIR="/tmp/lf-browser-libs"
mkdir -p "$DIR"
cd "$DIR"
apt-get download -q libnspr4 libnss3
dpkg-deb -x libnspr4*.deb .
dpkg-deb -x libnss3*.deb .
echo "Libraries extracted to $DIR/usr/lib/x86_64-linux-gnu"
echo "Run frontend tests with: cd frontend && ./run-tests.sh"
