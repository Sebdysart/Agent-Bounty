#!/bin/bash
# Ralph Wiggum BULLETPROOF Loop v3
# NEVER STOPS until done or max iterations
# "I bent my wookie!" - Ralph

# NO set -e! We handle errors ourselves and NEVER stop

cd /Users/sebastiandysart/Projects/Agent-Bounty

MAX_ITERATIONS=${1:-100}
TASK_FILE="RALPH_TASK.md"
LOG_FILE=".ralph/activity.log"
SKIP_FILE=".ralph/skipped_tasks.txt"

# Anti-loop settings
MAX_ATTEMPTS_PER_TASK=3
CLAUDE_TIMEOUT=300

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
RED='\033[0;31m'
NC='\033[0m'

mkdir -p .ralph
touch "$SKIP_FILE"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Timeout function for Mac
run_with_timeout() {
    local timeout=$1
    shift
    local cmd="$@"
    
    # Run in background
    eval "$cmd" &
    local pid=$!
    
    # Monitor with timeout
    local elapsed=0
    while kill -0 $pid 2>/dev/null; do
        sleep 5
        elapsed=$((elapsed + 5))
        if [ $elapsed -ge $timeout ]; then
            log "${RED}⏰ Timeout after ${timeout}s - killing Claude${NC}"
            kill -9 $pid 2>/dev/null
            wait $pid 2>/dev/null
            return 124
        fi
    done
    
    wait $pid 2>/dev/null
    return $?
}

# Get task hash
task_hash() {
    echo "$1" | md5 | cut -c1-8
}

# Check if skipped
is_skipped() {
    grep -qF "$1" "$SKIP_FILE" 2>/dev/null
    return $?
}

# Skip a task
skip_task() {
    echo "$1" >> "$SKIP_FILE"
    log "${RED}⏭️ SKIPPING (${MAX_ATTEMPTS_PER_TASK} failures): $2${NC}"
}

log ""
log "${PURPLE}═══════════════════════════════════════════════════════════════${NC}"
log "${PURPLE}🐛 RALPH WIGGUM v3 - NEVER STOPS${NC}"
log "${PURPLE}═══════════════════════════════════════════════════════════════${NC}"
log "   Max iterations: $MAX_ITERATIONS"
log "   Max attempts/task: $MAX_ATTEMPTS_PER_TASK"
log "   Timeout: ${CLAUDE_TIMEOUT}s"

if [ ! -f "$TASK_FILE" ]; then
    log "${RED}❌ No RALPH_TASK.md - exiting${NC}"
    exit 1
fi

ITERATION=0
LAST_HASH=""
ATTEMPTS=0

# MAIN LOOP - runs until done or max iterations
while [ $ITERATION -lt $MAX_ITERATIONS ]; do
    ITERATION=$((ITERATION + 1))
    
    # Count tasks
    CHECKED=$(grep -c "\- \[x\]" "$TASK_FILE" 2>/dev/null || echo "0")
    UNCHECKED=$(grep -c "\- \[ \]" "$TASK_FILE" 2>/dev/null || echo "0")
    SKIPPED_COUNT=$(wc -l < "$SKIP_FILE" 2>/dev/null | tr -d ' ')
    
    log ""
    log "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    log "${YELLOW}📍 ITERATION $ITERATION/$MAX_ITERATIONS | ✅$CHECKED | ⏳$UNCHECKED | ⏭️$SKIPPED_COUNT${NC}"
    log "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    # ALL DONE?
    if [ "$UNCHECKED" -eq 0 ]; then
        log "${GREEN}🎉 ALL TASKS COMPLETE!${NC}"
        break
    fi
    
    # Find next unskipped task
    NEXT_TASK=""
    while IFS= read -r line; do
        if echo "$line" | grep -q "^\- \[ \]"; then
            TASK=$(echo "$line" | sed 's/^- \[ \] //')
            HASH=$(task_hash "$TASK")
            if ! is_skipped "$HASH"; then
                NEXT_TASK="$TASK"
                break
            fi
        fi
    done < "$TASK_FILE"
    
    # No tasks left (all skipped)?
    if [ -z "$NEXT_TASK" ]; then
        log "${RED}❌ All remaining tasks skipped${NC}"
        break
    fi
    
    HASH=$(task_hash "$NEXT_TASK")
    
    # Track attempts on same task
    if [ "$HASH" = "$LAST_HASH" ]; then
        ATTEMPTS=$((ATTEMPTS + 1))
        if [ $ATTEMPTS -ge $MAX_ATTEMPTS_PER_TASK ]; then
            skip_task "$HASH" "$NEXT_TASK"
            LAST_HASH=""
            ATTEMPTS=0
            continue  # Try next task
        fi
        log "${YELLOW}⚠️ Retry $ATTEMPTS/$MAX_ATTEMPTS_PER_TASK${NC}"
    else
        ATTEMPTS=1
        LAST_HASH="$HASH"
    fi
    
    log "${YELLOW}🎯 Task: ${NEXT_TASK:0:70}...${NC}"
    
    # Save current count
    BEFORE=$CHECKED
    
    # Build prompt
    cat > /tmp/ralph_prompt.txt << PROMPT_END
You are Ralph, an autonomous AI developer. Your job is to complete ONE task and mark it done.

WORKING DIRECTORY: /Users/sebastiandysart/Projects/Agent-Bounty

YOUR TASK:
$NEXT_TASK

STEPS:
1. Write the code/tests needed for this task
2. Run "npm test" to verify it works
3. CRITICAL: Edit RALPH_TASK.md to change "- [ ] $NEXT_TASK" to "- [x] $NEXT_TASK"
4. Run "git add -A && git commit -m 'Complete: $NEXT_TASK'"

DO NOT ask questions. DO NOT explain. Just DO IT.
PROMPT_END

    log "${PURPLE}🤖 Claude working...${NC}"
    
    # Run Claude with timeout - IGNORE exit code
    run_with_timeout $CLAUDE_TIMEOUT "npx @anthropic-ai/claude-code --print --dangerously-skip-permissions < /tmp/ralph_prompt.txt >> '$LOG_FILE' 2>&1" || true
    
    rm -f /tmp/ralph_prompt.txt
    
    # Check if task completed
    AFTER=$(grep -c "\- \[x\]" "$TASK_FILE" 2>/dev/null || echo "0")
    
    if [ "$AFTER" -gt "$BEFORE" ]; then
        log "${GREEN}✅ Task DONE!${NC}"
        LAST_HASH=""
        ATTEMPTS=0
    else
        log "${YELLOW}⚠️ Not marked done - will retry${NC}"
    fi
    
    # Commit & push (ignore errors)
    git add -A 2>/dev/null || true
    git commit -m "Ralph #$ITERATION: ${NEXT_TASK:0:50}" --no-verify 2>/dev/null || true
    git push origin main 2>/dev/null || true
    
    # Brief pause
    sleep 2
    
    log "${BLUE}--- Loop continues ---${NC}"
done

# FINAL REPORT
log ""
log "${PURPLE}═══════════════════════════════════════════════════════════════${NC}"
log "${GREEN}🐛 RALPH FINISHED after $ITERATION iterations${NC}"
log "   Completed: $(grep -c '\- \[x\]' $TASK_FILE 2>/dev/null || echo 0)"
log "   Remaining: $(grep -c '\- \[ \]' $TASK_FILE 2>/dev/null || echo 0)"
log "   Skipped: $(wc -l < $SKIP_FILE 2>/dev/null | tr -d ' ')"
log "${PURPLE}═══════════════════════════════════════════════════════════════${NC}"
