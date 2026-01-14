#!/bin/bash
# Ralph Wiggum DAEMON - Runs forever in background
# "I'm learnding!" - Ralph Wiggum

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
cd "$PROJECT_DIR"

LOG_FILE=".ralph/daemon.log"
PID_FILE=".ralph/daemon.pid"

mkdir -p .ralph

start_daemon() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p "$PID" > /dev/null 2>&1; then
            echo "🐛 Ralph is already running (PID: $PID)"
            echo "   Use: ./.cursor/ralph-scripts/ralph-daemon.sh stop"
            exit 1
        fi
    fi

    echo "🐛 Starting Ralph Wiggum Daemon..."
    nohup "$SCRIPT_DIR/ralph-loop.sh" "${1:-50}" "${2:-claude-sonnet-4-5-20250514}" >> "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"
    echo "✅ Ralph started with PID: $(cat $PID_FILE)"
    echo "   Monitor: tail -f .ralph/daemon.log"
    echo "   Stop:    ./.cursor/ralph-scripts/ralph-daemon.sh stop"
}

stop_daemon() {
    if [ ! -f "$PID_FILE" ]; then
        echo "❌ Ralph is not running (no PID file)"
        exit 1
    fi

    PID=$(cat "$PID_FILE")
    if ps -p "$PID" > /dev/null 2>&1; then
        echo "🛑 Stopping Ralph (PID: $PID)..."
        kill "$PID"
        rm -f "$PID_FILE"
        echo "✅ Ralph stopped"
    else
        echo "❌ Ralph process not found (stale PID file)"
        rm -f "$PID_FILE"
    fi
}

status_daemon() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p "$PID" > /dev/null 2>&1; then
            echo "🐛 Ralph is RUNNING (PID: $PID)"
            echo ""
            echo "📊 Progress:"
            grep -c "\- \[x\]" RALPH_TASK.md 2>/dev/null || echo "0"
            echo " completed"
            grep -c "\- \[ \]" RALPH_TASK.md 2>/dev/null || echo "0"
            echo " remaining"
            echo ""
            echo "📜 Last 5 log lines:"
            tail -5 "$LOG_FILE" 2>/dev/null || echo "(no log yet)"
        else
            echo "❌ Ralph is NOT RUNNING (stale PID)"
        fi
    else
        echo "❌ Ralph is NOT RUNNING"
    fi
}

case "${1:-start}" in
    start)
        start_daemon "$2" "$3"
        ;;
    stop)
        stop_daemon
        ;;
    status)
        status_daemon
        ;;
    restart)
        stop_daemon 2>/dev/null
        sleep 1
        start_daemon "$2" "$3"
        ;;
    logs)
        tail -f "$LOG_FILE"
        ;;
    *)
        echo "Usage: $0 {start|stop|status|restart|logs} [iterations] [model]"
        exit 1
        ;;
esac
