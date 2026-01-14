#!/bin/bash
# Ralph Wiggum Single Run - One iteration only

TASK_FILE="RALPH_TASK.md"
MODEL=${1:-"claude-sonnet-4-5-20250514"}

if [ ! -f "$TASK_FILE" ]; then
    echo "Error: $TASK_FILE not found"
    exit 1
fi

TASK=$(cat "$TASK_FILE")

PROMPT="You are working on this task. Complete one item and update RALPH_TASK.md.

$TASK

Mark completed items with [x]. Be thorough and test your changes."

if command -v claude &> /dev/null; then
    echo "$PROMPT" | claude --model "$MODEL"
elif command -v cursor-agent &> /dev/null; then
    cursor-agent "$PROMPT" --model "$MODEL"
else
    echo "Neither 'claude' nor 'cursor-agent' CLI found"
    exit 1
fi
