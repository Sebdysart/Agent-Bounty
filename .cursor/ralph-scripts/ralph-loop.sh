#!/bin/bash
# Ralph Wiggum BULLETPROOF Loop
# Never stops until the job is done
# "I bent my wookie!" - Ralph

set -e

cd /Users/sebastiandysart/Projects/Agent-Bounty

MAX_ITERATIONS=${1:-100}
TASK_FILE="RALPH_TASK.md"
LOG_FILE=".ralph/activity.log"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
RED='\033[0;31m'
NC='\033[0m'

mkdir -p .ralph

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
    echo -e "$1"
}

log "${PURPLE}═══════════════════════════════════════════════════════════════${NC}"
log "${PURPLE}🐛 RALPH WIGGUM - BULLETPROOF MODE${NC}"
log "${PURPLE}═══════════════════════════════════════════════════════════════${NC}"

if [ ! -f "$TASK_FILE" ]; then
    log "${RED}❌ No RALPH_TASK.md found${NC}"
    exit 1
fi

ITERATION=0

while [ $ITERATION -lt $MAX_ITERATIONS ]; do
    ITERATION=$((ITERATION + 1))
    
    # Count progress
    UNCHECKED=$(grep -c "\- \[ \]" "$TASK_FILE" 2>/dev/null || echo "0")
    CHECKED=$(grep -c "\- \[x\]" "$TASK_FILE" 2>/dev/null || echo "0")
    
    log ""
    log "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    log "${YELLOW}📍 ITERATION $ITERATION/$MAX_ITERATIONS | ✅ $CHECKED done | ⏳ $UNCHECKED left${NC}"
    log "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    # Check completion
    if [ "$UNCHECKED" -eq 0 ] && [ "$CHECKED" -gt 0 ]; then
        log "${GREEN}🎉 ALL TASKS COMPLETE! Ralph is done.${NC}"
        break
    fi
    
    # Find next task
    NEXT_TASK=$(grep -m1 "\- \[ \]" "$TASK_FILE" | sed 's/- \[ \] //' | head -c 100)
    log "${YELLOW}🎯 Working on: $NEXT_TASK${NC}"
    
    # Build the prompt
    PROMPT="You are an autonomous AI developer working in /Users/sebastiandysart/Projects/Agent-Bounty

CURRENT TASK FROM RALPH_TASK.md:
$NEXT_TASK

INSTRUCTIONS:
1. Implement this task completely
2. Write real code, not placeholders  
3. Run tests with 'npm test' to verify
4. When DONE, update RALPH_TASK.md to mark this item [x]
5. Use git to commit your changes

Work directory: /Users/sebastiandysart/Projects/Agent-Bounty
Be thorough. Take your time. Quality matters.

START NOW."

    # Run Claude Code with full permissions
    log "${PURPLE}🤖 Claude working...${NC}"
    
    if echo "$PROMPT" | npx @anthropic-ai/claude-code \
        --print \
        --dangerously-skip-permissions \
        --allowedTools "Edit,Write,Bash,Read" \
        >> "$LOG_FILE" 2>&1; then
        log "${GREEN}✅ Iteration complete${NC}"
    else
        log "${RED}⚠️ Iteration had issues, continuing...${NC}"
    fi
    
    # Commit any changes
    if git diff --quiet 2>/dev/null; then
        log "No changes to commit"
    else
        git add -A
        git commit -m "Ralph iteration $ITERATION: $NEXT_TASK" --no-verify 2>/dev/null || true
        log "${GREEN}📝 Changes committed${NC}"
    fi
    
    # Brief pause
    sleep 2
done

log ""
log "${PURPLE}═══════════════════════════════════════════════════════════════${NC}"
log "${GREEN}🐛 Ralph completed after $ITERATION iterations${NC}"
log "${PURPLE}═══════════════════════════════════════════════════════════════${NC}"
