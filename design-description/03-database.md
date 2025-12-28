# 💾 Database Design

## Overview

Giraffe Terminal uses **SQLite** as its database engine, with a single database file located at `data/giraffe.db`.

## Entity Relationship Diagram

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│    accounts     │       │    holdings     │       │  transactions   │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id (PK)         │◄──────│ account_id (FK) │       │ id (PK)         │
│ name            │       │ id (PK)         │◄──────│ holding_id (FK) │
│ description     │       │ symbol          │       │ type            │
│ created_at      │       │ shares          │       │ shares          │
│ cash_balance    │       │ avg_cost        │       │ price           │
│ realized_gains  │       │ created_at      │       │ date            │
└─────────────────┘       │ is_sold         │       │ notes           │
                          └─────────────────┘       │ cost_basis      │
                                  │                 └─────────────────┘
                                  │
          ┌───────────────────────┼───────────────────────┐
          │                       │                       │
          ▼                       ▼                       ▼
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│   dividends     │       │ cash_movements  │       │  stock_splits   │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id (PK)         │       │ id (PK)         │       │ id (PK)         │
│ holding_id (FK) │       │ account_id (FK) │       │ holding_id (FK) │
│ amount          │       │ type            │       │ ratio           │
│ date            │       │ amount          │       │ date            │
│ notes           │       │ date            │       │ old_shares      │
└─────────────────┘       │ notes           │       │ new_shares      │
                          └─────────────────┘       └─────────────────┘

┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│  stock_prices   │       │  price_history  │       │performance_hist │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ symbol (PK)     │       │ id (PK)         │       │ id (PK)         │
│ current_price   │       │ symbol          │       │ account_id      │
│ market_cap      │       │ date            │       │ date            │
│ median_target   │       │ close_price     │       │ total_value     │
│ buy_target      │       │ updated_at      │       │ total_invested  │
│ sell_target     │       └─────────────────┘       │ twr             │
│ ratings...      │                                 └─────────────────┘
│ notes...        │
│ updated_at      │       ┌─────────────────┐
└─────────────────┘       │     roles       │
                          ├─────────────────┤
┌─────────────────┐       │ id (PK)         │
│     themes      │       │ name            │
├─────────────────┤       │ color           │
│ id (PK)         │       └─────────────────┘
│ name            │
│ color           │       ┌─────────────────┐
└─────────────────┘       │   branding      │
                          ├─────────────────┤
                          │ id (PK)         │
                          │ app_name        │
                          │ logo_emoji      │
                          │ logo_url        │
                          └─────────────────┘
```

## Core Tables

### `accounts`
Stores investment account information.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key, auto-increment |
| `name` | TEXT | Account name (e.g., "Roth IRA") |
| `description` | TEXT | Optional description |
| `created_at` | TEXT | ISO timestamp |
| `cash_balance` | REAL | Current cash in account |
| `realized_gains` | REAL | Cumulative realized gains/losses |

### `holdings`
Stores individual stock positions.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key, auto-increment |
| `account_id` | INTEGER | Foreign key to accounts |
| `symbol` | TEXT | Stock ticker symbol |
| `shares` | REAL | Current share count |
| `avg_cost` | REAL | Average cost per share |
| `created_at` | TEXT | ISO timestamp |
| `is_sold` | INTEGER | 1 if fully sold, 0 otherwise |
| `role_id` | INTEGER | Foreign key to roles |
| `theme_id` | INTEGER | Foreign key to themes |

### `transactions`
Records buy and sell transactions.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key, auto-increment |
| `holding_id` | INTEGER | Foreign key to holdings |
| `type` | TEXT | 'BUY' or 'SELL' |
| `shares` | REAL | Number of shares |
| `price` | REAL | Price per share |
| `date` | TEXT | Transaction date |
| `notes` | TEXT | Optional notes |
| `cost_basis` | REAL | Cost basis for sells |
| `realized_gain` | REAL | Calculated gain/loss for sells |

### `dividends`
Tracks dividend payments.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key, auto-increment |
| `holding_id` | INTEGER | Foreign key to holdings |
| `amount` | REAL | Dividend amount |
| `date` | TEXT | Payment date |
| `notes` | TEXT | Optional notes |

### `cash_movements`
Records deposits and withdrawals.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key, auto-increment |
| `account_id` | INTEGER | Foreign key to accounts |
| `type` | TEXT | 'DEPOSIT' or 'WITHDRAW' |
| `amount` | REAL | Movement amount |
| `date` | TEXT | Movement date |
| `notes` | TEXT | Optional notes |

### `stock_splits`
Records stock split events.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key, auto-increment |
| `holding_id` | INTEGER | Foreign key to holdings |
| `ratio` | REAL | Split ratio (e.g., 4 for 4:1) |
| `date` | TEXT | Split date |
| `old_shares` | REAL | Shares before split |
| `new_shares` | REAL | Shares after split |

## Price & Research Tables

### `stock_prices`
Caches current prices and research data.

| Column | Type | Description |
|--------|------|-------------|
| `symbol` | TEXT | Primary key, ticker symbol |
| `current_price` | REAL | Latest price |
| `market_cap` | REAL | Market capitalization |
| `median_target_price` | REAL | Analyst median target |
| `buy_target_price` | REAL | User's buy target |
| `sell_target_price` | REAL | User's sell target |
| `rating_valuation` | INTEGER | 1-5 star rating |
| `rating_growth_quality` | INTEGER | 1-5 star rating |
| `rating_economic_moat` | INTEGER | 1-5 star rating |
| `rating_leadership` | INTEGER | 1-5 star rating |
| `rating_financial_health` | INTEGER | 1-5 star rating |
| `rating_overall` | INTEGER | 1-5 star rating |
| `notes_investment_thesis` | TEXT | Investment thesis notes |
| `notes_valuation` | TEXT | Valuation notes |
| `notes_growth_quality` | TEXT | Growth notes |
| `notes_economic_moat` | TEXT | Moat notes |
| `notes_leadership` | TEXT | Leadership notes |
| `notes_financial_health` | TEXT | Financial health notes |
| `updated_at` | TEXT | Last update timestamp |

### `price_history`
Caches historical prices.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key |
| `symbol` | TEXT | Ticker symbol |
| `date` | TEXT | Date (YYYY-MM-DD) |
| `close_price` | REAL | Closing price |
| `updated_at` | TEXT | Cache timestamp |

**Unique constraint**: (symbol, date)

### `performance_history`
Caches daily portfolio snapshots.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key |
| `account_id` | TEXT | Account ID or 'all' |
| `date` | TEXT | Date (YYYY-MM-DD) |
| `total_value` | REAL | Portfolio value |
| `total_invested` | REAL | Cumulative invested |
| `twr` | REAL | Time-weighted return |
| `updated_at` | TEXT | Cache timestamp |

## Classification Tables

### `roles`
Defines investment roles for categorization.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key |
| `name` | TEXT | Role name |
| `color` | TEXT | Hex color for charts |

### `themes`
Defines investment themes for categorization.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key |
| `name` | TEXT | Theme name |
| `color` | TEXT | Hex color for charts |

## System Tables

### `branding`
Stores application customization.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key |
| `app_name` | TEXT | Custom app name |
| `logo_emoji` | TEXT | Emoji logo |
| `logo_url` | TEXT | Custom logo URL |

## Migration System

Database migrations are managed in `server/migrations.js`:

1. **Version tracking** - `schema_version` table tracks applied migrations
2. **Incremental updates** - New columns/tables added via migrations
3. **Safe execution** - Migrations check existing state before applying

## Indexes

Key indexes for performance:

```sql
CREATE INDEX idx_holdings_account ON holdings(account_id);
CREATE INDEX idx_transactions_holding ON transactions(holding_id);
CREATE INDEX idx_dividends_holding ON dividends(holding_id);
CREATE INDEX idx_cash_movements_account ON cash_movements(account_id);
CREATE INDEX idx_price_history_symbol_date ON price_history(symbol, date);
CREATE INDEX idx_performance_history_account_date ON performance_history(account_id, date);
```

## Data Integrity

### Foreign Key Constraints
- Holdings → Accounts
- Transactions → Holdings
- Dividends → Holdings
- Cash Movements → Accounts
- Stock Splits → Holdings

### Cascade Rules
- When a holding is deleted, related transactions and dividends are cascaded
- When an account is deleted, related holdings and cash movements are cascaded

## Backup Strategy

1. **Export via Developer page** - JSON export of all data
2. **Copy database file** - Direct copy of `data/giraffe.db`
3. **Recommended frequency** - After any significant transactions
