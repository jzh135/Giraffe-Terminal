
/**
 * Calculate the current cash balance for an account.
 * 
 * Formula:
 * Cash Balance = (Deposits + Withdrawals + Fees + Interest) + Dividends - Stock Buys + Stock Sells
 * 
 * @param {import('better-sqlite3').Database} db 
 * @param {number} accountId 
 * @returns {number}
 */
export function calculateCashBalance(db, accountId) {
    // Cash movements (deposits, withdrawals, fees, interest)
    const cashMovements = db.prepare(
        'SELECT COALESCE(SUM(amount), 0) as total FROM cash_movements WHERE account_id = ?'
    ).get(accountId);

    // Dividends received
    const dividends = db.prepare(
        'SELECT COALESCE(SUM(amount), 0) as total FROM dividends WHERE account_id = ?'
    ).get(accountId);

    // Stock buys (subtract from cash)
    const buys = db.prepare(
        "SELECT COALESCE(SUM(total), 0) as total FROM transactions WHERE account_id = ? AND type = 'buy'"
    ).get(accountId);

    // Stock sells (add to cash)
    const sells = db.prepare(
        "SELECT COALESCE(SUM(total), 0) as total FROM transactions WHERE account_id = ? AND type = 'sell'"
    ).get(accountId);

    return (cashMovements?.total || 0) + (dividends?.total || 0) - (buys?.total || 0) + (sells?.total || 0);
}

/**
 * Calculate the total portfolio value (Cash + Holdings Market Value).
 * 
 * @param {import('better-sqlite3').Database} db 
 * @param {number} accountId 
 * @returns {number}
 */
export function calculatePortfolioValue(db, accountId) {
    const cashBalance = calculateCashBalance(db, accountId);

    // Calculate value of holdings
    const holdings = db.prepare(
        'SELECT symbol, SUM(shares) as shares FROM holdings WHERE account_id = ? GROUP BY symbol'
    ).all(accountId);

    let holdingsValue = 0;
    for (const holding of holdings) {
        const priceRow = db.prepare('SELECT price FROM stock_prices WHERE symbol = ?').get(holding.symbol);
        const price = priceRow?.price || 0;
        holdingsValue += holding.shares * price;
    }

    return cashBalance + holdingsValue;
}

/**
 * Calculate realized gains for an account.
 * 
 * Note: This relies on the 'realized_gain' column in transactions table being accurate.
 * 
 * @param {import('better-sqlite3').Database} db 
 * @param {number} accountId 
 * @returns {number}
 */
export function calculateRealizedGain(db, accountId) {
    const transactions = db.prepare(
        "SELECT COALESCE(SUM(realized_gain), 0) as total FROM transactions WHERE account_id = ?"
    ).get(accountId);

    const dividends = db.prepare(
        "SELECT COALESCE(SUM(amount), 0) as total FROM dividends WHERE account_id = ?"
    ).get(accountId);

    return (transactions?.total || 0) + (dividends?.total || 0);
}
