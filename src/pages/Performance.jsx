import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import * as api from '../api';

function Performance() {
    const [performance, setPerformance] = useState(null);
    const [accounts, setAccounts] = useState([]);
    const [holdings, setHoldings] = useState([]);
    const [prices, setPrices] = useState({});
    const [loading, setLoading] = useState(true);
    const [selectedAccount, setSelectedAccount] = useState('');

    useEffect(() => {
        loadData();
    }, [selectedAccount]);

    async function loadData() {
        try {
            const accountId = selectedAccount || undefined;

            const [perfData, accountsData, holdingsData, pricesData] = await Promise.all([
                api.getPerformance(accountId),
                api.getAccounts(),
                api.getHoldings(accountId),
                api.getPrices()
            ]);

            setPerformance(perfData);
            setAccounts(accountsData);
            setHoldings(holdingsData);
            setPrices(pricesData.reduce((acc, p) => ({ ...acc, [p.symbol]: p }), {}));
        } catch (err) {
            console.error('Failed to load performance:', err);
        } finally {
            setLoading(false);
        }
    }

    // Calculate portfolio breakdown
    const holdingsBySymbol = {};
    holdings.forEach(h => {
        if (!holdingsBySymbol[h.symbol]) {
            holdingsBySymbol[h.symbol] = { shares: 0, costBasis: 0 };
        }
        holdingsBySymbol[h.symbol].shares += h.shares;
        holdingsBySymbol[h.symbol].costBasis += h.cost_basis;
    });

    const portfolioBreakdown = Object.entries(holdingsBySymbol)
        .map(([symbol, data]) => {
            const price = prices[symbol]?.price || 0;
            const marketValue = data.shares * price;
            const gainLoss = marketValue - data.costBasis;
            return { symbol, ...data, marketValue, gainLoss, price };
        })
        .sort((a, b) => b.marketValue - a.marketValue);

    const totalMarketValue = portfolioBreakdown.reduce((sum, p) => sum + p.marketValue, 0);
    const totalCostBasis = portfolioBreakdown.reduce((sum, p) => sum + p.costBasis, 0);
    const totalGainLoss = totalMarketValue - totalCostBasis;

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
                    <h1 className="page-title">Performance</h1>
                    <p className="page-subtitle">Track your portfolio returns and compare to benchmarks</p>
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

            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-label">Portfolio Value</div>
                    <div className="stat-value">{formatCurrency(performance?.portfolio_value || 0)}</div>
                </div>

                <div className="stat-card">
                    <div className="stat-label">Time-Weighted Return</div>
                    <div className={`stat-value ${(performance?.twr || 0) >= 0 ? 'positive' : 'negative'}`}>
                        {formatPercent(performance?.twr || 0)}
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-label">S&P 500 (1Y)</div>
                    <div className={`stat-value ${(performance?.spy_return || 0) >= 0 ? 'positive' : 'negative'}`}>
                        {performance?.spy_return !== null
                            ? formatPercent(performance.spy_return)
                            : 'N/A'}
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-label">vs S&P 500</div>
                    {performance?.spy_return !== null && (
                        <div className={`stat-value ${(performance?.twr || 0) - (performance?.spy_return || 0) >= 0 ? 'positive' : 'negative'}`}>
                            {formatPercent((performance?.twr || 0) - (performance?.spy_return || 0))}
                        </div>
                    )}
                </div>
            </div>

            <div className="card mb-lg">
                <div className="card-header">
                    <h2 className="card-title">Unrealized Gains/Losses</h2>
                </div>

                <div className="stats-grid" style={{ marginBottom: '1rem' }}>
                    <div>
                        <div className="text-muted">Total Cost Basis</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>{formatCurrency(totalCostBasis)}</div>
                    </div>
                    <div>
                        <div className="text-muted">Market Value</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>{formatCurrency(totalMarketValue)}</div>
                    </div>
                    <div>
                        <div className="text-muted">Unrealized Gain/Loss</div>
                        <div
                            style={{ fontSize: '1.25rem', fontWeight: 600 }}
                            className={totalGainLoss >= 0 ? 'text-positive' : 'text-negative'}
                        >
                            {formatCurrency(totalGainLoss)} ({totalCostBasis > 0 ? formatPercent((totalGainLoss / totalCostBasis) * 100) : '0%'})
                        </div>
                    </div>
                </div>
            </div>

            <div className="card mb-lg">
                <div className="card-header">
                    <h2 className="card-title">Portfolio Allocation</h2>
                </div>

                {portfolioBreakdown.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">📊</div>
                        <div className="empty-state-title">No holdings to display</div>
                    </div>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Symbol</th>
                                <th className="text-right">Shares</th>
                                <th className="text-right">Price</th>
                                <th className="text-right">Market Value</th>
                                <th className="text-right">Weight</th>
                                <th className="text-right">Gain/Loss</th>
                            </tr>
                        </thead>
                        <tbody>
                            {portfolioBreakdown.map(p => {
                                const weight = totalMarketValue > 0 ? (p.marketValue / totalMarketValue) * 100 : 0;
                                const gainLossPercent = p.costBasis > 0 ? (p.gainLoss / p.costBasis) * 100 : 0;

                                return (
                                    <tr key={p.symbol}>
                                        <td className="symbol">{p.symbol}</td>
                                        <td className="text-right number">{p.shares.toLocaleString()}</td>
                                        <td className="text-right number">{formatCurrency(p.price)}</td>
                                        <td className="text-right number">{formatCurrency(p.marketValue)}</td>
                                        <td className="text-right number">{weight.toFixed(1)}%</td>
                                        <td className={`text-right ${p.gainLoss >= 0 ? 'text-positive' : 'text-negative'}`}>
                                            {formatCurrency(p.gainLoss)} ({formatPercent(gainLossPercent)})
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            <div className="card">
                <div className="card-header">
                    <h2 className="card-title">Cash Flows</h2>
                </div>

                {!performance?.cash_flows || performance.cash_flows.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">💵</div>
                        <div className="empty-state-title">No cash flows recorded</div>
                        <p>Deposits and withdrawals will appear here</p>
                    </div>
                ) : (
                    <div style={{ height: 300 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={performance.cash_flows}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
                                <XAxis
                                    dataKey="date"
                                    stroke="#9090a0"
                                    tick={{ fill: '#9090a0' }}
                                />
                                <YAxis
                                    stroke="#9090a0"
                                    tick={{ fill: '#9090a0' }}
                                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#1a1a25',
                                        border: '1px solid #2a2a3a',
                                        borderRadius: '8px'
                                    }}
                                    labelStyle={{ color: '#f0f0f5' }}
                                    formatter={(value) => [formatCurrency(value), 'Amount']}
                                />
                                <Legend />
                                <Line
                                    type="monotone"
                                    dataKey="amount"
                                    stroke="#6366f1"
                                    strokeWidth={2}
                                    dot={{ fill: '#6366f1' }}
                                    name="Cash Flow"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Performance;
