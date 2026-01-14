#!/bin/bash
# Ralph Wiggum Loop - Persistent autonomous development
# Named after the Simpsons character who never gives up

set -e

# Configuration
MAX_ITERATIONS=${1:-20}
MODEL=${2:-"claude-sonnet-4-5-20250514"}
TASK_FILE="RALPH_TASK.md"
LOG_FILE=".ralph/activity.log"
COMPLETION_PROMISE="<promise>DONE</promise>"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

echo -e "${PURPLE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${PURPLE}🐛 Ralph Wiggum Loop - \"I'm helping!\"${NC}"
echo -e "${PURPLE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Check for task file
if [ ! -f "$TASK_FILE" ]; then
    echo -e "${RED}Error: $TASK_FILE not found${NC}"
    echo "Create a RALPH_TASK.md with checkboxes for completion criteria"
    exit 1
fi

# Initialize log
mkdir -p .ralph
echo "=== Ralph Loop Started: $(date) ===" >> "$LOG_FILE"
echo "Max iterations: $MAX_ITERATIONS" >> "$LOG_FILE"
echo "Model: $MODEL" >> "$LOG_FILE"

ITERATION=0
COMPLETED=false

while [ $ITERATION -lt $MAX_ITERATIONS ] && [ "$COMPLETED" = false ]; do
    ITERATION=$((ITERATION + 1))
    
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}📍 Iteration $ITERATION of $MAX_ITERATIONS${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    echo "[$(date)] Iteration $ITERATION started" >> "$LOG_FILE"
    
    # Read task file
    TASK=$(cat "$TASK_FILE")
    
    # Check if all checkboxes are checked
    UNCHECKED=$(grep -c "\- \[ \]" "$TASK_FILE" || true)
    CHECKED=$(grep -c "\- \[x\]" "$TASK_FILE" || true)
    
    echo -e "${GREEN}Progress: $CHECKED completed, $UNCHECKED remaining${NC}"
    
    if [ "$UNCHECKED" -eq 0 ] && [ "$CHECKED" -gt 0 ]; then
        echo -e "${GREEN}✅ All tasks completed!${NC}"
        COMPLETED=true
        break
    fi
    
    # Build prompt for Claude
    PROMPT="You are working on this task autonomously. 

TASK FILE:
$TASK

INSTRUCTIONS:
1. Check the current state of the codebase
2. Work on the next unchecked item
3. When you complete an item, update RALPH_TASK.md to mark it [x]
4. If ALL items are complete, output: $COMPLETION_PROMISE
5. Be thorough - run tests, verify changes work

Current iteration: $ITERATION of $MAX_ITERATIONS
Focus on quality over speed. Take your time."

    # Run Claude Code or cursor-agent
    if command -v claude &> /dev/null; then
        echo -e "${PURPLE}Running Claude Code...${NC}"
        RESPONSE=$(echo "$PROMPT" | claude --model "$MODEL" 2>&1) || true
        echo "$RESPONSE" >> "$LOG_FILE"
    elif command -v cursor-agent &> /dev/null; then
        echo -e "${PURPLE}Running Cursor Agent...${NC}"
        RESPONSE=$(cursor-agent "$PROMPT" --model "$MODEL" 2>&1) || true
        echo "$RESPONSE" >> "$LOG_FILE"
    else
        echo -e "${RED}Neither 'claude' nor 'cursor-agent' CLI found${NC}"
        echo "Install Claude Code: npm install -g @anthropic-ai/claude-code"
        echo "Or Cursor CLI: curl https://cursor.com/install -fsS | bash"
        exit 1
    fi
    
    # Check for completion promise
    if echo "$RESPONSE" | grep -q "$COMPLETION_PROMISE"; then
        echo -e "${GREEN}🎉 Completion promise received!${NC}"
        COMPLETED=true
    fi
    
    # Brief pause between iterations
    sleep 2
done

echo ""
echo -e "${PURPLE}═══════════════════════════════════════════════════════════════${NC}"
if [ "$COMPLETED" = true ]; then
    echo -e "${GREEN}✅ Ralph completed the task in $ITERATION iterations!${NC}"
else
    echo -e "${YELLOW}⚠️  Max iterations reached. Review progress in $TASK_FILE${NC}"
fi
echo -e "${PURPLE}═══════════════════════════════════════════════════════════════${NC}"

echo "=== Ralph Loop Ended: $(date) ===" >> "$LOG_FILE"
echo "Final status: $([ "$COMPLETED" = true ] && echo 'COMPLETED' || echo 'MAX_ITERATIONS')" >> "$LOG_FILE"
