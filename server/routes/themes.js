import { Router } from 'express';
import db from '../db.js';

const router = Router();

// Get all themes
router.get('/', (req, res) => {
  try {
    const themes = db.prepare('SELECT * FROM stock_themes ORDER BY sort_order, name').all();
    res.json(themes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new theme
router.post('/', (req, res) => {
  try {
    const { name, color } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Theme name is required' });
    }

    // Get the max sort_order
    const maxOrder = db.prepare('SELECT MAX(sort_order) as max FROM stock_themes').get();
    const sortOrder = (maxOrder?.max || 0) + 1;

    const result = db
      .prepare(
        `
            INSERT INTO stock_themes (name, color, sort_order) VALUES (?, ?, ?)
        `
      )
      .run(name.trim(), color || null, sortOrder);

    const newTheme = db
      .prepare('SELECT * FROM stock_themes WHERE id = ?')
      .get(result.lastInsertRowid);
    res.status(201).json(newTheme);
  } catch (err) {
    if (err.message.includes('UNIQUE constraint')) {
      return res.status(400).json({ error: 'A theme with this name already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Update a theme
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, color, sort_order } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Theme name is required' });
    }

    db.prepare(
      `
            UPDATE stock_themes SET name = ?, color = ?, sort_order = ? WHERE id = ?
        `
    ).run(name.trim(), color || null, sort_order ?? 0, id);

    const updated = db.prepare('SELECT * FROM stock_themes WHERE id = ?').get(id);
    if (!updated) {
      return res.status(404).json({ error: 'Theme not found' });
    }
    res.json(updated);
  } catch (err) {
    if (err.message.includes('UNIQUE constraint')) {
      return res.status(400).json({ error: 'A theme with this name already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Delete a theme
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;

    // Get the theme name before deleting (to clear references)
    const theme = db.prepare('SELECT name FROM stock_themes WHERE id = ?').get(id);

    if (!theme) {
      return res.status(404).json({ error: 'Theme not found' });
    }

    // Clear the theme from any stocks that use it
    db.prepare('UPDATE stock_prices SET theme = NULL WHERE theme = ?').run(theme.name);

    // Delete the theme
    db.prepare('DELETE FROM stock_themes WHERE id = ?').run(id);

    res.json({ message: 'Theme deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
