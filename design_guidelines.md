# BountyAI Design Guidelines - MAX Tier Premium Edition

## Design Philosophy
**"Neon Nexus"** - A premium B2B marketplace design that stands out from generic AI-generated layouts through strategic use of gradients, glass morphism, depth, and purposeful motion.

**Core Principles:**
- **Cinematic depth** - Layered backgrounds with radial gradients, subtle glow effects, and noise textures
- **Branded identity** - Consistent violet→fuchsia→cyan gradient as the signature visual element
- **Premium surfaces** - Glass morphism panels with backdrop blur, subtle borders, and hover lift effects
- **Information hierarchy** - Clear typography scale with Space Grotesk display font for headings
- **Purposeful motion** - Subtle animations that enhance UX without distraction

---

## Color System

### Primary Palette
- **Primary**: Violet (`hsl(252, 100%, 67%)`) - Main brand color
- **Gradient Start**: Violet-500 (`#8B5CF6`)
- **Gradient Mid**: Fuchsia-500 (`#D946EF`)
- **Gradient End**: Cyan-400 (`#22D3EE`)

### Semantic Colors
- **Success**: Emerald-500 (`#10B981`) - Monetary values, completion, positive states
- **Warning**: Amber-500 (`#F59E0B`) - Alerts, pending states
- **Error**: Red-500 (`#EF4444`) - Failed states, destructive actions
- **Info**: Cyan-500 (`#06B6D4`) - Informational highlights

### Surface Colors
- **Background**: Soft warm gray with subtle blue undertone
- **Card**: Pure white (light) / Deep navy (`#0f172a` dark)
- **Glass**: `backdrop-blur-xl` with 80% opacity card background

---

## Typography

### Font Families
- **Display**: Space Grotesk - All headings (h1-h6), hero text, feature titles
- **Body**: Inter - UI elements, body text, labels, descriptions
- **Mono**: JetBrains Mono - Monetary values, IDs, code, technical specs

### Scale
- **Hero**: `text-5xl md:text-6xl lg:text-7xl`, Space Grotesk, `font-bold`, `-tracking-tight`
- **Section headings**: `text-4xl md:text-5xl`, Space Grotesk, `font-bold`
- **Card titles**: `text-lg font-semibold`
- **Body**: `text-base`, Inter, `leading-relaxed`
- **Small/Labels**: `text-sm font-medium`, `text-muted-foreground`
- **Micro**: `text-xs font-medium uppercase tracking-wide`

---

## Component Patterns

### Premium Card (`card-premium`)
```css
- Rounded-xl corners
- Subtle border with 50% opacity
- Hover: lift effect (-2px translateY), increased shadow, gradient top border reveal
- Optional: gradient left accent bar for status indication
```

### Glass Panels (`glass`)
```css
- backdrop-blur-xl
- 80% opacity background
- 50% opacity border
- Used for: headers, floating panels, modal overlays
```

### Gradient Button (`btn-gradient`)
```css
- Background: linear-gradient violet→fuchsia
- Box-shadow glow effect
- Hover: intensified shadow, slight lift
- Used for primary CTAs only
```

### Stat Cards (`stat-card`)
```css
- Gradient icon containers (12x12, rounded-xl)
- Trend indicators with color-coded percentages
- Hover scale animation on icons
```

---

## Layout Patterns

### Hero Section
- Full viewport height option
- Layered radial gradients (hero-gradient class)
- Floating decorative blur circles with slow pulse animation
- Split layout: content left, interactive preview right
- Noise texture overlay for depth

### Stats Bar
- 4-column grid on desktop, 2-column on mobile
- Each stat: icon (gradient bg) + value + label + trend
- Subtle dividers or card separation

### Card Grids
- 1 col mobile → 2 col tablet → 3 col desktop
- Consistent gap-6 spacing
- Staggered hover effects (not simultaneous)

---

## Micro-interactions

### Hover States
- Cards: `translateY(-2px)`, increased shadow, gradient top line appears
- Buttons: shadow intensifies, slight scale for icon buttons
- Links: color transition to primary
- Icons: scale(1.1) with smooth transition

### Loading States
- Skeleton with shimmer animation
- Pulse animation for live indicators
- Slow float animation for decorative elements

### Status Indicators
- Gradient left border (1px width, full height)
- Color-coded badges with matching border colors
- Pulsing dot for "live" or "in progress" states

---

## Spacing

### Consistent Scale
- **Tight**: 2-3 (badge padding, inline gaps)
- **Base**: 4 (card content gaps)
- **Comfortable**: 6 (between card sections)
- **Section**: 16-24 (between page sections)

### Container
- `max-w-7xl mx-auto px-4 md:px-6`

---

## Dark Mode Considerations

- Gradients reduce opacity (25% vs 30%)
- Glow effects become more prominent
- Noise texture increases opacity (5% vs 3%)
- Card backgrounds shift to deep navy
- Maintain same gradient accent colors

---

## Animation Keyframes

```css
@keyframes float - 6s infinite, subtle Y translation
@keyframes glow - 2s alternate, pulsing shadow
@keyframes gradient - 8s infinite, background position shift
@keyframes shimmer - 2s infinite, loading skeleton effect
@keyframes pulse - 4s infinite, subtle opacity pulse
```

---

## Accessibility

- All interactive elements have visible focus states
- Color contrast ratios meet WCAG AA standards
- Animations respect `prefers-reduced-motion`
- Clear visual hierarchy through size and weight, not color alone

---

## Implementation Checklist

- [ ] All headings use Space Grotesk font
- [ ] Primary CTAs use gradient buttons
- [ ] Cards use `card-premium` class with hover effects
- [ ] Monetary values use `font-mono` and emerald-500 color
- [ ] Status badges use gradient left borders
- [ ] Hero sections include gradient background and noise overlay
- [ ] Glass effect used for sticky headers and overlays
- [ ] Icons inside gradient-colored containers
