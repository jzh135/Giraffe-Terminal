import { Router } from 'express';
import db from '../db.js';

const router = Router();

// Get all roles
router.get('/', (req, res) => {
  try {
    const roles = db.prepare('SELECT * FROM stock_roles ORDER BY sort_order, name').all();
    res.json(roles);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new role
router.post('/', (req, res) => {
  try {
    const { name, color } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Role name is required' });
    }

    // Get the max sort_order
    const maxOrder = db.prepare('SELECT MAX(sort_order) as max FROM stock_roles').get();
    const sortOrder = (maxOrder?.max || 0) + 1;

    const result = db
      .prepare(
        `
            INSERT INTO stock_roles (name, color, sort_order) VALUES (?, ?, ?)
        `
      )
      .run(name.trim(), color || null, sortOrder);

    const newRole = db
      .prepare('SELECT * FROM stock_roles WHERE id = ?')
      .get(result.lastInsertRowid);
    res.status(201).json(newRole);
  } catch (err) {
    if (err.message.includes('UNIQUE constraint')) {
      return res.status(400).json({ error: 'A role with this name already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Update a role
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, color, sort_order } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Role name is required' });
    }

    db.prepare(
      `
            UPDATE stock_roles SET name = ?, color = ?, sort_order = ? WHERE id = ?
        `
    ).run(name.trim(), color || null, sort_order ?? 0, id);

    const updated = db.prepare('SELECT * FROM stock_roles WHERE id = ?').get(id);
    if (!updated) {
      return res.status(404).json({ error: 'Role not found' });
    }
    res.json(updated);
  } catch (err) {
    if (err.message.includes('UNIQUE constraint')) {
      return res.status(400).json({ error: 'A role with this name already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Delete a role
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;

    // Get the role name before deleting (to clear references)
    const role = db.prepare('SELECT name FROM stock_roles WHERE id = ?').get(id);

    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }

    // Clear the role from any stocks that use it
    db.prepare('UPDATE stock_prices SET role = NULL WHERE role = ?').run(role.name);

    // Delete the role
    db.prepare('DELETE FROM stock_roles WHERE id = ?').run(id);

    res.json({ message: 'Role deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
