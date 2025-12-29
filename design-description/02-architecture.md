# 🏗️ System Architecture

## Overview

Giraffe Terminal uses a **client-server architecture** with a React frontend and Node.js/Express backend, communicating via RESTful APIs.

```
┌─────────────────────────────────────────────────────────────┐
│                      User Browser                            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              React Frontend (Vite)                     │  │
│  │              http://localhost:5173                     │  │
│  └───────────────────────────────────────────────────────┘  │
│                           │                                  │
│                           │ HTTP/REST                        │
│               ┌───────────┴───────────┐                      │
│               ▼                       ▼                      │
│  ┌───────────────────────┐  ┌───────────────────────┐       │
│  │   Express Backend     │  │   Python AI Agent     │       │
│  │  http://localhost:3001│  │  http://localhost:8000│       │
│  └───────────────────────┘  └───────────────────────┘       │
│               │                       │                      │
│               ▼                       ▼                      │
│  ┌───────────────────────┐  ┌───────────────────────┐       │
│  │    SQLite Database    │  │   SEC EDGAR API       │       │
│  │   data/giraffe.db     │  │   (External)          │       │
│  └───────────────────────┘  └───────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Frontend

| Technology | Purpose |
|------------|---------|
| **React 18** | UI framework with hooks and functional components |
| **Vite** | Build tool with fast HMR for development |
| **React Router** | Client-side routing and navigation |
| **Recharts** | Data visualization (charts, graphs) |
| **Luxon** | Date/time manipulation and formatting |

### Backend

| Technology | Purpose |
|------------|---------|
| **Node.js** | JavaScript runtime environment |
| **Express** | Web server framework |
| **Better-SQLite3** | Synchronous SQLite database driver |
| **CORS** | Cross-origin resource sharing middleware |

### External Services

| Service | Purpose |
|---------|---------|
| **Yahoo Finance** | Real-time and historical stock prices |
| **SEC EDGAR** | 10-K annual reports and company filings |

### AI Agent (Python)

| Technology | Purpose |
|------------|---------|
| **Python 3.11+** | Runtime environment |
| **FastAPI** | Async REST API server |
| **LangGraph** | Workflow orchestration for AI agent |
| **LangChain Google GenAI** | Google Gemini LLM integration |
| **Pydantic** | Data validation and serialization |
| **httpx** | Async HTTP client for SEC API |

## Directory Structure

```
giraffe-terminal/
├── server/                 # Backend Express server
│   ├── index.js           # Server entry point & middleware
│   ├── db.js              # Database connection & initialization
│   ├── migrations.js      # Database migration system
│   ├── schema.sql         # Initial database schema
│   ├── routes/            # API route handlers
│   │   ├── accounts.js    # Account CRUD operations
│   │   ├── holdings.js    # Holdings management
│   │   ├── transactions.js# Buy/sell transactions
│   │   ├── dividends.js   # Dividend tracking
│   │   ├── cashMovements.js# Deposits/withdrawals
│   │   ├── stockSplits.js # Stock split handling
│   │   ├── prices.js      # Price data & Yahoo Finance
│   │   ├── performance.js # Performance calculations
│   │   ├── roles.js       # Stock role classification
│   │   ├── themes.js      # Stock theme classification
│   │   ├── sec.js         # SEC EDGAR 10-K filings
│   │   └── admin.js       # Admin/developer tools
│   ├── utils/             # Shared utilities
│   └── middleware/        # Express middleware
│
├── src/                   # Frontend React application
│   ├── main.jsx          # React entry point
│   ├── App.jsx           # Main app component & routing
│   ├── index.css         # Global styles
│   ├── pages/            # Page components
│   │   ├── Dashboard.jsx # Main dashboard
│   │   ├── Accounts.jsx  # Account list
│   │   ├── AccountDetail.jsx # Single account view
│   │   ├── Holdings.jsx  # Holdings list
│   │   ├── StockDetail.jsx # Single stock view
│   │   ├── Research.jsx  # Stock research page
│   │   ├── Analysis.jsx  # Price target analysis
│   │   ├── Activity.jsx  # Activity log
│   │   ├── Performance.jsx # Performance charts
│   │   └── Developer.jsx # Developer tools
│   ├── components/       # Reusable components
│   │   └── modals/       # Modal dialogs
│   ├── hooks/            # Custom React hooks
│   └── api/              # API client functions
│
├── data/                  # Application data
│   ├── giraffe.db        # SQLite database
│   └── sec-filings/      # Cached SEC 10-K filings
│
├── agent/                 # AI Investment Analysis Agent
│   ├── main.py           # FastAPI entry point
│   ├── agent/            # LangGraph workflow & tools
│   └── requirements.txt  # Python dependencies
│
├── design-description/    # Design documentation
├── devlog/                # Development logs
│
├── index.html            # HTML entry point
├── vite.config.js        # Vite configuration
├── package.json          # Dependencies
├── start-server.bat      # Windows startup script
└── install.bat           # Windows installation script
```

## Data Flow

### Read Operations
```
User Action → React Component → API Call → Express Route → SQLite Query → Response → State Update → UI Render
```

### Write Operations
```
User Input → Form Validation → API Call → Express Route → SQLite Transaction → Response → UI Feedback
```

### Price Updates
```
Refresh Request → Backend → Yahoo Finance API → Parse Response → Cache in DB → Return to Frontend
```

## Key Design Decisions

### Why SQLite?
- **Portable** - Single file database, easy to backup
- **No Setup** - No separate database server needed
- **Reliable** - ACID compliant transactions
- **Fast** - Excellent read performance for local use

### Why Vite?
- **Speed** - Instant hot module replacement
- **Modern** - Native ES modules support
- **Simple** - Minimal configuration needed

### Why Better-SQLite3?
- **Synchronous** - Simpler code flow
- **Performance** - Faster than async alternatives
- **Native** - Direct SQLite bindings

## Scalability Considerations

The current architecture is designed for **single-user, local deployment**. For multi-user or cloud deployment, consider:

- Replace SQLite with PostgreSQL or MySQL
- Add authentication/authorization layer
- Implement session management
- Use connection pooling
- Add caching layer (Redis)
