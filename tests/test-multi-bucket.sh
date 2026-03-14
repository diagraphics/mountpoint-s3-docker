#!/bin/bash
# Multi-bucket test suite for mountpoint-s3 container
# Tests that multiple buckets can be mounted and used simultaneously

set -euo pipefail

MOUNT_DIR="${MOUNTPOINT_PREFIX:-/mnt}"
BUCKETS=("test-bucket" "data-bucket" "backup-bucket")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASSED=0
FAILED=0

log_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((PASSED++))
}

log_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((FAILED++))
}

log_info() {
    echo -e "[INFO] $1"
}

# Wait for all mounts to be ready
wait_for_mounts() {
    local max_attempts=30
    local attempt=1

    log_info "Waiting for all bucket mounts..."
    while [ $attempt -le $max_attempts ]; do
        local all_ready=true
        for bucket in "${BUCKETS[@]}"; do
            if ! mountpoint -q "${MOUNT_DIR}/${bucket}" 2>/dev/null; then
                all_ready=false
                break
            fi
        done

        if $all_ready; then
            log_info "All mounts ready after ${attempt} attempts"
            return 0
        fi

        sleep 1
        ((attempt++))
    done

    log_fail "Not all mounts ready after ${max_attempts} seconds"
    return 1
}

# ============================================
# Test: All Buckets Mounted
# ============================================
test_all_buckets_mounted() {
    log_info "Test: All buckets are mounted"
    local mounted=0

    for bucket in "${BUCKETS[@]}"; do
        local path="${MOUNT_DIR}/${bucket}"
        if mountpoint -q "${path}"; then
            log_info "  - ${bucket}: mounted at ${path}"
            ((mounted++))
        else
            log_fail "  - ${bucket}: NOT mounted at ${path}"
        fi
    done

    if [ ${mounted} -eq ${#BUCKETS[@]} ]; then
        log_pass "All ${#BUCKETS[@]} buckets mounted"
    else
        log_fail "Only ${mounted}/${#BUCKETS[@]} buckets mounted"
        return 1
    fi
}

# ============================================
# Test: Buckets Are Isolated
# ============================================
test_bucket_isolation() {
    log_info "Test: Buckets are isolated from each other"

    # Write unique file to each bucket
    for bucket in "${BUCKETS[@]}"; do
        local path="${MOUNT_DIR}/${bucket}"
        echo "This file belongs to ${bucket}" > "${path}/isolation-test.txt"
    done

    # Verify each file contains correct content
    local isolated=true
    for bucket in "${BUCKETS[@]}"; do
        local path="${MOUNT_DIR}/${bucket}"
        local content
        content=$(cat "${path}/isolation-test.txt")

        if [[ "${content}" == "This file belongs to ${bucket}" ]]; then
            log_info "  - ${bucket}: content verified"
        else
            log_fail "  - ${bucket}: wrong content: ${content}"
            isolated=false
        fi
    done

    # Verify files don't appear in other buckets' unique files
    if $isolated; then
        log_pass "Bucket isolation verified"
    else
        log_fail "Bucket isolation failed"
        return 1
    fi

    # Cleanup
    for bucket in "${BUCKETS[@]}"; do
        rm -f "${MOUNT_DIR}/${bucket}/isolation-test.txt" 2>/dev/null || true
    done
}

# ============================================
# Test: Concurrent Multi-Bucket Writes
# ============================================
test_concurrent_multi_bucket_writes() {
    log_info "Test: Concurrent writes to multiple buckets"

    local pids=()
    local timestamp=$(date +%s)

    # Start concurrent writes to all buckets
    for bucket in "${BUCKETS[@]}"; do
        local path="${MOUNT_DIR}/${bucket}"
        (
            for i in {1..10}; do
                echo "File ${i} in ${bucket}" > "${path}/concurrent-${timestamp}-${i}.txt"
            done
        ) &
        pids+=($!)
    done

    # Wait for all writes
    local failed=0
    for pid in "${pids[@]}"; do
        if ! wait "$pid"; then
            ((failed++))
        fi
    done

    # Verify all files exist
    local total_files=0
    for bucket in "${BUCKETS[@]}"; do
        local path="${MOUNT_DIR}/${bucket}"
        local count
        count=$(ls -1 "${path}"/concurrent-${timestamp}-*.txt 2>/dev/null | wc -l)
        total_files=$((total_files + count))
    done

    if [ ${total_files} -eq 30 ]; then
        log_pass "Concurrent multi-bucket writes: 30 files created"
    else
        log_fail "Concurrent multi-bucket writes: only ${total_files}/30 files"
    fi

    # Cleanup
    for bucket in "${BUCKETS[@]}"; do
        rm -f "${MOUNT_DIR}/${bucket}"/concurrent-${timestamp}-*.txt 2>/dev/null || true
    done
}

# ============================================
# Test: Cross-Bucket Copy
# ============================================
test_cross_bucket_copy() {
    log_info "Test: Copy files between buckets"

    local source_bucket="${BUCKETS[0]}"
    local dest_bucket="${BUCKETS[1]}"
    local source_path="${MOUNT_DIR}/${source_bucket}"
    local dest_path="${MOUNT_DIR}/${dest_bucket}"
    local test_file="cross-copy-test-$(date +%s).txt"
    local content="Cross-bucket copy test content $(date)"

    # Create file in source bucket
    echo "${content}" > "${source_path}/${test_file}"

    # Copy to destination bucket
    if cp "${source_path}/${test_file}" "${dest_path}/${test_file}"; then
        # Verify content matches
        local source_content
        local dest_content
        source_content=$(cat "${source_path}/${test_file}")
        dest_content=$(cat "${dest_path}/${test_file}")

        if [ "${source_content}" = "${dest_content}" ]; then
            log_pass "Cross-bucket copy succeeded"
        else
            log_fail "Cross-bucket copy: content mismatch"
        fi
    else
        log_fail "Cross-bucket copy failed"
    fi

    # Cleanup
    rm -f "${source_path}/${test_file}" "${dest_path}/${test_file}" 2>/dev/null || true
}

# ============================================
# Test: Large File Across Buckets
# ============================================
test_large_file_multi_bucket() {
    log_info "Test: Large file operations across buckets"

    local temp_file="/tmp/large-test-$(date +%s).bin"
    dd if=/dev/urandom of="${temp_file}" bs=1M count=10 2>/dev/null
    local original_hash
    original_hash=$(md5sum "${temp_file}" | cut -d' ' -f1)

    local success=0
    for bucket in "${BUCKETS[@]}"; do
        local path="${MOUNT_DIR}/${bucket}"
        local dest_file="${path}/large-test.bin"

        cp "${temp_file}" "${dest_file}"
        local copied_hash
        copied_hash=$(md5sum "${dest_file}" | cut -d' ' -f1)

        if [ "${original_hash}" = "${copied_hash}" ]; then
            log_info "  - ${bucket}: 10MB file verified"
            ((success++))
        else
            log_fail "  - ${bucket}: hash mismatch"
        fi

        rm -f "${dest_file}" 2>/dev/null || true
    done

    rm -f "${temp_file}"

    if [ ${success} -eq ${#BUCKETS[@]} ]; then
        log_pass "Large file operations across all buckets"
    else
        log_fail "Large file failed on ${success}/${#BUCKETS[@]} buckets"
    fi
}

# ============================================
# Test: Directory Sync Between Buckets
# ============================================
test_directory_sync() {
    log_info "Test: Directory structure sync between buckets"

    local source_bucket="${BUCKETS[0]}"
    local dest_bucket="${BUCKETS[2]}"
    local source_path="${MOUNT_DIR}/${source_bucket}/sync-test"
    local dest_path="${MOUNT_DIR}/${dest_bucket}/sync-test"

    # Create directory structure in source
    mkdir -p "${source_path}/level1/level2"
    echo "file1" > "${source_path}/file1.txt"
    echo "file2" > "${source_path}/level1/file2.txt"
    echo "file3" > "${source_path}/level1/level2/file3.txt"

    # Copy entire structure
    if cp -r "${source_path}" "${MOUNT_DIR}/${dest_bucket}/"; then
        # Verify structure
        if [ -f "${dest_path}/file1.txt" ] && \
           [ -f "${dest_path}/level1/file2.txt" ] && \
           [ -f "${dest_path}/level1/level2/file3.txt" ]; then
            log_pass "Directory sync succeeded"
        else
            log_fail "Directory sync: missing files"
        fi
    else
        log_fail "Directory sync failed"
    fi

    # Cleanup
    rm -rf "${source_path}" "${dest_path}" 2>/dev/null || true
}

# ============================================
# Test: Simultaneous Reads from All Buckets
# ============================================
test_simultaneous_reads() {
    log_info "Test: Simultaneous reads from all buckets"

    # Create test files in all buckets
    for bucket in "${BUCKETS[@]}"; do
        dd if=/dev/urandom of="${MOUNT_DIR}/${bucket}/read-test.bin" bs=1M count=5 2>/dev/null
    done

    local pids=()
    local start_time
    start_time=$(date +%s%N)

    # Read all files simultaneously
    for bucket in "${BUCKETS[@]}"; do
        (cat "${MOUNT_DIR}/${bucket}/read-test.bin" > /dev/null) &
        pids+=($!)
    done

    # Wait for all reads
    local failed=0
    for pid in "${pids[@]}"; do
        if ! wait "$pid"; then
            ((failed++))
        fi
    done

    local end_time
    end_time=$(date +%s%N)
    local duration_ms=$(( (end_time - start_time) / 1000000 ))

    if [ ${failed} -eq 0 ]; then
        log_pass "Simultaneous reads from ${#BUCKETS[@]} buckets in ${duration_ms}ms"
    else
        log_fail "Simultaneous reads: ${failed} failures"
    fi

    # Cleanup
    for bucket in "${BUCKETS[@]}"; do
        rm -f "${MOUNT_DIR}/${bucket}/read-test.bin" 2>/dev/null || true
    done
}

# ============================================
# Test: Bucket Capacity
# ============================================
test_bucket_capacity() {
    log_info "Test: Write capacity per bucket (50 files each)"

    for bucket in "${BUCKETS[@]}"; do
        local path="${MOUNT_DIR}/${bucket}/capacity-test"
        mkdir -p "${path}"

        local created=0
        for i in $(seq 1 50); do
            if echo "capacity file ${i}" > "${path}/file-${i}.txt" 2>/dev/null; then
                ((created++))
            fi
        done

        if [ ${created} -eq 50 ]; then
            log_info "  - ${bucket}: 50 files created"
        else
            log_fail "  - ${bucket}: only ${created}/50 files"
        fi

        rm -rf "${path}" 2>/dev/null || true
    done

    log_pass "Bucket capacity test completed"
}

# ============================================
# Main Test Runner
# ============================================
run_tests() {
    echo "============================================"
    echo "Multi-Bucket Test Suite"
    echo "============================================"
    echo "Buckets: ${BUCKETS[*]}"
    echo "Mount directory: ${MOUNT_DIR}"
    echo "Date: $(date)"
    echo "============================================"
    echo ""

    if ! wait_for_mounts; then
        echo ""
        echo "FATAL: Not all mounts available"
        exit 1
    fi

    echo ""
    echo "=== Multi-Bucket Mount Tests ==="
    test_all_buckets_mounted || true

    echo ""
    echo "=== Bucket Isolation Tests ==="
    test_bucket_isolation || true

    echo ""
    echo "=== Concurrent Operation Tests ==="
    test_concurrent_multi_bucket_writes || true
    test_simultaneous_reads || true

    echo ""
    echo "=== Cross-Bucket Operation Tests ==="
    test_cross_bucket_copy || true
    test_directory_sync || true

    echo ""
    echo "=== Large File Tests ==="
    test_large_file_multi_bucket || true

    echo ""
    echo "=== Capacity Tests ==="
    test_bucket_capacity || true

    echo ""
    echo "============================================"
    echo "Multi-Bucket Test Summary"
    echo "============================================"
    echo -e "${GREEN}Passed:${NC} ${PASSED}"
    echo -e "${RED}Failed:${NC} ${FAILED}"
    echo "============================================"

    if [ ${FAILED} -gt 0 ]; then
        exit 1
    fi
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    run_tests
fi
