import express from 'express';
import cors from 'cors';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import accountsRouter from './routes/accounts.js';
import holdingsRouter from './routes/holdings.js';
import transactionsRouter from './routes/transactions.js';
import dividendsRouter from './routes/dividends.js';
import cashMovementsRouter from './routes/cashMovements.js';
import stockSplitsRouter from './routes/stockSplits.js';
import pricesRouter from './routes/prices.js';
import performanceRouter from './routes/performance.js';
import adminRouter from './routes/admin.js';
import rolesRouter from './routes/roles.js';
import themesRouter from './routes/themes.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files in production (built React app)
if (isProduction) {
  app.use(express.static(join(__dirname, '..', 'dist')));
}

// API Routes
app.get('/', (req, res) => {
  res.json({ message: 'Giraffe Terminal API is running', version: '1.0.0' });
});

app.use('/api/accounts', accountsRouter);
app.use('/api/holdings', holdingsRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/dividends', dividendsRouter);
app.use('/api/cash-movements', cashMovementsRouter);
app.use('/api/stock-splits', stockSplitsRouter);
app.use('/api/prices', pricesRouter);
app.use('/api/performance', performanceRouter);
app.use('/api/admin', adminRouter);
app.use('/api/roles', rolesRouter);
app.use('/api/themes', themesRouter);

// Catch-all route for client-side routing (React Router)
// Must be after API routes but before error handler
if (isProduction) {
  app.get('*', (req, res) => {
    res.sendFile(join(__dirname, '..', 'dist', 'index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Giraffe Terminal API running on http://localhost:${PORT}`);
  console.log(`Database connected.`);
});
