
import db from './db.js';
import { calculateCashBalance, calculatePortfolioValue, calculateRealizedGain } from './utils/calculations.js';

function runTest() {
    console.log('--- Starting Verification Test ---');

    // 1. Create Test Account
    const accountResult = db.prepare("INSERT INTO accounts (name, type) VALUES (?, ?)").run('Test Account ' + Date.now(), 'brokerage');
    const accountId = accountResult.lastInsertRowid;
    console.log(`Created account with ID: ${accountId}`);

    try {
        // 2. Deposit Cash
        const depositAmount = 10000;
        db.prepare("INSERT INTO cash_movements (account_id, type, amount, date) VALUES (?, ?, ?, ?)").run(accountId, 'deposit', depositAmount, '2024-01-01');
        console.log(`Deposited ${depositAmount}`);

        // Verify Balance
        let balance = calculateCashBalance(db, accountId);
        console.log(`Balance after deposit: ${balance} (Expected: 10000)`);
        if (balance !== 10000) throw new Error('Balance mismatch after deposit');

        // 3. Buy Stock (creates holding and transaction)
        // Manual simulation of holdings.js logic
        const symbol = 'TESTSTOCK';
        const shares = 10;
        const price = 150;
        const costBasis = shares * price; // 1500

        // Create Holding
        const holdingRes = db.prepare("INSERT INTO holdings (account_id, symbol, shares, cost_basis, purchase_date) VALUES (?, ?, ?, ?, ?)").run(accountId, symbol, shares, costBasis, '2024-01-02');
        const holdingId = holdingRes.lastInsertRowid;

        // Create Transaction
        db.prepare("INSERT INTO transactions (account_id, holding_id, type, symbol, shares, price, total, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(accountId, holdingId, 'buy', symbol, shares, price, costBasis, '2024-01-02');
        console.log(`Bought ${shares} shares of ${symbol} at ${price}`);

        // Define Price for Portfolio Value
        // Ensure stock_prices has entry
        db.prepare("INSERT OR REPLACE INTO stock_prices (symbol, price, updated_at) VALUES (?, ?, datetime('now'))").run(symbol, price); // Price is same as buy

        // Verify Balance
        balance = calculateCashBalance(db, accountId);
        console.log(`Balance after buy: ${balance} (Expected: 8500)`);
        if (balance !== 8500) throw new Error('Balance mismatch after buy');

        // Verify Portfolio Value
        let portfolioValue = calculatePortfolioValue(db, accountId);
        console.log(`Portfolio Value: ${portfolioValue} (Expected: 10000)`);
        if (portfolioValue !== 10000) throw new Error('Portfolio Value mismatch');

        // 4. Update Price and Check Portfolio Value
        const newPrice = 200;
        db.prepare("UPDATE stock_prices SET price = ? WHERE symbol = ?").run(newPrice, symbol);
        console.log(`Updated price to ${newPrice}`);

        portfolioValue = calculatePortfolioValue(db, accountId);
        const expectedValue = 8500 + (10 * 200); // 10500
        console.log(`New Portfolio Value: ${portfolioValue} (Expected: ${expectedValue})`);
        if (portfolioValue !== expectedValue) throw new Error('Portfolio Value mismatch after fluctuation');

        // 5. Sell Stock
        // Sell 5 shares at 200
        const sellShares = 5;
        const sellPrice = 200;
        const sellTotal = sellShares * sellPrice; // 1000
        // Cost basis sold = (1500 / 10) * 5 = 750
        // Realized Gain = 1000 - 750 = 250

        const costBasisSold = (costBasis / shares) * sellShares;
        const realizedGain = sellTotal - costBasisSold;

        // Transaction
        db.prepare("INSERT INTO transactions (account_id, holding_id, type, symbol, shares, price, total, date, realized_gain) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(accountId, holdingId, 'sell', symbol, sellShares, sellPrice, sellTotal, '2024-01-03', realizedGain);

        // Update Holding
        const remainingShares = shares - sellShares;
        const newHoldingCostBasis = costBasis - costBasisSold;
        db.prepare("UPDATE holdings SET shares = ?, cost_basis = ? WHERE id = ?").run(remainingShares, newHoldingCostBasis, holdingId);
        console.log(`Sold ${sellShares} shares at ${sellPrice}`);

        // Verify Realized Gain
        const totalRealizedGain = calculateRealizedGain(db, accountId);
        console.log(`Realized Gain: ${totalRealizedGain} (Expected: 250)`);
        if (totalRealizedGain !== 250) throw new Error('Realized Gain mismatch');

        console.log('--- Verification Passed ---');

    } catch (err) {
        console.error('Test Failed:', err);
    } finally {
        // Cleanup
        db.prepare("DELETE FROM accounts WHERE id = ?").run(accountId);
        // Cascading deletes should handle others if schema is set up right
        console.log('Cleanup complete');
    }
}

runTest();
