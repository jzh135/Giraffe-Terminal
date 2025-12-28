import { useState } from 'react';

function DividendModal({ holdings, onSave, onClose }) {
  const today = new Date().toISOString().split('T')[0];

  // Get unique symbols from holdings
  const symbols = [...new Set(holdings.map((h) => h.symbol))].sort();

  const [symbol, setSymbol] = useState(symbols[0] || '');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (!symbol || !amount || !date) return;

    onSave({
      symbol: symbol.toUpperCase(),
      amount: parseFloat(amount),
      date,
      notes: notes.trim() || null,
    });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Add Dividend</h2>
          <button className="modal-close" onClick={onClose}>
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Symbol *</label>
            {symbols.length > 0 ? (
              <select
                className="form-select"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
              >
                {symbols.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                className="form-input"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder="e.g., AAPL"
                required
              />
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Amount *</label>
            <input
              type="number"
              className="form-input"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="50.00"
              step="0.01"
              min="0"
              required
            />
          </div>

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

          <div className="form-group">
            <label className="form-label">Notes</label>
            <input
              type="text"
              className="form-input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Q4 dividend"
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Add Dividend
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default DividendModal;
