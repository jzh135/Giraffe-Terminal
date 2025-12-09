import { useState, useEffect } from 'react';
import NoteModal from './NoteModal';

function TradeModal({
    initialTab = 'buy',
    initialHolding = null,
    initialSymbol = null,
    initialAccountId = null, // Account context (from AccountDetail)
    editingTransaction = null, // Pass transaction to edit
    holdings = [],
    accounts = [], // List of accounts for selection
    prices = {},
    onBuy,
    onSell,
    onDividend,
    onUpdate, // Callback for update
    onClose
}) {
    const today = new Date().toISOString().split('T')[0];
    const [activeTab, setActiveTab] = useState(initialTab);
    const isEditing = !!editingTransaction;

    // State to hold the list of transactions (rows)
    const [rows, setRows] = useState([]);
    const [editingNoteRowId, setEditingNoteRowId] = useState(null);
    const [selectedAccountId, setSelectedAccountId] = useState(initialAccountId || '');

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
        if (editingTransaction) {
            // Editing Mode
            const type = editingTransaction.type === 'transaction' ? editingTransaction.tx_type : editingTransaction.type; // Normalized type
            // Determine tab based on type
            let tab = 'buy';
            if (type === 'sell') tab = 'sell';
            else if (type === 'dividend') tab = 'dividend';

            setActiveTab(tab);
            setRows([{
                id: editingTransaction.id,
                symbol: editingTransaction.symbol,
                lotId: editingTransaction.holding_id || '',
                shares: editingTransaction.shares || '',
                price: editingTransaction.price || '',
                amount: editingTransaction.amount || '', // For dividends
                date: new Date(editingTransaction.date || today).toISOString().split('T')[0],
                notes: editingTransaction.notes || ''
            }]);
        } else if (initialHolding && initialTab === 'sell') {
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
    }, [initialHolding, initialTab, initialSymbol, editingTransaction]);

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

                const payload = { ...commonData };
                if (activeTab === 'dividend') {
                    payload.symbol = row.symbol.toUpperCase();
                    payload.amount = parseFloat(row.amount);
                } else {
                    payload.symbol = row.symbol.toUpperCase();
                    payload.shares = parseFloat(row.shares);
                    payload.price = parseFloat(row.price);
                    if (activeTab === 'sell') {
                        payload.holding_id = row.lotId;
                    }
                }

                if (isEditing) {
                    // Update existing
                    await onUpdate(editingTransaction.id, {
                        ...payload,
                        type: activeTab // preserve or update type
                    });
                } else {
                    // Create new
                    // Get account_id from initial context or selected dropdown
                    const accountId = initialAccountId || selectedAccountId;

                    if (activeTab === 'buy') {
                        await onBuy({
                            ...payload,
                            account_id: accountId,
                            cost_basis: payload.shares * payload.price,
                            purchase_date: payload.date
                        });
                    } else if (activeTab === 'sell') {
                        // Verify lot validity
                        const lot = holdings.find(h => h.id == row.lotId);
                        if (!lot) continue;

                        await onSell({
                            ...payload,
                            holding_id: lot.id,
                            account_id: lot.account_id
                        });
                    } else if (activeTab === 'dividend') {
                        await onDividend({
                            ...payload,
                            account_id: accountId
                        });
                    }
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
        <>
            <div className="modal-overlay" onClick={onClose}>
                <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: activeTab === 'sell' ? '1100px' : '1000px', width: '95%' }}>
                    <div className="modal-header">
                        <h2 className="modal-title">{isEditing ? 'Edit Transaction' : 'Trade / Action'}</h2>
                        <button className="modal-close" onClick={onClose}>&times;</button>
                    </div>

                    {!isEditing && (
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
                    )}

                    <form onSubmit={handleSubmit}>
                        {/* Account selector for buy/dividend when no initial account */}
                        {!isEditing && !initialAccountId && (activeTab === 'buy' || activeTab === 'dividend') && accounts.length > 0 && (
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Account</label>
                                <select
                                    className="form-input"
                                    value={selectedAccountId}
                                    onChange={e => setSelectedAccountId(e.target.value)}
                                    required
                                    style={{ maxWidth: '300px' }}
                                >
                                    <option value="">Select Account...</option>
                                    {accounts.map(acc => (
                                        <option key={acc.id} value={acc.id}>{acc.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <div style={{ overflowX: 'auto' }}>
                            <table className="data-table" style={{ minWidth: activeTab === 'sell' ? '900px' : '800px' }}>
                                <thead>
                                    <tr>
                                        {activeTab === 'buy' && (
                                            <>
                                                <th>Symbol</th>
                                                <th style={{ width: '120px' }}>Shares</th>
                                                <th style={{ width: '140px' }}>Price</th>
                                                <th style={{ width: '140px' }}>Total</th>
                                                <th style={{ width: '150px' }}>Date</th>
                                                <th>Notes</th>
                                            </>
                                        )}
                                        {activeTab === 'sell' && (
                                            <>
                                                <th colSpan="4">Sell Details</th>
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
                                                            className="form-input"
                                                            value={row.shares && row.price ? (parseFloat(row.shares) * parseFloat(row.price)).toFixed(2) : '-'}
                                                            readOnly
                                                            tabIndex="-1"
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
                                                        <button
                                                            type="button"
                                                            className={`btn btn-sm ${row.notes ? 'btn-primary' : 'btn-secondary'}`}
                                                            onClick={() => setEditingNoteRowId(row.id)}
                                                            title={row.notes || "Add Note"}
                                                            style={{ width: '100%' }}
                                                        >
                                                            {row.notes ? '📝 Edit Note' : '➕ Add Note'}
                                                        </button>
                                                    </td>
                                                </>
                                            )}

                                            {/* SELL ROW - Using card-style with two rows */}
                                            {activeTab === 'sell' && (
                                                <>
                                                    <td colSpan="5" style={{ padding: '12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px' }}>
                                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px', marginBottom: '12px' }}>
                                                            {/* Row 1: Symbol & Tax Lot */}
                                                            <div>
                                                                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Symbol</label>
                                                                <select
                                                                    className="form-input"
                                                                    value={row.symbol}
                                                                    onChange={e => updateRow(row.id, 'symbol', e.target.value)}
                                                                    required
                                                                    style={{ width: '100%' }}
                                                                >
                                                                    <option value="">Select Symbol...</option>
                                                                    {uniqueSymbols.map(s => <option key={s} value={s}>{s}</option>)}
                                                                </select>
                                                            </div>
                                                            <div>
                                                                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Tax Lot</label>
                                                                <select
                                                                    className="form-input"
                                                                    value={row.lotId}
                                                                    onChange={e => updateRow(row.id, 'lotId', e.target.value)}
                                                                    required
                                                                    disabled={!row.symbol}
                                                                    style={{ width: '100%' }}
                                                                >
                                                                    <option value="">Select Lot...</option>
                                                                    {getAvailableLots(row.symbol).map(lot => (
                                                                        <option key={lot.id} value={lot.id}>
                                                                            {lot.account_name} • {new Date(lot.purchase_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })} • {lot.shares} shares @ ${(lot.cost_basis / lot.shares).toFixed(2)}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        </div>
                                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
                                                            {/* Row 2: Shares, Price, Total, Date, Notes */}
                                                            <div>
                                                                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Shares</label>
                                                                <input
                                                                    type="number"
                                                                    className="form-input"
                                                                    value={row.shares}
                                                                    onChange={e => updateRow(row.id, 'shares', e.target.value)}
                                                                    step="any"
                                                                    min="0"
                                                                    required
                                                                    placeholder="0"
                                                                    style={{ width: '100%' }}
                                                                />
                                                            </div>
                                                            <div>
                                                                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Price</label>
                                                                <input
                                                                    type="number"
                                                                    className="form-input"
                                                                    value={row.price}
                                                                    onChange={e => updateRow(row.id, 'price', e.target.value)}
                                                                    step="0.01"
                                                                    min="0"
                                                                    required
                                                                    placeholder="0.00"
                                                                    style={{ width: '100%' }}
                                                                />
                                                            </div>
                                                            <div>
                                                                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Total</label>
                                                                <input
                                                                    className="form-input"
                                                                    value={row.shares && row.price ? `$${(parseFloat(row.shares) * parseFloat(row.price)).toFixed(2)}` : '-'}
                                                                    readOnly
                                                                    tabIndex="-1"
                                                                    style={{ width: '100%', backgroundColor: 'var(--bg-tertiary)', fontWeight: '600' }}
                                                                />
                                                            </div>
                                                            <div>
                                                                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Date</label>
                                                                <input
                                                                    type="date"
                                                                    className="form-input"
                                                                    value={row.date}
                                                                    onChange={e => updateRow(row.id, 'date', e.target.value)}
                                                                    required
                                                                    style={{ width: '100%' }}
                                                                />
                                                            </div>
                                                            <div>
                                                                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Notes</label>
                                                                <button
                                                                    type="button"
                                                                    className={`btn btn-sm ${row.notes ? 'btn-primary' : 'btn-secondary'}`}
                                                                    onClick={() => setEditingNoteRowId(row.id)}
                                                                    title={row.notes || "Add Note"}
                                                                    style={{ width: '100%', height: '38px' }}
                                                                >
                                                                    {row.notes ? '📝 Edit' : '➕ Add'}
                                                                </button>
                                                            </div>
                                                        </div>
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
                                                        <button
                                                            type="button"
                                                            className={`btn btn-sm ${row.notes ? 'btn-primary' : 'btn-secondary'}`}
                                                            onClick={() => setEditingNoteRowId(row.id)}
                                                            title={row.notes || "Add Note"}
                                                            style={{ width: '100%' }}
                                                        >
                                                            {row.notes ? '📝 Edit Note' : '➕ Add Note'}
                                                        </button>
                                                    </td>
                                                </>
                                            )}



                                            <td>
                                                {!isEditing && rows.length > 1 && (
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

                        {!isEditing && (
                            <div style={{ marginTop: '10px' }}>
                                <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={addRow}
                                >
                                    + Add Row
                                </button>
                            </div>
                        )}

                        <div className="modal-actions" style={{ marginTop: '20px' }}>
                            <button type="button" className="btn btn-secondary" onClick={onClose}>
                                Cancel
                            </button>
                            <button type="submit" className="btn btn-primary">
                                {isEditing ? 'Save Changes' : `Submit ${rows.length} ${rows.length === 1 ? 'Entry' : 'Entries'}`}
                            </button>
                        </div>

                    </form>
                </div>
            </div>

            {editingNoteRowId && (
                <NoteModal
                    initialNote={rows.find(r => r.id === editingNoteRowId)?.notes || ''}
                    onSave={(note) => {
                        updateRow(editingNoteRowId, 'notes', note);
                        setEditingNoteRowId(null);
                    }}
                    onClose={() => setEditingNoteRowId(null)}
                />
            )}
        </>
    );
}

export default TradeModal;
