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

    const symbolList = symbols.split(',').map((s) => s.trim().toUpperCase());
    const placeholders = symbolList.map(() => '?').join(',');
    const prices = db
      .prepare(baseQuery + ` WHERE sp.symbol IN (${placeholders})`)
      .all(...symbolList);

    res.json(prices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Refresh prices from Yahoo Finance
// This is the MAIN price sync - updates current prices AND fills missing historical data
router.post('/refresh', async (req, res) => {
  try {
    // Get all unique symbols from holdings
    const symbols = db
      .prepare('SELECT DISTINCT symbol FROM holdings')
      .all()
      .map((r) => r.symbol);

    if (symbols.length === 0) {
      return res.json({ message: 'No symbols to refresh', prices: [], historyUpdated: 0 });
    }

    const updatedPrices = [];
    const now = new Date().toISOString();
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    let historyPointsAdded = 0;

    // For each symbol, fetch current price AND fill missing history
    for (const symbol of symbols) {
      try {
        // 1. Get the first transaction date for this symbol (to know how far back to fetch)
        const firstTx = db
          .prepare('SELECT MIN(date) as first_date FROM transactions WHERE symbol = ?')
          .get(symbol);

        const startDate = firstTx?.first_date || today;

        // 2. Get the most recent cached date in price_history
        const lastCached = db
          .prepare('SELECT MAX(date) as last_date FROM price_history WHERE symbol = ?')
          .get(symbol);

        // 3. Determine if we need to fetch historical data
        const fetchFrom = lastCached?.last_date
          ? getNextDay(lastCached.last_date)
          : startDate;

        // 4. Fetch historical prices if there's a gap
        if (fetchFrom <= today) {
          const historyCount = await fetchAndCacheHistoricalPrices(symbol, fetchFrom, today);
          historyPointsAdded += historyCount;
        }

        // 5. Get the latest price for current display
        const latestPrice = db
          .prepare('SELECT close_price as price FROM price_history WHERE symbol = ? ORDER BY date DESC LIMIT 1')
          .get(symbol);

        if (latestPrice) {
          // Get or create stock_prices entry with name
          const existingPrice = db
            .prepare('SELECT name FROM stock_prices WHERE symbol = ?')
            .get(symbol);

          const stockName = existingPrice?.name || symbol;

          // Update stock_prices with latest price
          db.prepare(
            `
                        INSERT INTO stock_prices (symbol, price, name, updated_at) 
                        VALUES (?, ?, ?, ?)
                        ON CONFLICT(symbol) DO UPDATE SET 
                            price = ?, updated_at = ?
                    `
          ).run(symbol, latestPrice.price, stockName, now, latestPrice.price, now);

          updatedPrices.push({ symbol, price: latestPrice.price, name: stockName, updated_at: now });
        }
      } catch (err) {
        console.error(`Failed to fetch price for ${symbol}:`, err.message);
      }
    }

    // Also fetch SPY (S&P 500) for benchmark comparison
    try {
      // Get earliest transaction date across all symbols for SPY start date
      const earliestTx = db
        .prepare('SELECT MIN(date) as first_date FROM transactions')
        .get();

      const spyStartDate = earliestTx?.first_date || today;

      // Get most recent SPY cached date
      const spyLastCached = db
        .prepare("SELECT MAX(date) as last_date FROM price_history WHERE symbol = 'SPY'")
        .get();

      const spyFetchFrom = spyLastCached?.last_date
        ? getNextDay(spyLastCached.last_date)
        : spyStartDate;

      if (spyFetchFrom <= today) {
        const spyHistoryCount = await fetchAndCacheHistoricalPrices('SPY', spyFetchFrom, today);
        historyPointsAdded += spyHistoryCount;
        if (spyHistoryCount > 0) {
          console.log(`Added ${spyHistoryCount} SPY (S&P 500) price points`);
        }
      }
    } catch (err) {
      console.error('Failed to fetch SPY prices:', err.message);
    }

    res.json({
      message: `Refreshed ${updatedPrices.length} prices, added ${historyPointsAdded} history points`,
      prices: updatedPrices,
      historyUpdated: historyPointsAdded
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper: Get next day in YYYY-MM-DD format
function getNextDay(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const nextDay = new Date(year, month - 1, day + 1);
  return `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}`;
}

// Helper: Fetch and cache historical prices from Yahoo Finance
async function fetchAndCacheHistoricalPrices(symbol, startDate, endDate) {
  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const period1 = Math.floor(start.getTime() / 1000);
    const period2 = Math.floor(end.getTime() / 1000) + 86400; // Add a day buffer

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${period1}&period2=${period2}&interval=1d`;
    const response = await fetch(url);

    if (!response.ok) {
      console.warn(`Yahoo Finance returned ${response.status} for ${symbol}`);
      return 0;
    }

    const data = await response.json();

    if (!data.chart?.result?.[0]) {
      return 0;
    }

    const result = data.chart.result[0];
    const timestamps = result.timestamp || [];
    const closes = result.indicators?.quote?.[0]?.close || [];

    let pointsAdded = 0;

    for (let i = 0; i < timestamps.length; i++) {
      if (closes[i] !== null && closes[i] !== undefined) {
        const date = new Date(timestamps[i] * 1000).toISOString().split('T')[0];

        // Insert or update price_history
        const changes = db.prepare(
          `
                    INSERT INTO price_history (symbol, date, close_price)
                    VALUES (?, ?, ?)
                    ON CONFLICT(symbol, date) DO UPDATE SET close_price = ?
                `
        ).run(symbol, date, closes[i], closes[i]);

        if (changes.changes > 0) {
          pointsAdded++;
        }
      }
    }

    if (pointsAdded > 0) {
      console.log(`Added ${pointsAdded} price points for ${symbol}`);
    }

    return pointsAdded;
  } catch (err) {
    console.error(`Error fetching history for ${symbol}:`, err.message);
    return 0;
  }
}

// Fetch price for a single symbol
router.get('/fetch/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const price = await fetchYahooPrice(symbol);

    if (!price) {
      return res.status(404).json({ error: 'Symbol not found or price unavailable' });
    }

    const now = new Date().toISOString();
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

    // Cache the price in stock_prices
    db.prepare(
      `
            INSERT INTO stock_prices (symbol, price, name, updated_at) 
            VALUES (?, ?, ?, ?)
            ON CONFLICT(symbol) DO UPDATE SET 
                price = ?, name = ?, updated_at = ?
        `
    ).run(symbol, price.price, price.name, now, price.price, price.name, now);

    // Also update price_history for today (so chart reflects new price)
    db.prepare(
      `
            INSERT INTO price_history (symbol, date, close_price)
            VALUES (?, ?, ?)
            ON CONFLICT(symbol, date) DO UPDATE SET close_price = ?
        `
    ).run(symbol, today, price.price, price.price);

    // Return with joined role/theme data
    const result = db
      .prepare(
        `
            SELECT sp.*, sr.name as role_name, sr.color as role_color, st.name as theme_name, st.color as theme_color
            FROM stock_prices sp
            LEFT JOIN stock_roles sr ON sp.role_id = sr.id
            LEFT JOIN stock_themes st ON sp.theme_id = st.id
            WHERE sp.symbol = ?
        `
      )
      .get(symbol);

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
      theme_id,
      role_id,
      overall_rating,
      valuation_rating,
      growth_quality_rating,
      econ_moat_rating,
      leadership_rating,
      financial_health_rating,
      overall_notes,
      valuation_notes,
      growth_quality_notes,
      econ_moat_notes,
      leadership_notes,
      financial_health_notes,
      target_median_price,
      buy_target_price,
      sell_target_price,
    } = req.body;

    const now = new Date().toISOString();

    // Check if symbol exists
    const existing = db.prepare('SELECT symbol FROM stock_prices WHERE symbol = ?').get(symbol);

    if (existing) {
      // Update research fields including notes and price targets
      db.prepare(
        `
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
                    target_median_price = ?,
                    buy_target_price = ?,
                    sell_target_price = ?,
                    research_updated_at = ?
                WHERE symbol = ?
            `
      ).run(
        theme_id ?? null,
        role_id ?? null,
        overall_rating ?? null,
        valuation_rating ?? null,
        growth_quality_rating ?? null,
        econ_moat_rating ?? null,
        leadership_rating ?? null,
        financial_health_rating ?? null,
        overall_notes ?? null,
        valuation_notes ?? null,
        growth_quality_notes ?? null,
        econ_moat_notes ?? null,
        leadership_notes ?? null,
        financial_health_notes ?? null,
        target_median_price ?? null,
        buy_target_price ?? null,
        sell_target_price ?? null,
        now,
        symbol
      );
    } else {
      // Insert new row with research fields
      db.prepare(
        `
                INSERT INTO stock_prices (
                    symbol, price, name, theme_id, role_id, 
                    overall_rating, valuation_rating, growth_quality_rating, econ_moat_rating, leadership_rating, financial_health_rating,
                    overall_notes, valuation_notes, growth_quality_notes, econ_moat_notes, leadership_notes, financial_health_notes,
                    target_median_price, buy_target_price, sell_target_price,
                    research_updated_at, updated_at
                )
                VALUES (?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `
      ).run(
        symbol,
        symbol,
        theme_id ?? null,
        role_id ?? null,
        overall_rating ?? null,
        valuation_rating ?? null,
        growth_quality_rating ?? null,
        econ_moat_rating ?? null,
        leadership_rating ?? null,
        financial_health_rating ?? null,
        overall_notes ?? null,
        valuation_notes ?? null,
        growth_quality_notes ?? null,
        econ_moat_notes ?? null,
        leadership_notes ?? null,
        financial_health_notes ?? null,
        target_median_price ?? null,
        buy_target_price ?? null,
        sell_target_price ?? null,
        now,
        now
      );
    }

    // Return the updated record with joined role/theme names
    const updated = db
      .prepare(
        `
            SELECT sp.*, sr.name as role_name, sr.color as role_color, st.name as theme_name, st.color as theme_color
            FROM stock_prices sp
            LEFT JOIN stock_roles sr ON sp.role_id = sr.id
            LEFT JOIN stock_themes st ON sp.theme_id = st.id
            WHERE sp.symbol = ?
        `
      )
      .get(symbol);
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
        const closes = quote.close.filter((c) => c !== null);
        price = closes[closes.length - 1];
      }

      return {
        price: price || 0,
        name: meta.shortName || meta.longName || symbol,
      };
    }

    return null;
  } catch (err) {
    console.error(`Yahoo Finance error for ${symbol}:`, err.message);
    return null;
  }
}

export default router;
