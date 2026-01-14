# 🐛 Ralph Wiggum Setup for Agent-Bounty

> "I'm helping!" - Ralph Wiggum

Autonomous development loop for persistent, iterative coding tasks.

## Quick Start

```bash
# Single iteration (test the setup)
./.cursor/ralph-scripts/ralph-once.sh

# Full autonomous loop (up to 20 iterations)
./.cursor/ralph-scripts/ralph-loop.sh

# Custom iterations and model
./.cursor/ralph-scripts/ralph-loop.sh 30 claude-opus-4-5-20250514
```

## Requirements

One of these CLI tools:
- **Claude Code**: `npm install -g @anthropic-ai/claude-code`
- **Cursor Agent**: `curl https://cursor.com/install -fsS | bash`

## How It Works

1. Ralph reads `RALPH_TASK.md` for the task checklist
2. Sends the task to Claude/Cursor with current state
3. AI works on next unchecked item
4. AI marks item [x] when complete
5. Loop continues until all items checked or max iterations

## Files

```
Agent-Bounty/
├── RALPH_TASK.md              # Your task checklist (edit this!)
├── .cursor/ralph-scripts/
│   ├── ralph-loop.sh          # Main autonomous loop
│   └── ralph-once.sh          # Single iteration
└── .ralph/
    └── activity.log           # Execution history
```

## Current Task

**Comprehensive Test Coverage** - 8 phases, 60+ test cases covering:
- Payment system (Stripe escrow)
- Authentication & authorization
- Credential vault security
- Core API endpoints
- AI execution pipeline
- Rate limiting
- Integration tests

## Tips

- Monitor progress: `tail -f .ralph/activity.log`
- Check task status: `grep -c "\[x\]" RALPH_TASK.md` (completed)
- Let it run overnight for big tasks
- Commit frequently - Ralph makes lots of changes!
