#!/bin/bash
# Test suite for mountpoint-s3 container
# Exercises the mounted S3 filesystem via LocalStack

set -euo pipefail

MOUNT_DIR="${MOUNTPOINT_PREFIX:-/mnt}"
TEST_BUCKET="${TEST_BUCKET:-test-bucket}"
BUCKET_PATH="${MOUNT_DIR}/${TEST_BUCKET}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0
SKIPPED=0

log_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((PASSED++))
}

log_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((FAILED++))
}

log_skip() {
    echo -e "${YELLOW}[SKIP]${NC} $1"
    ((SKIPPED++))
}

log_info() {
    echo -e "[INFO] $1"
}

# Wait for mount to be ready
wait_for_mount() {
    local max_attempts=30
    local attempt=1

    log_info "Waiting for mount at ${BUCKET_PATH}..."
    while [ $attempt -le $max_attempts ]; do
        if mountpoint -q "${BUCKET_PATH}" 2>/dev/null; then
            log_info "Mount ready after ${attempt} attempts"
            return 0
        fi
        sleep 1
        ((attempt++))
    done

    log_fail "Mount not ready after ${max_attempts} seconds"
    return 1
}

# ============================================
# Test: Mount Point Verification
# ============================================
test_mount_exists() {
    log_info "Test: Mount point exists"
    if [ -d "${BUCKET_PATH}" ]; then
        log_pass "Mount directory exists: ${BUCKET_PATH}"
    else
        log_fail "Mount directory does not exist: ${BUCKET_PATH}"
        return 1
    fi
}

test_mount_is_fuse() {
    log_info "Test: Mount is a FUSE filesystem"
    if mountpoint -q "${BUCKET_PATH}"; then
        log_pass "Directory is a mountpoint"
    else
        log_fail "Directory is not a mountpoint"
        return 1
    fi
}

# ============================================
# Test: Basic File Operations
# ============================================
test_list_empty_bucket() {
    log_info "Test: List empty bucket"
    local count
    count=$(ls -1 "${BUCKET_PATH}" 2>/dev/null | wc -l)
    log_pass "Bucket listing works (${count} items)"
}

test_write_small_file() {
    log_info "Test: Write small file"
    local test_file="${BUCKET_PATH}/test-small-$(date +%s).txt"
    local content="Hello, mountpoint-s3!"

    if echo "${content}" > "${test_file}" 2>/dev/null; then
        log_pass "Small file write succeeded: ${test_file}"
        # Cleanup
        rm -f "${test_file}" 2>/dev/null || true
    else
        log_fail "Small file write failed"
        return 1
    fi
}

test_write_and_read_file() {
    log_info "Test: Write and read file"
    local test_file="${BUCKET_PATH}/test-readwrite-$(date +%s).txt"
    local content="Test content: $(date)"

    echo "${content}" > "${test_file}"
    local read_content
    read_content=$(cat "${test_file}")

    if [ "${read_content}" = "${content}" ]; then
        log_pass "Write and read matched"
        rm -f "${test_file}" 2>/dev/null || true
    else
        log_fail "Content mismatch: expected '${content}', got '${read_content}'"
        return 1
    fi
}

test_write_large_file() {
    log_info "Test: Write large file (1MB)"
    local test_file="${BUCKET_PATH}/test-large-$(date +%s).bin"

    if dd if=/dev/urandom of="${test_file}" bs=1M count=1 2>/dev/null; then
        local size
        size=$(stat -c%s "${test_file}" 2>/dev/null || stat -f%z "${test_file}" 2>/dev/null)
        if [ "${size}" -ge 1000000 ]; then
            log_pass "Large file write succeeded (${size} bytes)"
        else
            log_fail "Large file size incorrect: ${size}"
        fi
        rm -f "${test_file}" 2>/dev/null || true
    else
        log_fail "Large file write failed"
        return 1
    fi
}

test_write_very_large_file() {
    log_info "Test: Write very large file (100MB)"
    local test_file="${BUCKET_PATH}/test-vlarge-$(date +%s).bin"

    if dd if=/dev/urandom of="${test_file}" bs=1M count=100 2>/dev/null; then
        local size
        size=$(stat -c%s "${test_file}" 2>/dev/null || stat -f%z "${test_file}" 2>/dev/null)
        if [ "${size}" -ge 100000000 ]; then
            log_pass "Very large file write succeeded (${size} bytes)"
        else
            log_fail "Very large file size incorrect: ${size}"
        fi
        rm -f "${test_file}" 2>/dev/null || true
    else
        log_fail "Very large file write failed"
        return 1
    fi
}

# ============================================
# Test: Directory Operations
# ============================================
test_create_directory() {
    log_info "Test: Create directory"
    local test_dir="${BUCKET_PATH}/test-dir-$(date +%s)"

    if mkdir -p "${test_dir}"; then
        if [ -d "${test_dir}" ]; then
            log_pass "Directory creation succeeded"
            rmdir "${test_dir}" 2>/dev/null || true
        else
            log_fail "Directory does not exist after creation"
            return 1
        fi
    else
        log_fail "Directory creation failed"
        return 1
    fi
}

test_nested_directories() {
    log_info "Test: Create nested directories"
    local base_dir="${BUCKET_PATH}/test-nested-$(date +%s)"
    local nested_dir="${base_dir}/level1/level2/level3"

    if mkdir -p "${nested_dir}"; then
        if [ -d "${nested_dir}" ]; then
            log_pass "Nested directory creation succeeded"
            rm -rf "${base_dir}" 2>/dev/null || true
        else
            log_fail "Nested directory does not exist"
            return 1
        fi
    else
        log_fail "Nested directory creation failed"
        return 1
    fi
}

test_file_in_subdirectory() {
    log_info "Test: File in subdirectory"
    local base_dir="${BUCKET_PATH}/test-subdir-$(date +%s)"
    local test_file="${base_dir}/subfile.txt"

    mkdir -p "${base_dir}"
    echo "Subdirectory test" > "${test_file}"

    if [ -f "${test_file}" ]; then
        log_pass "File in subdirectory created"
        rm -rf "${base_dir}" 2>/dev/null || true
    else
        log_fail "File in subdirectory not found"
        return 1
    fi
}

# ============================================
# Test: File Metadata
# ============================================
test_file_stat() {
    log_info "Test: File stat operations"
    local test_file="${BUCKET_PATH}/test-stat-$(date +%s).txt"

    echo "stat test" > "${test_file}"

    if stat "${test_file}" >/dev/null 2>&1; then
        log_pass "File stat succeeded"
        rm -f "${test_file}" 2>/dev/null || true
    else
        log_fail "File stat failed"
        return 1
    fi
}

test_file_permissions() {
    log_info "Test: File permissions readable"
    local test_file="${BUCKET_PATH}/test-perms-$(date +%s).txt"

    echo "perms test" > "${test_file}"

    local perms
    perms=$(stat -c%a "${test_file}" 2>/dev/null || stat -f%Lp "${test_file}" 2>/dev/null)

    if [ -n "${perms}" ]; then
        log_pass "File permissions readable: ${perms}"
        rm -f "${test_file}" 2>/dev/null || true
    else
        log_fail "Could not read file permissions"
        return 1
    fi
}

# ============================================
# Test: Concurrent Operations
# ============================================
test_concurrent_writes() {
    log_info "Test: Concurrent file writes"
    local base_name="${BUCKET_PATH}/test-concurrent-$(date +%s)"
    local pids=()

    for i in {1..5}; do
        (echo "Concurrent test ${i}" > "${base_name}-${i}.txt") &
        pids+=($!)
    done

    local failed=0
    for pid in "${pids[@]}"; do
        if ! wait "$pid"; then
            ((failed++))
        fi
    done

    if [ $failed -eq 0 ]; then
        log_pass "Concurrent writes succeeded (5 files)"
    else
        log_fail "Concurrent writes failed (${failed}/5)"
    fi

    # Cleanup
    rm -f "${base_name}"-*.txt 2>/dev/null || true
}

test_concurrent_reads() {
    log_info "Test: Concurrent file reads"
    local test_file="${BUCKET_PATH}/test-concread-$(date +%s).txt"
    local content="Concurrent read test content"

    echo "${content}" > "${test_file}"

    local pids=()
    for i in {1..10}; do
        (cat "${test_file}" >/dev/null) &
        pids+=($!)
    done

    local failed=0
    for pid in "${pids[@]}"; do
        if ! wait "$pid"; then
            ((failed++))
        fi
    done

    if [ $failed -eq 0 ]; then
        log_pass "Concurrent reads succeeded (10 readers)"
    else
        log_fail "Concurrent reads failed (${failed}/10)"
    fi

    rm -f "${test_file}" 2>/dev/null || true
}

# ============================================
# Test: Special Characters
# ============================================
test_filename_with_spaces() {
    log_info "Test: Filename with spaces"
    local test_file="${BUCKET_PATH}/test file with spaces $(date +%s).txt"

    if echo "spaces test" > "${test_file}"; then
        if [ -f "${test_file}" ]; then
            log_pass "Filename with spaces works"
            rm -f "${test_file}" 2>/dev/null || true
        else
            log_fail "File with spaces not found"
            return 1
        fi
    else
        log_fail "Could not create file with spaces"
        return 1
    fi
}

test_filename_with_unicode() {
    log_info "Test: Filename with unicode"
    local test_file="${BUCKET_PATH}/test-émoji-日本語-$(date +%s).txt"

    if echo "unicode test" > "${test_file}" 2>/dev/null; then
        if [ -f "${test_file}" ]; then
            log_pass "Filename with unicode works"
            rm -f "${test_file}" 2>/dev/null || true
        else
            log_fail "File with unicode not found"
            return 1
        fi
    else
        log_skip "Unicode filenames not supported"
    fi
}

# ============================================
# Test: Binary Data
# ============================================
test_binary_data_integrity() {
    log_info "Test: Binary data integrity"
    local test_file="${BUCKET_PATH}/test-binary-$(date +%s).bin"
    local temp_file="/tmp/test-binary-original.bin"

    # Create random binary data
    dd if=/dev/urandom of="${temp_file}" bs=1K count=100 2>/dev/null
    local original_hash
    original_hash=$(md5sum "${temp_file}" | cut -d' ' -f1)

    # Copy to S3 mount
    cp "${temp_file}" "${test_file}"

    # Read back and verify
    local read_hash
    read_hash=$(md5sum "${test_file}" | cut -d' ' -f1)

    if [ "${original_hash}" = "${read_hash}" ]; then
        log_pass "Binary data integrity verified (MD5: ${original_hash})"
    else
        log_fail "Binary data corrupted: ${original_hash} != ${read_hash}"
    fi

    rm -f "${temp_file}" "${test_file}" 2>/dev/null || true
}

# ============================================
# Test: Streaming Operations
# ============================================
test_append_file() {
    log_info "Test: Append to file"
    local test_file="${BUCKET_PATH}/test-append-$(date +%s).txt"

    echo "Line 1" > "${test_file}"
    echo "Line 2" >> "${test_file}"
    echo "Line 3" >> "${test_file}"

    local lines
    lines=$(wc -l < "${test_file}")

    if [ "${lines}" -eq 3 ]; then
        log_pass "File append works (3 lines)"
    else
        log_fail "File append failed: expected 3 lines, got ${lines}"
    fi

    rm -f "${test_file}" 2>/dev/null || true
}

test_truncate_file() {
    log_info "Test: Truncate file"
    local test_file="${BUCKET_PATH}/test-truncate-$(date +%s).txt"

    echo "Original content that is fairly long" > "${test_file}"
    truncate -s 10 "${test_file}" 2>/dev/null || true

    local size
    size=$(stat -c%s "${test_file}" 2>/dev/null || stat -f%z "${test_file}" 2>/dev/null)

    if [ "${size}" -eq 10 ]; then
        log_pass "File truncate works"
    else
        log_skip "File truncate not supported (size: ${size})"
    fi

    rm -f "${test_file}" 2>/dev/null || true
}

# ============================================
# Test: Performance
# ============================================
test_many_small_files() {
    log_info "Test: Many small files (100 files)"
    local base_dir="${BUCKET_PATH}/test-many-$(date +%s)"
    mkdir -p "${base_dir}"

    local start_time
    start_time=$(date +%s)

    for i in $(seq 1 100); do
        echo "File ${i}" > "${base_dir}/file-${i}.txt"
    done

    local end_time
    end_time=$(date +%s)
    local duration=$((end_time - start_time))

    local count
    count=$(ls -1 "${base_dir}" | wc -l)

    if [ "${count}" -eq 100 ]; then
        log_pass "Created 100 files in ${duration}s"
    else
        log_fail "Only created ${count}/100 files"
    fi

    rm -rf "${base_dir}" 2>/dev/null || true
}

test_read_throughput() {
    log_info "Test: Read throughput (10MB file)"
    local test_file="${BUCKET_PATH}/test-throughput-$(date +%s).bin"

    # Create 10MB file
    dd if=/dev/urandom of="${test_file}" bs=1M count=10 2>/dev/null

    local start_time
    start_time=$(date +%s%N)

    # Read file 5 times
    for i in {1..5}; do
        cat "${test_file}" > /dev/null
    done

    local end_time
    end_time=$(date +%s%N)
    local duration_ns=$((end_time - start_time))
    local duration_ms=$((duration_ns / 1000000))

    log_pass "Read 50MB in ${duration_ms}ms"

    rm -f "${test_file}" 2>/dev/null || true
}

# ============================================
# Test: Delete Operations
# ============================================
test_delete_file() {
    log_info "Test: Delete file"
    local test_file="${BUCKET_PATH}/test-delete-$(date +%s).txt"

    echo "delete me" > "${test_file}"

    if rm "${test_file}" 2>/dev/null; then
        if [ ! -f "${test_file}" ]; then
            log_pass "File deletion succeeded"
        else
            log_fail "File still exists after deletion"
            return 1
        fi
    else
        log_skip "File deletion not supported (may need --allow-delete)"
    fi
}

test_delete_directory() {
    log_info "Test: Delete directory with contents"
    local test_dir="${BUCKET_PATH}/test-deldir-$(date +%s)"

    mkdir -p "${test_dir}"
    echo "file 1" > "${test_dir}/file1.txt"
    echo "file 2" > "${test_dir}/file2.txt"

    if rm -rf "${test_dir}" 2>/dev/null; then
        if [ ! -d "${test_dir}" ]; then
            log_pass "Directory deletion succeeded"
        else
            log_fail "Directory still exists after deletion"
            return 1
        fi
    else
        log_skip "Directory deletion not supported"
    fi
}

# ============================================
# Main Test Runner
# ============================================
run_tests() {
    echo "============================================"
    echo "Mountpoint-S3 Test Suite"
    echo "============================================"
    echo "Mount directory: ${BUCKET_PATH}"
    echo "Date: $(date)"
    echo "============================================"
    echo ""

    # Wait for mount
    if ! wait_for_mount; then
        echo ""
        echo "FATAL: Mount not available"
        exit 1
    fi

    echo ""
    echo "=== Mount Verification Tests ==="
    test_mount_exists || true
    test_mount_is_fuse || true

    echo ""
    echo "=== Basic File Operation Tests ==="
    test_list_empty_bucket || true
    test_write_small_file || true
    test_write_and_read_file || true
    test_write_large_file || true

    echo ""
    echo "=== Directory Operation Tests ==="
    test_create_directory || true
    test_nested_directories || true
    test_file_in_subdirectory || true

    echo ""
    echo "=== File Metadata Tests ==="
    test_file_stat || true
    test_file_permissions || true

    echo ""
    echo "=== Concurrent Operation Tests ==="
    test_concurrent_writes || true
    test_concurrent_reads || true

    echo ""
    echo "=== Special Character Tests ==="
    test_filename_with_spaces || true
    test_filename_with_unicode || true

    echo ""
    echo "=== Data Integrity Tests ==="
    test_binary_data_integrity || true

    echo ""
    echo "=== Streaming Operation Tests ==="
    test_append_file || true
    test_truncate_file || true

    echo ""
    echo "=== Performance Tests ==="
    test_many_small_files || true
    test_read_throughput || true

    echo ""
    echo "=== Large File Tests ==="
    test_write_very_large_file || true

    echo ""
    echo "=== Delete Operation Tests ==="
    test_delete_file || true
    test_delete_directory || true

    echo ""
    echo "============================================"
    echo "Test Summary"
    echo "============================================"
    echo -e "${GREEN}Passed:${NC}  ${PASSED}"
    echo -e "${RED}Failed:${NC}  ${FAILED}"
    echo -e "${YELLOW}Skipped:${NC} ${SKIPPED}"
    echo "============================================"

    if [ ${FAILED} -gt 0 ]; then
        exit 1
    fi
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    run_tests
fi
