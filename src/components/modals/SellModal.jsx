import { useState, useEffect } from 'react';

function SellModal({ holding, holdings = [], prices = {}, onSave, onClose }) {
  const today = new Date().toISOString().split('T')[0];

  // Selection State (for generic mode)
  const [selectedSymbol, setSelectedSymbol] = useState('');
  const [selectedLotId, setSelectedLotId] = useState('');

  // Determine which holding we are acting on
  const activeHolding =
    holding || (selectedLotId ? holdings.find((h) => h.id === parseInt(selectedLotId)) : null);

  // Form State
  const [shares, setShares] = useState('');
  const [price, setPrice] = useState('');
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState('');

  // Update price when activeHolding changes (only if price is empty or we want to reset it)
  useEffect(() => {
    if (activeHolding && prices) {
      const currentPrice = prices[activeHolding.symbol]?.price || 0;
      if (currentPrice) {
        setPrice(currentPrice.toString());
      }
    }
  }, [activeHolding, prices]);

  const total = shares && price ? (parseFloat(shares) * parseFloat(price)).toFixed(2) : '';
  const costBasisPerShare = activeHolding ? activeHolding.cost_basis / activeHolding.shares : 0;
  const gainLoss =
    shares && price
      ? parseFloat(shares) * parseFloat(price) - parseFloat(shares) * costBasisPerShare
      : 0;

  function handleSubmit(e) {
    e.preventDefault();
    if (!activeHolding || !shares || !price || !date) return;

    if (parseFloat(shares) > activeHolding.shares) {
      alert('Cannot sell more shares than held in this lot');
      return;
    }

    onSave({
      holding_id: activeHolding.id,
      shares: parseFloat(shares),
      price: parseFloat(price),
      date,
      notes: notes.trim() || null,
    });
  }

  function handleSellAll() {
    if (activeHolding) {
      setShares(activeHolding.shares.toString());
    }
  }

  // Derived Selection Lists
  const uniqueSymbols = [...new Set(holdings.map((h) => h.symbol))].sort();
  const availableLots = selectedSymbol ? holdings.filter((h) => h.symbol === selectedSymbol) : [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            {activeHolding ? `Sell ${activeHolding.symbol}` : 'Sell Stock'}
          </h2>
          <button className="modal-close" onClick={onClose}>
            &times;
          </button>
        </div>

        {/* Selection Step (only if no specific holding passed/selected) */}
        {!activeHolding && (
          <div style={{ padding: '20px' }}>
            <div className="form-group">
              <label className="form-label">Select Stock</label>
              <select
                className="form-input"
                value={selectedSymbol}
                onChange={(e) => {
                  setSelectedSymbol(e.target.value);
                  setSelectedLotId(''); // Reset lot when symbol changes
                }}
              >
                <option value="">-- Choose Symbol --</option>
                {uniqueSymbols.map((sym) => (
                  <option key={sym} value={sym}>
                    {sym}
                  </option>
                ))}
              </select>
            </div>

            {selectedSymbol && (
              <div className="form-group">
                <label className="form-label">Select Tax Lot</label>
                <select
                  className="form-input"
                  value={selectedLotId}
                  onChange={(e) => setSelectedLotId(e.target.value)}
                >
                  <option value="">-- Choose Lot --</option>
                  {availableLots.map((lot) => (
                    <option key={lot.id} value={lot.id}>
                      {new Date(lot.purchase_date + 'T00:00:00').toLocaleDateString()} -{' '}
                      {lot.shares} shares @ ${lot.cost_basis / lot.shares}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Sell Form (only visible when we have a target holding) */}
        {activeHolding && (
          <>
            <div
              className="card"
              style={{ marginBottom: 'var(--spacing-lg)', padding: 'var(--spacing-md)' }}
            >
              <div className="flex justify-between">
                <span className="text-muted">Lot Date:</span>
                <span>
                  {new Date(activeHolding.purchase_date + 'T00:00:00').toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Available:</span>
                <span>{activeHolding.shares} shares</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Cost Basis:</span>
                <span>${costBasisPerShare.toFixed(2)}/share</span>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Shares to Sell *</label>
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
                  <button type="button" className="btn btn-secondary" onClick={handleSellAll}>
                    Sell All
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Price per Share *</label>
                <input
                  type="number"
                  className="form-input"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  step="0.01"
                  min="0"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Sale Date *</label>
                <input
                  type="date"
                  className="form-input"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Notes</label>
                <input
                  type="text"
                  className="form-input"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional notes"
                />
              </div>

              {total && (
                <div
                  className="card"
                  style={{ padding: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}
                >
                  <div className="flex justify-between">
                    <span className="text-muted">Total Proceeds:</span>
                    <span>${total}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Realized Gain/Loss:</span>
                    <span className={gainLoss >= 0 ? 'text-positive' : 'text-negative'}>
                      ${gainLoss.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              <div className="modal-actions">
                {/* If we are in generic mode (holding not passed as prop), allow going back? 
                                    For now just Cancel closes everything */}
                <button type="button" className="btn btn-secondary" onClick={onClose}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-danger">
                  Sell Stock
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default SellModal;
