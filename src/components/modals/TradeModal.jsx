import { useState, useEffect } from 'react';

function TradeModal({
    initialTab = 'buy',
    initialHolding = null,
    holdings = [],
    prices = {},
    onBuy,
    onSell,
    onClose
}) {
    const today = new Date().toISOString().split('T')[0];
    const [activeTab, setActiveTab] = useState(initialTab);

    // -- SHARED FORM STATE --
    const [symbol, setSymbol] = useState('');
    const [shares, setShares] = useState('');
    const [price, setPrice] = useState('');
    const [date, setDate] = useState(today);
    const [notes, setNotes] = useState('');

    // -- SELL SPECIFIC STATE --
    const [selectedLotId, setSelectedLotId] = useState(initialHolding ? initialHolding.id : '');

    // Initialize state based on props
    useEffect(() => {
        if (initialHolding) {
            setSymbol(initialHolding.symbol);
            setSelectedLotId(initialHolding.id);
            setActiveTab('sell');
        }
    }, [initialHolding]);

    // Reset lot selection when switching symbols in Sell tab
    useEffect(() => {
        if (activeTab === 'sell' && !initialHolding) {
            setSelectedLotId('');
        }
    }, [symbol, activeTab]);

    // Derived State
    const currentPrice = prices[symbol]?.price || 0;

    // Update price when symbol changes (if not set manually yet) OR when switching tabs
    useEffect(() => {
        if (currentPrice && !price) {
            setPrice(currentPrice.toString());
        }
    }, [symbol, currentPrice]);

    // Determine Active Lot for Sell
    const activeLot = activeTab === 'sell'
        ? (initialHolding || holdings.find(h => h.id === parseInt(selectedLotId)))
        : null;

    // Derived Selection Lists for Sell Tab
    const uniqueSymbols = [...new Set(holdings.map(h => h.symbol))].sort();
    const availableLots = symbol ? holdings.filter(h => h.symbol === symbol) : [];

    // Calculations
    const totalValue = shares && price ? (parseFloat(shares) * parseFloat(price)).toFixed(2) : '';

    // Sell specific calcs
    const costBasisPerShare = activeLot ? activeLot.cost_basis / activeLot.shares : 0;
    const gainLoss = (activeTab === 'sell' && shares && price)
        ? (parseFloat(shares) * parseFloat(price)) - (parseFloat(shares) * costBasisPerShare)
        : 0;

    function handleSubmit(e) {
        e.preventDefault();

        const commonData = {
            shares: parseFloat(shares),
            price: parseFloat(price),
            date,
            notes: notes.trim() || null
        };

        if (activeTab === 'buy') {
            onBuy({
                symbol: symbol.toUpperCase(),
                cost_basis: commonData.shares * commonData.price, // Calculate total cost
                purchase_date: commonData.date,
                ...commonData
            });
        } else {
            if (!activeLot) {
                alert('Please select a tax lot to sell.');
                return;
            }
            if (parseFloat(shares) > activeLot.shares) {
                alert(`Cannot sell more shares than available (${activeLot.shares}).`);
                return;
            }
            onSell({
                holding_id: activeLot.id,
                ...commonData
            });
        }
    }

    function resetForm() {
        setSymbol('');
        setShares('');
        setPrice('');
        setDate(today);
        setNotes('');
        setSelectedLotId('');
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">Trade Stock</h2>
                    <button className="modal-close" onClick={onClose}>&times;</button>
                </div>

                {/* TABS */}
                <div className="tabs" style={{ marginBottom: '20px', borderBottom: '1px solid #ccc' }}>
                    <button
                        className={`tab ${activeTab === 'buy' ? 'active' : ''}`}
                        onClick={() => { setActiveTab('buy'); resetForm(); }}
                        style={{ flex: 1, textAlign: 'center' }}
                    >
                        Buy
                    </button>
                    <button
                        className={`tab ${activeTab === 'sell' ? 'active' : ''}`}
                        onClick={() => { setActiveTab('sell'); resetForm(); }}
                        style={{ flex: 1, textAlign: 'center' }}
                    >
                        Sell
                    </button>
                </div>

                <form onSubmit={handleSubmit}>

                    {/* SYMBOL SELECTION */}
                    <div className="form-group">
                        <label className="form-label">Symbol *</label>
                        {activeTab === 'buy' ? (
                            <input
                                type="text"
                                className="form-input"
                                value={symbol}
                                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                                placeholder="e.g., AAPL"
                                required
                                autoFocus
                            />
                        ) : (
                            <select
                                className="form-input"
                                value={symbol}
                                onChange={e => setSymbol(e.target.value)}
                                required
                                disabled={!!initialHolding} // Lock symbol if selling specific lot
                            >
                                <option value="">-- Select Stock --</option>
                                {uniqueSymbols.map(sym => (
                                    <option key={sym} value={sym}>{sym}</option>
                                ))}
                            </select>
                        )}
                    </div>

                    {/* SELL: LOT SELECTION */}
                    {activeTab === 'sell' && symbol && !initialHolding && (
                        <div className="form-group">
                            <label className="form-label">Select Tax Lot *</label>
                            <select
                                className="form-input"
                                value={selectedLotId}
                                onChange={e => setSelectedLotId(e.target.value)}
                                required
                            >
                                <option value="">-- Choose Lot --</option>
                                {availableLots.map(lot => (
                                    <option key={lot.id} value={lot.id}>
                                        {new Date(lot.purchase_date).toLocaleDateString()} - {lot.shares} sh (Basis: ${(lot.cost_basis / lot.shares).toFixed(2)})
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* SELL: LOT INFO */}
                    {activeTab === 'sell' && activeLot && (
                        <div className="card" style={{ padding: '10px', marginBottom: '15px', background: '#f5f5f5' }}>
                            <div className="flex justify-between" style={{ fontSize: '0.9rem' }}>
                                <span className="text-muted">Available Shares:</span>
                                <strong>{activeLot.shares}</strong>
                            </div>
                            <div className="flex justify-between" style={{ fontSize: '0.9rem' }}>
                                <span className="text-muted">Cost Basis:</span>
                                <strong>${(activeLot.cost_basis / activeLot.shares).toFixed(2)}/sh</strong>
                            </div>
                        </div>
                    )}

                    {/* SHARES */}
                    <div className="form-group">
                        <label className="form-label">Shares *</label>
                        <div className="flex gap-sm">
                            <input
                                type="number"
                                className="form-input"
                                value={shares}
                                onChange={(e) => setShares(e.target.value)}
                                placeholder="0"
                                step="any"
                                min="0"
                                required
                                style={{ flex: 1 }}
                            />
                            {activeTab === 'sell' && activeLot && (
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setShares(activeLot.shares)}
                                >
                                    Max
                                </button>
                            )}
                        </div>
                    </div>

                    {/* PRICE */}
                    <div className="form-group">
                        <label className="form-label">Price per Share *</label>
                        <input
                            type="number"
                            className="form-input"
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                            placeholder="0.00"
                            step="0.01"
                            min="0"
                            required
                        />
                        {totalValue && (
                            <div className="text-right text-muted" style={{ marginTop: 5 }}>
                                Total {activeTab === 'buy' ? 'Cost' : 'Proceeds'}: <strong>${totalValue}</strong>
                            </div>
                        )}
                        {activeTab === 'sell' && gainLoss !== 0 && (
                            <div className={`text-right ${gainLoss >= 0 ? 'text-positive' : 'text-negative'}`}>
                                Est. Gain/Loss: {gainLoss >= 0 ? '+' : ''}${gainLoss.toFixed(2)}
                            </div>
                        )}
                    </div>

                    {/* DATE */}
                    <div className="form-group">
                        <label className="form-label">Date *</label>
                        <input
                            type="date"
                            className="form-input"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            required
                        />
                    </div>

                    {/* NOTES */}
                    <div className="form-group">
                        <label className="form-label">Notes</label>
                        <input
                            type="text"
                            className="form-input"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Optional"
                        />
                    </div>

                    <div className="modal-actions">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className={`btn ${activeTab === 'buy' ? 'btn-primary' : 'btn-danger'}`}>
                            {activeTab === 'buy' ? 'Buy Stock' : 'Sell Stock'}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}

export default TradeModal;
