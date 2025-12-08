import express from 'express';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import db from '../db.js';

const router = express.Router();
const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, '..', '..', 'data', 'giraffe.db');

// Export database
router.get('/export-db', (req, res) => {
    try {
        res.download(dbPath, 'giraffe_backup.db');
    } catch (err) {
        console.error('Export failed:', err);
        res.status(500).json({ error: 'Failed to export database' });
    }
});

// Get database statistics
router.get('/stats', (req, res) => {
    try {
        const stats = {
            accounts: db.prepare('SELECT COUNT(*) as count FROM accounts').get().count,
            holdings: db.prepare('SELECT COUNT(*) as count FROM holdings').get().count,
            transactions: db.prepare('SELECT COUNT(*) as count FROM transactions').get().count,
            prices: db.prepare('SELECT COUNT(*) as count FROM stock_prices').get().count,
            dividends: db.prepare('SELECT COUNT(*) as count FROM dividends').get().count,
            cashMovements: db.prepare('SELECT COUNT(*) as count FROM cash_movements').get().count,
            sizeBytes: fs.statSync(dbPath).size
        };
        res.json(stats);
    } catch (err) {
        console.error('Stats failed:', err);
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

export default router;
