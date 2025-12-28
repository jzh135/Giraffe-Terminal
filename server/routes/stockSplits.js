import { Router } from 'express';
import db from '../db.js';

const router = Router();

// Get all stock splits
router.get('/', (req, res) => {
  try {
    const { symbol } = req.query;
    let query = 'SELECT * FROM stock_splits WHERE 1=1';
    const params = [];

    if (symbol) {
      query += ' AND symbol = ?';
      params.push(symbol.toUpperCase());
    }

    query += ' ORDER BY date DESC';

    const splits = db.prepare(query).all(...params);
    res.json(splits);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create stock split and apply to holdings
router.post('/', (req, res) => {
  try {
    const { symbol, ratio, date, notes } = req.body;

    if (!symbol || !ratio || !date) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const upperSymbol = symbol.toUpperCase();

    // Use transaction for atomicity
    const applySplit = db.transaction(() => {
      // Record the split
      const result = db
        .prepare('INSERT INTO stock_splits (symbol, ratio, date, notes) VALUES (?, ?, ?, ?)')
        .run(upperSymbol, ratio, date, notes || null);

      // Apply split to all holdings of this symbol purchased before the split date
      const holdings = db
        .prepare('SELECT * FROM holdings WHERE symbol = ? AND purchase_date <= ?')
        .all(upperSymbol, date);

      for (const holding of holdings) {
        // Multiply shares by ratio, divide cost basis per share by ratio
        const newShares = holding.shares * ratio;
        // Cost basis stays the same (total investment unchanged), but per-share is lower
        db.prepare('UPDATE holdings SET shares = ? WHERE id = ?').run(newShares, holding.id);
      }

      return { splitId: result.lastInsertRowid, holdingsUpdated: holdings.length };
    });

    const result = applySplit();
    const split = db.prepare('SELECT * FROM stock_splits WHERE id = ?').get(result.splitId);
    res.status(201).json({ ...split, holdings_updated: result.holdingsUpdated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete stock split (Note: does NOT reverse the split on holdings)
router.delete('/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM stock_splits WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Stock split not found' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
