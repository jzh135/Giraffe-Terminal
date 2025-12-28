import { useState } from 'react';

function HoldingModal({ onSave, onClose }) {
  const today = new Date().toISOString().split('T')[0];

  const [symbol, setSymbol] = useState('');
  const [shares, setShares] = useState('');
  const [price, setPrice] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(today);
  const [notes, setNotes] = useState('');

  const totalCost = shares && price ? (parseFloat(shares) * parseFloat(price)).toFixed(2) : '';

  function handleSubmit(e) {
    e.preventDefault();
    if (!symbol.trim() || !shares || !price || !purchaseDate) return;

    onSave({
      symbol: symbol.trim().toUpperCase(),
      shares: parseFloat(shares),
      cost_basis: parseFloat(shares) * parseFloat(price),
      purchase_date: purchaseDate,
      notes: notes.trim() || null,
    });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Buy Stock</h2>
          <button className="modal-close" onClick={onClose}>
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Symbol *</label>
            <input
              type="text"
              className="form-input"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="e.g., AAPL"
              autoFocus
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Shares *</label>
            <input
              type="number"
              className="form-input"
              value={shares}
              onChange={(e) => setShares(e.target.value)}
              placeholder="100"
              step="any"
              min="0"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Price per Share *</label>
            <input
              type="number"
              className="form-input"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="150.00"
              step="0.01"
              min="0"
              required
            />
            {totalCost && (
              <small className="text-muted" style={{ marginTop: '4px', display: 'block' }}>
                Total Cost: ${totalCost}
              </small>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Purchase Date *</label>
            <input
              type="date"
              className="form-input"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
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

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Add Holding
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default HoldingModal;
