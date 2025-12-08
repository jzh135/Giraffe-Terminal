import { Router } from 'express';
import db from '../db.js';

const router = Router();

// Get all accounts with cash balance
router.get('/', (req, res) => {
    try {
        const accounts = db.prepare('SELECT * FROM accounts ORDER BY name').all();

        // Calculate cash balance for each account
        const accountsWithBalance = accounts.map(account => {
            const cashBalance = calculateCashBalance(account.id);
            const realizedGain = calculateRealizedGain(account.id);
            return { ...account, cash_balance: cashBalance, realized_gain: realizedGain };
        });

        res.json(accountsWithBalance);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get single account with details
router.get('/:id', (req, res) => {
    try {
        const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id);
        if (!account) {
            return res.status(404).json({ error: 'Account not found' });
        }

        account.cash_balance = calculateCashBalance(account.id);
        account.realized_gain = calculateRealizedGain(account.id);
        res.json(account);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create account
router.post('/', (req, res) => {
    try {
        const { name, type, institution } = req.body;
        const result = db.prepare(
            'INSERT INTO accounts (name, type, institution) VALUES (?, ?, ?)'
        ).run(name, type || 'brokerage', institution || null);

        const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(result.lastInsertRowid);
        account.cash_balance = 0;
        res.status(201).json(account);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update account
router.put('/:id', (req, res) => {
    try {
        const { name, type, institution } = req.body;
        db.prepare(
            'UPDATE accounts SET name = ?, type = ?, institution = ? WHERE id = ?'
        ).run(name, type, institution, req.params.id);

        const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id);
        if (!account) {
            return res.status(404).json({ error: 'Account not found' });
        }
        account.cash_balance = calculateCashBalance(account.id);
        res.json(account);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete account
router.delete('/:id', (req, res) => {
    try {
        const result = db.prepare('DELETE FROM accounts WHERE id = ?').run(req.params.id);
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Account not found' });
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Helper: Calculate cash balance for an account
function calculateCashBalance(accountId) {
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

    // Realized Gains (stored in generated column for new transactions, or calculated?)
    // Actually, we just need to return it separately or add it to the account object? 
    // The user wants to SEE realized gain/loss. So let's fetch it.
    // We'll return it as part of the balance or a new field? New field is better logic.
    // But this function is 'calculateCashBalance'.
    // I should modify the ROUTE to fetch this separately.

    return cashMovements.total + dividends.total - buys.total + sells.total;
}

// Helper: Calculate realized gain for an account
function calculateRealizedGain(accountId) {
    const transactions = db.prepare(
        "SELECT COALESCE(SUM(realized_gain), 0) as total FROM transactions WHERE account_id = ?"
    ).get(accountId);

    const dividends = db.prepare(
        "SELECT COALESCE(SUM(amount), 0) as total FROM dividends WHERE account_id = ?"
    ).get(accountId);

    return transactions.total + dividends.total;
}

export default router;
