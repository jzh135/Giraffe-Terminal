-- Giraffe Terminal Database Schema
-- SQLite database for investment tracking

-- Investment accounts
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'brokerage',
  institution TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Individual stock lots (each purchase is a separate lot)
CREATE TABLE IF NOT EXISTS holdings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  shares REAL NOT NULL,
  cost_basis REAL NOT NULL,
  purchase_date TEXT NOT NULL,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Buy/sell transactions
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  holding_id INTEGER REFERENCES holdings(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  symbol TEXT NOT NULL,
  shares REAL NOT NULL,
  price REAL NOT NULL,
  total REAL NOT NULL,
  date TEXT NOT NULL,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Dividends (linked to account + symbol, not individual lots)
CREATE TABLE IF NOT EXISTS dividends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  amount REAL NOT NULL,
  date TEXT NOT NULL,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Cash movements (deposit, withdrawal, fee, interest)
CREATE TABLE IF NOT EXISTS cash_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  amount REAL NOT NULL,
  date TEXT NOT NULL,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Stock splits
CREATE TABLE IF NOT EXISTS stock_splits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  ratio REAL NOT NULL,
  date TEXT NOT NULL,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Cached stock prices with research fields
CREATE TABLE IF NOT EXISTS stock_prices (
  symbol TEXT PRIMARY KEY,
  price REAL NOT NULL,
  name TEXT,
  role_id INTEGER REFERENCES stock_roles(id),
  theme_id INTEGER REFERENCES stock_themes(id),
  overall_rating REAL,
  valuation_rating REAL,
  growth_quality_rating REAL,
  econ_moat_rating REAL,
  leadership_rating REAL,
  financial_health_rating REAL,
  research_updated_at TEXT,
  updated_at TEXT NOT NULL
);

-- User-defined stock roles
CREATE TABLE IF NOT EXISTS stock_roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  color TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- User-defined stock themes
CREATE TABLE IF NOT EXISTS stock_themes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  color TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);


-- Application settings
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Insert default settings
INSERT OR IGNORE INTO app_settings (key, value) VALUES ('app_name', 'Giraffe Terminal');
INSERT OR IGNORE INTO app_settings (key, value) VALUES ('logo_type', 'default');
INSERT OR IGNORE INTO app_settings (key, value) VALUES ('logo_value', '🦒');

-- Performance history cache (daily snapshots per account)
CREATE TABLE IF NOT EXISTS performance_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  portfolio_value REAL NOT NULL,
  cost_basis REAL NOT NULL,
  cash_balance REAL NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(account_id, date)
);

-- Historical price cache for benchmarks (SPY, etc.)
CREATE TABLE IF NOT EXISTS price_history (
  symbol TEXT NOT NULL,
  date TEXT NOT NULL,
  close_price REAL NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (symbol, date)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_holdings_account ON holdings(account_id);
CREATE INDEX IF NOT EXISTS idx_holdings_symbol ON holdings(symbol);
CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_dividends_account ON dividends(account_id);
CREATE INDEX IF NOT EXISTS idx_dividends_symbol ON dividends(symbol);
CREATE INDEX IF NOT EXISTS idx_cash_movements_account ON cash_movements(account_id);
CREATE INDEX IF NOT EXISTS idx_stock_splits_symbol ON stock_splits(symbol);
CREATE INDEX IF NOT EXISTS idx_performance_history_account_date ON performance_history(account_id, date);
CREATE INDEX IF NOT EXISTS idx_price_history_symbol_date ON price_history(symbol, date);

