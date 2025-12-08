import { useState, useEffect } from 'react';
import * as api from '../api';

function Activity() {
    const [transactions, setTransactions] = useState([]);
    const [dividends, setDividends] = useState([]);
    const [cashMovements, setCashMovements] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);

    const [activeTab, setActiveTab] = useState('all');
    const [selectedAccount, setSelectedAccount] = useState('');

    useEffect(() => {
        loadData();
    }, [selectedAccount]);

    async function loadData() {
        try {
            const filters = selectedAccount ? { account_id: selectedAccount } : {};

            const [txData, divData, cashData, accountsData] = await Promise.all([
                api.getTransactions(filters),
                api.getDividends(filters),
                api.getCashMovements(filters),
                api.getAccounts()
            ]);

            setTransactions(txData);
            setDividends(divData);
            setCashMovements(cashData);
            setAccounts(accountsData);
        } catch (err) {
            console.error('Failed to load activity:', err);
        } finally {
            setLoading(false);
        }
    }

    // Combine all activities
    const allActivities = [
        ...transactions.map(t => ({
            ...t,
            activityType: 'transaction',
            description: `${t.type.toUpperCase()} ${t.shares} ${t.symbol}`,
            amount: t.type === 'buy' ? -t.total : t.total
        })),
        ...dividends.map(d => ({
            ...d,
            activityType: 'dividend',
            description: `Dividend from ${d.symbol}`,
            amount: d.amount
        })),
        ...cashMovements.map(c => ({
            ...c,
            activityType: 'cash',
            description: `${c.type.charAt(0).toUpperCase() + c.type.slice(1)}`,
            amount: c.amount
        }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    const filteredActivities = activeTab === 'all'
        ? allActivities
        : allActivities.filter(a => {
            if (activeTab === 'trades') return a.activityType === 'transaction';
            if (activeTab === 'dividends') return a.activityType === 'dividend';
            if (activeTab === 'cash') return a.activityType === 'cash';
            return true;
        });

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2
        }).format(value);
    };

    const formatDate = (dateStr) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    const getActivityBadge = (activity) => {
        switch (activity.activityType) {
            case 'transaction':
                return activity.type === 'buy'
                    ? <span className="badge badge-success">BUY</span>
                    : <span className="badge badge-danger">SELL</span>;
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
                    {accounts.map(a => (
                        <option key={a.id} value={a.id}>{a.name}</option>
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
                                <th>Date</th>
                                <th>Type</th>
                                <th>Description</th>
                                <th>Account</th>
                                <th className="text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredActivities.map((activity, index) => (
                                <tr key={`${activity.activityType}-${activity.id}-${index}`}>
                                    <td>{formatDate(activity.date)}</td>
                                    <td>{getActivityBadge(activity)}</td>
                                    <td>{activity.description}</td>
                                    <td>{activity.account_name}</td>
                                    <td className={`text-right number ${activity.amount >= 0 ? 'text-positive' : 'text-negative'}`}>
                                        {formatCurrency(activity.amount)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

export default Activity;
