import { useState } from 'react';

function CashMovementModal({ onSave, onClose, editingMovement = null, onUpdate = null }) {
    const today = new Date().toISOString().split('T')[0];
    const isEditing = !!editingMovement;

    // Rows state for multi-entry
    const [rows, setRows] = useState(
        isEditing
            ? [{
                id: editingMovement.id,
                type: editingMovement.type,
                amount: Math.abs(editingMovement.amount), // Display as positive
                date: new Date(editingMovement.date || today).toISOString().split('T')[0],
                notes: editingMovement.notes || ''
            }]
            : [{ id: Date.now(), type: 'deposit', amount: '', date: today, notes: '' }]
    );

    // Confirmation state
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [pendingRows, setPendingRows] = useState([]);

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

    // Format currency for display
    const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

    // Format date for display
    const formatDate = (dateStr) => {
        const date = dateStr.includes('T') ? new Date(dateStr) : new Date(dateStr + 'T00:00:00');
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    };

    // Handle review (show confirmation)
    function handleReview(e) {
        e.preventDefault();
        const validRows = rows.filter(r => r.amount && r.date);
        if (validRows.length === 0) return;
        setPendingRows(validRows);
        setShowConfirmation(true);
    }

    // Go back to edit
    function handleGoBack() {
        setShowConfirmation(false);
        setPendingRows([]);
    }

    // Final confirm and submit
    async function handleConfirm() {
        try {
            for (const row of pendingRows) {
                const payload = {
                    type: row.type,
                    amount: parseFloat(row.amount),
                    date: row.date,
                    notes: row.notes || null
                };

                if (isEditing) {
                    await onUpdate(editingMovement.id, payload);
                } else {
                    await onSave(payload);
                }
            }
            onClose();
        } catch (err) {
            console.error(err);
            alert("Error processing cash movements: " + err.message);
        }
    }

    // Get type label for display
    const getTypeLabel = (type) => {
        const labels = { deposit: 'Deposit', withdrawal: 'Withdrawal', interest: 'Interest', fee: 'Fee' };
        return labels[type] || type;
    };

    // Confirmation View
    if (showConfirmation) {
        return (
            <div className="modal-overlay" onClick={onClose}>
                <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '90%' }}>
                    <div className="modal-header">
                        <h2 className="modal-title">Confirm Cash Movement{pendingRows.length > 1 ? 's' : ''}</h2>
                        <button className="modal-close" onClick={onClose}>&times;</button>
                    </div>

                    <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-lg)' }}>
                        Please review the following {pendingRows.length === 1 ? 'entry' : `${pendingRows.length} entries`} before confirming:
                    </p>

                    <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                        {pendingRows.map((row, idx) => (
                            <div key={row.id} className="card" style={{ marginBottom: 'var(--spacing-md)', padding: 'var(--spacing-md)' }}>
                                {pendingRows.length > 1 && (
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 'var(--spacing-sm)' }}>
                                        Entry {idx + 1}
                                    </div>
                                )}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-sm)' }}>
                                    <div>
                                        <span className="text-muted" style={{ fontSize: '0.85rem' }}>Type:</span>
                                        <div style={{ fontWeight: 500 }}>{getTypeLabel(row.type)}</div>
                                    </div>
                                    <div>
                                        <span className="text-muted" style={{ fontSize: '0.85rem' }}>Amount:</span>
                                        <div style={{ fontWeight: 600, color: row.type === 'withdrawal' || row.type === 'fee' ? 'var(--danger)' : 'var(--success)' }}>
                                            {row.type === 'withdrawal' || row.type === 'fee' ? '-' : '+'}{formatCurrency(parseFloat(row.amount))}
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-muted" style={{ fontSize: '0.85rem' }}>Date:</span>
                                        <div>{formatDate(row.date)}</div>
                                    </div>
                                    {row.notes && (
                                        <div>
                                            <span className="text-muted" style={{ fontSize: '0.85rem' }}>Notes:</span>
                                            <div>{row.notes}</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="modal-actions" style={{ marginTop: 'var(--spacing-lg)' }}>
                        <button type="button" className="btn btn-secondary" onClick={handleGoBack}>
                            ← Go Back
                        </button>
                        <button type="button" className="btn btn-primary" onClick={handleConfirm}>
                            ✓ Confirm
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Main Entry Form
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '900px', width: '90%' }}>
                <div className="modal-header">
                    <h2 className="modal-title">{isEditing ? 'Edit Cash Movement' : 'Cash Movement'}</h2>
                    <button className="modal-close" onClick={onClose}>&times;</button>
                </div>

                <form onSubmit={handleReview}>
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
                                            {!isEditing && rows.length > 1 && (
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
                            {isEditing ? 'Review Changes' : `Review ${rows.length} ${rows.length === 1 ? 'Entry' : 'Entries'}`}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}

export default CashMovementModal;

