import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');

// Ensure data directory exists
if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
}

const dbPath = join(dataDir, 'giraffe.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize schema
const schemaPath = join(__dirname, 'schema.sql');
const schema = readFileSync(schemaPath, 'utf-8');
db.exec(schema);

// Migration: Add realized_gain to transactions if missing
try {
    const tableInfo = db.prepare('PRAGMA table_info(transactions)').all();
    const hasRealizedGain = tableInfo.some(col => col.name === 'realized_gain');
    if (!hasRealizedGain) {
        console.log('Migrating: Adding realized_gain to transactions table...');
        db.prepare('ALTER TABLE transactions ADD COLUMN realized_gain REAL').run();
    }
} catch (err) {
    console.error('Migration failed:', err);
}

// Migration: Create app_settings table if missing
try {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='app_settings'").all();
    if (tables.length === 0) {
        console.log('Migrating: Creating app_settings table...');
        db.exec(`
            CREATE TABLE app_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TEXT DEFAULT (datetime('now'))
            );
            INSERT INTO app_settings (key, value) VALUES ('app_name', 'Giraffe Terminal');
            INSERT INTO app_settings (key, value) VALUES ('logo_type', 'default');
            INSERT INTO app_settings (key, value) VALUES ('logo_value', '🦒');
        `);
        console.log('app_settings table created successfully');
    }
} catch (err) {
    console.error('app_settings migration failed:', err);
}

// Migration: Add research fields to stock_prices if missing
try {
    const tableInfo = db.prepare('PRAGMA table_info(stock_prices)').all();
    const hasMarketCap = tableInfo.some(col => col.name === 'market_cap');
    if (!hasMarketCap) {
        console.log('Migrating: Adding research fields to stock_prices table...');
        db.exec(`
            ALTER TABLE stock_prices ADD COLUMN market_cap REAL;
            ALTER TABLE stock_prices ADD COLUMN theme TEXT;
            ALTER TABLE stock_prices ADD COLUMN strategy TEXT;
            ALTER TABLE stock_prices ADD COLUMN valuation_rating REAL;
            ALTER TABLE stock_prices ADD COLUMN growth_quality_rating REAL;
            ALTER TABLE stock_prices ADD COLUMN econ_moat_rating REAL;
            ALTER TABLE stock_prices ADD COLUMN leadership_rating REAL;
            ALTER TABLE stock_prices ADD COLUMN financial_health_rating REAL;
            ALTER TABLE stock_prices ADD COLUMN research_updated_at TEXT;
        `);
        console.log('Research fields added to stock_prices successfully');
    }
} catch (err) {
    console.error('stock_prices research migration failed:', err);
}

export default db;
