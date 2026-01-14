#!/bin/bash
# Ralph Wiggum v4 - MEMORY SAFE
# Won't crash your Mac
# "My cat's breath smells like cat food" - Ralph

cd /Users/sebastiandysart/Projects/Agent-Bounty

MAX_ITERATIONS=${1:-100}
TASK_FILE="RALPH_TASK.md"
LOG_FILE=".ralph/activity.log"
SKIP_FILE=".ralph/skipped_tasks.txt"

# MEMORY SAFE SETTINGS
MAX_ATTEMPTS_PER_TASK=3
CLAUDE_TIMEOUT=180          # Shorter timeout (3 min)
PAUSE_BETWEEN_ITERATIONS=10 # 10 sec cooldown
MEMORY_CLEANUP_INTERVAL=3   # Cleanup every 3 iterations

mkdir -p .ralph
touch "$SKIP_FILE"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Memory cleanup function
cleanup_memory() {
    log "🧹 Cleaning up memory..."
    # Kill any orphaned node processes from Claude
    pkill -f "node.*claude" 2>/dev/null || true
    # Clear npm cache
    npm cache clean --force 2>/dev/null || true
    # Force garbage collection hint
    sync
    sleep 2
}

# Check available memory (MB)
get_free_memory() {
    vm_stat | awk '/Pages free/ {free=$3} /Pages inactive/ {inactive=$3} END {print int((free+inactive)*4096/1024/1024)}'
}

# Timeout function for Mac
run_with_timeout() {
    local timeout=$1
    shift
    local cmd="$@"
    
    eval "$cmd" &
    local pid=$!
    
    local elapsed=0
    while kill -0 $pid 2>/dev/null; do
        sleep 5
        elapsed=$((elapsed + 5))
        if [ $elapsed -ge $timeout ]; then
            log "⏰ Timeout - killing process"
            kill -9 $pid 2>/dev/null
            wait $pid 2>/dev/null
            return 124
        fi
    done
    
    wait $pid 2>/dev/null
    return $?
}

task_hash() {
    echo "$1" | md5 | cut -c1-8
}

is_skipped() {
    grep -qF "$1" "$SKIP_FILE" 2>/dev/null
}

skip_task() {
    echo "$1" >> "$SKIP_FILE"
    log "⏭️ SKIPPING: $2"
}

log ""
log "═══════════════════════════════════════════════════════════════"
log "🐛 RALPH WIGGUM v4 - MEMORY SAFE MODE"
log "═══════════════════════════════════════════════════════════════"
log "   Max iterations: $MAX_ITERATIONS"
log "   Timeout: ${CLAUDE_TIMEOUT}s"
log "   Cooldown: ${PAUSE_BETWEEN_ITERATIONS}s between iterations"
log "   Memory cleanup: every $MEMORY_CLEANUP_INTERVAL iterations"
log "   Free memory: $(get_free_memory) MB"

if [ ! -f "$TASK_FILE" ]; then
    log "❌ No RALPH_TASK.md"
    exit 1
fi

ITERATION=0
LAST_HASH=""
ATTEMPTS=0

while [ $ITERATION -lt $MAX_ITERATIONS ]; do
    ITERATION=$((ITERATION + 1))
    
    # Memory cleanup every N iterations
    if [ $((ITERATION % MEMORY_CLEANUP_INTERVAL)) -eq 0 ]; then
        cleanup_memory
    fi
    
    # Check memory before starting
    FREE_MEM=$(get_free_memory)
    if [ "$FREE_MEM" -lt 500 ]; then
        log "⚠️ Low memory (${FREE_MEM}MB) - forcing cleanup"
        cleanup_memory
        sleep 10
    fi
    
    CHECKED=$(grep -c "\- \[x\]" "$TASK_FILE" 2>/dev/null || echo "0")
    UNCHECKED=$(grep -c "\- \[ \]" "$TASK_FILE" 2>/dev/null || echo "0")
    SKIPPED_COUNT=$(wc -l < "$SKIP_FILE" 2>/dev/null | tr -d ' ')
    
    log ""
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log "📍 ITERATION $ITERATION/$MAX_ITERATIONS | ✅$CHECKED | ⏳$UNCHECKED | 💾${FREE_MEM}MB free"
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    if [ "$UNCHECKED" -eq 0 ]; then
        log "🎉 ALL TASKS COMPLETE!"
        break
    fi
    
    # Find next task
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
    
    if [ -z "$NEXT_TASK" ]; then
        log "❌ All remaining tasks skipped"
        break
    fi
    
    HASH=$(task_hash "$NEXT_TASK")
    
    if [ "$HASH" = "$LAST_HASH" ]; then
        ATTEMPTS=$((ATTEMPTS + 1))
        if [ $ATTEMPTS -ge $MAX_ATTEMPTS_PER_TASK ]; then
            skip_task "$HASH" "$NEXT_TASK"
            LAST_HASH=""
            ATTEMPTS=0
            continue
        fi
        log "⚠️ Retry $ATTEMPTS/$MAX_ATTEMPTS_PER_TASK"
    else
        ATTEMPTS=1
        LAST_HASH="$HASH"
    fi
    
    log "🎯 Task: ${NEXT_TASK:0:60}..."
    
    BEFORE=$CHECKED
    
    # Create simple prompt
    cat > /tmp/ralph_prompt.txt << PROMPT_END
You are Ralph. Complete this task in /Users/sebastiandysart/Projects/Agent-Bounty:

$NEXT_TASK

1. Write the code
2. Run npm test
3. Edit RALPH_TASK.md to mark this [x]
4. git add -A && git commit

Be fast and efficient.
PROMPT_END

    log "🤖 Claude working (${CLAUDE_TIMEOUT}s max)..."
    
    # Run with lower priority (nice) to not hog CPU
    run_with_timeout $CLAUDE_TIMEOUT "nice -n 10 npx @anthropic-ai/claude-code --print --dangerously-skip-permissions < /tmp/ralph_prompt.txt >> '$LOG_FILE' 2>&1" || true
    
    rm -f /tmp/ralph_prompt.txt
    
    # Check completion
    AFTER=$(grep -c "\- \[x\]" "$TASK_FILE" 2>/dev/null || echo "0")
    
    if [ "$AFTER" -gt "$BEFORE" ]; then
        log "✅ Task DONE!"
        LAST_HASH=""
        ATTEMPTS=0
    else
        log "⚠️ Not done - will retry"
    fi
    
    # Commit
    git add -A 2>/dev/null || true
    git commit -m "Ralph #$ITERATION: ${NEXT_TASK:0:50}" --no-verify 2>/dev/null || true
    git push origin main 2>/dev/null || true
    
    # IMPORTANT: Cooldown to let memory free up
    log "💤 Cooling down ${PAUSE_BETWEEN_ITERATIONS}s..."
    sleep $PAUSE_BETWEEN_ITERATIONS
done

# Final cleanup
cleanup_memory

log ""
log "═══════════════════════════════════════════════════════════════"
log "🐛 RALPH COMPLETE - $ITERATION iterations"
log "   Completed: $(grep -c '\- \[x\]' $TASK_FILE 2>/dev/null || echo 0)"
log "   Remaining: $(grep -c '\- \[ \]' $TASK_FILE 2>/dev/null || echo 0)"
log "═══════════════════════════════════════════════════════════════"
