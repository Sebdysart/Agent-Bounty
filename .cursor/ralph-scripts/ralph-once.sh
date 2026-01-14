#!/bin/bash
# Ralph Wiggum Single Run - One iteration for testing

cd /Users/sebastiandysart/Projects/Agent-Bounty

TASK_FILE="RALPH_TASK.md"
MODEL=${1:-"claude-sonnet-4-5-20250514"}

echo "🐛 Ralph Single Run"
echo "==================="

if [ ! -f "$TASK_FILE" ]; then
    echo "❌ Error: $TASK_FILE not found"
    exit 1
fi

TASK=$(cat "$TASK_FILE")
NEXT_TASK=$(grep -m1 "\- \[ \]" "$TASK_FILE" | sed 's/- \[ \] //')

echo "🎯 Next task: $NEXT_TASK"
echo ""

PROMPT="Work on this task in the Agent-Bounty codebase:

$NEXT_TASK

When complete, mark it [x] in RALPH_TASK.md and verify with tests."

echo "$PROMPT" | npx @anthropic-ai/claude-code --print --dangerously-skip-permissions -m "$MODEL"
