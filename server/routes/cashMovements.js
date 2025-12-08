import { Router } from 'express';
import db from '../db.js';

const router = Router();

// Get all cash movements (optionally filtered)
router.get('/', (req, res) => {
    try {
        const { account_id, type } = req.query;
        let query = `
      SELECT c.*, a.name as account_name 
      FROM cash_movements c 
      JOIN accounts a ON c.account_id = a.id
      WHERE 1=1
    `;
        const params = [];

        if (account_id) {
            query += ' AND c.account_id = ?';
            params.push(account_id);
        }
        if (type) {
            query += ' AND c.type = ?';
            params.push(type);
        }

        query += ' ORDER BY c.date DESC, c.id DESC';

        const movements = db.prepare(query).all(...params);
        res.json(movements);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get single cash movement
router.get('/:id', (req, res) => {
    try {
        const movement = db.prepare(`
      SELECT c.*, a.name as account_name 
      FROM cash_movements c 
      JOIN accounts a ON c.account_id = a.id 
      WHERE c.id = ?
    `).get(req.params.id);

        if (!movement) {
            return res.status(404).json({ error: 'Cash movement not found' });
        }
        res.json(movement);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create cash movement
router.post('/', (req, res) => {
    try {
        const { account_id, type, amount, date, notes } = req.body;

        if (!account_id || !type || amount === undefined || !date) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Validate type
        const validTypes = ['deposit', 'withdrawal', 'fee', 'interest'];
        if (!validTypes.includes(type)) {
            return res.status(400).json({ error: 'Invalid type. Must be: deposit, withdrawal, fee, or interest' });
        }

        // Normalize amount: deposits and interest are positive, withdrawals and fees are negative
        let normalizedAmount = Math.abs(amount);
        if (type === 'withdrawal' || type === 'fee') {
            normalizedAmount = -normalizedAmount;
        }

        const result = db.prepare(
            'INSERT INTO cash_movements (account_id, type, amount, date, notes) VALUES (?, ?, ?, ?, ?)'
        ).run(account_id, type, normalizedAmount, date, notes || null);

        const movement = db.prepare('SELECT * FROM cash_movements WHERE id = ?').get(result.lastInsertRowid);
        res.status(201).json(movement);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update cash movement
router.put('/:id', (req, res) => {
    try {
        const { type, amount, date, notes } = req.body;

        // Normalize amount
        let normalizedAmount = Math.abs(amount);
        if (type === 'withdrawal' || type === 'fee') {
            normalizedAmount = -normalizedAmount;
        }

        db.prepare(
            'UPDATE cash_movements SET type = ?, amount = ?, date = ?, notes = ? WHERE id = ?'
        ).run(type, normalizedAmount, date, notes, req.params.id);

        const movement = db.prepare('SELECT * FROM cash_movements WHERE id = ?').get(req.params.id);
        if (!movement) {
            return res.status(404).json({ error: 'Cash movement not found' });
        }
        res.json(movement);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete cash movement
router.delete('/:id', (req, res) => {
    try {
        const result = db.prepare('DELETE FROM cash_movements WHERE id = ?').run(req.params.id);
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Cash movement not found' });
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
