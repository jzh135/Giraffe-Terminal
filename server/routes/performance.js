import { Router } from 'express';
import db from '../db.js';

const router = Router();

const CORS_PROXY = 'https://corsproxy.io/?';

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

        cashFlowQuery += ' GROUP BY date ORDER BY date';

        const cashFlows = db.prepare(cashFlowQuery).all(...params);

        // Get current portfolio value
        const portfolioValue = await calculatePortfolioValue(account_id);

        // Calculate Time-Weighted Return (TWR)
        const twr = calculateTWR(cashFlows, portfolioValue);

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

// Get portfolio value over time for charting
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

// Helper: Calculate current portfolio value
async function calculatePortfolioValue(accountId) {
    const holdingsQuery = accountId
        ? 'SELECT symbol, SUM(shares) as shares FROM holdings WHERE account_id = ? GROUP BY symbol'
        : 'SELECT symbol, SUM(shares) as shares FROM holdings GROUP BY symbol';

    const holdings = accountId
        ? db.prepare(holdingsQuery).all(accountId)
        : db.prepare(holdingsQuery).all();

    let totalValue = 0;

    for (const holding of holdings) {
        const priceRow = db.prepare('SELECT price FROM stock_prices WHERE symbol = ?').get(holding.symbol);
        const price = priceRow?.price || 0;
        totalValue += holding.shares * price;
    }

    // Add cash balance
    const cashQuery = accountId
        ? 'SELECT COALESCE(SUM(amount), 0) as total FROM cash_movements WHERE account_id = ?'
        : 'SELECT COALESCE(SUM(amount), 0) as total FROM cash_movements';

    const cash = accountId
        ? db.prepare(cashQuery).get(accountId)
        : db.prepare(cashQuery).get();

    const divQuery = accountId
        ? 'SELECT COALESCE(SUM(amount), 0) as total FROM dividends WHERE account_id = ?'
        : 'SELECT COALESCE(SUM(amount), 0) as total FROM dividends';

    const dividends = accountId
        ? db.prepare(divQuery).get(accountId)
        : db.prepare(divQuery).get();

    const buysQuery = accountId
        ? "SELECT COALESCE(SUM(total), 0) as total FROM transactions WHERE account_id = ? AND type = 'buy'"
        : "SELECT COALESCE(SUM(total), 0) as total FROM transactions WHERE type = 'buy'";

    const buys = accountId
        ? db.prepare(buysQuery).get(accountId)
        : db.prepare(buysQuery).get();

    const sellsQuery = accountId
        ? "SELECT COALESCE(SUM(total), 0) as total FROM transactions WHERE account_id = ? AND type = 'sell'"
        : "SELECT COALESCE(SUM(total), 0) as total FROM transactions WHERE type = 'sell'";

    const sells = accountId
        ? db.prepare(sellsQuery).get(accountId)
        : db.prepare(sellsQuery).get();

    const cashBalance = cash.total + dividends.total - buys.total + sells.total;

    return totalValue + cashBalance;
}

// Helper: Calculate Time-Weighted Return
function calculateTWR(cashFlows, currentValue) {
    if (cashFlows.length === 0) return 0;

    // Simplified TWR calculation
    // For proper TWR, we'd need daily valuations
    const totalDeposits = cashFlows
        .filter(cf => cf.amount > 0)
        .reduce((sum, cf) => sum + cf.amount, 0);

    const totalWithdrawals = cashFlows
        .filter(cf => cf.amount < 0)
        .reduce((sum, cf) => sum + Math.abs(cf.amount), 0);

    const netInvested = totalDeposits - totalWithdrawals;

    if (netInvested <= 0) return 0;

    return ((currentValue - netInvested) / netInvested) * 100;
}

// Helper: Fetch S&P 500 performance
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

export default router;
