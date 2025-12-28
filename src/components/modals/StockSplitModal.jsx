import { useState } from 'react';

function StockSplitModal({ symbols, onSave, onClose }) {
  const today = new Date().toISOString().split('T')[0];

  const [symbol, setSymbol] = useState(symbols[0] || '');
  const [ratio, setRatio] = useState('');
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (!symbol || !ratio || !date) return;

    onSave({
      symbol: symbol.toUpperCase(),
      ratio: parseFloat(ratio),
      date,
      notes: notes.trim() || null,
    });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Apply Stock Split</h2>
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
                placeholder="e.g., TSLA"
                required
              />
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Split Ratio *</label>
            <input
              type="number"
              className="form-input"
              value={ratio}
              onChange={(e) => setRatio(e.target.value)}
              placeholder="e.g., 4 for a 4:1 split"
              step="any"
              min="0"
              required
            />
            <small className="text-muted" style={{ marginTop: '4px', display: 'block' }}>
              For a 4:1 split, enter 4. For a 1:10 reverse split, enter 0.1.
            </small>
          </div>

          <div className="form-group">
            <label className="form-label">Split Date *</label>
            <input
              type="date"
              className="form-input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
            <small className="text-muted" style={{ marginTop: '4px', display: 'block' }}>
              All holdings purchased on or before this date will be adjusted.
            </small>
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
              Apply Split
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default StockSplitModal;
