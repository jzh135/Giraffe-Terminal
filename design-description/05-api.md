# 🔌 API Design

## Overview

Giraffe Terminal exposes a RESTful API on `http://localhost:3001/api`. All endpoints return JSON and follow consistent conventions.

## API Conventions

### HTTP Methods
| Method | Usage |
|--------|-------|
| `GET` | Retrieve resources |
| `POST` | Create new resources |
| `PUT` | Update existing resources |
| `DELETE` | Remove resources |

### Response Format
```json
{
  "data": { ... },      // Success response
  "error": "message"    // Error response
}
```

### Status Codes
| Code | Meaning |
|------|---------|
| `200` | Success |
| `201` | Created |
| `400` | Bad Request (validation error) |
| `404` | Resource Not Found |
| `500` | Server Error |

---

## Endpoints

### Accounts

#### `GET /api/accounts`
List all accounts.

**Response:**
```json
[
  {
    "id": 1,
    "name": "Roth IRA",
    "description": "Retirement account",
    "created_at": "2024-01-01T00:00:00.000Z",
    "cash_balance": 5000.00,
    "realized_gains": 1234.56
  }
]
```

#### `POST /api/accounts`
Create a new account.

**Request:**
```json
{
  "name": "Brokerage",
  "description": "Taxable investment account"
}
```

#### `PUT /api/accounts/:id`
Update an account.

#### `DELETE /api/accounts/:id`
Delete an account and all related data.

---

### Holdings

#### `GET /api/holdings`
List all holdings.

**Query Parameters:**
- `accountId` - Filter by account

**Response includes:**
- Holding details (symbol, shares, avg_cost)
- Current price from cache
- Calculated market value
- Unrealized gain/loss

#### `POST /api/holdings`
Add a new holding with initial buy transaction.

**Request:**
```json
{
  "accountId": 1,
  "symbol": "AAPL",
  "shares": 10,
  "price": 150.00,
  "date": "2024-01-15",
  "notes": "Initial position"
}
```

#### `PUT /api/holdings/:id`
Update holding metadata (role, theme).

#### `DELETE /api/holdings/:id`
Delete a holding and all transactions.

---

### Transactions

#### `GET /api/transactions`
List transactions.

**Query Parameters:**
- `holdingId` - Filter by holding
- `accountId` - Filter by account
- `type` - Filter by type (BUY/SELL)

#### `POST /api/transactions`
Record a buy or sell.

**Buy Request:**
```json
{
  "holdingId": 1,
  "type": "BUY",
  "shares": 5,
  "price": 155.00,
  "date": "2024-02-01"
}
```

**Sell Request:**
```json
{
  "holdingId": 1,
  "type": "SELL",
  "shares": 3,
  "price": 160.00,
  "date": "2024-03-01",
  "taxLots": [
    { "transactionId": 1, "shares": 3 }
  ]
}
```

#### `DELETE /api/transactions/:id`
Delete a transaction (adjusts share count).

---

### Dividends

#### `GET /api/dividends`
List dividends.

**Query Parameters:**
- `holdingId` - Filter by holding

#### `POST /api/dividends`
Record a dividend payment.

**Request:**
```json
{
  "holdingId": 1,
  "amount": 50.00,
  "date": "2024-03-15",
  "notes": "Q1 dividend"
}
```

#### `DELETE /api/dividends/:id`
Delete a dividend record.

---

### Cash Movements

#### `GET /api/cash-movements`
List cash deposits/withdrawals.

**Query Parameters:**
- `accountId` - Filter by account

#### `POST /api/cash-movements`
Record a deposit or withdrawal.

**Request:**
```json
{
  "accountId": 1,
  "type": "DEPOSIT",
  "amount": 1000.00,
  "date": "2024-01-01",
  "notes": "Monthly contribution"
}
```

#### `DELETE /api/cash-movements/:id`
Delete a cash movement.

---

### Stock Splits

#### `GET /api/stock-splits`
List split events.

**Query Parameters:**
- `holdingId` - Filter by holding

#### `POST /api/stock-splits`
Record a stock split.

**Request:**
```json
{
  "holdingId": 1,
  "ratio": 4,
  "date": "2024-08-01"
}
```

---

### Prices

#### `GET /api/prices`
Get cached prices for symbols.

**Query Parameters:**
- `symbols` - Comma-separated list

#### `POST /api/prices/refresh`
Refresh prices from Yahoo Finance.

**Request:**
```json
{
  "symbols": ["AAPL", "MSFT", "GOOGL"]
}
```

**Response:**
```json
{
  "AAPL": { "price": 175.50, "updated_at": "..." },
  "MSFT": { "price": 380.25, "updated_at": "..." }
}
```

#### `GET /api/prices/history/:symbol`
Get historical prices.

**Query Parameters:**
- `startDate` - Start date (YYYY-MM-DD)
- `endDate` - End date (YYYY-MM-DD)

#### `PUT /api/prices/:symbol/research`
Update research data for a symbol.

**Request:**
```json
{
  "median_target_price": 200.00,
  "buy_target_price": 160.00,
  "sell_target_price": 220.00,
  "rating_valuation": 4,
  "notes_investment_thesis": "Strong moat..."
}
```

---

### Performance

#### `GET /api/performance`
Get performance data.

**Query Parameters:**
- `accountId` - Account ID or 'all'
- `startDate` - Start date
- `endDate` - End date
- `timeframe` - Preset (5D, 30D, YTD, etc.)

**Response:**
```json
{
  "portfolio": {
    "dates": ["2024-01-01", "..."],
    "values": [100000, 101000, "..."],
    "twr": 0.0523
  },
  "benchmark": {
    "dates": ["..."],
    "values": ["..."],
    "twr": 0.0412
  }
}
```

#### `POST /api/performance/recalculate`
Force recalculation of performance history.

---

### Roles & Themes

#### `GET /api/roles`
List investment roles.

#### `POST /api/roles`
Create a new role.

#### `PUT /api/roles/:id`
Update a role.

#### `DELETE /api/roles/:id`
Delete a role.

#### `GET /api/themes`
List investment themes.

#### `POST /api/themes`
Create a new theme.

#### `PUT /api/themes/:id`
Update a theme.

#### `DELETE /api/themes/:id`
Delete a theme.

---

### SEC EDGAR (10-K and 10-Q Filings)

Access SEC EDGAR filings for companies. Uses official SEC API (no authentication required).

#### `GET /api/sec/cik/:ticker`
Get CIK number for a ticker symbol.

**Response:**
```json
{
  "ticker": "AAPL",
  "cik": 320193,
  "cikPadded": "0000320193",
  "name": "Apple Inc."
}
```

#### `GET /api/sec/filings/:ticker`
Get list of SEC filings for a company.

**Query Parameters:**
- `form` - Form type (default: "10-K")
- `limit` - Max results (default: 10)

**Response:**
```json
{
  "ticker": "AAPL",
  "cik": 320193,
  "companyName": "Apple Inc.",
  "formType": "10-K",
  "filings": [
    {
      "form": "10-K",
      "filingDate": "2024-11-01",
      "accessionNumber": "0000320193-24-000081",
      "primaryDocument": "aapl-20240928.htm",
      "documentUrl": "https://www.sec.gov/Archives/edgar/data/..."
    }
  ]
}
```

#### `GET /api/sec/10k/:ticker`
Download and cache a 10-K (annual) filing.

**Query Parameters:**
- `year` - Fiscal year (optional, defaults to most recent)
- `includeContent` - Set to "true" to include raw HTML

#### `GET /api/sec/10k/:ticker/text`
Get 10-K as plain text (HTML stripped) for AI processing.

#### `GET /api/sec/10q/:ticker`
Download and cache a 10-Q (quarterly) filing.

**Query Parameters:**
- `quarter` - Year to filter by (optional, defaults to most recent)
- `includeContent` - Set to "true" to include raw HTML

#### `GET /api/sec/10q/:ticker/text`
Get 10-Q as plain text (HTML stripped) for AI processing.

#### `GET /api/sec/search`
Search for companies by name or ticker.

**Query Parameters:**
- `q` - Search query (min 2 chars)
- `limit` - Max results (default: 20)

---

### Admin

#### `GET /api/admin/export`
Export full database as JSON.

#### `GET /api/admin/branding`
Get current branding settings.

#### `PUT /api/admin/branding`
Update branding.

**Request:**
```json
{
  "app_name": "My Portfolio",
  "logo_emoji": "📈"
}
```

---

## Error Handling

### Validation Errors
```json
{
  "error": "Validation failed",
  "details": {
    "symbol": "Symbol is required",
    "shares": "Must be positive number"
  }
}
```

### Not Found
```json
{
  "error": "Account not found"
}
```

### Server Error
```json
{
  "error": "Database error",
  "message": "SQLITE_CONSTRAINT: ..."
}
```

---

## Rate Limiting

Currently no rate limiting is implemented as this is a local single-user application.

For multi-user deployment, consider adding:
- Request rate limiting per IP
- Throttling for Yahoo Finance calls
- Caching headers for static data

---

## Authentication

Currently **no authentication** is implemented.

For secured deployment, add:
- JWT-based authentication
- Session management
- Role-based access control
