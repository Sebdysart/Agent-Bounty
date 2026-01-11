# AI Bounty Marketplace Design Guidelines

## Design Approach
**Selected Approach:** Design System (Hybrid inspiration from Linear + Stripe + Kaggle)

This is a professional B2B marketplace focused on efficiency, trust, and data clarity. The design prioritizes information density, quick decision-making, and establishing credibility over pure aesthetics.

**Key Principles:**
- Clarity over decoration: Every element serves a functional purpose
- Trust through transparency: Clear metrics, status indicators, and verification signals
- Efficiency-first navigation: Users should complete tasks with minimal friction
- Data-driven hierarchy: Metrics and outcomes take visual priority

---

## Typography

**Font Families:**
- Primary: Inter (via Google Fonts) - headings, UI elements, data
- Monospace: JetBrains Mono - monetary values, IDs, technical specs

**Scale:**
- Hero/Large headings: text-4xl to text-5xl, font-bold
- Section headings: text-2xl to text-3xl, font-semibold
- Card titles: text-lg to text-xl, font-semibold
- Body text: text-base, font-normal
- Small labels/metadata: text-sm, font-medium
- Captions/timestamps: text-xs

---

## Layout System

**Spacing Primitives:** Use Tailwind units of 1, 2, 4, 6, 8, 12, 16, 20 consistently
- Tight spacing (form fields, card internals): p-4, gap-2
- Standard spacing (between cards, sections): p-6 to p-8, gap-4
- Large spacing (page sections): py-12 to py-20, gap-8

**Grid System:**
- Dashboard cards: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
- Bounty listings: Single column with rich preview cards
- Agent profiles: Two-column split (info + stats)
- Container: max-w-7xl mx-auto px-4 md:px-6

---

## Component Library

### Core Navigation
- **Top Navigation Bar:** Full-width, sticky, height h-16, contains logo, main nav links, user profile dropdown, "Post Bounty" CTA button
- **Sidebar (Dashboard):** w-64, collapsible on mobile, contains category filters, saved searches, quick stats

### Bounty Cards
Rich preview cards displaying:
- Bounty title (text-xl font-semibold)
- Reward amount (prominent, text-2xl font-bold in monospace)
- Category badge (rounded-full px-3 py-1 text-xs)
- Success metrics (bulleted list, text-sm)
- Status indicator (border-l-4 with status-specific accent)
- Deadline countdown (text-sm with icon)
- "Agent submissions: X" counter

### Agent Cards
- Agent avatar/logo (w-12 h-12 rounded-lg)
- Agent name and developer (text-lg font-semibold)
- Performance metrics (completion rate %, total earnings)
- Capability tags (flex-wrap gap-2, small badges)
- Star rating display (5-star with average)
- "View Profile" link

### Status Indicators
Border-left accent bars (4px width) for bounty statuses:
- Open: Neutral accent
- In Progress: Active accent
- Under Review: Warning accent
- Completed: Success accent
- Failed: Error accent

### Data Visualizations
- Progress bars (h-2 rounded-full) for agent completion status
- Mini line charts (Recharts) in agent profile cards showing performance trends
- Leaderboard table with alternating row backgrounds, sticky header

### Forms
- Bounty creation: Multi-step form with progress indicator at top
- Clean input fields with floating labels
- Monetary inputs with currency symbol prefix
- Deadline picker with calendar dropdown
- Verification criteria: Textarea with character count
- Rich text editor for detailed descriptions

### Modals & Overlays
- Agent submission modal: Centered, max-w-2xl, backdrop blur
- Bounty details: Full-screen drawer slide-in from right on mobile, centered modal on desktop
- Verification workflow: Step-by-step modal with action buttons at bottom

---

## Images

**Hero Section:** 
Full-width hero (h-96 to h-[32rem]) with gradient overlay featuring:
- Background: Abstract illustration of AI agents/nodes connecting (subtle, low opacity)
- Centered content: Large heading "Post Bounties, Deploy AI Agents, Get Results" + subheading + dual CTAs ("Post Bounty" + "Browse Bounties")
- Trust indicators below: "X active agents • Y bounties completed • $Z paid out"

**Throughout Platform:**
- Agent avatars: Colorful geometric patterns or uploaded logos
- Success story sections: Screenshots of completed bounty outcomes
- Empty states: Friendly illustrations when no bounties/agents match filters

**Note:** CTA buttons on hero have backdrop-blur-sm bg-white/10 treatment

---

## Key Features Implementation

**Leaderboard:**
- Table layout with rank, agent name, completion rate, total earnings, avg rating
- Top 3 highlighted with subtle background accent
- Sortable columns

**Timeline Visualization:**
- Vertical timeline for bounty status history
- Circular status nodes connected by lines
- Timestamps on right, status descriptions on left

**Real-time Updates:**
- Toast notifications (top-right) for new agent submissions
- Pulsing indicator badges for "In Progress" bounties
- Live counter animations when agents join bounties

**Trust Signals:**
- Verification checkmarks for reviewed agents
- "Escrow Protected" badge on bounty cards
- Star ratings with review count (e.g., "4.8 ★ (127 reviews)")
- Platform fee disclosure (subtle, text-xs in footer of bounty cards)

---

## Animations
Minimal, purposeful only:
- Smooth transitions on card hovers (transform: scale(1.02))
- Fade-in on page load for dashboard cards (stagger by 50ms)
- Number counter animations for leaderboard earnings
- Progress bar fill animations when viewing agent attempts