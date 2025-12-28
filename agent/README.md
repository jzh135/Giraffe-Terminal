# 🤖 AI Investment Analysis Agent

A Python-based AI agent that analyzes company investments using SEC 10-Q filings and current stock prices. Part of the Giraffe Terminal portfolio management system.

## Features

- **Programmatic XBRL Extraction**: Fetches structured financial data directly from SEC's XBRL API (no LLM tokens used!)
- **Minimal LLM Usage**: Only uses the LLM for generating the final investment summary (~500 tokens per analysis)
- **LangGraph Orchestration**: Clean workflow management with conditional error handling
- **FastAPI Server**: REST API for integration with the Giraffe Terminal React frontend

## Quick Start

### 1. Create Virtual Environment

```bash
cd agent
python -m venv venv

# Windows
venv\Scripts\activate

# Linux/Mac
source venv/bin/activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure Environment

```bash
# Copy the example env file
copy .env.example .env

# Edit .env and add your Google API key
```

You need a Google AI API key. Get one from: https://aistudio.google.com/apikey

### 4. Run the Server

```bash
python main.py
```

Or with auto-reload:

```bash
uvicorn main:app --reload --port 8000
```

The server will start at http://localhost:8000

## API Endpoints

### `GET /health`
Health check endpoint.

### `POST /analyze/{ticker}`
Analyze a stock using SEC 10-Q filings.

**Request Body (optional):**
```json
{
  "num_quarters": 3,
  "include_current_price": true
}
```

**Response:**
```json
{
  "ticker": "AAPL",
  "company_name": "Apple Inc.",
  "cik": "320193",
  "current_price": 195.50,
  "analysis_date": "2024-12-28",
  "quarterly_metrics": [
    {
      "period_end": "2024-09-28",
      "fiscal_period": "Q4",
      "revenue": 94930000000,
      "net_income": 14736000000,
      "eps_diluted": 0.97,
      "gross_margin": 0.462
    }
  ],
  "trend_analysis": {
    "revenue_trend": "growing",
    "avg_revenue_growth_yoy": 0.05,
    "margin_trend": "stable"
  },
  "investment_summary": "Apple shows consistent 5-6% YoY revenue growth..."
}
```

## Architecture

```
agent/
├── main.py                  # FastAPI entry point
├── agent/
│   ├── graph.py             # LangGraph workflow
│   ├── models.py            # Pydantic models
│   ├── prompts.py           # LLM prompts (minimal)
│   └── tools/
│       ├── xbrl_extractor.py   # SEC XBRL parsing (NO LLM)
│       └── price_fetcher.py    # Get prices from Giraffe API
├── requirements.txt
└── .env.example
```

## Token Usage

| Step | LLM Tokens |
|------|------------|
| Fetch XBRL data | 0 |
| Extract metrics | 0 |
| Calculate trends | 0 |
| Get current price | 0 |
| Generate summary | ~500 |

**Total: ~500 tokens per analysis** (~$0.001 with Gemini Flash)

## Troubleshooting

### "Ticker not found in SEC records"
The stock may be an ETF (like SPY, QQQ) which don't file 10-Q reports. This agent only works with companies that file SEC 10-Q quarterly reports.

### "Failed to fetch XBRL data"
Check your internet connection. The SEC API may also have temporary outages.

### "LLM summary unavailable"
Make sure your `GOOGLE_API_KEY` is set correctly in the `.env` file.
