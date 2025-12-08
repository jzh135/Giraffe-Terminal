import { useState } from 'react';

function CashMovementModal({ onSave, onClose }) {
    const today = new Date().toISOString().split('T')[0];

    // Rows state for multi-entry
    const [rows, setRows] = useState([
        { id: Date.now(), type: 'deposit', amount: '', date: today, notes: '' }
    ]);

    const createRow = () => ({
        id: Date.now() + Math.random(),
        type: 'deposit',
        amount: '',
        date: today,
        notes: ''
    });

    const addRow = () => {
        setRows(prev => [...prev, createRow()]);
    };

    const removeRow = (id) => {
        if (rows.length > 1) {
            setRows(prev => prev.filter(r => r.id !== id));
        }
    };

    const updateRow = (id, field, value) => {
        setRows(prev => prev.map(row => {
            if (row.id !== id) return row;
            return { ...row, [field]: value };
        }));
    };

    async function handleSubmit(e) {
        e.preventDefault();

        // Filter valid rows
        const validRows = rows.filter(r => r.amount && r.date);
        if (validRows.length === 0) return;

        try {
            for (const row of validRows) {
                await onSave({
                    type: row.type,
                    amount: parseFloat(row.amount),
                    date: row.date,
                    notes: row.notes || null
                });
            }
            onClose();
        } catch (err) {
            console.error(err);
            alert("Error processing cash movements: " + err.message);
        }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '900px', width: '90%' }}>
                <div className="modal-header">
                    <h2 className="modal-title">Cash Movement</h2>
                    <button className="modal-close" onClick={onClose}>&times;</button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="data-table" style={{ minWidth: '700px' }}>
                            <thead>
                                <tr>
                                    <th style={{ width: '150px' }}>Type</th>
                                    <th style={{ width: '150px' }}>Amount</th>
                                    <th style={{ width: '150px' }}>Date</th>
                                    <th>Notes</th>
                                    <th style={{ width: '50px' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map(row => (
                                    <tr key={row.id}>
                                        <td>
                                            <select
                                                className="form-input"
                                                value={row.type}
                                                onChange={e => updateRow(row.id, 'type', e.target.value)}
                                                required
                                            >
                                                <option value="deposit">Deposit</option>
                                                <option value="withdrawal">Withdrawal</option>
                                                <option value="interest">Interest</option>
                                                <option value="fee">Fee</option>
                                            </select>
                                        </td>
                                        <td>
                                            <input
                                                type="number" className="form-input"
                                                value={row.amount}
                                                onChange={e => updateRow(row.id, 'amount', e.target.value)}
                                                step="0.01" min="0" required
                                                placeholder="0.00"
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
                                        <td>
                                            {rows.length > 1 && (
                                                <button
                                                    type="button"
                                                    className="btn btn-icon text-negative"
                                                    onClick={() => removeRow(row.id)}
                                                    title="Remove"
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

export default CashMovementModal;
