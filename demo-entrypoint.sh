#! /usr/bin/env bash

set -euo pipefail

mountpoint="${@: -1}"
mkdir -p "$mountpoint"

echo "Mounting $mountpoint"

mount-s3 \
    --force-path-style \
    --cache /var/cache/mount-s3 \
    "$@" \

cd "$mountpoint"

echo "Serving..."

caddy file-server --listen ":${PORT:-8080}" --browse
