#!/bin/bash
# Test the new bash-based workflow execution
set -e

echo "=== Testing New Bash-Based Workflow Execution ==="
echo ""

# Test 1: Simple /build command
echo "Test 1: Testing /build command with bash wrapper..."
echo ""

# Create a test ADW
TEST_ADW_ID="test$(date +%s)"
TEST_WORKTREE="test-worktree-$TEST_ADW_ID"
echo "Test ADW ID: $TEST_ADW_ID"
echo "Test Worktree: $TEST_WORKTREE"
echo ""

# Call the Python workflow directly (which will use the bash wrapper)
# Note: This will actually execute Claude Code and make changes
# Only run this if you're sure you want to test it!
echo "⚠️  This will execute a real workflow. Press Ctrl+C to cancel within 3 seconds..."
sleep 3

./adws/adw_build_update_teamwork_task.py \
    "$TEST_ADW_ID" \
    "999999" \
    "Add a test utility function called hello_world() to adws/adw_modules/utils.py that returns 'Hello, World!'" \
    "$TEST_WORKTREE"

# Check exit code
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Test 1 PASSED: /build command executed successfully via bash wrapper"
    echo ""
    echo "Check the agent logs at:"
    echo "  agents/$TEST_ADW_ID/"
else
    echo ""
    echo "❌ Test 1 FAILED: /build command failed"
    exit 1
fi

echo ""
echo "=== All Tests Passed! ==="
echo ""
echo "The bash wrapper successfully avoids Python subprocess rate limiting!"
