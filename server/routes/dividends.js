import { Router } from 'express';
import db from '../db.js';

const router = Router();

// Get all dividends (optionally filtered)
router.get('/', (req, res) => {
    try {
        const { account_id, symbol } = req.query;
        let query = `
      SELECT d.*, a.name as account_name 
      FROM dividends d 
      JOIN accounts a ON d.account_id = a.id
      WHERE 1=1
    `;
        const params = [];

        if (account_id) {
            query += ' AND d.account_id = ?';
            params.push(account_id);
        }
        if (symbol) {
            query += ' AND d.symbol = ?';
            params.push(symbol.toUpperCase());
        }

        query += ' ORDER BY d.date DESC, d.id DESC';

        const dividends = db.prepare(query).all(...params);
        res.json(dividends);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get single dividend
router.get('/:id', (req, res) => {
    try {
        const dividend = db.prepare(`
      SELECT d.*, a.name as account_name 
      FROM dividends d 
      JOIN accounts a ON d.account_id = a.id 
      WHERE d.id = ?
    `).get(req.params.id);

        if (!dividend) {
            return res.status(404).json({ error: 'Dividend not found' });
        }
        res.json(dividend);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create dividend
router.post('/', (req, res) => {
    try {
        const { account_id, symbol, amount, date, notes } = req.body;

        if (!account_id || !symbol || !amount || !date) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const result = db.prepare(
            'INSERT INTO dividends (account_id, symbol, amount, date, notes) VALUES (?, ?, ?, ?, ?)'
        ).run(account_id, symbol.toUpperCase(), amount, date, notes || null);

        const dividend = db.prepare('SELECT * FROM dividends WHERE id = ?').get(result.lastInsertRowid);
        res.status(201).json(dividend);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update dividend
router.put('/:id', (req, res) => {
    try {
        const { symbol, amount, date, notes } = req.body;

        db.prepare(
            'UPDATE dividends SET symbol = ?, amount = ?, date = ?, notes = ? WHERE id = ?'
        ).run(symbol.toUpperCase(), amount, date, notes, req.params.id);

        const dividend = db.prepare('SELECT * FROM dividends WHERE id = ?').get(req.params.id);
        if (!dividend) {
            return res.status(404).json({ error: 'Dividend not found' });
        }
        res.json(dividend);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete dividend
router.delete('/:id', (req, res) => {
    try {
        const result = db.prepare('DELETE FROM dividends WHERE id = ?').run(req.params.id);
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Dividend not found' });
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
