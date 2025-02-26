#! /usr/bin/env bash

# set -euo pipefail

function check () {
    aws --debug s3 ls "s3://${1}"
}

function mount_s3 () {
    2>&1 mount-s3 \
    --force-path-style \
    --debug \
    --debug-crt \
    --cache /var/cache/mount-s3 \
    "$@"
}

function mount_s3fs () {
    2>&1 s3fs "$@" \
    -o endpoint=${AWS_REGION} \
    -o url=${AWS_ENDPOINT_URL} \
    -o use_path_request_style \
    -o use_cache=/var/cache/mount-s3 \
    -o dbglevel=info \
    -o curldbg
}

function serve () {
    cd "$1"
    caddy file-server --listen ":${PORT:-8080}" --browse
}

mountpoint="${@: -1}"

mkdir -p "$mountpoint"


# check "$@"
# echo "TZ=${TZ}"
date
# mount_s3fs -f "$@"
mount_s3 -f "$@"


# https://github.com/supabase/supabase/issues/32787

# serve "$mountpoint"
