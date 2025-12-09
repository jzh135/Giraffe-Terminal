import { Router } from 'express';
import db from '../db.js';

const router = Router();

// Get all transactions (optionally filtered)
router.get('/', (req, res) => {
    try {
        const { account_id, type, symbol } = req.query;
        let query = `
      SELECT t.*, a.name as account_name 
      FROM transactions t 
      JOIN accounts a ON t.account_id = a.id
      WHERE 1=1
    `;
        const params = [];

        if (account_id) {
            query += ' AND t.account_id = ?';
            params.push(account_id);
        }
        if (type) {
            query += ' AND t.type = ?';
            params.push(type);
        }
        if (symbol) {
            query += ' AND t.symbol = ?';
            params.push(symbol.toUpperCase());
        }

        query += ' ORDER BY t.date DESC, t.id DESC';

        const transactions = db.prepare(query).all(...params);
        res.json(transactions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get single transaction
router.get('/:id', (req, res) => {
    try {
        const transaction = db.prepare(`
      SELECT t.*, a.name as account_name 
      FROM transactions t 
      JOIN accounts a ON t.account_id = a.id 
      WHERE t.id = ?
    `).get(req.params.id);

        if (!transaction) {
            return res.status(404).json({ error: 'Transaction not found' });
        }
        res.json(transaction);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create transaction (for manual sells)
router.post('/', (req, res) => {
    try {
        const { account_id, holding_id, type, symbol, shares, price, date, notes } = req.body;

        if (!account_id || !type || !symbol || !shares || !price || !date) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const total = shares * price;

        const result = db.prepare(
            'INSERT INTO transactions (account_id, holding_id, type, symbol, shares, price, total, date, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(account_id, holding_id || null, type, symbol.toUpperCase(), shares, price, total, date, notes || null);

        const transaction = db.prepare('SELECT * FROM transactions WHERE id = ?').get(result.lastInsertRowid);
        res.status(201).json(transaction);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update transaction
router.put('/:id', (req, res) => {
    try {
        const { type, symbol, shares, price, date, notes } = req.body;
        const total = shares * price;
        const txId = req.params.id;

        // Get the existing transaction to check if it's a buy and has an associated holding
        const existingTx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(txId);
        if (!existingTx) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        // Use a database transaction for atomicity
        const updateTx = db.transaction(() => {
            // Update the transaction record
            db.prepare(
                'UPDATE transactions SET type = ?, symbol = ?, shares = ?, price = ?, total = ?, date = ?, notes = ? WHERE id = ?'
            ).run(type, symbol.toUpperCase(), shares, price, total, date, notes, txId);

            // If this is a buy transaction with an associated holding, update the holding too
            if (existingTx.type === 'buy' && existingTx.holding_id) {
                const holding = db.prepare('SELECT * FROM holdings WHERE id = ?').get(existingTx.holding_id);

                if (holding) {
                    // Calculate the new cost basis (shares * price)
                    const newCostBasis = shares * price;

                    // Update the holding with new shares, cost_basis, symbol, and purchase_date
                    db.prepare(
                        'UPDATE holdings SET symbol = ?, shares = ?, cost_basis = ?, purchase_date = ? WHERE id = ?'
                    ).run(symbol.toUpperCase(), shares, newCostBasis, date, existingTx.holding_id);
                }
            }
        });

        updateTx();

        const transaction = db.prepare('SELECT * FROM transactions WHERE id = ?').get(txId);
        res.json(transaction);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete transaction
router.delete('/:id', (req, res) => {
    try {
        const result = db.prepare('DELETE FROM transactions WHERE id = ?').run(req.params.id);
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Transaction not found' });
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Sell stock from a specific lot
router.post('/sell', (req, res) => {
    try {
        const { account_id, holding_id, shares, price, date, notes } = req.body;

        if (!account_id || !holding_id || !shares || !price || !date) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Get the holding to validate
        const holding = db.prepare('SELECT * FROM holdings WHERE id = ?').get(holding_id);
        if (!holding) {
            return res.status(404).json({ error: 'Holding not found' });
        }

        if (shares > holding.shares) {
            return res.status(400).json({ error: 'Cannot sell more shares than held in lot' });
        }

        const total = shares * price;

        // Use transaction for atomicity
        const sellStock = db.transaction(() => {
            // Calculate realized gain
            const costBasisSold = (holding.cost_basis / holding.shares) * shares;
            const realizedGain = total - costBasisSold;

            // Log the sell transaction
            const txResult = db.prepare(
                'INSERT INTO transactions (account_id, holding_id, type, symbol, shares, price, total, date, notes, realized_gain) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            ).run(account_id, holding_id, 'sell', holding.symbol, shares, price, total, date, notes || null, realizedGain);

            // Update the holding shares
            const remainingShares = holding.shares - shares;

            if (remainingShares <= 0) {
                // Delete the lot if fully sold
                db.prepare('DELETE FROM holdings WHERE id = ?').run(holding_id);
            } else {
                // Update remaining shares and adjust cost basis proportionally
                const costBasisPerShare = holding.cost_basis / holding.shares;
                const newCostBasis = remainingShares * costBasisPerShare;
                db.prepare('UPDATE holdings SET shares = ?, cost_basis = ? WHERE id = ?').run(
                    remainingShares, newCostBasis, holding_id
                );
            }

            return txResult.lastInsertRowid;
        });

        const txId = sellStock();
        const transaction = db.prepare('SELECT * FROM transactions WHERE id = ?').get(txId);
        res.status(201).json(transaction);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
