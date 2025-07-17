#!/command/with-contenv bash
# shellcheck shell=bash

set -euo pipefail

TEMPLATE_ROOT="/etc/s6-overlay/s6-rc.template.d"
SERVICE_ROOT="/etc/s6-overlay/s6-rc.d"
MOUNTPOINT_PREFIX="${MOUNTPOINT_PREFIX:-/mnt}"

copy_source() {
    local service="$1"
    local suffix="$2"
    local source="${TEMPLATE_ROOT}/${service}"
    local target="${SERVICE_ROOT}/${service}-${suffix}"

    cp -R "${source}" "${target}" > /dev/null 2>&1

    echo "{$target}"
}

add_to_bundle() {
    local bundle="$1"
    local service="$2"
    local workdir="${SERVICE_ROOT}/${bundle}/contents.d"

    mkdir -p "${workdir}"
    touch "${workdir}/${service}"
}

make_env() {
    local workdir="$1"
    local bucket="$2"

    mkdir -p "${workdir}/env"
    echo "${bucket}" > "${workdir}/env/MOUNTPOINT_BUCKET"
    echo "${MOUNTPOINT_PREFIX}/${bucket}" > "${workdir}/env/MOUNTPOINT_DIR"
}

make_instance() {
    local service="$1"
    local bucket="$2"
    local workdir
    workdir="$(copy_source "${service}" "${bucket}")"

    make_env "${workdir}" "${bucket}" > /dev/null 2>&1
    add_to_bundle mountpoint-s3 "mountpoint-s3-${bucket}"
    mkdir -p "${MOUNTPOINT_PREFIX}/${bucket}"
    mkdir -p "/var/cache/mount-s3/${bucket}"
}

main() {
    echo "Creating mountpoint-s3 service instances for buckets: ${MOUNTPOINT_BUCKETS}..."
    for bucket in ${MOUNTPOINT_BUCKETS//,/ }; do
        make_instance mountpoint-s3 "${bucket}"
    done
}

main
