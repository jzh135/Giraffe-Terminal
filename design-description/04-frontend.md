# 🎨 Frontend Design

## Overview

The Giraffe Terminal frontend is built with React and follows modern UI/UX principles with a focus on data density, visual clarity, and responsive interactions.

## Design System

### Color Palette

#### Primary Colors
| Color | Hex | Usage |
|-------|-----|-------|
| Background | `#1a1a2e` | Main app background |
| Surface | `#16213e` | Cards and panels |
| Surface Elevated | `#0f3460` | Elevated elements |
| Primary | `#e94560` | Primary accent (coral red) |
| Secondary | `#4ecca3` | Secondary accent (mint green) |
| Text Primary | `#ffffff` | Main text |
| Text Secondary | `#a0aec0` | Muted text |

#### Semantic Colors
| Color | Hex | Usage |
|-------|-----|-------|
| Success | `#48bb78` | Positive gains, buy targets |
| Danger | `#f56565` | Negative values, sell targets |
| Warning | `#ed8936` | Alerts, near zones |
| Info | `#4299e1` | Information highlights |

### Typography

| Element | Font | Size | Weight |
|---------|------|------|--------|
| H1 | System | 2rem | 700 |
| H2 | System | 1.5rem | 600 |
| H3 | System | 1.25rem | 600 |
| Body | System | 1rem | 400 |
| Small | System | 0.875rem | 400 |
| Mono | Monospace | 0.875rem | 400 |

### Spacing Scale

```
4px  - xs
8px  - sm
12px - md
16px - lg
24px - xl
32px - 2xl
48px - 3xl
```

### Component Patterns

#### Cards
```css
.card {
  background: var(--surface);
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 12px rgba(0, 0, 0, 0.4);
}
```

#### Buttons
- **Primary**: Filled background, white text
- **Secondary**: Outlined, colored border
- **Ghost**: No background, text only
- **Danger**: Red for destructive actions

#### Inputs
- Dark backgrounds with subtle borders
- Focus states with colored glow
- Clear validation states

## Layout Structure

### Main Layout
```
┌─────────────────────────────────────────────────────────────┐
│                        Header                                │
│  [Logo] [App Name]                    [Navigation Links]     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│                      Main Content                            │
│                                                              │
│  ┌─────────────────┐ ┌─────────────────┐ ┌───────────────┐  │
│  │    Card 1       │ │    Card 2       │ │    Card 3     │  │
│  │                 │ │                 │ │               │  │
│  └─────────────────┘ └─────────────────┘ └───────────────┘  │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    Full Width Card                       ││
│  │                                                          ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Responsive Breakpoints
| Breakpoint | Width | Layout |
|------------|-------|--------|
| Mobile | < 768px | Single column |
| Tablet | 768px - 1024px | Two columns |
| Desktop | > 1024px | Multi-column |

## Animation & Transitions

### Micro-interactions
- **Hover effects**: Subtle lift on cards (translateY)
- **Button feedback**: Scale down on click
- **Loading states**: Skeleton loaders
- **Transitions**: 200ms ease-in-out

### Page Transitions
- Fade in on route change
- Smooth scroll to top

## Component Hierarchy

```
App.jsx
├── Header (Navigation)
│
├── Pages
│   ├── Dashboard.jsx
│   │   ├── PerformanceCard
│   │   ├── AllocationChart
│   │   ├── TopHoldings
│   │   └── AccountSummary
│   │
│   ├── Holdings.jsx
│   │   ├── HoldingsList
│   │   └── AddHoldingModal
│   │
│   ├── StockDetail.jsx
│   │   ├── StockHeader
│   │   ├── TransactionTable
│   │   ├── ResearchPanel
│   │   └── ActionButtons
│   │
│   └── ... (other pages)
│
└── Modals
    ├── AddAccountModal
    ├── BuyModal
    ├── SellModal
    ├── DividendModal
    ├── CashMovementModal
    ├── StockSplitModal
    ├── NoteModal
    ├── DeleteConfirmModal
    └── AllocationModal
```

## Key UI Patterns

### Data Tables
- Alternating row backgrounds
- Sortable column headers
- Click-to-expand details
- Responsive horizontal scroll

### Charts (Recharts)
- Consistent color schemes
- Interactive tooltips
- Responsive containers
- Legend below chart

### Forms
- Inline validation
- Clear error messages
- Smart defaults
- Autofocus on open

### Loading States
- Spinner for short waits
- Skeleton for content loading
- Progress bar for long operations

### Error Handling
- Toast notifications for errors
- Inline error messages
- Retry actions where applicable

## Accessibility

### ARIA Support
- Proper heading hierarchy
- Button labels
- Form field associations
- Screen reader compatibility

### Keyboard Navigation
- Tab order follows visual order
- Enter/Space to activate buttons
- Escape to close modals
- Arrow keys in dropdowns

### Color Contrast
- WCAG AA compliance for text
- Icons with text labels
- Not relying solely on color

## State Management

### Local State (useState)
- Form inputs
- Modal visibility
- UI toggles

### Data Fetching
- Direct API calls with fetch
- Loading/error states per component
- Manual refresh buttons

### Shared State
- Branding settings (passed via props)
- Selected account (route params)

## Performance Optimizations

### Code Splitting
- Route-based lazy loading
- Modal components loaded on demand

### Caching
- Browser caching for static assets
- Backend caching for price data

### Rendering
- Memoization where needed
- Avoiding unnecessary re-renders
- Efficient list rendering

## File Organization

```
src/
├── main.jsx          # Entry point
├── App.jsx           # Router and layout
├── index.css         # Global styles
│
├── pages/            # Route components
│   ├── Dashboard.jsx
│   ├── Holdings.jsx
│   └── ...
│
├── components/       # Reusable components
│   └── modals/       # Modal dialogs
│
├── hooks/            # Custom hooks
│   └── useDebounce.js
│
└── api/              # API client
    └── index.js
```
