
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
        const { account_id, end_date } = req.query;

        // Default to YTD (January 1st of current year) for TWR calculation
        const currentYear = new Date().getFullYear();
        const ytdStartDate = req.query.start_date || `${currentYear}-01-01`;

        // Get all cash flows (deposits, withdrawals) within YTD period
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

        // Filter by YTD date range
        cashFlowQuery += ' AND date >= ?';
        params.push(ytdStartDate);

        cashFlowQuery += ' GROUP BY date ORDER BY date';

        const cashFlows = db.prepare(cashFlowQuery).all(...params);

        // Get current portfolio value
        const portfolioValue = calculatePortfolioValue(db, account_id);

        // Calculate starting portfolio value at YTD start date
        const startSnapshot = calculateHistoricalSnapshot(account_id, ytdStartDate);
        const startValue = startSnapshot.portfolio_value;

        // Calculate Time-Weighted Return (Modified Dietz) - YTD
        const twr = calculateModifiedDietzWithStartValue(cashFlows, startValue, portfolioValue, ytdStartDate);

        // Get S&P 500 comparison - also YTD
        const spyData = await fetchSPYPerformanceYTD(ytdStartDate);

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

// Get portfolio allocation by role, theme, or stock
router.get('/allocation', (req, res) => {
    try {
        const { account_id, group_by = 'role' } = req.query;

        let query = `
            SELECT 
                h.symbol, 
                h.shares,
                sp.price,
                sp.name as stock_name,
                sr.name as role_name,
                sr.color as role_color,
                st.name as theme_name,
                st.color as theme_color
            FROM holdings h
            LEFT JOIN stock_prices sp ON h.symbol = sp.symbol
            LEFT JOIN stock_roles sr ON sp.role_id = sr.id
            LEFT JOIN stock_themes st ON sp.theme_id = st.id
            WHERE 1=1
        `;

        const params = [];

        if (account_id) {
            query += ' AND h.account_id = ?';
            params.push(account_id);
        }

        const holdings = db.prepare(query).all(...params);

        // Generate colors for stocks
        const stockColors = [
            '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
            '#f43f5e', '#ef4444', '#f97316', '#f59e0b', '#eab308',
            '#84cc16', '#22c55e', '#10b981', '#14b8a6', '#06b6d4',
            '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7'
        ];

        // Group by role, theme, or stock
        const allocation = {};
        let totalValue = 0;

        holdings.forEach((h, index) => {
            const value = h.shares * (h.price || 0);
            totalValue += value;

            let groupName, groupColor;
            if (group_by === 'theme') {
                groupName = h.theme_name || 'Unassigned';
                groupColor = h.theme_color || '#cccccc';
            } else if (group_by === 'stock') {
                groupName = h.symbol;
                // Use stock colors, cycling through if more than available
                groupColor = stockColors[Object.keys(allocation).length % stockColors.length];
            } else {
                groupName = h.role_name || 'Unassigned';
                groupColor = h.role_color || '#cccccc';
            }

            if (!allocation[groupName]) {
                allocation[groupName] = {
                    name: groupName,
                    value: 0,
                    color: group_by === 'stock' ? stockColors[Object.keys(allocation).length % stockColors.length] : groupColor
                };
            }
            allocation[groupName].value += value;
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

        // Calculate the DISPLAY date range based on timeframe (what we'll show)
        const { startDate, endDate } = getDateRange(timeframe, accounts);

        // Fetch with the MAX of 1Y or oldest account date to ensure full coverage
        const { startDate: oneYearStartDate } = getDateRange('1Y', accounts);
        const { startDate: allTimeStartDate } = getDateRange('ALL', accounts);
        const fetchStartDate = allTimeStartDate < oneYearStartDate ? allTimeStartDate : oneYearStartDate;

        // Get all unique symbols held across all accounts
        const allSymbols = db.prepare(`
            SELECT DISTINCT symbol FROM transactions 
            WHERE account_id IN (${accounts.map(() => '?').join(',')})
        `).all(...accounts.map(a => a.id)).map(r => r.symbol);

        // Fetch historical prices for all symbols (including SPY) with extended range
        const symbolsToFetch = [...new Set([...allSymbols, 'SPY'])];
        const historicalPrices = await fetchHistoricalPricesForSymbols(symbolsToFetch, fetchStartDate, endDate);

        // Get or calculate performance data for each account (using display range)
        const accountData = await Promise.all(accounts.map(async (account, index) => {
            const history = await getAccountPerformanceHistoryWithPrices(account.id, startDate, endDate, historicalPrices);
            return {
                id: account.id,
                name: account.name,
                color: ACCOUNT_COLORS[index % ACCOUNT_COLORS.length],
                data: history
            };
        }));

        // Get S&P 500 data from the historical prices, filtered to display range
        const spyData = (historicalPrices.get('SPY') || [])
            .filter(p => p.date >= startDate && p.date <= endDate)
            .map(p => ({ date: p.date, close_price: p.price }));

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

// Recalculate performance history for an account (with SSE progress)
router.get('/recalculate/:accountId', async (req, res) => {
    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const sendProgress = (data) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
        const { accountId } = req.params;
        const startTime = Date.now();

        // Verify account exists
        const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId);
        if (!account) {
            sendProgress({ error: 'Account not found' });
            res.end();
            return;
        }

        sendProgress({ status: 'Deleting old records...', percent: 0 });

        // Delete existing performance history for this account
        const deleteResult = db.prepare('DELETE FROM performance_history WHERE account_id = ?').run(accountId);
        console.log(`Deleted ${deleteResult.changes} old performance history records for account ${accountId}`);

        // Get date range - from first transaction/cash movement to today
        const firstActivity = db.prepare(`
            SELECT MIN(date) as earliest FROM (
                SELECT date FROM transactions WHERE account_id = ?
                UNION ALL
                SELECT date FROM cash_movements WHERE account_id = ?
            )
        `).get(accountId, accountId);

        if (!firstActivity?.earliest) {
            sendProgress({ complete: true, message: 'No activity found for this account', regenerated: 0 });
            res.end();
            return;
        }

        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const startDate = firstActivity.earliest;

        sendProgress({ status: 'Fetching historical prices...', percent: 5 });

        // Get all symbols for this account
        const symbols = db.prepare(`
            SELECT DISTINCT symbol FROM transactions WHERE account_id = ?
        `).all(accountId).map(r => r.symbol);

        // Fetch historical prices (will use cache)
        const historicalPrices = await fetchHistoricalPricesForSymbols(symbols, startDate, today);

        // Generate all workdays
        const allDates = generateWorkdays(startDate, today).filter(d => d !== today);
        const totalDates = allDates.length;

        sendProgress({ status: 'Calculating snapshots...', percent: 10, total: totalDates });

        let regenerated = 0;
        for (let i = 0; i < allDates.length; i++) {
            const date = allDates[i];

            // Calculate snapshot for this date
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
            let totalCostBasis = 0;
            for (const h of holdings) {
                const symbolPrices = historicalPrices.get(h.symbol) || [];
                let price = null;
                for (let j = symbolPrices.length - 1; j >= 0; j--) {
                    if (symbolPrices[j].date <= date) {
                        price = symbolPrices[j].price;
                        break;
                    }
                }
                if (price === null) {
                    const currentPrice = db.prepare('SELECT price FROM stock_prices WHERE symbol = ?').get(h.symbol);
                    price = currentPrice?.price || 0;
                }
                holdingsValue += h.shares * price;
                totalCostBasis += h.cost_basis || 0;
            }

            const portfolioValue = cashBalance + holdingsValue;

            // Only save if there's meaningful data
            if (portfolioValue > 0 || totalCostBasis > 0) {
                db.prepare(`
                    INSERT OR REPLACE INTO performance_history 
                    (account_id, date, portfolio_value, cost_basis, cash_balance)
                    VALUES (?, ?, ?, ?, ?)
                `).run(accountId, date, portfolioValue, totalCostBasis, cashBalance);
                regenerated++;
            }

            // Send progress update every 10 dates or at the end
            if (i % 10 === 0 || i === allDates.length - 1) {
                const percent = Math.round(10 + (i / totalDates) * 88); // 10% to 98%
                const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                sendProgress({
                    status: `Processing ${date}...`,
                    percent,
                    current: i + 1,
                    total: totalDates,
                    elapsed: `${elapsed}s`,
                    regenerated
                });
            }
        }

        const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`Regenerated ${regenerated} performance history records for account ${accountId} in ${totalElapsed}s`);

        sendProgress({
            complete: true,
            message: 'Performance history recalculated',
            regenerated,
            elapsed: `${totalElapsed}s`,
            percent: 100
        });
        res.end();
    } catch (err) {
        console.error('Recalculate error:', err);
        sendProgress({ error: err.message });
        res.end();
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

// Helper: Calculate TWR with explicit start value (for YTD calculation)
function calculateModifiedDietzWithStartValue(cashFlows, startValue, endValue, startDateStr) {
    // If no starting value, the portfolio didn't exist yet
    if (startValue <= 0 && cashFlows.length === 0) return 0;

    // Filter flows within the period
    let flows = cashFlows;
    if (startDateStr) {
        flows = cashFlows.filter(cf => cf.date >= startDateStr);
    }

    // Net External Flows (F)
    const totalFlows = flows.reduce((sum, cf) => sum + cf.amount, 0);

    const today = new Date();
    const periodStart = new Date(startDateStr);
    const totalDurationMs = today - periodStart;
    const totalDurationDays = totalDurationMs / (1000 * 60 * 60 * 24);

    if (totalDurationDays <= 0) return 0;

    // Calculate weighted flows based on time in period
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

// Helper: Fetch S&P 500 performance for YTD
async function fetchSPYPerformanceYTD(ytdStartDate) {
    try {
        // Calculate period1 and period2 for Yahoo Finance
        const startDate = new Date(ytdStartDate);
        const endDate = new Date();
        const period1 = Math.floor(startDate.getTime() / 1000);
        const period2 = Math.floor(endDate.getTime() / 1000) + 86400;

        const url = `${CORS_PROXY}https://query1.finance.yahoo.com/v8/finance/chart/SPY?period1=${period1}&period2=${period2}&interval=1d`;
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
        console.error('Failed to fetch SPY YTD data:', err.message);
        return null;
    }
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
// Uses incremental fetching - only fetches missing dates, not the full history
async function fetchHistoricalPricesForSymbols(symbols, startDate, endDate) {
    const pricesMap = new Map();

    // Use LOCAL date, not UTC (toISOString converts to UTC which can be "tomorrow" in evening)
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // Get cached data for all symbols first
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

    // Determine which symbols need fetching and from what date
    // We only fetch NEW data (from last cached date to today), not the full history
    const symbolsToFetch = [];

    // Helper: check if we need to fetch based on cache freshness
    // On weekends/holidays, we don't want to refetch if we have recent data
    function isCacheFresh(cachedDate) {
        if (!cachedDate) return false;

        const cached = new Date(cachedDate);
        const todayDate = new Date(today);
        const diffDays = Math.floor((todayDate - cached) / (1000 * 60 * 60 * 24));

        // If today is a weekday (Mon-Fri) and cache is not from today, it's stale
        const dayOfWeek = todayDate.getDay();
        const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

        if (isWeekday) {
            // On weekdays, only consider fresh if cache is from today
            return cachedDate === today;
        }

        // On weekends, cache from Friday (or later) is fresh
        // Saturday = 6, Sunday = 0
        // If it's Saturday, Friday's data (1 day old) is fresh
        // If it's Sunday, Friday's data (2 days old) is fresh
        return diffDays <= 2;
    }

    for (const symbol of symbols) {
        const cached = pricesMap.get(symbol);

        if (!cached || cached.length === 0) {
            // No cached data at all - need full fetch
            symbolsToFetch.push({ symbol, fetchFrom: startDate, fullFetch: true });
        } else {
            // Check if we need to fetch newer data
            const mostRecentCachedDate = cached[cached.length - 1]?.date;

            // Skip if cache is fresh
            if (mostRecentCachedDate && isCacheFresh(mostRecentCachedDate)) {
                continue;
            }

            if (mostRecentCachedDate && mostRecentCachedDate < today) {
                // Only fetch from the day after the last cached date
                // Parse the date properly to avoid timezone issues
                const [year, month, day] = mostRecentCachedDate.split('-').map(Number);
                const nextDay = new Date(year, month - 1, day + 1);
                const fetchFromDate = `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}`;

                // Only add to fetch list if there could be new data
                if (fetchFromDate <= today) {
                    symbolsToFetch.push({ symbol, fetchFrom: fetchFromDate, fullFetch: false });
                }
            }
            // If mostRecentCachedDate >= today, we already have all data - no fetch needed
        }
    }

    if (symbolsToFetch.length > 0) {
        const fullFetches = symbolsToFetch.filter(s => s.fullFetch).length;
        const incrementalFetches = symbolsToFetch.length - fullFetches;

        if (fullFetches > 0) {
            console.log(`Fetching full history for ${fullFetches} new symbols...`);
        }
        if (incrementalFetches > 0) {
            console.log(`Fetching recent prices for ${incrementalFetches} symbols...`);
        }
    }

    for (const { symbol, fetchFrom, fullFetch } of symbolsToFetch) {
        try {
            const start = new Date(fetchFrom);
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

                let newPoints = 0;
                for (let i = 0; i < timestamps.length; i++) {
                    if (closes[i] !== null && closes[i] !== undefined) {
                        const date = new Date(timestamps[i] * 1000).toISOString().split('T')[0];

                        // Cache the new data point
                        try {
                            db.prepare(`
                                INSERT OR REPLACE INTO price_history (symbol, date, close_price)
                                VALUES (?, ?, ?)
                            `).run(symbol, date, closes[i]);
                            newPoints++;
                        } catch (e) {
                            // Ignore cache errors
                        }
                    }
                }

                // Reload the full cached data for this symbol
                const updatedCache = db.prepare(`
                    SELECT date, close_price as price
                    FROM price_history
                    WHERE symbol = ? AND date >= ? AND date <= ?
                    ORDER BY date
                `).all(symbol, startDate, endDate);

                pricesMap.set(symbol, updatedCache);

                if (fullFetch) {
                    console.log(`Cached ${updatedCache.length} price points for ${symbol}`);
                } else if (newPoints > 0) {
                    console.log(`Added ${newPoints} new price points for ${symbol}`);
                }
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

