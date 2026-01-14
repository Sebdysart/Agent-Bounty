#!/bin/bash
# RALPH WIGGUM BACKGROUND RUNNER v2
# Fixed: Pass prompt as argument instead of stdin

cd /Users/sebastiandysart/Projects/Agent-Bounty

LOG_DIR=".ralph"
MAIN_LOG="$LOG_DIR/ralph-background.log"
PID_FILE="$LOG_DIR/ralph.pid"

mkdir -p "$LOG_DIR"

# Check if already running
if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE")
    if ps -p "$OLD_PID" > /dev/null 2>&1; then
        echo "⚠️  Ralph is already running (PID: $OLD_PID)"
        echo "   Log: tail -f $MAIN_LOG"
        echo "   Stop: kill $OLD_PID"
        exit 1
    fi
fi

echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║  🐛 LAUNCHING RALPH WIGGUM IN BACKGROUND                          ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"

MAX_ITERATIONS=${1:-50}
MODEL=${2:-"claude-sonnet-4-5-20250514"}

echo ""
echo "📋 Configuration:"
echo "   Max iterations: $MAX_ITERATIONS"
echo "   Model: $MODEL"
echo "   Log file: $MAIN_LOG"
echo ""

# Create worker script
cat > "$LOG_DIR/worker.sh" << 'WORKER_EOF'
#!/bin/bash
cd /Users/sebastiandysart/Projects/Agent-Bounty

MAX_ITERATIONS=$1
MODEL=$2
LOG_FILE=".ralph/ralph-background.log"
TASK_FILE="RALPH_TASK.md"

echo "═══════════════════════════════════════════════════════════════════" >> "$LOG_FILE"
echo "🚀 Ralph Started: $(date)" >> "$LOG_FILE"
echo "   Iterations: $MAX_ITERATIONS | Model: $MODEL" >> "$LOG_FILE"
echo "═══════════════════════════════════════════════════════════════════" >> "$LOG_FILE"

ITERATION=0
CONSECUTIVE_FAILURES=0

while [ $ITERATION -lt $MAX_ITERATIONS ]; do
    ITERATION=$((ITERATION + 1))
    
    echo "" >> "$LOG_FILE"
    echo "━━━ ITERATION $ITERATION ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >> "$LOG_FILE"
    echo "[$(date '+%H:%M:%S')]" >> "$LOG_FILE"
    
    # Progress check
    UNCHECKED=$(grep -c "\- \[ \]" "$TASK_FILE" 2>/dev/null || echo "0")
    CHECKED=$(grep -c "\- \[x\]" "$TASK_FILE" 2>/dev/null || echo "0")
    
    echo "Progress: $CHECKED done, $UNCHECKED remaining" >> "$LOG_FILE"
    
    if [ "$UNCHECKED" -eq 0 ] && [ "$CHECKED" -gt 0 ]; then
        echo "🎉 ALL TASKS COMPLETE!" >> "$LOG_FILE"
        break
    fi
    
    # Get next task
    NEXT_TASK=$(grep -m1 "\- \[ \]" "$TASK_FILE" | sed 's/- \[ \] //')
    echo "Next: $NEXT_TASK" >> "$LOG_FILE"
    
    # Build prompt (shorter for better performance)
    TASK_CONTENT=$(cat "$TASK_FILE")
    PROMPT="You are Ralph Wiggum working on Agent-Bounty tests.

TASK FILE:
$TASK_CONTENT

CURRENT TASK: $NEXT_TASK

INSTRUCTIONS:
1. Create the test file if it doesn't exist
2. Write comprehensive tests for the component
3. Run: npm test to verify
4. Mark [x] in RALPH_TASK.md when tests pass
5. Output <promise>DONE</promise> when ALL tasks complete

Iteration $ITERATION/$MAX_ITERATIONS. Work in /Users/sebastiandysart/Projects/Agent-Bounty"

    echo "🤖 Running Claude..." >> "$LOG_FILE"
    
    # Run Claude Code with prompt as argument
    if OUTPUT=$(npx @anthropic-ai/claude-code --print --dangerously-skip-permissions --model "$MODEL" "$PROMPT" 2>&1); then
        # Log first/last lines (truncate middle for massive outputs)
        LINES=$(echo "$OUTPUT" | wc -l)
        if [ "$LINES" -gt 100 ]; then
            echo "$OUTPUT" | head -30 >> "$LOG_FILE"
            echo "... [$((LINES - 60)) lines truncated] ..." >> "$LOG_FILE"
            echo "$OUTPUT" | tail -30 >> "$LOG_FILE"
        else
            echo "$OUTPUT" >> "$LOG_FILE"
        fi
        
        CONSECUTIVE_FAILURES=0
        
        # Check completion
        if echo "$OUTPUT" | grep -q "<promise>DONE</promise>"; then
            echo "🎉 COMPLETION PROMISE!" >> "$LOG_FILE"
            break
        fi
        
        # Check if task was marked
        NEW_CHECKED=$(grep -c "\- \[x\]" "$TASK_FILE" 2>/dev/null || echo "0")
        if [ "$NEW_CHECKED" -gt "$CHECKED" ]; then
            echo "✅ Task completed!" >> "$LOG_FILE"
        fi
    else
        CONSECUTIVE_FAILURES=$((CONSECUTIVE_FAILURES + 1))
        echo "❌ Failed ($CONSECUTIVE_FAILURES/5)" >> "$LOG_FILE"
        echo "Error: $OUTPUT" >> "$LOG_FILE"
        
        if [ $CONSECUTIVE_FAILURES -ge 5 ]; then
            echo "Too many failures. Stopping." >> "$LOG_FILE"
            break
        fi
    fi
    
    sleep 3
done

echo "" >> "$LOG_FILE"
echo "═══════════════════════════════════════════════════════════════════" >> "$LOG_FILE"
echo "🏁 Ralph Finished: $(date)" >> "$LOG_FILE"
echo "═══════════════════════════════════════════════════════════════════" >> "$LOG_FILE"

rm -f .ralph/ralph.pid
WORKER_EOF

chmod +x "$LOG_DIR/worker.sh"

# Launch detached
nohup bash "$LOG_DIR/worker.sh" "$MAX_ITERATIONS" "$MODEL" > /dev/null 2>&1 &
RALPH_PID=$!
echo $RALPH_PID > "$PID_FILE"

echo "✅ Ralph is running! PID: $RALPH_PID"
echo ""
echo "📊 Watch progress: tail -f $MAIN_LOG"
echo "🛑 Stop: kill $RALPH_PID"
