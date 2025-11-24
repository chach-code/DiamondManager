# Baseball Team Management Website - Design Guidelines

## Design Approach

**Selected Framework**: Hybrid approach combining sports app functionality (TeamSnap, SportsEngine) with modern web app aesthetics (Linear's clean data presentation + Notion's organizational clarity).

**Core Principle**: Professional sports management tool with baseball-specific personality through strategic use of imagery, iconography, and layout patterns that feel authentic to the sport.

## Typography

**Font Families** (via Google Fonts):
- Primary: 'Inter' - Clean, highly legible for data tables and forms
- Accent: 'Bebas Neue' - Bold, sporty headlines and section titles

**Type Scale**:
- Hero/Page Titles: text-4xl to text-5xl (Bebas Neue, uppercase)
- Section Headers: text-2xl to text-3xl (Bebas Neue)
- Card Titles: text-lg font-semibold (Inter)
- Body Text: text-base (Inter)
- Table Data/Stats: text-sm to text-base (Inter, tabular-nums for numbers)
- Labels: text-xs uppercase tracking-wide (Inter)

## Layout System

**Spacing Primitives**: Use Tailwind units of 3, 4, 6, 8, 12, and 16 for consistent rhythm
- Component padding: p-4, p-6, p-8
- Section spacing: mb-8, mb-12, mb-16
- Card gaps: gap-4, gap-6
- Container max-width: max-w-7xl

**Grid Patterns**:
- Roster list: Single column on mobile, 2-column cards on tablet (md:grid-cols-2), maintain single/double for desktop
- Position lineup: Visual baseball diamond layout (custom positioned grid)
- Batting order: Vertical numbered list with drag handles

## Component Library

### Navigation
- Sticky top navigation bar with logo left, primary actions right
- Tab navigation for switching between Roster, Batting Lineup, Position Lineup views
- Mobile: Hamburger menu with slide-out drawer

### Roster Management
- Player cards with jersey number prominently displayed (large circular badge)
- Card layout: Jersey number (left) | Player info (center) | Actions (right)
- Each card shows: Name, Number, Preferred Positions (as tags), Edit/Delete buttons
- "Add Player" - Large prominent button with plus icon at top of roster section
- Empty state: Illustration/icon with "Build your roster" messaging

### Forms (Add/Edit Player)
- Modal overlay with baseball stadium subtle background treatment
- Fields: Player Name (text), Jersey Number (number input), Preferred Positions (multi-select chips)
- Form inputs: Rounded borders (rounded-lg), generous padding (p-3), focus states with accent
- Submit buttons: Full-width on mobile, inline on desktop

### Lineup Displays

**Batting Lineup**:
- Numbered list (1-9) with large position numbers
- Each row: Position number | Player name | Jersey number
- "Generate Random Lineup" button at top (Baseball bat icon)
- Visual indicator if roster has fewer than 9 players
- Save lineup action with heart/bookmark icon

**Position Lineup**:
- Visual baseball diamond representation using absolute positioning
- Player badges positioned at field locations (P, C, 1B, 2B, 3B, SS, LF, CF, RF)
- Each position shows player name and jersey number in circular badges
- "Generate Random Positions" button with field diagram icon
- Desktop: Full diamond layout, Mobile: Simplified list view with position labels

### Data Tables (if roster view uses table format)
- Striped rows for readability (even rows with subtle background)
- Sticky header on scroll
- Sortable columns with arrow indicators
- Hover states on rows

### Action Buttons
- Primary actions: Solid backgrounds, rounded-lg, px-6 py-3
- Secondary actions: Outlined style
- Icon buttons: Circular (rounded-full), p-2
- Destructive actions: Use icon with confirmation modal

## Iconography

**Icon Library**: Heroicons (solid and outline variants via CDN)
- Use baseball-specific custom icons where needed: <!-- CUSTOM ICON: baseball bat, baseball diamond, jersey -->
- Action icons: Plus, Pencil, Trash, Shuffle (for random generation), Bookmark

## Images

**Hero Section**: 
- Full-width banner image of baseball stadium (1920x600px) with dark overlay gradient
- Centered white text overlay: "Team Roster Management"
- Subtle blur-background buttons for primary CTAs if placed over image

**Background Treatments**:
- Subtle baseball diamond watermark pattern on empty states
- Very faint baseball stitching texture on cards (5% opacity)

**Location & Usage**:
- Hero: Top of homepage/dashboard
- Empty states: Small illustrative icons/graphics for empty roster, no lineups saved
- Position lineup: Baseball field diagram as background for player positioning

## Interactions & States

**Minimal Animation Strategy**:
- Smooth transitions on hover (transition-all duration-200)
- Modal enter/exit: Fade and scale
- Card hover: Subtle lift (shadow increase)
- NO complex scroll animations or parallax

**Interactive States**:
- Hover: Slight shadow elevation on cards/buttons
- Active: Scale down slightly (scale-95)
- Focus: Visible outline for keyboard navigation
- Loading: Simple spinner for random generation actions
- Disabled: 50% opacity with cursor-not-allowed

## Responsive Breakpoints

- Mobile (default): Single column, stacked layouts
- Tablet (md: 768px): 2-column roster cards, expanded forms
- Desktop (lg: 1024px): Full layouts with sidebars if needed, wider forms