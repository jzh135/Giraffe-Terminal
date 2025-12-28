# 🧩 Component Design

## Overview

This document describes the reusable components in Giraffe Terminal.

---

## Modal Components

Located in `src/components/modals/`

### AddAccountModal
- Create new investment accounts
- Fields: Name, Description
- Validation: Name required

### BuyModal
- Record buy transactions
- Fields: Shares, Price, Date, Notes
- Auto-calculates total cost

### SellModal
- Record sell transactions
- Tax lot selection for FIFO/specific lot
- Shows realized gain preview

### DividendModal
- Record dividend payments
- Fields: Amount, Date, Notes

### CashMovementModal
- Record deposits/withdrawals
- Type toggle (Deposit/Withdraw)
- Fields: Amount, Date, Notes

### StockSplitModal
- Record stock splits
- Fields: Ratio, Date
- Preview of new share count

### NoteModal
- Add notes to transactions
- Rich text input
- Character limit display

### DeleteConfirmModal
- Confirmation for deletions
- Shows impact warning
- Requires explicit confirmation

### AllocationModal
- Expanded pie chart view
- Full-screen mode
- Interactive legend

---

## Shared UI Patterns

### StarRating
- 1-5 star rating input
- Clickable or display-only
- Hover preview

### Card
- Elevated container
- Optional hover lift effect
- Consistent padding/radius

### Button Variants
- Primary: Filled accent
- Secondary: Outlined
- Ghost: Text only
- Danger: Red for destructive

### Table
- Alternating rows
- Sortable headers
- Responsive scroll

### Badge
- Small label/tag
- Color variants
- Pill shape

### Toast Notifications
Located in `src/components/Toast.jsx`

**Components:**
- `ToastContainer` - Renders all active toasts
- `Toast` - Individual notification

**Hook:**
- `useToast()` - Returns `{ toasts, addToast, removeToast }`

**Usage:**
```jsx
import { ToastContainer, useToast } from '../components/Toast';

const { toasts, addToast, removeToast } = useToast();

// Show toast
addToast('Message', 'success'); // success | error | warning | info

// Render
<ToastContainer toasts={toasts} removeToast={removeToast} />
```

**Features:**
- Auto-dismiss after 4 seconds
- Click to dismiss
- Slide-in animation
- Stacks vertically

---

## Chart Components

Built with Recharts

### LineChart
- Performance over time
- Multiple series support
- Interactive tooltips
- Responsive container

### PieChart
- Allocation breakdown
- Smart labels
- Expandable legend
- Click interactions

---

## Form Components

### TextInput
- Dark theme styling
- Clear validation states
- Focus glow effect

### Select/Dropdown
- Custom styled
- Search support
- Multi-select option

### DatePicker
- Calendar popup
- Quick presets
- Range selection

### NumberInput
- Currency formatting
- Min/max validation
- Step controls
