import { Router } from 'express';
import db from '../db.js';

const router = Router();

// Get all holdings (optionally filtered by account)
router.get('/', (req, res) => {
  try {
    const { account_id } = req.query;
    let query = `
      SELECT h.*, a.name as account_name 
      FROM holdings h 
      JOIN accounts a ON h.account_id = a.id
    `;
    const params = [];

    if (account_id) {
      query += ' WHERE h.account_id = ?';
      params.push(account_id);
    }

    query += ' ORDER BY h.symbol, h.purchase_date';

    const holdings = db.prepare(query).all(...params);
    res.json(holdings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single holding
router.get('/:id', (req, res) => {
  try {
    const holding = db
      .prepare(
        `
      SELECT h.*, a.name as account_name 
      FROM holdings h 
      JOIN accounts a ON h.account_id = a.id 
      WHERE h.id = ?
    `
      )
      .get(req.params.id);

    if (!holding) {
      return res.status(404).json({ error: 'Holding not found' });
    }
    res.json(holding);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create holding (also logs buy transaction)
router.post('/', (req, res) => {
  try {
    const { account_id, symbol, shares, cost_basis, purchase_date, notes } = req.body;

    // Validate required fields
    if (!account_id || !symbol || !shares || !cost_basis || !purchase_date) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const pricePerShare = cost_basis / shares;

    // Use transaction for atomicity
    const createHolding = db.transaction(() => {
      // Create the holding (lot)
      const holdingResult = db
        .prepare(
          'INSERT INTO holdings (account_id, symbol, shares, cost_basis, purchase_date, notes) VALUES (?, ?, ?, ?, ?, ?)'
        )
        .run(account_id, symbol.toUpperCase(), shares, cost_basis, purchase_date, notes || null);

      // Log the buy transaction
      db.prepare(
        'INSERT INTO transactions (account_id, holding_id, type, symbol, shares, price, total, date, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(
        account_id,
        holdingResult.lastInsertRowid,
        'buy',
        symbol.toUpperCase(),
        shares,
        pricePerShare,
        cost_basis,
        purchase_date,
        notes || null
      );

      return holdingResult.lastInsertRowid;
    });

    const holdingId = createHolding();
    const holding = db.prepare('SELECT * FROM holdings WHERE id = ?').get(holdingId);
    res.status(201).json(holding);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update holding
router.put('/:id', (req, res) => {
  try {
    const { shares, cost_basis, purchase_date, notes } = req.body;

    db.prepare(
      'UPDATE holdings SET shares = ?, cost_basis = ?, purchase_date = ?, notes = ? WHERE id = ?'
    ).run(shares, cost_basis, purchase_date, notes, req.params.id);

    const holding = db.prepare('SELECT * FROM holdings WHERE id = ?').get(req.params.id);
    if (!holding) {
      return res.status(404).json({ error: 'Holding not found' });
    }
    res.json(holding);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete holding
router.delete('/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM holdings WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Holding not found' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
