# 🦒 Alpha 1.7 - SEC EDGAR Integration & Unified Price Refresh

**Release Date:** December 28, 2024

---

## ✨ New Features

### SEC EDGAR 10-K and 10-Q Integration
Added full integration with the SEC EDGAR API for accessing company 10-K annual reports and 10-Q quarterly reports.

#### Backend API (`/api/sec/`)
- **`GET /api/sec/cik/:ticker`** - Get CIK (Central Index Key) number for any ticker symbol
- **`GET /api/sec/filings/:ticker`** - Get list of SEC filings (defaults to 10-K)
- **`GET /api/sec/10k/:ticker`** - Download and cache a 10-K filing
- **`GET /api/sec/10k/:ticker/text`** - Get 10-K as plain text (HTML stripped) for AI processing
- **`GET /api/sec/10q/:ticker`** - Download and cache a 10-Q filing
- **`GET /api/sec/10q/:ticker/text`** - Get 10-Q as plain text (HTML stripped) for AI processing
- **`GET /api/sec/search?q=`** - Search for companies by name or ticker

#### Features:
- **Ticker-to-CIK Mapping**: Automatically fetches and caches SEC's ticker mapping (24-hour cache TTL)
- **10-K Caching**: Downloaded filings are saved to `data/sec-filings/` folder
- **Plain Text Extraction**: Strips HTML for AI agent consumption
- **SEC User-Agent Compliance**: Proper headers for SEC API compliance

### Stock Detail Page Enhancement
Added **📄 SEC Filings** section to the stock detail page:
- Collapsible section (click to expand)
- **Tabbed interface** for switching between 10-K and 10-Q filings
- Lazy loading - only fetches when expanded
- Shows 5 most recent filings for each type
- Direct links to view filings on SEC.gov
- Index link to see all filing documents
- Graceful error handling for ETFs/non-SEC tickers

### Design Documentation
Added comprehensive design documentation in `design-description/` folder:
- **01-overview.md** - Application summary and design philosophy
- **02-architecture.md** - System architecture with diagrams
- **03-database.md** - Database schema with ERD
- **04-frontend.md** - UI/UX design system
- **05-api.md** - RESTful API documentation
- **06-pages.md** - Page designs
- **07-components.md** - Component specifications

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

### CORS Proxy Removal
- Removed unnecessary CORS proxy (`corsproxy.io`) from `performance.js`
- CORS proxies are not needed for server-to-server requests
- Improves performance by eliminating proxy latency

---

## 📁 Files Changed

### New Files
- `server/routes/sec.js` - SEC EDGAR API routes
- `src/components/Toast.jsx` - Reusable toast notification component with useToast hook
- `design-description/` - Design documentation folder
- `devlog/` - Development log folder

### Modified Files
- `server/index.js` - Added SEC routes registration
- `server/routes/prices.js` - Rewrote `/refresh` endpoint with historical fetching
- `server/routes/performance.js` - Removed CORS proxy
- `src/api/index.js` - Added SEC API functions
- `src/pages/StockDetail.jsx` - Added SEC 10-K section
- `src/pages/Dashboard.jsx` - Added toast notifications
- `src/pages/Holdings.jsx` - Added toast notifications
- `src/index.css` - Added toast animation

---

## 🔮 Future Considerations

### AI Agent Integration
The SEC filing text endpoints are designed for AI agent consumption:
- `/api/sec/10k/:ticker/text` - Annual reports
- `/api/sec/10q/:ticker/text` - Quarterly reports
- Returns clean text with HTML stripped
- Can be used for financial analysis, risk extraction, earnings parsing

### Potential Enhancements
- Parse XBRL data for structured financials
- Add progress indicator for large history backfills
- Consider WebSocket for real-time price updates
