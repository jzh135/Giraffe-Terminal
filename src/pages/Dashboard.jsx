import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine } from 'recharts';
import * as api from '../api';

function Dashboard() {
    const [accounts, setAccounts] = useState([]);
    const [holdings, setHoldings] = useState([]);
    const [prices, setPrices] = useState({});
    const [performance, setPerformance] = useState(null);
    const [allocation, setAllocation] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedAccount, setSelectedAccount] = useState('');

    // Performance chart state
    const [chartData, setChartData] = useState(null);
    const [chartTimeframe, setChartTimeframe] = useState('1Y');
    const [chartAccounts, setChartAccounts] = useState([]);
    const [showSpy, setShowSpy] = useState(true);
    const [chartLoading, setChartLoading] = useState(false);

    useEffect(() => {
        loadData();
    }, [selectedAccount]);

    useEffect(() => {
        loadChartData();
    }, [chartTimeframe, accounts]);

    async function loadData() {
        try {
            const accountId = selectedAccount || undefined;
            const [accountsData, holdingsData, pricesData, perfData, allocData] = await Promise.all([
                api.getAccounts(),
                api.getHoldings(accountId),
                api.getPrices(),
                api.getPerformance(accountId),
                api.getAllocation(accountId)
            ]);

            setAccounts(accountsData);
            setHoldings(holdingsData);
            setPrices(pricesData.reduce((acc, p) => ({ ...acc, [p.symbol]: p }), {}));
            setPerformance(perfData);
            setAllocation(allocData);
        } catch (err) {
            console.error('Failed to load dashboard data:', err);
        } finally {
            setLoading(false);
        }
    }

    async function loadChartData() {
        if (accounts.length === 0) return;

        setChartLoading(true);
        try {
            const accountIds = chartAccounts.length > 0
                ? chartAccounts.join(',')
                : accounts.map(a => a.id).join(',');

            const data = await api.getPerformanceChart({
                account_ids: accountIds,
                timeframe: chartTimeframe
            });

            setChartData(data);

            // Initialize chart accounts if empty
            if (chartAccounts.length === 0 && data.accounts) {
                setChartAccounts(data.accounts.map(a => a.id));
            }
        } catch (err) {
            console.error('Failed to load chart data:', err);
        } finally {
            setChartLoading(false);
        }
    }

    async function handleRefreshPrices() {
        setRefreshing(true);
        try {
            const result = await api.refreshPrices();
            setPrices(result.prices.reduce((acc, p) => ({ ...acc, [p.symbol]: p }), {}));
            // Reload allocation as it depends on prices
            const allocData = await api.getAllocation(selectedAccount || undefined);
            setAllocation(allocData);
        } catch (err) {
            console.error('Failed to refresh prices:', err);
        } finally {
            setRefreshing(false);
        }
    }

    function toggleChartAccount(accountId) {
        setChartAccounts(prev => {
            if (prev.includes(accountId)) {
                return prev.filter(id => id !== accountId);
            } else {
                return [...prev, accountId];
            }
        });
    }

    // Calculate totals
    const totalCash = accounts.reduce((sum, a) => {
        if (selectedAccount && a.id.toString() !== selectedAccount.toString()) return sum;
        return sum + (a.cash_balance || 0);
    }, 0);

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

    const formatChartDate = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    if (loading) {
        return (
            <div className="loading">
                <div className="spinner"></div>
            </div>
        );
    }

    const timeframeLabels = {
        '5D': '5D',
        '30D': '1M',
        '3M': '3M',
        '6M': '6M',
        'YTD': 'YTD',
        '1Y': '1Y',
        'ALL': 'All'
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Portfolio Overview</h1>
                    <p className="page-subtitle">Track your investments across all accounts</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <select
                        className="form-select"
                        value={selectedAccount}
                        onChange={(e) => setSelectedAccount(e.target.value)}
                        style={{ minWidth: '200px' }}
                    >
                        <option value="">All Accounts</option>
                        {accounts.map(a => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                    </select>
                    <button
                        className="btn btn-secondary"
                        onClick={handleRefreshPrices}
                        disabled={refreshing}
                    >
                        {refreshing ? '⏳ Refreshing...' : '🔄 Refresh Prices'}
                    </button>
                </div>
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

            {/* Performance Chart */}
            <div className="card mb-lg">
                <div className="card-header">
                    <h2 className="card-title">Performance Chart</h2>
                    <div className="chart-controls">
                        <div className="timeframe-selector">
                            {Object.entries(timeframeLabels).map(([key, label]) => (
                                <button
                                    key={key}
                                    className={`timeframe-btn ${chartTimeframe === key ? 'active' : ''}`}
                                    onClick={() => setChartTimeframe(key)}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {chartLoading ? (
                    <div className="loading" style={{ height: 350 }}>
                        <div className="spinner"></div>
                    </div>
                ) : chartData?.data?.length > 0 ? (
                    <>
                        <div style={{ height: 350 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData.data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
                                    <XAxis
                                        dataKey="date"
                                        stroke="#9090a0"
                                        tick={{ fill: '#9090a0', fontSize: 11 }}
                                        tickFormatter={formatChartDate}
                                        interval="preserveStartEnd"
                                    />
                                    <YAxis
                                        stroke="#9090a0"
                                        tick={{ fill: '#9090a0', fontSize: 11 }}
                                        tickFormatter={(v) => `${v.toFixed(1)}%`}
                                        domain={['auto', 'auto']}
                                    />
                                    <ReferenceLine y={0} stroke="#4a4a5a" strokeDasharray="3 3" />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: '#1a1a25',
                                            border: '1px solid #2a2a3a',
                                            borderRadius: '8px'
                                        }}
                                        labelStyle={{ color: '#f0f0f5' }}
                                        formatter={(value, name) => {
                                            const formattedName = name === 'spy'
                                                ? 'S&P 500'
                                                : chartData.accounts?.find(a => `account_${a.id}` === name)?.name || name;
                                            return [`${value?.toFixed(2)}%`, formattedName];
                                        }}
                                        labelFormatter={formatChartDate}
                                    />
                                    <Legend
                                        formatter={(value) => {
                                            if (value === 'spy') return 'S&P 500';
                                            const account = chartData.accounts?.find(a => `account_${a.id}` === value);
                                            return account?.name || value;
                                        }}
                                    />

                                    {/* Account lines */}
                                    {chartData.accounts?.filter(a => chartAccounts.includes(a.id)).map(account => (
                                        <Line
                                            key={account.id}
                                            type="monotone"
                                            dataKey={`account_${account.id}`}
                                            stroke={account.color}
                                            strokeWidth={2}
                                            dot={false}
                                            name={`account_${account.id}`}
                                            connectNulls
                                        />
                                    ))}

                                    {/* S&P 500 line */}
                                    {showSpy && (
                                        <Line
                                            type="monotone"
                                            dataKey="spy"
                                            stroke={chartData.spy_color || '#fbbf24'}
                                            strokeWidth={2}
                                            dot={false}
                                            name="spy"
                                            strokeDasharray="5 5"
                                            connectNulls
                                        />
                                    )}
                                </LineChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Account toggles */}
                        <div className="chart-legend-controls">
                            <div className="legend-items">
                                {chartData.accounts?.map(account => (
                                    <label key={account.id} className="legend-item">
                                        <input
                                            type="checkbox"
                                            checked={chartAccounts.includes(account.id)}
                                            onChange={() => toggleChartAccount(account.id)}
                                        />
                                        <span className="legend-color" style={{ backgroundColor: account.color }}></span>
                                        <span className="legend-name">{account.name}</span>
                                    </label>
                                ))}
                                <label className="legend-item">
                                    <input
                                        type="checkbox"
                                        checked={showSpy}
                                        onChange={(e) => setShowSpy(e.target.checked)}
                                    />
                                    <span className="legend-color" style={{ backgroundColor: chartData.spy_color || '#fbbf24' }}></span>
                                    <span className="legend-name">S&P 500</span>
                                </label>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="empty-state" style={{ height: 350 }}>
                        <div className="empty-state-icon">📈</div>
                        <div className="empty-state-title">No performance data</div>
                        <p>Add some transactions to see performance over time</p>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-2 gap-lg mb-lg">
                <div className="card">
                    <div className="card-header">
                        <h2 className="card-title">Allocation by Role</h2>
                    </div>
                    <div style={{ height: 300 }}>
                        {allocation.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-state-icon">📊</div>
                                <div className="empty-state-title">No allocation data</div>
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={allocation}
                                        dataKey="value"
                                        nameKey="name"
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={100}
                                        paddingAngle={2}
                                    >
                                        {allocation.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} stroke="#1a1a25" />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: '#1a1a25',
                                            border: '1px solid #2a2a3a',
                                            borderRadius: '8px'
                                        }}
                                        itemStyle={{ color: '#f0f0f5' }}
                                        formatter={(value, name, props) => [
                                            `${formatCurrency(value)} (${props.payload.percent.toFixed(1)}%)`,
                                            name
                                        ]}
                                    />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>
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
                                    <th className="text-right">Value</th>
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
                        {accounts
                            .filter(a => !selectedAccount || a.id.toString() === selectedAccount.toString())
                            .map(account => (
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
        </div>
    );
}

export default Dashboard;

