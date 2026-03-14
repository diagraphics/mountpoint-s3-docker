#!/bin/bash
# Master test runner for mountpoint-s3 container
# Runs all test suites in sequence

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}  Mountpoint-S3 Full Test Suite${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

OVERALL_STATUS=0

echo -e "${BLUE}>>> Running: Single Bucket Tests${NC}"
echo ""
if "${SCRIPT_DIR}/test-s3-mount.sh"; then
    echo -e "${GREEN}>>> Single bucket tests: PASSED${NC}"
else
    echo -e "${RED}>>> Single bucket tests: FAILED${NC}"
    OVERALL_STATUS=1
fi

echo ""
echo -e "${BLUE}>>> Running: Multi-Bucket Tests${NC}"
echo ""
if "${SCRIPT_DIR}/test-multi-bucket.sh"; then
    echo -e "${GREEN}>>> Multi-bucket tests: PASSED${NC}"
else
    echo -e "${RED}>>> Multi-bucket tests: FAILED${NC}"
    OVERALL_STATUS=1
fi

echo ""
echo -e "${BLUE}======================================${NC}"
if [ ${OVERALL_STATUS} -eq 0 ]; then
    echo -e "${GREEN}  ALL TESTS PASSED${NC}"
else
    echo -e "${RED}  SOME TESTS FAILED${NC}"
fi
echo -e "${BLUE}======================================${NC}"

exit ${OVERALL_STATUS}
