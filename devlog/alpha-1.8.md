# 🦒 Alpha 1.8 - Unified Price Refresh & Toast Notifications

**Release Date:** December 28, 2024

---

## ✨ New Features

### Unified Price Refresh
Consolidated all price fetching into a single "Refresh Prices" button that updates:
- **Current prices** for all holdings
- **Historical prices** for performance charts
- **S&P 500 (SPY)** benchmark data for comparison

#### How It Works:
1. For each symbol in your portfolio:
   - Finds the first transaction date
   - Fetches any missing historical prices from Yahoo Finance
   - Updates `price_history` table with all data points
   - Updates `stock_prices` with the latest price
2. Also fetches SPY historical data for benchmark comparison
3. Works even when market is closed (fills gaps from last trading day)

### Toast Notifications
Added a modern toast notification system for user feedback:
- **Success** ✅ - Shows number of prices refreshed and history points added
- **Warning** ⚠️ - Market closed indicator
- **Error** ❌ - Displays error messages
- Auto-dismiss after 4 seconds
- Click to dismiss early
- Stacks vertically for multiple notifications

---

## 🔧 Improvements

### Single Source of Truth
- `price_history` table is now the authoritative source for all price data
- `stock_prices` table gets its price from the latest `price_history` entry
- Performance chart and dashboard now use the same data source
- Eliminates price discrepancies between views

### Always-On Refresh
- Removed market hours check that prevented refreshing when closed
- Now always fetches missing historical data
- Toast shows "(market closed)" when applicable but still syncs data

---

## 📁 Files Changed

### New Files
- `src/components/Toast.jsx` - Reusable toast notification component with useToast hook

### Modified Files
- `server/routes/prices.js`
  - Completely rewrote `/refresh` endpoint
  - Added `fetchAndCacheHistoricalPrices()` helper
  - Added `getNextDay()` helper
  - Now fetches SPY alongside portfolio symbols
- `src/pages/Dashboard.jsx`
  - Added toast notifications for price refresh
  - Simplified refresh logic (always refreshes)
  - Reloads chart data after refresh
- `src/pages/Holdings.jsx`
  - Added toast notifications for price refresh
  - Simplified refresh logic
- `src/index.css`
  - Added `@keyframes slideIn` animation for toasts

---

## 🔧 Technical Details

### Price Refresh Flow
```
POST /api/prices/refresh
        ↓
For each holding symbol:
  1. Get first transaction date
  2. Get last cached price_history date
  3. Fetch missing dates from Yahoo Finance
  4. Insert/update price_history
  5. Update stock_prices with latest
        ↓
Fetch SPY (S&P 500):
  1. Get earliest transaction date
  2. Fetch missing SPY history
        ↓
Response: {
  prices: [...],
  historyUpdated: 84,
  message: "Refreshed 15 prices, added 84 history points"
}
```

### Toast Component API
```jsx
import { ToastContainer, useToast } from '../components/Toast';

const { toasts, addToast, removeToast } = useToast();

// Usage
addToast('Message here', 'success'); // success | error | warning | info

// Render
<ToastContainer toasts={toasts} removeToast={removeToast} />
```

---

## 🔮 Future Considerations

### Potential Enhancements
- Add progress indicator for large history backfills
- Batch Yahoo Finance requests for better performance
- Add refresh button to performance chart directly
- Consider WebSocket for real-time price updates during market hours
