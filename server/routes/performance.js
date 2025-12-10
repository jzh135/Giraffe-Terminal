
import { Router } from 'express';
import db from '../db.js';
import { calculatePortfolioValue, calculateCashBalance } from '../utils/calculations.js';

const router = Router();

const CORS_PROXY = 'https://corsproxy.io/?';

// Timeframe presets
const TIMEFRAMES = {
    '5D': { days: 5, label: '5 Days' },
    '30D': { days: 30, label: '30 Days' },
    '3M': { days: 90, label: '3 Months' },
    '6M': { days: 180, label: '6 Months' },
    'YTD': { days: null, label: 'YTD' }, // Special handling
    '1Y': { days: 365, label: '1 Year' },
    'ALL': { days: null, label: 'Since Inception' } // Special handling
};

// Auto-generated distinct colors for accounts
const ACCOUNT_COLORS = [
    '#6366f1', // Indigo
    '#10b981', // Emerald
    '#f59e0b', // Amber  
    '#ef4444', // Red
    '#8b5cf6', // Violet
    '#06b6d4', // Cyan
    '#ec4899', // Pink
    '#84cc16', // Lime
    '#f97316', // Orange
    '#14b8a6', // Teal
];

const SPY_COLOR = '#fbbf24'; // Gold for S&P 500

// Get portfolio performance with TWR and S&P 500 comparison
router.get('/', async (req, res) => {
    try {
        const { account_id, start_date, end_date } = req.query;

        // Get all cash flows (deposits, withdrawals)
        let cashFlowQuery = `
      SELECT date, SUM(amount) as amount
      FROM cash_movements
      WHERE type IN ('deposit', 'withdrawal')
    `;
        const params = [];

        if (account_id) {
            cashFlowQuery += ' AND account_id = ?';
            params.push(account_id);
        }

        // Filter by date range if provided
        if (start_date) {
            cashFlowQuery += ' AND date >= ?';
            params.push(start_date);
        }

        cashFlowQuery += ' GROUP BY date ORDER BY date';

        const cashFlows = db.prepare(cashFlowQuery).all(...params);

        // Get current portfolio value
        const portfolioValue = calculatePortfolioValue(db, account_id);

        // Calculate Time-Weighted Return (Modified Dietz)
        const twr = calculateModifiedDietz(cashFlows, portfolioValue, start_date);

        // Get S&P 500 comparison
        const spyData = await fetchSPYPerformance(start_date, end_date);

        res.json({
            portfolio_value: portfolioValue,
            twr: twr,
            spy_return: spyData?.return || null,
            cash_flows: cashFlows
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get portfolio allocation by role
router.get('/allocation', (req, res) => {
    try {
        const { account_id } = req.query;

        let query = `
            SELECT 
                h.symbol, 
                h.shares,
                sp.price,
                sr.name as role_name,
                sr.color as role_color
            FROM holdings h
            LEFT JOIN stock_prices sp ON h.symbol = sp.symbol
            LEFT JOIN stock_roles sr ON sp.role_id = sr.id
            WHERE 1=1
        `;

        const params = [];

        if (account_id) {
            query += ' AND h.account_id = ?';
            params.push(account_id);
        }

        const holdings = db.prepare(query).all(...params);

        // Group by role
        const allocation = {};
        let totalValue = 0;

        holdings.forEach(h => {
            const value = h.shares * (h.price || 0);
            totalValue += value;

            const roleName = h.role_name || 'Unassigned';
            const roleColor = h.role_color || '#cccccc';

            if (!allocation[roleName]) {
                allocation[roleName] = {
                    name: roleName,
                    value: 0,
                    color: roleColor
                };
            }
            allocation[roleName].value += value;
        });

        // Convert to array and calculate percentages
        const result = Object.values(allocation)
            .map(item => ({
                ...item,
                percent: totalValue > 0 ? (item.value / totalValue) * 100 : 0
            }))
            .sort((a, b) => b.value - a.value);

        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get performance chart data with normalized returns
router.get('/chart', async (req, res) => {
    try {
        const { account_ids, timeframe = '1Y' } = req.query;

        // Parse account IDs
        const accountIdList = account_ids ? account_ids.split(',').map(id => parseInt(id)) : [];

        // Get all accounts if none specified
        const accounts = accountIdList.length > 0
            ? db.prepare(`SELECT * FROM accounts WHERE id IN (${accountIdList.map(() => '?').join(',')})`).all(...accountIdList)
            : db.prepare('SELECT * FROM accounts').all();

        if (accounts.length === 0) {
            return res.json({ data: [], accounts: [], timeframes: Object.keys(TIMEFRAMES) });
        }

        // Calculate date range based on timeframe
        const { startDate, endDate } = getDateRange(timeframe, accounts);

        // Get all unique symbols held across all accounts
        const allSymbols = db.prepare(`
            SELECT DISTINCT symbol FROM transactions 
            WHERE account_id IN (${accounts.map(() => '?').join(',')})
        `).all(...accounts.map(a => a.id)).map(r => r.symbol);

        // Fetch historical prices for all symbols (including SPY)
        const symbolsToFetch = [...new Set([...allSymbols, 'SPY'])];
        const historicalPrices = await fetchHistoricalPricesForSymbols(symbolsToFetch, startDate, endDate);

        // Get or calculate performance data for each account
        const accountData = await Promise.all(accounts.map(async (account, index) => {
            const history = await getAccountPerformanceHistoryWithPrices(account.id, startDate, endDate, historicalPrices);
            return {
                id: account.id,
                name: account.name,
                color: ACCOUNT_COLORS[index % ACCOUNT_COLORS.length],
                data: history
            };
        }));

        // Get S&P 500 data from the historical prices we already fetched
        const spyData = (historicalPrices.get('SPY') || []).map(p => ({ date: p.date, close_price: p.price }));

        // Normalize all data to percentage returns from the start
        const normalizedData = normalizeReturns(accountData, spyData, startDate, endDate);

        res.json({
            data: normalizedData,
            accounts: accounts.map((a, i) => ({
                id: a.id,
                name: a.name,
                color: ACCOUNT_COLORS[i % ACCOUNT_COLORS.length]
            })),
            spy_color: SPY_COLOR,
            timeframes: Object.keys(TIMEFRAMES),
            current_timeframe: timeframe
        });
    } catch (err) {
        console.error('Chart error:', err);
        res.status(500).json({ error: err.message });
    }
});


// Get portfolio value over time for charting (legacy endpoint)
router.get('/history', async (req, res) => {
    try {
        const { account_id } = req.query;

        // Get all activities ordered by date
        let activities = [];

        // Cash movements
        const cashQuery = account_id
            ? 'SELECT date, amount FROM cash_movements WHERE account_id = ? ORDER BY date'
            : 'SELECT date, amount FROM cash_movements ORDER BY date';
        const cashMovements = account_id
            ? db.prepare(cashQuery).all(account_id)
            : db.prepare(cashQuery).all();

        activities = activities.concat(cashMovements.map(c => ({ date: c.date, cashChange: c.amount })));

        // Dividends
        const divQuery = account_id
            ? 'SELECT date, amount FROM dividends WHERE account_id = ? ORDER BY date'
            : 'SELECT date, amount FROM dividends ORDER BY date';
        const dividends = account_id
            ? db.prepare(divQuery).all(account_id)
            : db.prepare(divQuery).all();

        activities = activities.concat(dividends.map(d => ({ date: d.date, cashChange: d.amount })));

        // Sort by date
        activities.sort((a, b) => a.date.localeCompare(b.date));

        // Build historical data points
        let runningCash = 0;
        const history = [];
        const seenDates = new Set();

        for (const activity of activities) {
            runningCash += activity.cashChange || 0;
            if (!seenDates.has(activity.date)) {
                seenDates.add(activity.date);
                history.push({
                    date: activity.date,
                    cash: runningCash
                });
            }
        }

        res.json(history);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Helper: Get date range based on timeframe
function getDateRange(timeframe, accounts) {
    const today = new Date();
    let startDate;
    const endDate = today.toISOString().split('T')[0];

    if (timeframe === 'YTD') {
        startDate = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];
    } else if (timeframe === 'ALL') {
        // Find the earliest account creation or first transaction
        const earliestAccount = accounts.reduce((earliest, acc) => {
            const created = acc.created_at ? acc.created_at.split('T')[0] : endDate;
            return created < earliest ? created : earliest;
        }, endDate);

        // Also check for earliest cash movement
        const earliestCashMove = db.prepare(
            'SELECT MIN(date) as earliest FROM cash_movements'
        ).get();

        startDate = earliestCashMove?.earliest && earliestCashMove.earliest < earliestAccount
            ? earliestCashMove.earliest
            : earliestAccount;
    } else {
        const preset = TIMEFRAMES[timeframe] || TIMEFRAMES['1Y'];
        startDate = new Date(today.getTime() - (preset.days * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];
    }

    return { startDate, endDate };
}

// Helper: Get account performance history
async function getAccountPerformanceHistory(accountId, startDate, endDate) {
    // Try to get cached data first
    const cached = db.prepare(`
        SELECT date, portfolio_value, cost_basis, cash_balance
        FROM performance_history
        WHERE account_id = ? AND date >= ? AND date <= ?
        ORDER BY date
    `).all(accountId, startDate, endDate);

    // Generate missing dates
    const allDates = generateWorkdays(startDate, endDate);
    const cachedMap = new Map(cached.map(c => [c.date, c]));

    const result = [];

    for (const date of allDates) {
        if (cachedMap.has(date)) {
            result.push(cachedMap.get(date));
        } else {
            // Calculate historical value for this date
            const snapshot = calculateHistoricalSnapshot(accountId, date);

            // Cache it if it's not today (today's data changes)
            const today = new Date().toISOString().split('T')[0];
            if (date !== today && snapshot.portfolio_value > 0) {
                try {
                    db.prepare(`
                        INSERT OR REPLACE INTO performance_history 
                        (account_id, date, portfolio_value, cost_basis, cash_balance)
                        VALUES (?, ?, ?, ?, ?)
                    `).run(accountId, date, snapshot.portfolio_value, snapshot.cost_basis, snapshot.cash_balance);
                } catch (e) {
                    // Ignore cache errors
                }
            }

            result.push({ date, ...snapshot });
        }
    }

    return result;
}

// Helper: Calculate historical snapshot for a given date
function calculateHistoricalSnapshot(accountId, targetDate) {
    const whereClause = accountId ? 'WHERE account_id = ?' : '';
    const params = accountId ? [accountId] : [];

    // Cash movements up to target date
    const cashMovements = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total 
        FROM cash_movements 
        ${whereClause ? whereClause + ' AND' : 'WHERE'} date <= ?
    `).get(...params, targetDate);

    // Dividends up to target date
    const dividends = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total 
        FROM dividends 
        ${whereClause ? whereClause + ' AND' : 'WHERE'} date <= ?
    `).get(...params, targetDate);

    // Buys up to target date
    const buys = db.prepare(`
        SELECT COALESCE(SUM(total), 0) as total 
        FROM transactions 
        ${whereClause ? whereClause + " AND type = 'buy' AND" : "WHERE type = 'buy' AND"} date <= ?
    `).get(...params, targetDate);

    // Sells up to target date
    const sells = db.prepare(`
        SELECT COALESCE(SUM(total), 0) as total 
        FROM transactions 
        ${whereClause ? whereClause + " AND type = 'sell' AND" : "WHERE type = 'sell' AND"} date <= ?
    `).get(...params, targetDate);

    const cashBalance = (cashMovements?.total || 0) + (dividends?.total || 0) - (buys?.total || 0) + (sells?.total || 0);

    // Get holdings at target date (shares bought - shares sold)
    const holdings = db.prepare(`
        SELECT symbol, 
               SUM(CASE WHEN type = 'buy' AND date <= ? THEN shares ELSE 0 END) -
               SUM(CASE WHEN type = 'sell' AND date <= ? THEN shares ELSE 0 END) as shares,
               SUM(CASE WHEN type = 'buy' AND date <= ? THEN total ELSE 0 END) as cost_basis
        FROM transactions
        ${whereClause ? whereClause + ' AND' : 'WHERE'} date <= ?
        GROUP BY symbol
        HAVING shares > 0
    `).all(...params, targetDate, targetDate, targetDate, targetDate);

    // Use current prices (we don't have historical prices for individual stocks)
    let holdingsValue = 0;
    let totalCostBasis = 0;

    for (const h of holdings) {
        const priceRow = db.prepare('SELECT price FROM stock_prices WHERE symbol = ?').get(h.symbol);
        holdingsValue += h.shares * (priceRow?.price || 0);
        totalCostBasis += h.cost_basis || 0;
    }

    return {
        portfolio_value: cashBalance + holdingsValue,
        cost_basis: totalCostBasis,
        cash_balance: cashBalance
    };
}

// Helper: Generate list of workdays between two dates
function generateWorkdays(startDate, endDate) {
    const dates = [];
    const current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
        const dayOfWeek = current.getDay();
        // 0 = Sunday, 6 = Saturday
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            dates.push(current.toISOString().split('T')[0]);
        }
        current.setDate(current.getDate() + 1);
    }

    return dates;
}

// Helper: Get S&P 500 history
async function getSPYHistory(startDate, endDate) {
    // Check cache first
    const cached = db.prepare(`
        SELECT date, close_price
        FROM price_history
        WHERE symbol = 'SPY' AND date >= ? AND date <= ?
        ORDER BY date
    `).all(startDate, endDate);

    // If we have recent data, use cache
    const today = new Date().toISOString().split('T')[0];
    const hasRecentData = cached.some(c => c.date >= today ||
        (new Date(today) - new Date(c.date)) / (1000 * 60 * 60 * 24) <= 1);

    if (cached.length > 0 && hasRecentData) {
        return cached;
    }

    // Fetch from Yahoo Finance
    try {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const period1 = Math.floor(start.getTime() / 1000);
        const period2 = Math.floor(end.getTime() / 1000) + 86400; // Add a day

        const url = `${CORS_PROXY}https://query1.finance.yahoo.com/v8/finance/chart/SPY?period1=${period1}&period2=${period2}&interval=1d`;
        const response = await fetch(url);

        if (!response.ok) {
            return cached.length > 0 ? cached : [];
        }

        const data = await response.json();

        if (data.chart?.result?.[0]) {
            const result = data.chart.result[0];
            const timestamps = result.timestamp || [];
            const closes = result.indicators?.quote?.[0]?.close || [];

            const history = [];
            for (let i = 0; i < timestamps.length; i++) {
                if (closes[i] !== null) {
                    const date = new Date(timestamps[i] * 1000).toISOString().split('T')[0];
                    history.push({ date, close_price: closes[i] });

                    // Cache the data
                    try {
                        db.prepare(`
                            INSERT OR REPLACE INTO price_history (symbol, date, close_price)
                            VALUES ('SPY', ?, ?)
                        `).run(date, closes[i]);
                    } catch (e) {
                        // Ignore cache errors
                    }
                }
            }

            return history;
        }
    } catch (err) {
        console.error('Failed to fetch SPY history:', err.message);
    }

    return cached.length > 0 ? cached : [];
}

// Helper: Normalize returns to percentage
function normalizeReturns(accountData, spyData, startDate, endDate) {
    const allDates = generateWorkdays(startDate, endDate);

    // Create a map for SPY data
    const spyMap = new Map(spyData.map(d => [d.date, d.close_price]));
    const spyStartPrice = spyData.length > 0 ? spyData[0].close_price : null;

    // Create maps for each account
    const accountMaps = accountData.map(acc => ({
        id: acc.id,
        name: acc.name,
        color: acc.color,
        dataMap: new Map(acc.data.map(d => [d.date, d.portfolio_value])),
        startValue: acc.data.length > 0 ? acc.data[0].portfolio_value : null
    }));

    // Build normalized data points
    const result = [];

    for (const date of allDates) {
        const point = { date };

        // Add account returns
        for (const acc of accountMaps) {
            const value = acc.dataMap.get(date);
            if (value !== undefined && acc.startValue && acc.startValue > 0) {
                point[`account_${acc.id}`] = ((value - acc.startValue) / acc.startValue) * 100;
            }
        }

        // Add SPY return
        const spyPrice = spyMap.get(date);
        if (spyPrice !== undefined && spyStartPrice && spyStartPrice > 0) {
            point.spy = ((spyPrice - spyStartPrice) / spyStartPrice) * 100;
        }

        result.push(point);
    }

    return result;
}

// Helper: Calculate Time-Weighted Return using Modified Dietz method
function calculateModifiedDietz(cashFlows, endValue, startDateStr) {
    if (cashFlows.length === 0) return 0;

    // Filter flows within the period if startDate is provided
    let flows = cashFlows;
    if (startDateStr) {
        flows = cashFlows.filter(cf => cf.date >= startDateStr);
    }

    if (flows.length === 0) return 0;

    const startValue = 0;

    // Net External Flows (F)
    const totalFlows = flows.reduce((sum, cf) => sum + cf.amount, 0);

    const today = new Date();
    flows.sort((a, b) => a.date.localeCompare(b.date));

    const firstDate = new Date(flows[0].date);
    const totalDurationMs = today - firstDate;
    const totalDurationDays = totalDurationMs / (1000 * 60 * 60 * 24);

    if (totalDurationDays <= 0) return 0;

    let weightedFlows = 0;

    for (const flow of flows) {
        const flowDate = new Date(flow.date);
        const daysSinceFlow = (today - flowDate) / (1000 * 60 * 60 * 24);
        const weight = Math.max(0, daysSinceFlow / totalDurationDays);
        weightedFlows += flow.amount * weight;
    }

    // Modified Dietz Formula:
    // R = (V1 - V0 - F) / (V0 + Sum(Fi * Wi))
    const numerator = endValue - startValue - totalFlows;
    const denominator = startValue + weightedFlows;

    if (denominator <= 0) return 0;

    return (numerator / denominator) * 100;
}

// Helper: Fetch S&P 500 performance (for main dashboard)
async function fetchSPYPerformance(startDate, endDate) {
    try {
        const url = `${CORS_PROXY}https://query1.finance.yahoo.com/v8/finance/chart/SPY?interval=1d&range=1y`;
        const response = await fetch(url);

        if (!response.ok) return null;

        const data = await response.json();

        if (data.chart?.result?.[0]) {
            const result = data.chart.result[0];
            const closes = result.indicators?.quote?.[0]?.close?.filter(c => c !== null) || [];

            if (closes.length >= 2) {
                const startPrice = closes[0];
                const endPrice = closes[closes.length - 1];
                return {
                    return: ((endPrice - startPrice) / startPrice) * 100
                };
            }
        }

        return null;
    } catch (err) {
        console.error('Failed to fetch SPY data:', err.message);
        return null;
    }
}

// Helper: Fetch historical prices for multiple symbols from Yahoo Finance
async function fetchHistoricalPricesForSymbols(symbols, startDate, endDate) {
    const pricesMap = new Map();
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    // Check cache first
    for (const symbol of symbols) {
        const cached = db.prepare(`
            SELECT date, close_price as price
            FROM price_history
            WHERE symbol = ? AND date >= ? AND date <= ?
            ORDER BY date
        `).all(symbol, startDate, endDate);

        if (cached.length > 0) {
            pricesMap.set(symbol, cached);
        }
    }

    // Calculate expected number of workdays in the range
    const expectedDays = generateWorkdays(startDate, endDate).length;

    // Determine which symbols need fetching:
    // 1. No cached data at all
    // 2. Cached data is missing more than 20% of expected days
    // 3. We don't have data for yesterday or today (need fresh data)
    const symbolsToFetch = symbols.filter(s => {
        const cached = pricesMap.get(s);
        if (!cached || cached.length === 0) return true;

        // Check if we're missing too much data
        if (cached.length < expectedDays * 0.8) return true;

        // Check if we have recent data (within last 2 days)
        const mostRecentDate = cached[cached.length - 1]?.date;
        if (!mostRecentDate) return true;
        if (mostRecentDate < yesterday) return true;

        return false;
    });

    console.log(`Fetching historical prices for ${symbolsToFetch.length} symbols from Yahoo Finance...`);

    for (const symbol of symbolsToFetch) {
        try {
            const start = new Date(startDate);
            const end = new Date(endDate);
            const period1 = Math.floor(start.getTime() / 1000);
            const period2 = Math.floor(end.getTime() / 1000) + 86400;

            const url = `${CORS_PROXY}https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${period1}&period2=${period2}&interval=1d`;
            const response = await fetch(url);

            if (!response.ok) {
                console.warn(`Failed to fetch ${symbol}: ${response.status}`);
                continue;
            }

            const data = await response.json();

            if (data.chart?.result?.[0]) {
                const result = data.chart.result[0];
                const timestamps = result.timestamp || [];
                const closes = result.indicators?.quote?.[0]?.close || [];

                const history = [];
                for (let i = 0; i < timestamps.length; i++) {
                    if (closes[i] !== null && closes[i] !== undefined) {
                        const date = new Date(timestamps[i] * 1000).toISOString().split('T')[0];
                        history.push({ date, price: closes[i] });

                        // Cache the data
                        try {
                            db.prepare(`
                                INSERT OR REPLACE INTO price_history (symbol, date, close_price)
                                VALUES (?, ?, ?)
                            `).run(symbol, date, closes[i]);
                        } catch (e) {
                            // Ignore cache errors
                        }
                    }
                }

                pricesMap.set(symbol, history);
                console.log(`Cached ${history.length} price points for ${symbol}`);
            }
        } catch (err) {
            console.error(`Failed to fetch ${symbol}:`, err.message);
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    return pricesMap;
}


// Helper: Get account performance history with historical prices
async function getAccountPerformanceHistoryWithPrices(accountId, startDate, endDate, historicalPrices) {
    const allDates = generateWorkdays(startDate, endDate);
    const result = [];

    for (const date of allDates) {
        // Calculate holdings at this date
        const holdings = db.prepare(`
            SELECT symbol, 
                   SUM(CASE WHEN type = 'buy' AND date <= ? THEN shares ELSE 0 END) -
                   SUM(CASE WHEN type = 'sell' AND date <= ? THEN shares ELSE 0 END) as shares,
                   SUM(CASE WHEN type = 'buy' AND date <= ? THEN total ELSE 0 END) as cost_basis
            FROM transactions
            WHERE account_id = ? AND date <= ?
            GROUP BY symbol
            HAVING shares > 0
        `).all(date, date, date, accountId, date);

        // Calculate cash balance at this date
        const cashMovements = db.prepare(`
            SELECT COALESCE(SUM(amount), 0) as total 
            FROM cash_movements 
            WHERE account_id = ? AND date <= ?
        `).get(accountId, date);

        const dividends = db.prepare(`
            SELECT COALESCE(SUM(amount), 0) as total 
            FROM dividends 
            WHERE account_id = ? AND date <= ?
        `).get(accountId, date);

        const buys = db.prepare(`
            SELECT COALESCE(SUM(total), 0) as total 
            FROM transactions 
            WHERE account_id = ? AND type = 'buy' AND date <= ?
        `).get(accountId, date);

        const sells = db.prepare(`
            SELECT COALESCE(SUM(total), 0) as total 
            FROM transactions 
            WHERE account_id = ? AND type = 'sell' AND date <= ?
        `).get(accountId, date);

        const cashBalance = (cashMovements?.total || 0) + (dividends?.total || 0) - (buys?.total || 0) + (sells?.total || 0);

        // Calculate holdings value using historical prices
        let holdingsValue = 0;
        for (const h of holdings) {
            const symbolPrices = historicalPrices.get(h.symbol) || [];
            // Find the price for this date or the nearest earlier date
            let price = null;
            for (let i = symbolPrices.length - 1; i >= 0; i--) {
                if (symbolPrices[i].date <= date) {
                    price = symbolPrices[i].price;
                    break;
                }
            }
            // If no historical price, use current price as fallback
            if (price === null) {
                const currentPrice = db.prepare('SELECT price FROM stock_prices WHERE symbol = ?').get(h.symbol);
                price = currentPrice?.price || 0;
            }
            holdingsValue += h.shares * price;
        }

        const portfolioValue = cashBalance + holdingsValue;

        result.push({
            date,
            portfolio_value: portfolioValue,
            cash_balance: cashBalance,
            holdings_value: holdingsValue
        });
    }

    return result;
}

export default router;

