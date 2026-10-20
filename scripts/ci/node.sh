#!/usr/bin/env bash
set -euo pipefail

# Keep the repository Node on PATH; the consumer runner receives this binary explicitly.
[[ "${CONSUMER_NODE_VERSION:?}" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]
directory="${RUNNER_TEMP:?}/consumer-node"
mkdir -p "$directory"
archive="node-v${CONSUMER_NODE_VERSION}-linux-x64.tar.xz"
curl --fail --silent --show-error --retry 3 "https://nodejs.org/dist/v${CONSUMER_NODE_VERSION}/${archive}" --output "$directory/$archive"
curl --fail --silent --show-error --retry 3 "https://nodejs.org/dist/v${CONSUMER_NODE_VERSION}/SHASUMS256.txt" --output "$directory/SHASUMS256.txt"
cd "$directory"
awk -v archive="$archive" '$2 == archive' SHASUMS256.txt > selected.sha256
test -s selected.sha256
sha256sum --check selected.sha256
tar -xJf "$archive"
