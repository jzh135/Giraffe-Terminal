import { useState, useEffect } from 'react';

function TradeModal({
    initialTab = 'buy',
    initialHolding = null,
    initialSymbol = null, // New prop
    holdings = [],
    prices = {},
    onBuy,
    onSell,
    onDividend,
    onClose
}) {
    const today = new Date().toISOString().split('T')[0];
    const [activeTab, setActiveTab] = useState(initialTab);

    // State to hold the list of transactions (rows)
    const [rows, setRows] = useState([]);

    // Unique symbols for dropdowns
    const uniqueSymbols = [...new Set(holdings.map(h => h.symbol))].sort();

    // Helper to create a new empty row based on the current tab
    const createRow = (tab) => {
        const base = { id: Date.now() + Math.random(), date: today, notes: '' };

        // Use initialSymbol if available and we are creating the FIRST row or relevant logic
        // But createRow is generic. We can set defaults when initializing state.
        const defaultSymbol = initialSymbol || '';

        switch (tab) {
            case 'buy':
                return { ...base, symbol: defaultSymbol, shares: '', price: '' };
            case 'sell':
                return { ...base, symbol: defaultSymbol, lotId: '', shares: '', price: '' };
            case 'dividend':
                return { ...base, symbol: defaultSymbol, amount: '' };

            default:
                return base;
        }
    };

    // Initialize rows on mount or when critical props change
    useEffect(() => {
        // If opening with a specific holding (likely for Sell from Holdings page)
        if (initialHolding && initialTab === 'sell') {
            const currentPrice = prices[initialHolding.symbol]?.price || '';
            setRows([{
                id: Date.now(),
                symbol: initialHolding.symbol,
                lotId: initialHolding.id,
                shares: '',
                price: currentPrice,
                date: today,
                notes: ''
            }]);
            setActiveTab('sell');
        } else {
            // Default initialization
            if (rows.length === 0) {
                // Determine symbol to use for the first row
                const startSymbol = initialHolding ? initialHolding.symbol : (initialSymbol || '');
                const firstRow = createRow(initialTab);
                if (startSymbol) firstRow.symbol = startSymbol;

                // Pre-fill price if symbol is available
                if (startSymbol && (initialTab === 'buy' || initialTab === 'sell')) {
                    const p = prices[startSymbol]?.price;
                    if (p) firstRow.price = p;
                }

                setRows([firstRow]);
                setActiveTab(initialTab);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialHolding, initialTab, initialSymbol]);

    // ... rest of component ... make sure to update createRow usage if needed or leaving it as is.
    // Actually createRow inside the component is fine, I updated it to blindly use defaultSymbol but `rows.length === 0` block handles the specific setup better.
    // I need to ensure `createRow` (used by addRow) also respects `initialSymbol` OR relies on the "copy previous row" logic I added in previous turn.
    // The previous turn added "copy previous row" logic to `addRow`. So subsequent rows will copy the first row's symbol.
    // Perfect.

    // ... (rest of the file is large, I should only replace the top part or allow multiple replacements)
    // I'll stick to replacing the whole file or huge chunk to be safe given the prop change.
    // Wait, I can just replace the top part if I'm careful.

    /* Using multi_replace to be precise */

    // Handle Tab Switching
    const handleTabChange = (tab) => {
        setActiveTab(tab);
        setRows([createRow(tab)]);
    };

    // Row Update Handler
    const updateRow = (id, field, value) => {
        setRows(prev => prev.map(row => {
            if (row.id !== id) return row;

            const updated = { ...row, [field]: value };

            // Special logic for Sell tab: If symbol changes, clear lotId
            if (activeTab === 'sell' && field === 'symbol') {
                updated.lotId = '';
                // Try to pre-fill price
                const price = prices[value]?.price;
                if (price) updated.price = price;
            }

            // Special logic for Buy tab: If symbol changes, pre-fill price
            if (activeTab === 'buy' && field === 'symbol') {
                const price = prices[value]?.price;
                if (price) updated.price = price;
            }

            return updated;
        }));
    };

    const removeRow = (id) => {
        if (rows.length > 1) {
            setRows(prev => prev.filter(r => r.id !== id));
        }
    };

    const addRow = () => {
        setRows(prev => {
            const lastRow = prev[prev.length - 1];
            const newRow = createRow(activeTab);

            // Auto-fill symbol/price from previous row if available
            if (lastRow && (activeTab === 'buy' || activeTab === 'sell' || activeTab === 'dividend')) {
                if (lastRow.symbol) {
                    newRow.symbol = lastRow.symbol;

                    // For Buy tab, also copy the price if it was set
                    if (activeTab === 'buy' && lastRow.price) {
                        newRow.price = lastRow.price;
                    }
                    // For Sell tab, we don't copy lotId because it must be unique/specific to the lot
                    // But we can trigger price lookup if needed (though existing logic might handle it on change)
                    // Actually, we should probably look up the price again just in case, but here we just copy symbol. 
                    // The user still needs to select a lot.

                    // If we are in Sell tab, we might want to pre-fill the price too if it's the same symbol
                    if (activeTab === 'sell') {
                        const currentPrice = prices[lastRow.symbol]?.price;
                        if (currentPrice) newRow.price = currentPrice;
                    }
                }
            }

            return [...prev, newRow];
        });
    };

    // Helpers for Render
    const getAvailableLots = (symbol) => {
        if (!symbol) return [];
        return holdings.filter(h => h.symbol === symbol).sort((a, b) => new Date(a.purchase_date) - new Date(b.purchase_date));
    };

    // Submit Handler
    async function handleSubmit(e) {
        e.preventDefault();

        // Process all rows
        // We'll execute them sequentially to avoid race conditions in the backend/loading states if any
        // Ideally we'd have a batch API, but for now we loop.

        const validRows = rows.filter(r => {
            if (activeTab === 'buy') return r.symbol && r.shares && r.price;
            if (activeTab === 'sell') return r.lotId && r.shares && r.price;
            if (activeTab === 'dividend') return r.symbol && r.amount;

            return false;
        });

        if (validRows.length === 0) return;

        try {
            for (const row of validRows) {
                const commonData = {
                    date: row.date,
                    notes: row.notes
                };

                if (activeTab === 'buy') {
                    await onBuy({
                        symbol: row.symbol.toUpperCase(),
                        shares: parseFloat(row.shares),
                        price: parseFloat(row.price),
                        cost_basis: parseFloat(row.shares) * parseFloat(row.price),
                        purchase_date: row.date,
                        notes: row.notes
                    });
                } else if (activeTab === 'sell') {
                    // Verify lot validity
                    const lot = holdings.find(h => h.id == row.lotId); // loose match for string/int
                    if (!lot) continue;

                    await onSell({
                        holding_id: lot.id,
                        shares: parseFloat(row.shares),
                        price: parseFloat(row.price),
                        ...commonData
                    });
                } else if (activeTab === 'dividend') {
                    await onDividend({
                        symbol: row.symbol.toUpperCase(),
                        amount: parseFloat(row.amount),
                        ...commonData
                    });

                }
            }
            onClose();
        } catch (err) {
            console.error(err);
            alert("Error processing trades: " + err.message);
        }
    }

    // --- Render Helpers ---

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '1000px', width: '90%' }}>
                <div className="modal-header">
                    <h2 className="modal-title">Trade / Action</h2>
                    <button className="modal-close" onClick={onClose}>&times;</button>
                </div>

                <div className="tabs" style={{ marginBottom: '20px', borderBottom: '1px solid #ccc' }}>
                    {['buy', 'sell', 'dividend'].map(tab => (
                        <button
                            key={tab}
                            className={`tab ${activeTab === tab ? 'active' : ''}`}
                            onClick={() => handleTabChange(tab)}
                            style={{ flex: 1, textAlign: 'center' }}
                        >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </div>

                <form onSubmit={handleSubmit}>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="data-table" style={{ minWidth: activeTab === 'sell' ? '900px' : '800px' }}>
                            <thead>
                                <tr>
                                    {activeTab === 'buy' && (
                                        <>
                                            <th>Symbol</th>
                                            <th style={{ width: '120px' }}>Shares</th>
                                            <th style={{ width: '140px' }}>Price</th>
                                            <th style={{ width: '150px' }}>Date</th>
                                            <th>Notes</th>
                                        </>
                                    )}
                                    {activeTab === 'sell' && (
                                        <>
                                            <th style={{ width: '120px' }}>Symbol</th>
                                            <th style={{ width: '300px' }}>Tax Lot</th>
                                            <th style={{ width: '150px' }}>Shares</th>
                                            <th style={{ width: '140px' }}>Price</th>
                                            <th style={{ width: '150px' }}>Date</th>
                                        </>
                                    )}
                                    {activeTab === 'dividend' && (
                                        <>
                                            <th>Symbol</th>
                                            <th style={{ width: '140px' }}>Amount</th>
                                            <th style={{ width: '150px' }}>Date</th>
                                            <th>Notes</th>
                                        </>
                                    )}

                                    <th style={{ width: '50px' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row) => (
                                    <tr key={row.id}>
                                        {/* BUY ROW */}
                                        {activeTab === 'buy' && (
                                            <>
                                                <td>
                                                    <input
                                                        className="form-input"
                                                        value={row.symbol}
                                                        onChange={e => updateRow(row.id, 'symbol', e.target.value.toUpperCase())}
                                                        placeholder="AAPL"
                                                        required
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        type="number" className="form-input"
                                                        value={row.shares}
                                                        onChange={e => updateRow(row.id, 'shares', e.target.value)}
                                                        step="any" min="0" required
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        type="number" className="form-input"
                                                        value={row.price}
                                                        onChange={e => updateRow(row.id, 'price', e.target.value)}
                                                        step="0.01" min="0" required
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        type="date" className="form-input"
                                                        value={row.date}
                                                        onChange={e => updateRow(row.id, 'date', e.target.value)}
                                                        required
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        className="form-input"
                                                        value={row.notes}
                                                        onChange={e => updateRow(row.id, 'notes', e.target.value)}
                                                        placeholder="Optional"
                                                    />
                                                </td>
                                            </>
                                        )}

                                        {/* SELL ROW */}
                                        {activeTab === 'sell' && (
                                            <>
                                                <td>
                                                    <select
                                                        className="form-input"
                                                        value={row.symbol}
                                                        onChange={e => updateRow(row.id, 'symbol', e.target.value)}
                                                        required
                                                    >
                                                        <option value="">Select...</option>
                                                        {uniqueSymbols.map(s => <option key={s} value={s}>{s}</option>)}
                                                    </select>
                                                </td>
                                                <td>
                                                    <select
                                                        className="form-input"
                                                        value={row.lotId}
                                                        onChange={e => updateRow(row.id, 'lotId', e.target.value)}
                                                        required
                                                        disabled={!row.symbol}
                                                    >
                                                        <option value="">Select Lot...</option>
                                                        {getAvailableLots(row.symbol).map(lot => (
                                                            <option key={lot.id} value={lot.id}>
                                                                {new Date(lot.purchase_date).toLocaleDateString()} - {lot.shares}sh (${(lot.cost_basis / lot.shares).toFixed(2)})
                                                            </option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: '4px' }}>
                                                        <input
                                                            type="number" className="form-input"
                                                            value={row.shares}
                                                            onChange={e => updateRow(row.id, 'shares', e.target.value)}
                                                            step="any" min="0" required
                                                            style={{ flex: 1 }}
                                                        />
                                                        {row.lotId && (
                                                            <button type="button" className="btn btn-xs btn-secondary" onClick={() => {
                                                                const lot = holdings.find(h => h.id == row.lotId);
                                                                if (lot) updateRow(row.id, 'shares', lot.shares);
                                                            }}>Max</button>
                                                        )}
                                                    </div>
                                                </td>
                                                <td>
                                                    <input
                                                        type="number" className="form-input"
                                                        value={row.price}
                                                        onChange={e => updateRow(row.id, 'price', e.target.value)}
                                                        step="0.01" min="0" required
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        type="date" className="form-input"
                                                        value={row.date}
                                                        onChange={e => updateRow(row.id, 'date', e.target.value)}
                                                        required
                                                    />
                                                </td>
                                            </>
                                        )}

                                        {/* DIVIDEND ROW */}
                                        {activeTab === 'dividend' && (
                                            <>
                                                <td>
                                                    <select
                                                        className="form-input"
                                                        value={row.symbol}
                                                        onChange={e => updateRow(row.id, 'symbol', e.target.value)}
                                                        required
                                                    >
                                                        <option value="">Select...</option>
                                                        {uniqueSymbols.map(s => <option key={s} value={s}>{s}</option>)}
                                                    </select>
                                                </td>
                                                <td>
                                                    <input
                                                        type="number" className="form-input"
                                                        value={row.amount}
                                                        onChange={e => updateRow(row.id, 'amount', e.target.value)}
                                                        step="0.01" min="0" required
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        type="date" className="form-input"
                                                        value={row.date}
                                                        onChange={e => updateRow(row.id, 'date', e.target.value)}
                                                        required
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        className="form-input"
                                                        value={row.notes}
                                                        onChange={e => updateRow(row.id, 'notes', e.target.value)}
                                                        placeholder="Optional"
                                                    />
                                                </td>
                                            </>
                                        )}



                                        <td>
                                            {rows.length > 1 && (
                                                <button
                                                    type="button"
                                                    className="btn btn-icon text-negative"
                                                    onClick={() => removeRow(row.id)}
                                                    title="Remove Row"
                                                >
                                                    &times;
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div style={{ marginTop: '10px' }}>
                        <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={addRow}
                        >
                            + Add Row
                        </button>
                    </div>

                    <div className="modal-actions" style={{ marginTop: '20px' }}>
                        <button type="button" className="btn btn-secondary" onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary">
                            Submit {rows.length} {rows.length === 1 ? 'Entry' : 'Entries'}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}

export default TradeModal;
