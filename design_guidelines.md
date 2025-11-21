# Contract Agent Design Guidelines

## Design Approach
**System-Based Approach** inspired by modern SaaS platforms (Linear, Notion, Dropbox Paper) with enterprise document management aesthetics. Focus on professional credibility, efficient workflows, and clear information hierarchy for legal contract management.

## Core Design Principles
1. **Professional Trust**: Clean, authoritative interface that inspires confidence in legal workflows
2. **Efficiency First**: Minimize clicks, optimize for power users and frequent tasks
3. **Document-Centric**: Design around contract readability and comparison workflows
4. **Clear Hierarchy**: Distinguish between navigation, content, and actions at all times

---

## Typography

**Font Stack**: Inter (primary), IBM Plex Mono (code/contract IDs)

**Hierarchy**:
- Page Titles: text-3xl, font-semibold
- Section Headers: text-xl, font-semibold
- Card Titles: text-lg, font-medium
- Body Text: text-base, font-normal
- Metadata/Secondary: text-sm, font-normal
- Labels/Captions: text-xs, font-medium, uppercase tracking-wide

---

## Layout System

**Spacing Units**: Use Tailwind units of **2, 3, 4, 6, 8, 12, 16** for consistent rhythm
- Component padding: p-4 to p-6
- Section spacing: space-y-6 to space-y-8
- Card gaps: gap-4 to gap-6
- Page margins: px-8, py-6

**Grid System**:
- Dashboard: 3-column stats grid (grid-cols-3)
- Contract List: Single column with full-width cards
- Detail Views: 2-column layout (main content 2/3, sidebar 1/3)

**Max Widths**:
- Full application: max-w-7xl mx-auto
- Contract content area: max-w-4xl
- Form containers: max-w-2xl

---

## Application Layout Structure

### Top Navigation Bar
- Height: h-16
- Sticky position with subtle shadow
- Left: Logo/Brand + Main nav links (Dashboard, Contracts, Templates, Validate)
- Right: Search bar, Notification bell, User avatar dropdown
- Background: Solid surface with border-b

### Sidebar (Optional for some views)
- Width: w-64
- Filters panel for contract hub (status, type, date ranges)
- Template categories for template library
- Collapsible on tablet/mobile

### Main Content Area
- Breathing room: px-8 py-6
- Clear page title with breadcrumb trail
- Action buttons aligned top-right (+ New Contract, Upload Template)

---

## Component Library

### Dashboard Cards
- Grid of 3 stats cards (Total Contracts, Pending Validation, Active Templates)
- Each card: p-6, rounded-lg border, shadow-sm
- Large number (text-4xl font-bold), label below (text-sm)
- Small trend indicator (icon + percentage)

### Contract List Cards
- Full-width cards with hover elevation
- Layout: Horizontal flex with contract icon, title, metadata row, status badge, action menu
- Metadata: Created date, Contract type, Parties involved (icons + text-sm)
- Status badges: Pill-shaped with semantic styling (Draft, Active, Pending, Validated)

### Contract Detail View
**Main Content (Left 2/3)**:
- Contract title (editable inline)
- Metadata bar: Type, Created date, Last modified, Version number
- Document viewer area: White background, generous padding (p-8), readable width
- Sections clearly delineated with borders or spacing

**Sidebar (Right 1/3)**:
- Validation status panel (if validated)
- Action buttons stacked vertically (Download, Share, Validate, Archive)
- Related contracts section
- Activity timeline (version history, comments)

### Contract Generation Interface
**Step-by-step workflow**:
1. Template Selection: Grid of template cards with preview
2. Business Proposal Input: Form with text area + file upload
3. AI Generation Progress: Loading state with LangGraph workflow steps
4. Review & Edit: Split view (generated draft left, editable right)
5. Finalize: Metadata form + save/publish actions

### Template Library
- Masonry grid layout (2-3 columns)
- Template cards: Preview thumbnail, title, category tag, usage count
- Upload new template: Prominent button + drag-drop zone

### Validation Interface
- Side-by-side comparison view
- Left: Business proposal (uploaded document or pasted text)
- Right: Contract being validated
- Bottom panel: AI validation results with highlighted discrepancies
- Color-coded markers: Issues (amber), Compliant (green), Suggestions (blue)

---

## Interactions & States

**Buttons**:
- Primary: Solid fill, medium font-weight
- Secondary: Outline style
- Sizes: Base (px-4 py-2), Large (px-6 py-3)
- Icons: 16px inline with text, 4px spacing

**Form Inputs**:
- Height: h-10 (base), h-12 (large)
- Border radius: rounded-md
- Focus: Ring style with offset
- File uploads: Dashed border drag-drop zones with icon + helper text

**Cards**:
- Border radius: rounded-lg
- Default: border + subtle shadow
- Hover: Elevated shadow (shadow-md)
- Active/Selected: Border accent

**Loading States**:
- Skeleton screens for contract lists
- Progress indicators for AI generation (stepper with checkmarks)
- Inline spinners for validation checks

---

## Navigation Patterns

**Primary Navigation**: Top bar with 4-5 main sections
**Breadcrumbs**: Below nav bar for deep navigation (Contracts > [Type] > [Contract Name])
**Action Context**: Floating action button (FAB) for quick contract creation on mobile
**Search**: Global search with recent items and suggestions dropdown

---

## Images

**No large hero images** - This is an application dashboard, not a marketing site.

**Icon Usage**:
- Contract type icons (document, agreement, NDA variants) - Use Heroicons
- Status indicators (check, clock, alert) 
- Navigation icons for clarity
- Empty states: Simple illustrations for "No contracts yet" states

**Placeholder States**:
- Empty contract list: Centered icon + text + CTA button
- Empty template library: Upload illustration with instructions

---

## Data Display

**Tables** (if needed for advanced filtering):
- Striped rows for readability
- Sticky header
- Sortable columns with caret indicators
- Row actions: Dropdown menu on right

**Charts** (Dashboard):
- Simple bar/line charts for contract trends over time
- Donut chart for contract status distribution
- Libraries: Chart.js or Recharts (lightweight)

**Metadata Displays**:
- Key-value pairs in definition list style
- Icons prefix keys for scannability
- Consistent spacing (space-y-2)

---

## Responsive Behavior

**Desktop (lg+)**: Full layout with sidebar, 3-column grids
**Tablet (md)**: Collapsible sidebar, 2-column grids
**Mobile**: Stack everything single-column, hamburger menu, bottom nav for key actions