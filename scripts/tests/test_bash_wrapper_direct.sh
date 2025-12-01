#!/bin/bash
# Direct test of the bash wrapper script
set -e

echo "=== Testing Bash Wrapper Script Directly ==="
echo ""

# Test 1: Simple /build command
echo "Test 1: Testing bash wrapper with /build command..."
echo ""

./scripts/execute-claude-workflow.sh \
    "/build" \
    "Add a simple hello() function to adws/adw_modules/utils.py that returns 'Hello!'" \
    "." \
    "sonnet"

EXIT_CODE=$?

echo ""
if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ Bash wrapper test PASSED!"
else
    echo "❌ Bash wrapper test FAILED with exit code: $EXIT_CODE"
    exit 1
fi

echo ""
echo "=== Test Complete ==="
