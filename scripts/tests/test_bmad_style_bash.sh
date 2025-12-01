#!/bin/bash
# Test BMAD-style execution via bash script

set -e

echo "Testing BMAD-style claude execution..."
echo ""

# Test 1: Simple slash command with stdin
echo "=== Test 1: /build command via stdin ==="
echo "Add a slugify utility function to adws/adw_modules/utils.py that converts text to URL-safe slugs" | \
  claude -p "/build" \
    --model sonnet \
    --dangerously-skip-permissions \
    --verbose \
    --output-format stream-json \
    > /tmp/test_bmad_build.jsonl 2>&1

if [ $? -eq 0 ]; then
    echo "✅ Test 1 PASSED"
    tail -5 /tmp/test_bmad_build.jsonl
else
    echo "❌ Test 1 FAILED"
    tail -10 /tmp/test_bmad_build.jsonl
fi

echo ""
echo "=== Test 2: /list_teamwork_tasks with args ==="
# Test 2: Command with arguments
echo "" | \
  claude -p "/list_teamwork_tasks 805682 10" \
    --model sonnet \
    --dangerously-skip-permissions \
    --verbose \
    --output-format stream-json \
    > /tmp/test_bmad_list.jsonl 2>&1

if [ $? -eq 0 ]; then
    echo "✅ Test 2 PASSED"
    tail -5 /tmp/test_bmad_list.jsonl
else
    echo "❌ Test 2 FAILED"
    tail -10 /tmp/test_bmad_list.jsonl
fi

echo ""
echo "Done!"
