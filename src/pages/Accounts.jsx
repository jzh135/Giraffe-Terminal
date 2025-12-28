import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import * as api from '../api';
import AccountModal from '../components/modals/AccountModal';
import ConfirmModal from '../components/modals/ConfirmModal';

function Accounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    loadAccounts();
  }, []);

  async function loadAccounts() {
    try {
      const data = await api.getAccounts();
      setAccounts(data);
    } catch (err) {
      console.error('Failed to load accounts:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleAddAccount() {
    setEditingAccount(null);
    setModalOpen(true);
  }

  function handleEditAccount(account, e) {
    e.preventDefault();
    e.stopPropagation();
    setEditingAccount(account);
    setModalOpen(true);
  }

  async function handleSaveAccount(data) {
    try {
      if (editingAccount) {
        await api.updateAccount(editingAccount.id, data);
      } else {
        await api.createAccount(data);
      }
      await loadAccounts();
      setModalOpen(false);
    } catch (err) {
      console.error('Failed to save account:', err);
    }
  }

  function handleDeleteClick(account, e) {
    e.preventDefault();
    e.stopPropagation();
    setDeleteConfirm(account);
  }

  async function handleConfirmDelete() {
    if (!deleteConfirm) return;
    try {
      await api.deleteAccount(deleteConfirm.id);
      await loadAccounts();
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Failed to delete account:', err);
    }
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Accounts</h1>
          <p className="page-subtitle">Manage your investment accounts</p>
        </div>
        <button className="btn btn-primary" onClick={handleAddAccount}>
          ➕ Add Account
        </button>
      </div>

      {accounts.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">🏦</div>
            <div className="empty-state-title">No accounts yet</div>
            <p>Create your first account to start tracking investments</p>
            <button className="btn btn-primary mt-md" onClick={handleAddAccount}>
              Create Account
            </button>
          </div>
        </div>
      ) : (
        <div className="account-cards">
          {accounts.map((account) => (
            <Link
              key={account.id}
              to={`/accounts/${account.id}`}
              className="account-card"
              style={{ textDecoration: 'none' }}
            >
              <div className="account-header">
                <div>
                  <div className="account-name">{account.name}</div>
                  <div className="account-type">{account.institution || 'No institution'}</div>
                </div>
                <div className="action-row">
                  <button
                    className="btn btn-icon"
                    onClick={(e) => handleEditAccount(account, e)}
                    title="Edit"
                  >
                    ✏️
                  </button>
                  <button
                    className="btn btn-icon"
                    onClick={(e) => handleDeleteClick(account, e)}
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              <span className="badge badge-neutral">{account.type}</span>

              <div className={`account-cash mt-md ${account.cash_balance < 0 ? 'negative' : ''}`}>
                Cash: {formatCurrency(account.cash_balance)}
                {account.cash_balance < 0 && (
                  <span className="badge badge-danger ml-sm">Margin</span>
                )}
              </div>
              <div
                className={`stat-change mt-sm ${account.realized_gain >= 0 ? 'positive' : 'negative'}`}
                style={{ fontSize: '0.9rem' }}
              >
                Realized: {account.realized_gain >= 0 ? '+' : ''}
                {formatCurrency(account.realized_gain)}
              </div>
            </Link>
          ))}
        </div>
      )}

      {modalOpen && (
        <AccountModal
          account={editingAccount}
          onSave={handleSaveAccount}
          onClose={() => setModalOpen(false)}
        />
      )}

      {deleteConfirm && (
        <ConfirmModal
          title="Delete Account"
          message={`Are you sure you want to delete "${deleteConfirm.name}"? This will also delete all holdings, transactions, and other data for this account.`}
          confirmText="Delete"
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
}

export default Accounts;
