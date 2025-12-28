import express from 'express';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import multer from 'multer';
import db from '../db.js';

const router = express.Router();
const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, '..', '..', 'data', 'giraffe.db');

// Configure multer for database uploads
const upload = multer({
  dest: join(__dirname, '..', '..', 'data', 'uploads'),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  fileFilter: (req, file, cb) => {
    if (file.originalname.endsWith('.db')) {
      cb(null, true);
    } else {
      cb(new Error('Only .db files are allowed'));
    }
  },
});

// Export database
router.get('/export-db', (req, res) => {
  try {
    res.download(dbPath, 'giraffe_backup.db');
  } catch (err) {
    console.error('Export failed:', err);
    res.status(500).json({ error: 'Failed to export database' });
  }
});

// Import database
router.post('/import-db', upload.single('database'), async (req, res) => {
  const uploadedFile = req.file;

  if (!uploadedFile) {
    return res
      .status(400)
      .json({ error: 'No file uploaded', message: 'Please select a database file' });
  }

  try {
    // Validate it's a SQLite database by checking the header
    const header = Buffer.alloc(16);
    const fd = fs.openSync(uploadedFile.path, 'r');
    fs.readSync(fd, header, 0, 16, 0);
    fs.closeSync(fd);

    const sqliteHeader = 'SQLite format 3';
    if (!header.toString('utf8', 0, 15).startsWith(sqliteHeader.substring(0, 15))) {
      fs.unlinkSync(uploadedFile.path); // Clean up
      return res.status(400).json({
        error: 'Invalid file',
        message: 'The uploaded file is not a valid SQLite database',
      });
    }

    // Close the current database connection
    db.close();

    // Create backup of current database
    const backupPath = dbPath + '.backup.' + Date.now();
    if (fs.existsSync(dbPath)) {
      fs.copyFileSync(dbPath, backupPath);
    }

    // Replace with uploaded database
    fs.copyFileSync(uploadedFile.path, dbPath);
    fs.unlinkSync(uploadedFile.path); // Clean up uploaded file

    // Trigger server restart to reinitialize database connection
    res.json({
      success: true,
      message: 'Database imported successfully. Please restart the server or reload the page.',
      backup: backupPath,
    });

    // Trigger restart
    setTimeout(() => {
      const serverPath = join(__dirname, '..', 'index.js');
      const now = new Date();
      fs.utimesSync(serverPath, now, now);
      console.log('Server restart triggered after database import.');
    }, 500);
  } catch (err) {
    console.error('Import failed:', err);
    // Clean up uploaded file if it exists
    if (uploadedFile && fs.existsSync(uploadedFile.path)) {
      fs.unlinkSync(uploadedFile.path);
    }
    res.status(500).json({ error: 'Import failed', message: err.message });
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
      sizeBytes: fs.statSync(dbPath).size,
    };
    res.json(stats);
  } catch (err) {
    console.error('Stats failed:', err);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// Reset database (Danger Zone)
router.post('/reset', (req, res) => {
  try {
    const resetTx = db.transaction(() => {
      db.prepare('DELETE FROM transactions').run();
      db.prepare('DELETE FROM holdings').run();
      db.prepare('DELETE FROM dividends').run();
      db.prepare('DELETE FROM cash_movements').run();
      db.prepare('DELETE FROM stock_splits').run();
      db.prepare('DELETE FROM accounts').run();
      db.prepare('DELETE FROM stock_prices').run();
      // Reset sequences (optional but good for clean slate)
      db.prepare('DELETE FROM sqlite_sequence').run();
    });

    resetTx();
    res.json({ message: 'Database reset successful' });
  } catch (err) {
    console.error('Reset failed:', err);
    res.status(500).json({ error: 'Failed to reset database' });
  }
});

// Restart server (triggers file watch by touching a file)
router.post('/restart', (req, res) => {
  try {
    res.json({ message: 'Server restarting...' });
    // Touch the server file to trigger node --watch restart
    setTimeout(() => {
      const serverPath = join(__dirname, '..', 'index.js');
      const now = new Date();
      fs.utimesSync(serverPath, now, now);
      console.log('Server restart triggered via file touch.');
    }, 500);
  } catch (err) {
    console.error('Restart failed:', err);
    res.status(500).json({ error: 'Failed to restart server' });
  }
});

// Clear price cache
router.post('/clear-cache', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM stock_prices').run();
    res.json({
      message: 'Price cache cleared successfully',
      deletedCount: result.changes,
    });
  } catch (err) {
    console.error('Clear cache failed:', err);
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

// Get app settings
router.get('/settings', (req, res) => {
  try {
    const settings = db.prepare('SELECT * FROM app_settings').all();
    const settingsObj = {};
    settings.forEach((s) => {
      settingsObj[s.key] = s.value;
    });
    res.json(settingsObj);
  } catch (err) {
    console.error('Get settings failed:', err);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

// Update app settings
router.post('/settings', (req, res) => {
  try {
    const { app_name, logo_type, logo_value } = req.body;

    const updateTx = db.transaction(() => {
      if (app_name !== undefined) {
        db.prepare(
          "INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))"
        ).run('app_name', app_name);
      }
      if (logo_type !== undefined) {
        db.prepare(
          "INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))"
        ).run('logo_type', logo_type);
      }
      if (logo_value !== undefined) {
        db.prepare(
          "INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))"
        ).run('logo_value', logo_value);
      }
    });

    updateTx();

    const settings = db.prepare('SELECT * FROM app_settings').all();
    const settingsObj = {};
    settings.forEach((s) => {
      settingsObj[s.key] = s.value;
    });

    res.json(settingsObj);
  } catch (err) {
    console.error('Update settings failed:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

export default router;
