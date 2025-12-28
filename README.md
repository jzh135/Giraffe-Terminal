# 🦒 Giraffe Terminal

A powerful and intuitive portfolio management application for tracking investments, analyzing performance, and managing your financial portfolio.

## 📋 Features

- **Account Management**: Create and manage multiple investment accounts
- **Holdings Tracking**: Track stocks, cash positions, and margin
- **Transaction History**: Record buys, sells, dividends, and cash movements
- **Performance Analytics**: Compare your portfolio performance against the S&P 500 benchmark
- **Stock Splits**: Automatic handling of stock split adjustments
- **Realized Gains Tracking**: Monitor realized gains and losses including dividends
- **Activity Log**: Comprehensive view of all portfolio activities
- **Research Panel**: Keep notes and research on stocks
- **Customizable Branding**: Personalize app name and logo
- **Developer Tools**: Database export and management features

## 🛠️ Technology Stack

### Frontend
- **React** - UI framework
- **Vite** - Build tool and development server
- **React Router** - Client-side routing
- **Recharts** - Data visualization
- **Luxon** - Date/time handling

### Backend
- **Node.js** - Runtime environment
- **Express** - Web framework
- **Better-SQLite3** - Database
- **CORS** - Cross-origin resource sharing

## 📦 Installation

### Prerequisites
- Node.js (v16 or higher)
- npm (comes with Node.js)

### Setup

1. **Clone or navigate to the project directory**:
   ```bash
   cd "d:\Web Based Apps\Giraffe Terminal"
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

## 🚀 Running the Application

### Option 1: Using the Batch File (Windows)
Simply double-click `start-server.bat` or run:
```bash
start-server.bat
```

This will start both the backend server and frontend development server concurrently.

### Option 2: Using npm Scripts

**Start both frontend and backend together**:
```bash
npm run dev
```

**Start only the backend server**:
```bash
npm run server
```

**Start only the frontend**:
```bash
npm run client
```

## 🌐 Accessing the Application

Once running, the application will be available at:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001

## 📁 Project Structure

```
giraffe-terminal/
├── server/              # Backend Express server
│   ├── index.js         # Server entry point
│   ├── db.js            # Database entry point
│   ├── migrations.js    # Database migrations
│   ├── schema.sql       # Database schema
│   ├── routes/          # API route handlers
│   ├── utils/           # Shared utility functions
│   └── middleware/      # Express middleware
├── src/                 # Frontend React application
│   ├── components/      # Reusable components
│   ├── pages/           # Page components
│   └── api/             # API client
├── data/                # Application data (database, SEC filings)
├── design-description/  # Design documentation
├── devlog/              # Development logs per version
├── index.html           # HTML entry point
├── vite.config.js       # Vite configuration
└── package.json         # Dependencies and scripts
```

## 💾 Database

The application uses SQLite for data storage. The database file is located at:
```
d:\Web Based Apps\Giraffe Terminal\data\giraffe.db
```

The database is automatically created on first run based on the schema defined in `server/schema.sql`.

## 🔧 Development

### Available Scripts

- `npm run dev` - Run both frontend and backend in development mode
- `npm run server` - Run backend server with hot reload (--watch mode)
- `npm run client` - Run Vite development server
- `npm run build` - Build frontend for production
- `npm run preview` - Preview production build

### Hot Reload

- **Backend**: Uses Node.js `--watch` flag for automatic restart on file changes
- **Frontend**: Vite provides instant hot module replacement (HMR)

## 📊 API Endpoints

The backend provides RESTful API endpoints:

- `/api/accounts` - Account management
- `/api/holdings` - Holdings management
- `/api/transactions` - Transaction history
- `/api/dividends` - Dividend tracking
- `/api/cash-movements` - Cash deposits/withdrawals
- `/api/stock-splits` - Stock split handling
- `/api/prices` - Price data management
- `/api/performance` - Performance analytics
- `/api/admin` - Admin operations (export, branding)

## 🎨 Customization

### Branding
Navigate to the Developer page in the application to customize:
- Application name
- Logo (emoji or custom image)

### Database Export
Use the Developer page to export your database for backup purposes.

## 📝 Usage Tips

1. **Create an Account**: Start by creating your first investment account
2. **Add Holdings**: Record your stock positions with purchase details
3. **Log Transactions**: Keep a complete record of all buys, sells, and dividends
4. **Track Cash Movements**: Record deposits and withdrawals with notes
5. **Monitor Performance**: View the Performance page to see how you're doing vs. S&P 500
6. **Research**: Use the Research panel to keep notes on stocks you're tracking

## 🐛 Troubleshooting

### Port Already in Use
If port 3001 or 5173 is already in use, you can change them:
- Backend: Set environment variable `PORT` before running
- Frontend: Modify `vite.config.js`

### Database Issues
If you encounter database issues:
1. Check that the `data` directory exists
2. Ensure you have write permissions
3. Use the Developer page to export before making changes

### Build Errors
If you encounter build errors:
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

## 📝 Dev Log

- **2025-12-28**: Version **alpha-1.7**
  - **SEC EDGAR Integration (NEW)**:
    - Added full SEC EDGAR API integration for 10-K annual reports.
    - New endpoints: `/api/sec/cik/:ticker`, `/api/sec/filings/:ticker`, `/api/sec/10k/:ticker`, `/api/sec/10k/:ticker/text`.
    - Ticker-to-CIK mapping with 24-hour caching.
    - Plain text extraction endpoint for AI agent use.
    - 10-K filings cached locally in `data/sec-filings/`.
  - **Stock Detail Page**:
    - Added **📄 SEC 10-K Filings** collapsible section.
    - Shows 5 most recent 10-K filings with direct links to SEC.gov.
  - **Design Documentation**:
    - Added `design-description/` folder with comprehensive docs.
    - Includes architecture, database schema, API docs, page designs.
  - **Backend**:
    - Removed unnecessary CORS proxy from performance routes.
  - **Devlog**:
    - Added `devlog/` folder for version tracking.

- **2025-12-18**: Version **alpha-1.6**
  - **Performance Chart Fix**:
    - Fixed chart not showing today's date - was stuck on previous trading day.
    - Improved cache freshness logic: on weekdays, always fetch today's prices; on weekends, use Friday's data.
  - **Price Refresh Improvements**:
    - Fixed "Refresh Prices" button to properly update portfolio value and all dashboard stats.
    - Holdings page refresh now correctly reloads full price data.
    - Dashboard uses cached prices on load for fast performance; manual refresh fetches from Yahoo Finance.
  - **Backend**:
    - Optimized historical price fetching to be smarter about when to fetch new data.

- **2025-12-16**: Version **alpha-1.5**
  - **Analysis Page (NEW)**:
    - Added dedicated **Analysis** page (`/analysis`) for price target analytics.
    - **Weighted Median Growth**: Shows portfolio-weighted average upside based on median targets.
    - **Stocks-Only Growth**: Separate stat excluding ETFs (SPY, QQQ, VOO, etc.) for pure stock analysis.
    - **Near Buy Zone**: Lists stocks within 15% of your buy target price.
    - **Near Sell Zone**: Lists stocks within 15% of your sell target price.
    - **All Price Targets**: Table of all stocks with targets.
    - **Sortable Columns**: Click any column header to sort ascending/descending with visual indicator.
  - **Price Targets Feature**:
    - Added **Median Target Price**, **Buy Target Price**, and **Sell Target Price** fields to Research page.
    - Price targets display in the **Research panel** on Stock Detail page with percentage comparison to current price.
    - Buy targets shown in **green**, Sell targets shown in **red** for visual clarity.
    - Targets are **manual entry only** - stored in database and preserved across price refreshes.
  - **Backend Improvements**:
    - Removed non-functional Yahoo Finance analyst data fetching code.
    - Fixed price refresh endpoints to **not overwrite** manually-entered target prices.
  - **Database**:
    - Added `buy_target_price` and `sell_target_price` columns to `stock_prices` table.

- **2025-12-15**: Version **alpha-1.4**
  - **Research Panel Improvements**:
    - Increased character limit to **1000 characters** per notes block (was previously unlimited but now enforced).
    - Added **character countdown** indicators showing remaining characters for each notes field.
    - Countdown turns **amber** when under 100 characters remain and **bold** at limit.
  - **Stock Detail Page**:
    - Research panel is now **expandable** with a toggle button.
    - When expanded, shows **all notes** for every rating category (Investment Thesis, Valuation, Growth Quality, Economic Moat, Leadership, Financial Health).
    - Collapsed view shows ratings only; expanded view shows full notes content.
  - **Bug Fixes**:
    - Fixed **stale closure bug** that prevented typing in multiple notes fields.
    - Fixed **focus loss** issue where textareas would lose focus after each keystroke.
    - Refactored `StarRating` and `RatingCard` components to be stable across re-renders.

- **2025-12-14**: Version **alpha-1.3**
  - **Research Page**:
    - Added dedicated Research page (`/holdings/:symbol/research`) for in-depth stock analysis.
    - **Editable Notes**: Each of the 6 ratings (Valuation, Growth Quality, Economic Moat, Leadership, Financial Health, Overall) now has a text notes field.
    - **Investment Thesis**: Featured section for summarizing your overall investment thesis.
    - Research panel on stock detail page is now **clickable** with hover effects, navigating to the dedicated page.
  - **Export Feature**:
    - Added **Export** button on Research page to download research data as JSON with timestamp.
    - Export includes all ratings, notes, classification (theme/role), and metadata.
  - **Bug Fixes**:
    - Fixed price cache check to properly handle **weekends and holidays**.
    - Cache now considers data "fresh" if within last 3 days, preventing redundant API calls on non-trading days.
  - **Database**:
    - Added 6 new columns to `stock_prices` table for rating notes.

- **2025-12-10**: Version **alpha-1.2**
  - **Dashboard Overhaul**:
    - Reorganized layout: Logical grouping of Performance, Allocation, Top Holdings, and Accounts.
    - **Visual Enhancements**: Added icons, hover effects (`hover-lift`), and compact card designs.
    - **Allocation Chart**: 
        - Added **Stock** grouping (alongside Role/Theme).
        - Added **Expand Mode**: Full-screen modal for detailed chart analysis.
        - **Smart Labels**: Inline labels for items ≥3%, sidebar legend for items <3%.
        - Clockwise ordering starting from 12 o'clock.
  - **Holdings Management**:
    - Added **"Show Sold Stocks"** toggle to view fully realized positions.
    - Visual indicators (badge, opacity) for sold positions.
    - Persists view preference across sessions.
  - **System**:
    - **Optimized Caching**: Incremental fetching for historical prices (only fetches missing days).
    - **Recalculate Tool**: Added manual "Recalculate History" button with real-time SSE progress streaming.
    - **UX**: Improved responsiveness and added consistent styling (buttons, badges).

- **2025-12-09**: Version **alpha-1.1**
  - **Performance Chart**: 
    - Added multi-account performance chart on Dashboard with S&P 500 benchmark comparison.
    - Timeframe presets: 5D, 30D, 3M, 6M, YTD, 1Y, and Since Inception.
    - Fetches historical stock prices from Yahoo Finance for accurate portfolio valuation over time.
    - Auto-generated distinct colors for each account line.
    - Toggle visibility for individual accounts and S&P 500 line.
  - **TWR Fix**:
    - Fixed Time-Weighted Return calculation bug that showed -100%.
    - Root cause: Portfolio value calculation failed for "All Accounts" view.
  - **Caching**:
    - Added `price_history` table to cache historical stock prices.
    - Added `performance_history` table for portfolio snapshots.
    - Smart caching: only refetches if data is stale or missing.

- **2025-12-09**: Version **alpha-1**
  - **Core Architecture**:
    - Major backend refactoring: Centralized cash balance, portfolio value, and realized gain calculations.
    - Modularized database migrations system for better maintainability.
    - Implemented input validation middleware for robust API security.
  - **Features**:
    - Added **Developer Tools**: Database export and custom branding (App Name/Logo).
    - Enhanced **Trade Module**: Added support for specific tax lot selection when selling.
    - Improved **Financial Tracking**: Realized gains accuracy improved; now accounts for dividends correctly.
    - Added manual data entry support for Market Cap.
  - **System**:
    - Optimized `start-server.bat` and `install.bat` for smoother Windows deployment.
    - Fixed various UI display bugs (Market Cap, Cash movements).

## �📄 License

This is a personal portfolio management application.

## 🤝 Contributing

This is a personal project, but feel free to fork and customize for your own use!

---

**Made with 🦒 by Giraffe Terminal**
