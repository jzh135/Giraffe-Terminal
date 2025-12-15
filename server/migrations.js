
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Run database migrations.
 * 
 * @param {import('better-sqlite3').Database} db 
 * @param {string} __dirname 
 */
export function runMigrations(db, __dirname) {
    console.log('Running migrations...');

    // Initialize Schema
    try {
        const schemaPath = join(__dirname, 'schema.sql');
        const schema = readFileSync(schemaPath, 'utf-8');
        db.exec(schema);
    } catch (err) {
        console.error('Schema initialization failed:', err);
    }

    // Migration 1: Add realized_gain to transactions
    try {
        const tableInfo = db.prepare('PRAGMA table_info(transactions)').all();
        const hasRealizedGain = tableInfo.some(col => col.name === 'realized_gain');
        if (!hasRealizedGain) {
            console.log('Migrating: Adding realized_gain to transactions table...');
            db.prepare('ALTER TABLE transactions ADD COLUMN realized_gain REAL').run();
        }
    } catch (err) {
        console.error('Migration 1 failed:', err);
    }

    // Migration 2: Create app_settings table
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
        }
    } catch (err) {
        console.error('Migration 2 failed:', err);
    }

    // Migration 3: Add research fields to stock_prices
    try {
        const tableInfo = db.prepare('PRAGMA table_info(stock_prices)').all();
        const hasRole = tableInfo.some(col => col.name === 'role');
        const hasMarketCap = tableInfo.some(col => col.name === 'market_cap');

        // Check for new fields
        const hasValuationRating = tableInfo.some(col => col.name === 'valuation_rating');

        if (!hasRole && !hasMarketCap) {
            // Basic check - exact logic might depend on state
            // If we really want to be robust, we check each column individually.
        }

        // We will assume if 'valuation_rating' is missing, we need to add the block.
        // But the original code had a complex conditional. Let's simplify and make it robust (idempotent).

        const columnsToAdd = [
            'role TEXT', 'theme TEXT', 'strategy TEXT',
            'valuation_rating REAL', 'growth_quality_rating REAL',
            'econ_moat_rating REAL', 'leadership_rating REAL',
            'financial_health_rating REAL', 'research_updated_at TEXT',
            'overall_rating REAL', 'role_id INTEGER', 'theme_id INTEGER'
        ];

        for (const colDef of columnsToAdd) {
            const colName = colDef.split(' ')[0];
            const hasCol = tableInfo.some(col => col.name === colName);
            if (!hasCol) {
                // Check if we need to rename market_cap to role first
                if (colName === 'role' && hasMarketCap) {
                    try {
                        console.log('Migrating: Renaming market_cap to role...');
                        db.exec(`ALTER TABLE stock_prices RENAME COLUMN market_cap TO role`);
                    } catch (e) {
                        // ignore if failed, maybe already renamed
                    }
                } else {
                    try {
                        db.prepare(`ALTER TABLE stock_prices ADD COLUMN ${colDef}`).run();
                        console.log(`Migrating: Added ${colName} to stock_prices`);
                    } catch (e) {
                        // ignore errors if column exists
                    }
                }
            }
        }

    } catch (err) {
        console.error('Migration 3 failed:', err);
    }

    // Migration 4 & 5: Create stock_roles and stock_themes
    const createTable = (tableName, sql) => {
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(tableName);
        if (!tables) {
            console.log(`Migrating: Creating ${tableName} table...`);
            db.exec(sql);
        }
    };

    try {
        createTable('stock_roles', `
            CREATE TABLE stock_roles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                color TEXT,
                sort_order INTEGER DEFAULT 0,
                created_at TEXT DEFAULT (datetime('now'))
            );
            INSERT INTO stock_roles (name, color, sort_order) VALUES ('MEGA', '#4f46e5', 1);
            INSERT INTO stock_roles (name, color, sort_order) VALUES ('LARGE', '#3b82f6', 2);
            INSERT INTO stock_roles (name, color, sort_order) VALUES ('MID/SMALL', '#10b981', 3);
            INSERT INTO stock_roles (name, color, sort_order) VALUES ('ETF', '#f59e0b', 4);
        `);

        createTable('stock_themes', `
            CREATE TABLE stock_themes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                color TEXT,
                sort_order INTEGER DEFAULT 0,
                created_at TEXT DEFAULT (datetime('now'))
            );
            INSERT INTO stock_themes (name, color, sort_order) VALUES ('Technology', '#3b82f6', 1);
            INSERT INTO stock_themes (name, color, sort_order) VALUES ('Healthcare', '#10b981', 2);
            INSERT INTO stock_themes (name, color, sort_order) VALUES ('Financial', '#8b5cf6', 3);
            INSERT INTO stock_themes (name, color, sort_order) VALUES ('Consumer', '#f59e0b', 4);
            INSERT INTO stock_themes (name, color, sort_order) VALUES ('Industrial', '#6b7280', 5);
            INSERT INTO stock_themes (name, color, sort_order) VALUES ('Energy', '#ef4444', 6);
        `);
    } catch (err) {
        console.error('Roles/Themes migration failed:', err);
    }

    // Migration: Convert role/theme TEXT to role_id/theme_id (Data Migration)
    try {
        const tableInfo = db.prepare('PRAGMA table_info(stock_prices)').all();
        const hasRoleText = tableInfo.some(col => col.name === 'role');
        const hasRoleId = tableInfo.some(col => col.name === 'role_id');
        const hasThemeText = tableInfo.some(col => col.name === 'theme');

        if (hasRoleText && hasRoleId) {
            const stocks = db.prepare('SELECT symbol, role FROM stock_prices WHERE role IS NOT NULL AND role_id IS NULL').all();
            if (stocks.length > 0) console.log('Migrating data: Converting role text to IDs...');
            for (const stock of stocks) {
                const roleRecord = db.prepare('SELECT id FROM stock_roles WHERE name = ?').get(stock.role);
                if (roleRecord) {
                    db.prepare('UPDATE stock_prices SET role_id = ? WHERE symbol = ?').run(roleRecord.id, stock.symbol);
                }
            }
        }

        if (hasThemeText) {
            const stocks = db.prepare('SELECT symbol, theme FROM stock_prices WHERE theme IS NOT NULL AND theme_id IS NULL').all();
            if (stocks.length > 0) console.log('Migrating data: Converting theme text to IDs...');
            for (const stock of stocks) {
                const themeRecord = db.prepare('SELECT id FROM stock_themes WHERE name = ?').get(stock.theme);
                if (themeRecord) {
                    db.prepare('UPDATE stock_prices SET theme_id = ? WHERE symbol = ?').run(themeRecord.id, stock.symbol);
                }
            }
        }
    } catch (err) {
        console.error('Data migration failed:', err);
    }

    // Migration: Add rating notes columns to stock_prices
    try {
        const tableInfo = db.prepare('PRAGMA table_info(stock_prices)').all();
        const noteColumns = [
            'valuation_notes TEXT',
            'growth_quality_notes TEXT',
            'econ_moat_notes TEXT',
            'leadership_notes TEXT',
            'financial_health_notes TEXT',
            'overall_notes TEXT'
        ];

        for (const colDef of noteColumns) {
            const colName = colDef.split(' ')[0];
            const hasCol = tableInfo.some(col => col.name === colName);
            if (!hasCol) {
                try {
                    db.prepare(`ALTER TABLE stock_prices ADD COLUMN ${colDef}`).run();
                    console.log(`Migrating: Added ${colName} to stock_prices`);
                } catch (e) {
                    // ignore if column exists
                }
            }
        }
    } catch (err) {
        console.error('Rating notes migration failed:', err);
    }

    console.log('Migrations complete.');
}
