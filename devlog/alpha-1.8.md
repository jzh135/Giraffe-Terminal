# 🦒 Alpha 1.8 - AI Investment Analysis Agent

**Release Date:** December 28, 2024

---

## ✨ New Features

### Python AI Investment Analysis Agent
Added a **Python-based AI agent** that analyzes company investments using SEC 10-Q filings.

#### Key Capabilities:
- **Programmatic XBRL Extraction** - Fetches structured financial data directly from SEC's XBRL API (no LLM tokens used!)
- **LangGraph Orchestration** - Clean workflow with conditional error handling
- **Gemini 2.0 Flash Integration** - Generates investment summaries (~500 tokens per analysis)
- **FastAPI Server** - REST API on port 8000 for frontend integration

#### Financial Metrics Extracted:
- Revenue, Net Income, EPS (Basic/Diluted)
- Gross Profit, Operating Income
- Cash, Total Assets, Stockholders' Equity
- Gross Margin, Operating Margin
- YoY trend analysis

### Stock Detail Page - AI Analysis Section
Replaced the SEC Filings section with **🤖 AI Investment Analysis**:
- Collapsible section (click to expand)
- "Run AI Analysis" button triggers Python agent
- Loading spinner during analysis
- Displays quarterly metrics in table format
- Shows trend analysis (revenue, margins, EPS)
- AI-generated investment summary

---

## 🔧 Architecture

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────┐
│  React Frontend │────▶│ Python AI Agent:8000 │────▶│ SEC XBRL API│
│    :5173        │     │                      │     └─────────────┘
└────────┬────────┘     │  LangGraph Workflow: │
         │              │  1. Fetch XBRL (0 tokens)
         │              │  2. Extract metrics   │
         │              │  3. Calculate trends  │
         ▼              │  4. Get price         │
┌─────────────────┐     │  5. Generate summary  │──▶ Gemini Flash
│ Node.js Backend │◀───▶│     (~500 tokens)     │
│    :3001        │     └──────────────────────┘
└─────────────────┘
```

### Token Usage Optimization
| Step | LLM Tokens |
|------|------------|
| Fetch XBRL data | 0 |
| Extract metrics | 0 |
| Calculate trends | 0 |
| Get current price | 0 |
| **Generate summary** | **~500** |

**Total: ~500 tokens per analysis** (~$0.001 with Gemini Flash)

---

## 📁 Files Changed

### New Files (Python Agent)
- `agent/main.py` - FastAPI server
- `agent/agent/graph.py` - LangGraph workflow
- `agent/agent/models.py` - Pydantic schemas
- `agent/agent/prompts.py` - Minimal LLM prompts
- `agent/agent/tools/xbrl_extractor.py` - SEC XBRL parsing
- `agent/agent/tools/price_fetcher.py` - Get prices from Giraffe API
- `agent/requirements.txt` - Python dependencies
- `agent/.env.example` - Environment template
- `agent/README.md` - Agent documentation

### Modified Files
- `server/index.js` - Removed SEC router (Python handles SEC now)
- `src/api/index.js` - Added `analyzeStock()` function for AI agent
- `src/pages/StockDetail.jsx` - Replaced SEC Filings with AI Analysis section
- `install.bat` - Now sets up Python venv and dependencies
- `start-server.bat` - Starts AI agent alongside Node.js
- `.gitignore` - Added Python ignores (venv, __pycache__, etc.)

### Deleted Files
- `server/routes/sec.js` - Moved to Python agent
- `data/sec-filings/` - No longer needed

---

## 🚀 Setup

### Quick Start
```bash
# 1. Run install (sets up Python venv automatically)
install.bat

# 2. Add your Google API key to agent/.env
# GOOGLE_API_KEY=your-key-here

# 3. Start everything
start-server.bat
```

### Manual Setup
```bash
cd agent
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your GOOGLE_API_KEY
python main.py
```

Get your API key from: https://aistudio.google.com/apikey

---

## 🔮 Future Considerations

### Potential Enhancements
- Add 10-K annual report analysis
- Extract MD&A section for qualitative insights
- Add competitor comparison
- Cache analysis results
- Add more financial ratios (P/E, ROE, etc.)
