import { Router } from 'express';
import db from '../db.js';

const router = Router();

// Get cached prices for symbols
router.get('/', (req, res) => {
    try {
        const { symbols } = req.query;

        const baseQuery = `
            SELECT sp.*, sr.name as role_name, sr.color as role_color, st.name as theme_name, st.color as theme_color
            FROM stock_prices sp
            LEFT JOIN stock_roles sr ON sp.role_id = sr.id
            LEFT JOIN stock_themes st ON sp.theme_id = st.id
        `;

        if (!symbols) {
            const prices = db.prepare(baseQuery + ' ORDER BY sp.symbol').all();
            return res.json(prices);
        }

        const symbolList = symbols.split(',').map(s => s.trim().toUpperCase());
        const placeholders = symbolList.map(() => '?').join(',');
        const prices = db.prepare(baseQuery + ` WHERE sp.symbol IN (${placeholders})`).all(...symbolList);

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

        // Return with joined role/theme data
        const result = db.prepare(`
            SELECT sp.*, sr.name as role_name, sr.color as role_color, st.name as theme_name, st.color as theme_color
            FROM stock_prices sp
            LEFT JOIN stock_roles sr ON sp.role_id = sr.id
            LEFT JOIN stock_themes st ON sp.theme_id = st.id
            WHERE sp.symbol = ?
        `).get(symbol);

        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update research fields for a symbol
router.put('/:symbol', (req, res) => {
    try {
        const symbol = req.params.symbol.toUpperCase();
        const {
            theme_id, role_id,
            overall_rating, valuation_rating, growth_quality_rating,
            econ_moat_rating, leadership_rating, financial_health_rating,
            overall_notes, valuation_notes, growth_quality_notes,
            econ_moat_notes, leadership_notes, financial_health_notes
        } = req.body;

        const now = new Date().toISOString();

        // Check if symbol exists
        const existing = db.prepare('SELECT symbol FROM stock_prices WHERE symbol = ?').get(symbol);

        if (existing) {
            // Update research fields including notes
            db.prepare(`
                UPDATE stock_prices SET 
                    theme_id = COALESCE(?, theme_id),
                    role_id = COALESCE(?, role_id),
                    overall_rating = ?,
                    valuation_rating = ?, 
                    growth_quality_rating = ?, 
                    econ_moat_rating = ?, 
                    leadership_rating = ?, 
                    financial_health_rating = ?,
                    overall_notes = ?,
                    valuation_notes = ?,
                    growth_quality_notes = ?,
                    econ_moat_notes = ?,
                    leadership_notes = ?,
                    financial_health_notes = ?,
                    research_updated_at = ?
                WHERE symbol = ?
            `).run(
                theme_id ?? null, role_id ?? null,
                overall_rating ?? null, valuation_rating ?? null, growth_quality_rating ?? null,
                econ_moat_rating ?? null, leadership_rating ?? null, financial_health_rating ?? null,
                overall_notes ?? null, valuation_notes ?? null, growth_quality_notes ?? null,
                econ_moat_notes ?? null, leadership_notes ?? null, financial_health_notes ?? null,
                now, symbol
            );
        } else {
            // Insert new row with research fields
            db.prepare(`
                INSERT INTO stock_prices (
                    symbol, price, name, theme_id, role_id, 
                    overall_rating, valuation_rating, growth_quality_rating, econ_moat_rating, leadership_rating, financial_health_rating,
                    overall_notes, valuation_notes, growth_quality_notes, econ_moat_notes, leadership_notes, financial_health_notes,
                    research_updated_at, updated_at
                )
                VALUES (?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                symbol, symbol, theme_id ?? null, role_id ?? null,
                overall_rating ?? null, valuation_rating ?? null, growth_quality_rating ?? null,
                econ_moat_rating ?? null, leadership_rating ?? null, financial_health_rating ?? null,
                overall_notes ?? null, valuation_notes ?? null, growth_quality_notes ?? null,
                econ_moat_notes ?? null, leadership_notes ?? null, financial_health_notes ?? null,
                now, now
            );
        }

        // Return the updated record with joined role/theme names
        const updated = db.prepare(`
            SELECT sp.*, sr.name as role_name, sr.color as role_color, st.name as theme_name, st.color as theme_color
            FROM stock_prices sp
            LEFT JOIN stock_roles sr ON sp.role_id = sr.id
            LEFT JOIN stock_themes st ON sp.theme_id = st.id
            WHERE sp.symbol = ?
        `).get(symbol);
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});



// Helper: Fetch price from Yahoo Finance
async function fetchYahooPrice(symbol) {
    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
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
