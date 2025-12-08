import { useState } from 'react';

function CashMovementModal({ onSave, onClose }) {
    const today = new Date().toISOString().split('T')[0];

    const [type, setType] = useState('deposit');
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(today);
    const [notes, setNotes] = useState('');

    function handleSubmit(e) {
        e.preventDefault();
        if (!amount || !date) return;

        onSave({
            type,
            amount: parseFloat(amount),
            date,
            notes: notes.trim() || null
        });
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">Cash Movement</h2>
                    <button className="modal-close" onClick={onClose}>&times;</button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Type *</label>
                        <select
                            className="form-select"
                            value={type}
                            onChange={(e) => setType(e.target.value)}
                        >
                            <option value="deposit">Deposit</option>
                            <option value="withdrawal">Withdrawal</option>
                            <option value="interest">Interest</option>
                            <option value="fee">Fee</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Amount *</label>
                        <input
                            type="number"
                            className="form-input"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="1000.00"
                            step="0.01"
                            min="0"
                            required
                        />
                        <small className="text-muted" style={{ marginTop: '4px', display: 'block' }}>
                            {type === 'deposit' || type === 'interest'
                                ? 'This will increase your cash balance'
                                : 'This will decrease your cash balance'}
                        </small>
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
                            placeholder="Optional notes"
                        />
                    </div>

                    <div className="modal-actions">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary">
                            Add Cash Movement
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default CashMovementModal;
