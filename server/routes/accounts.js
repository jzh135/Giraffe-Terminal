import { Router } from 'express';
import db from '../db.js';
import { calculateCashBalance, calculateRealizedGain } from '../utils/calculations.js';
import { validateRequired } from '../middleware/validation.js';

const router = Router();

// Get all accounts with cash balance
router.get('/', (req, res) => {
    try {
        const accounts = db.prepare('SELECT * FROM accounts ORDER BY name').all();

        // Calculate cash balance for each account using shared logic
        const accountsWithBalance = accounts.map(account => {
            const cashBalance = calculateCashBalance(db, account.id);
            const realizedGain = calculateRealizedGain(db, account.id);
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

        account.cash_balance = calculateCashBalance(db, account.id);
        account.realized_gain = calculateRealizedGain(db, account.id);
        res.json(account);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create account
router.post('/', validateRequired(['name']), (req, res) => {
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
router.put('/:id', validateRequired(['name']), (req, res) => {
    try {
        const { name, type, institution } = req.body;

        db.prepare(
            'UPDATE accounts SET name = ?, type = ?, institution = ? WHERE id = ?'
        ).run(name, type, institution, req.params.id);

        const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id);
        if (!account) {
            return res.status(404).json({ error: 'Account not found' });
        }
        account.cash_balance = calculateCashBalance(db, account.id);
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

export default router;
