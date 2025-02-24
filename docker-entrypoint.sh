#! /usr/bin/env bash

set -euo pipefail

mountpoint="${@: -1}"

mkdir -p "$mountpoint"

exec mount-s3 \
    --force-path-style \
    --foreground \
    --cache /var/cache/mount-s3 \
    "$@" \
