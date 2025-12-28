import { useState, useEffect, useMemo } from 'react';
import * as api from '../api';
import TradeModal from '../components/modals/TradeModal';
import CashMovementModal from '../components/modals/CashMovementModal';
import ConfirmModal from '../components/modals/ConfirmModal';
import { useSort } from '../hooks/useSort';

function Activity() {
  const [transactions, setTransactions] = useState([]);
  const [dividends, setDividends] = useState([]);
  const [cashMovements, setCashMovements] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState('all');
  const [selectedAccount, setSelectedAccount] = useState('');

  // Modal State
  const [editTransaction, setEditTransaction] = useState(null);
  const [editCash, setEditCash] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Auxiliary data for modals (holdings/prices) - loaded if needed
  const [holdings, setHoldings] = useState([]);
  const [prices, setPrices] = useState({});

  useEffect(() => {
    loadData();
  }, [selectedAccount]);

  async function loadData() {
    try {
      const filters = selectedAccount ? { account_id: selectedAccount } : {};

      const [txData, divData, cashData, accountsData, holdingsData, pricesData] = await Promise.all(
        [
          api.getTransactions(filters),
          api.getDividends(filters),
          api.getCashMovements(filters),
          api.getAccounts(),
          api.getHoldings(selectedAccount || undefined), // Fetch all holdings or filter
          api.getPrices(),
        ]
      );

      setTransactions(txData);
      setDividends(divData);
      setCashMovements(cashData);
      setAccounts(accountsData);
      setHoldings(holdingsData);
      setPrices(
        Array.isArray(pricesData)
          ? pricesData.reduce((acc, p) => ({ ...acc, [p.symbol]: p }), {})
          : {}
      );
    } catch (err) {
      console.error('Failed to load activity:', err);
    } finally {
      setLoading(false);
    }
  }

  // Combine all activities
  const allActivities = useMemo(
    () => [
      ...transactions.map((t) => ({
        ...t,
        activityType: 'transaction',
        description: `${t.type.toUpperCase()} ${t.shares} ${t.symbol}`,
        amount: t.type === 'buy' ? -t.total : t.total,
      })),
      ...dividends.map((d) => ({
        ...d,
        activityType: 'dividend',
        description: `Dividend from ${d.symbol}`,
        amount: d.amount,
      })),
      ...cashMovements.map((c) => ({
        ...c,
        activityType: 'cash',
        description: `${c.type.charAt(0).toUpperCase() + c.type.slice(1)}`,
        amount: c.amount,
      })),
    ],
    [transactions, dividends, cashMovements]
  );

  const filteredActivities = useMemo(() => {
    if (activeTab === 'all') return allActivities;
    return allActivities.filter((a) => {
      if (activeTab === 'trades') return a.activityType === 'transaction';
      if (activeTab === 'dividends') return a.activityType === 'dividend';
      if (activeTab === 'cash') return a.activityType === 'cash';
      return true;
    });
  }, [allActivities, activeTab]);

  const { sortedData, sortConfig, requestSort, getSortIndicator } = useSort(filteredActivities, {
    key: 'date',
    direction: 'desc',
  });

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatDate = (dateStr) => {
    // Add T00:00:00 to parse as local time, not UTC
    const date = dateStr.includes('T') ? new Date(dateStr) : new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getActivityBadge = (activity) => {
    switch (activity.activityType) {
      case 'transaction':
        return activity.type === 'buy' ? (
          <span className="badge badge-success">BUY</span>
        ) : (
          <span className="badge badge-danger">SELL</span>
        );
      case 'dividend':
        return <span className="badge badge-warning">DIVIDEND</span>;
      case 'cash':
        if (activity.type === 'deposit' || activity.type === 'interest') {
          return <span className="badge badge-success">{activity.type.toUpperCase()}</span>;
        }
        return <span className="badge badge-danger">{activity.type.toUpperCase()}</span>;
      default:
        return <span className="badge badge-neutral">OTHER</span>;
    }
  };

  const SortableHeader = ({ column, label, className = '' }) => (
    <th
      className={`${className} sortable ${sortConfig.key === column ? 'sorted' : ''}`}
      onClick={() => requestSort(column)}
    >
      {label}
      <span className="sort-indicator">{getSortIndicator(column)}</span>
    </th>
  );

  const handleEdit = (activity) => {
    if (activity.activityType === 'transaction' || activity.activityType === 'dividend') {
      // For transactions, we need to ensure the modal gets the right unified structure
      // If it's a dividend from the dividends table, map it to the structure TradeModal expects
      const mapped =
        activity.activityType === 'dividend'
          ? { ...activity, type: 'dividend' } // TradeModal uses 'type' to determine tab
          : activity;
      setEditTransaction(mapped);
    } else if (activity.activityType === 'cash') {
      setEditCash(activity);
    }
  };

  const handleUpdateTransaction = async (id, data) => {
    try {
      if (
        editTransaction.activityType === 'transaction' ||
        editTransaction.type === 'buy' ||
        editTransaction.type === 'sell'
      ) {
        if (data.type === 'dividend') {
          // If user switched type to dividend? Not supported easily in modal yet (modal keeps tabs separate usually but logic allows)
          // But here we are assuming the update follows the original object type mostly.
          // The API `updateTransaction` is for table `transactions`.
          await api.updateTransaction(id, data);
        } else {
          await api.updateTransaction(id, data);
        }
      } else if (
        editTransaction.activityType === 'dividend' ||
        editTransaction.type === 'dividend'
      ) {
        await api.updateDividend(id, data);
      }
      setEditTransaction(null);
      loadData();
    } catch (err) {
      alert('Failed to update: ' + err.message);
    }
  };

  const handleUpdateCash = async (id, data) => {
    try {
      await api.updateCashMovement(id, data);
      setEditCash(null);
      loadData();
    } catch (err) {
      alert('Failed to update cash movement: ' + err.message);
    }
  };

  const initiateDelete = (activity) => {
    setDeleteConfirm(activity);
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      if (deleteConfirm.activityType === 'transaction') {
        await api.deleteTransaction(deleteConfirm.id);
      } else if (deleteConfirm.activityType === 'dividend') {
        await api.deleteDividend(deleteConfirm.id);
      } else if (deleteConfirm.activityType === 'cash') {
        await api.deleteCashMovement(deleteConfirm.id);
      }
      setDeleteConfirm(null);
      loadData();
    } catch (err) {
      alert('Failed to delete: ' + err.message);
    }
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
          <h1 className="page-title">Activity</h1>
          <p className="page-subtitle">All transactions, dividends, and cash movements</p>
        </div>
      </div>

      <div className="filter-row">
        <select
          className="form-select"
          value={selectedAccount}
          onChange={(e) => setSelectedAccount(e.target.value)}
        >
          <option value="">All Accounts</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          All ({allActivities.length})
        </button>
        <button
          className={`tab ${activeTab === 'trades' ? 'active' : ''}`}
          onClick={() => setActiveTab('trades')}
        >
          Trades ({transactions.length})
        </button>
        <button
          className={`tab ${activeTab === 'dividends' ? 'active' : ''}`}
          onClick={() => setActiveTab('dividends')}
        >
          Dividends ({dividends.length})
        </button>
        <button
          className={`tab ${activeTab === 'cash' ? 'active' : ''}`}
          onClick={() => setActiveTab('cash')}
        >
          Cash ({cashMovements.length})
        </button>
      </div>

      <div className="card">
        {filteredActivities.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-title">No activity yet</div>
            <p>Transactions, dividends, and cash movements will appear here</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <SortableHeader column="date" label="Date" />
                <SortableHeader column="activityType" label="Type" />
                <SortableHeader column="description" label="Description" />
                <SortableHeader column="account_name" label="Account" />
                <SortableHeader column="amount" label="Amount" className="text-right" />
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedData.map((activity, index) => (
                <tr key={`${activity.activityType}-${activity.id}-${index}`}>
                  <td>{formatDate(activity.date)}</td>
                  <td>{getActivityBadge(activity)}</td>
                  <td>{activity.description}</td>
                  <td>{activity.account_name}</td>
                  <td
                    className={`text-right number ${activity.amount >= 0 ? 'text-positive' : 'text-negative'}`}
                  >
                    {formatCurrency(activity.amount)}
                  </td>
                  <td className="text-right">
                    <div className="action-row justify-end">
                      <button
                        className="btn btn-icon"
                        onClick={() => handleEdit(activity)}
                        title="Edit"
                      >
                        ✏️
                      </button>
                      <button
                        className="btn btn-icon text-negative"
                        onClick={() => initiateDelete(activity)}
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editTransaction && (
        <TradeModal
          editingTransaction={editTransaction}
          holdings={holdings.filter((h) => h.account_id === editTransaction.account_id)}
          prices={prices}
          onUpdate={handleUpdateTransaction}
          onClose={() => setEditTransaction(null)}
        />
      )}

      {editCash && (
        <CashMovementModal
          editingMovement={editCash}
          onUpdate={handleUpdateCash}
          onClose={() => setEditCash(null)}
        />
      )}

      {deleteConfirm && (
        <ConfirmModal
          title="Delete Activity"
          message={`Are you sure you want to delete this ${deleteConfirm.activityType}?`}
          confirmText="Delete"
          onConfirm={handleDelete}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
}

export default Activity;
