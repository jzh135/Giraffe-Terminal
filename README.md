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
│   └── data/            # Data management
├── data/                # Application data (database, research)
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

## � Dev Log

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
