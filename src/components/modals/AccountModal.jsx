import { useState } from 'react';

function AccountModal({ account, onSave, onClose }) {
    const [name, setName] = useState(account?.name || '');
    const [type, setType] = useState(account?.type || 'brokerage');
    const [institution, setInstitution] = useState(account?.institution || '');

    function handleSubmit(e) {
        e.preventDefault();
        if (!name.trim()) return;
        onSave({ name: name.trim(), type, institution: institution.trim() || null });
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">{account ? 'Edit Account' : 'Add Account'}</h2>
                    <button className="modal-close" onClick={onClose}>&times;</button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Account Name *</label>
                        <input
                            type="text"
                            className="form-input"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., Fidelity Brokerage"
                            autoFocus
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Account Type</label>
                        <select
                            className="form-select"
                            value={type}
                            onChange={(e) => setType(e.target.value)}
                        >
                            <option value="brokerage">Brokerage</option>
                            <option value="ira">IRA</option>
                            <option value="roth_ira">Roth IRA</option>
                            <option value="401k">401(k)</option>
                            <option value="hsa">HSA</option>
                            <option value="other">Other</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Institution</label>
                        <input
                            type="text"
                            className="form-input"
                            value={institution}
                            onChange={(e) => setInstitution(e.target.value)}
                            placeholder="e.g., Fidelity, Schwab, Vanguard"
                        />
                    </div>

                    <div className="modal-actions">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary">
                            {account ? 'Save Changes' : 'Create Account'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default AccountModal;
