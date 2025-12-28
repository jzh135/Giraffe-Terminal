# 📄 Page Designs

## Overview

This document describes the design and functionality of each page in Giraffe Terminal.

---

## Dashboard (`/`)

The main landing page with portfolio overview.

### Features
- **Performance Card**: Total value, invested, YTD return with chart
- **Allocation Chart**: Pie chart groupable by Role, Theme, or Stock
- **Top Holdings**: Ranked by market value
- **Account Summary**: All accounts at a glance
- **Refresh Prices**: Manual price update

---

## Accounts (`/accounts`)

Account management page.

### Features
- Account cards with summary stats
- Add new account modal
- Navigation to account details

---

## Account Detail (`/accounts/:id`)

Single account view with holdings and cash movements.

### Features
- Account statistics
- Holdings table with prices
- Cash movements history
- Edit, Delete, Deposit, Withdraw

---

## Holdings (`/holdings`)

All holdings across accounts.

### Features
- Filter by account
- Toggle sold positions
- Sortable columns
- Click for stock detail

---

## Stock Detail (`/holdings/:id`)

Single stock position view.

### Features
- Stock summary with value
- Transaction history
- Dividend history
- Research panel
- Trade actions

---

## Research (`/holdings/:symbol/research`)

Stock research and analysis page.

### Features
- Investment thesis editor
- 6-dimension rating system
- Price target management
- Export to JSON

---

## Analysis (`/analysis`)

Portfolio-wide price target analysis.

### Features
- Weighted upside calculation
- Stocks-only view
- Near buy/sell zone alerts
- Sortable target table

---

## Performance (`/performance`)

Performance charts and analysis.

### Features
- Interactive line chart
- Timeframe presets
- S&P 500 benchmark
- Per-account or aggregate

---

## Activity (`/activity`)

Comprehensive activity log.

### Features
- All activity types
- Filter by type, account, date
- Color-coded entries

---

## Developer (`/developer`)

Developer tools and settings.

### Features
- Custom branding
- Database export
- History recalculation
