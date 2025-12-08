import { Router } from 'express';
import db from '../db.js';

const router = Router();

const CORS_PROXY = 'https://corsproxy.io/?';

// Get cached prices for symbols
router.get('/', (req, res) => {
    try {
        const { symbols } = req.query;

        if (!symbols) {
            const prices = db.prepare('SELECT * FROM stock_prices ORDER BY symbol').all();
            return res.json(prices);
        }

        const symbolList = symbols.split(',').map(s => s.trim().toUpperCase());
        const placeholders = symbolList.map(() => '?').join(',');
        const prices = db.prepare(`SELECT * FROM stock_prices WHERE symbol IN (${placeholders})`).all(...symbolList);

        res.json(prices);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Refresh prices from Yahoo Finance
router.post('/refresh', async (req, res) => {
    try {
        // Get all unique symbols from holdings
        const symbols = db.prepare('SELECT DISTINCT symbol FROM holdings').all().map(r => r.symbol);

        if (symbols.length === 0) {
            return res.json({ message: 'No symbols to refresh', prices: [] });
        }

        const updatedPrices = [];
        const now = new Date().toISOString();

        for (const symbol of symbols) {
            try {
                const price = await fetchYahooPrice(symbol);
                if (price) {
                    // Upsert the price
                    db.prepare(`
            INSERT INTO stock_prices (symbol, price, name, updated_at) 
            VALUES (?, ?, ?, ?)
            ON CONFLICT(symbol) DO UPDATE SET price = ?, name = ?, updated_at = ?
          `).run(symbol, price.price, price.name, now, price.price, price.name, now);

                    updatedPrices.push({ symbol, ...price, updated_at: now });
                }
            } catch (err) {
                console.error(`Failed to fetch price for ${symbol}:`, err.message);
            }
        }

        res.json({ message: `Refreshed ${updatedPrices.length} prices`, prices: updatedPrices });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Fetch price for a single symbol
router.get('/fetch/:symbol', async (req, res) => {
    try {
        const symbol = req.params.symbol.toUpperCase();
        const price = await fetchYahooPrice(symbol);

        if (!price) {
            return res.status(404).json({ error: 'Symbol not found or price unavailable' });
        }

        const now = new Date().toISOString();

        // Cache the price
        db.prepare(`
      INSERT INTO stock_prices (symbol, price, name, updated_at) 
      VALUES (?, ?, ?, ?)
      ON CONFLICT(symbol) DO UPDATE SET price = ?, name = ?, updated_at = ?
    `).run(symbol, price.price, price.name, now, price.price, price.name, now);

        res.json({ symbol, ...price, updated_at: now });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Helper: Fetch price from Yahoo Finance using CORS proxy
async function fetchYahooPrice(symbol) {
    try {
        const url = `${CORS_PROXY}https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data.chart?.result?.[0]) {
            const result = data.chart.result[0];
            const meta = result.meta;
            const quote = result.indicators?.quote?.[0];

            // Get the last close price
            let price = meta.regularMarketPrice || meta.previousClose;
            if (!price && quote?.close) {
                const closes = quote.close.filter(c => c !== null);
                price = closes[closes.length - 1];
            }

            return {
                price: price || 0,
                name: meta.shortName || meta.longName || symbol
            };
        }

        return null;
    } catch (err) {
        console.error(`Yahoo Finance error for ${symbol}:`, err.message);
        return null;
    }
}

export default router;
