import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import * as api from '../api';

function Dashboard() {
    const [accounts, setAccounts] = useState([]);
    const [holdings, setHoldings] = useState([]);
    const [prices, setPrices] = useState({});
    const [performance, setPerformance] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        try {
            const [accountsData, holdingsData, pricesData, perfData] = await Promise.all([
                api.getAccounts(),
                api.getHoldings(),
                api.getPrices(),
                api.getPerformance()
            ]);

            setAccounts(accountsData);
            setHoldings(holdingsData);
            setPrices(pricesData.reduce((acc, p) => ({ ...acc, [p.symbol]: p }), {}));
            setPerformance(perfData);
        } catch (err) {
            console.error('Failed to load dashboard data:', err);
        } finally {
            setLoading(false);
        }
    }

    async function handleRefreshPrices() {
        setRefreshing(true);
        try {
            const result = await api.refreshPrices();
            setPrices(result.prices.reduce((acc, p) => ({ ...acc, [p.symbol]: p }), {}));
        } catch (err) {
            console.error('Failed to refresh prices:', err);
        } finally {
            setRefreshing(false);
        }
    }

    // Calculate totals
    const totalCash = accounts.reduce((sum, a) => sum + (a.cash_balance || 0), 0);

    const holdingsBySymbol = holdings.reduce((acc, h) => {
        if (!acc[h.symbol]) {
            acc[h.symbol] = { shares: 0, costBasis: 0 };
        }
        acc[h.symbol].shares += h.shares;
        acc[h.symbol].costBasis += h.cost_basis;
        return acc;
    }, {});

    const totalMarketValue = Object.entries(holdingsBySymbol).reduce((sum, [symbol, data]) => {
        const price = prices[symbol]?.price || 0;
        return sum + (data.shares * price);
    }, 0);

    const totalCostBasis = Object.values(holdingsBySymbol).reduce((sum, data) => sum + data.costBasis, 0);
    const totalGainLoss = totalMarketValue - totalCostBasis;
    const totalGainLossPercent = totalCostBasis > 0 ? (totalGainLoss / totalCostBasis) * 100 : 0;

    const portfolioValue = totalMarketValue + totalCash;

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2
        }).format(value);
    };

    const formatPercent = (value) => {
        const sign = value >= 0 ? '+' : '';
        return `${sign}${value.toFixed(2)}%`;
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
                    <h1 className="page-title">Portfolio Overview</h1>
                    <p className="page-subtitle">Track your investments across all accounts</p>
                </div>
                <button
                    className="btn btn-secondary"
                    onClick={handleRefreshPrices}
                    disabled={refreshing}
                >
                    {refreshing ? '⏳ Refreshing...' : '🔄 Refresh Prices'}
                </button>
            </div>

            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-label">Total Portfolio Value</div>
                    <div className="stat-value">{formatCurrency(portfolioValue)}</div>
                </div>

                <div className="stat-card">
                    <div className="stat-label">Holdings Value</div>
                    <div className="stat-value">{formatCurrency(totalMarketValue)}</div>
                    <div className={`stat-change ${totalGainLoss >= 0 ? 'positive' : 'negative'}`}>
                        {formatCurrency(totalGainLoss)} ({formatPercent(totalGainLossPercent)})
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-label">Cash Balance</div>
                    <div className={`stat-value ${totalCash < 0 ? 'negative' : ''}`}>
                        {formatCurrency(totalCash)}
                    </div>
                    {totalCash < 0 && (
                        <div className="stat-change negative">Margin Used</div>
                    )}
                </div>

                <div className="stat-card">
                    <div className="stat-label">Time-Weighted Return</div>
                    <div className={`stat-value ${(performance?.twr || 0) >= 0 ? 'positive' : 'negative'}`}>
                        {formatPercent(performance?.twr || 0)}
                    </div>
                    {performance?.spy_return !== null && (
                        <div className="stat-change">
                            S&P 500: {formatPercent(performance.spy_return)}
                        </div>
                    )}
                </div>
            </div>

            <div className="card mb-lg">
                <div className="card-header">
                    <h2 className="card-title">Accounts</h2>
                    <Link to="/accounts" className="btn btn-secondary">View All</Link>
                </div>

                {accounts.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">🏦</div>
                        <div className="empty-state-title">No accounts yet</div>
                        <p>Create your first account to get started</p>
                        <Link to="/accounts" className="btn btn-primary mt-md">Add Account</Link>
                    </div>
                ) : (
                    <div className="account-cards">
                        {accounts.slice(0, 4).map(account => (
                            <Link
                                key={account.id}
                                to={`/accounts/${account.id}`}
                                className="account-card"
                                style={{ textDecoration: 'none' }}
                            >
                                <div className="account-header">
                                    <div>
                                        <div className="account-name">{account.name}</div>
                                        <div className="account-type">{account.institution || account.type}</div>
                                    </div>
                                    <span className="badge badge-neutral">{account.type}</span>
                                </div>
                                <div className={`account-cash ${account.cash_balance < 0 ? 'negative' : ''}`}>
                                    Cash: {formatCurrency(account.cash_balance)}
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>

            <div className="card">
                <div className="card-header">
                    <h2 className="card-title">Top Holdings</h2>
                    <Link to="/holdings" className="btn btn-secondary">View All</Link>
                </div>

                {Object.keys(holdingsBySymbol).length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">📈</div>
                        <div className="empty-state-title">No holdings yet</div>
                        <p>Add stocks to your accounts to track them here</p>
                    </div>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Symbol</th>
                                <th className="text-right">Shares</th>
                                <th className="text-right">Price</th>
                                <th className="text-right">Market Value</th>
                                <th className="text-right">Gain/Loss</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.entries(holdingsBySymbol)
                                .sort((a, b) => {
                                    const aValue = a[1].shares * (prices[a[0]]?.price || 0);
                                    const bValue = b[1].shares * (prices[b[0]]?.price || 0);
                                    return bValue - aValue;
                                })
                                .slice(0, 5)
                                .map(([symbol, data]) => {
                                    const price = prices[symbol]?.price || 0;
                                    const marketValue = data.shares * price;
                                    const gainLoss = marketValue - data.costBasis;
                                    const gainLossPercent = data.costBasis > 0 ? (gainLoss / data.costBasis) * 100 : 0;

                                    return (
                                        <tr key={symbol}>
                                            <td className="symbol">{symbol}</td>
                                            <td className="text-right number">{data.shares.toLocaleString()}</td>
                                            <td className="text-right number">{formatCurrency(price)}</td>
                                            <td className="text-right number">{formatCurrency(marketValue)}</td>
                                            <td className={`text-right ${gainLoss >= 0 ? 'text-positive' : 'text-negative'}`}>
                                                {formatCurrency(gainLoss)} ({formatPercent(gainLossPercent)})
                                            </td>
                                        </tr>
                                    );
                                })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

export default Dashboard;
