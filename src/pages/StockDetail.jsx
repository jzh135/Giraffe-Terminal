import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as api from '../api';

function StockDetail() {
    const { symbol } = useParams();
    const navigate = useNavigate();
    const [holdings, setHoldings] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [price, setPrice] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, [symbol]);

    async function loadData() {
        try {
            const [holdingsData, transactionsData, priceData] = await Promise.all([
                api.getHoldings(),
                api.getTransactions({ symbol }),
                api.fetchPrice(symbol) // Ensure we get the latest price
            ]);

            // Filter holdings for this symbol
            const symbolHoldings = holdingsData.filter(h => h.symbol === symbol);
            setHoldings(symbolHoldings);
            setTransactions(transactionsData);
            setPrice(priceData);
        } catch (err) {
            console.error('Failed to load stock data:', err);
        } finally {
            setLoading(false);
        }
    }

    const totalShares = holdings.reduce((sum, h) => sum + h.shares, 0);
    const totalCostBasis = holdings.reduce((sum, h) => sum + h.cost_basis, 0);
    const currentPrice = price?.price || 0;
    const marketValue = totalShares * currentPrice;
    const gainLoss = marketValue - totalCostBasis;
    const gainLossPercent = totalCostBasis > 0 ? (gainLoss / totalCostBasis) * 100 : 0;
    const avgCost = totalShares > 0 ? totalCostBasis / totalShares : 0;

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

    const formatDate = (dateStr) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
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
                    <button onClick={() => navigate('/holdings')} className="btn btn-text">
                        ← Back to Holdings
                    </button>
                    <h1 className="page-title" style={{ marginTop: '0.5rem' }}>
                        {symbol} <span className="text-muted" style={{ fontSize: '1rem', fontWeight: 'normal' }}>{price?.name}</span>
                    </h1>
                </div>
                <div className="action-row">
                    {/* Add actions here if needed */}
                </div>
            </div>

            {/* Summary Card */}
            <div className="card mb-lg">
                <div className="stats-grid">
                    <div>
                        <div className="text-muted">Market Value</div>
                        <div className="stat-value">{formatCurrency(marketValue)}</div>
                    </div>
                    <div>
                        <div className="text-muted">Total Shares</div>
                        <div className="stat-value">{totalShares.toLocaleString()}</div>
                    </div>
                    <div>
                        <div className="text-muted">Total Gain/Loss</div>
                        <div className={`stat-value ${gainLoss >= 0 ? 'text-positive' : 'text-negative'}`}>
                            {formatCurrency(gainLoss)} ({formatPercent(gainLossPercent)})
                        </div>
                    </div>
                    <div>
                        <div className="text-muted">Avg Cost</div>
                        <div className="stat-value">{formatCurrency(avgCost)}</div>
                    </div>
                    <div>
                        <div className="text-muted">Current Price</div>
                        <div className="stat-value">{formatCurrency(currentPrice)}</div>
                    </div>
                </div>
            </div>

            <div className="grid grid-2">
                {/* Lots Section */}
                <div>
                    <h3 className="section-title">Tax Lots</h3>
                    <div className="card">
                        {holdings.length === 0 ? (
                            <p className="text-muted">No current holdings.</p>
                        ) : (
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Account</th>
                                        <th className="text-right">Shares</th>
                                        <th className="text-right">Cost</th>
                                        <th className="text-right">Date</th>
                                        <th className="text-right">Gain/Loss</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {holdings.map(lot => {
                                        const lotValue = lot.shares * currentPrice;
                                        const lotGainLoss = lotValue - lot.cost_basis;
                                        const lotGainLossPercent = lot.cost_basis > 0 ? (lotGainLoss / lot.cost_basis) * 100 : 0;

                                        return (
                                            <tr key={lot.id}>
                                                <td>{lot.account_name}</td>
                                                <td className="text-right number">{lot.shares.toLocaleString()}</td>
                                                <td className="text-right number">{formatCurrency(lot.cost_basis)}</td>
                                                <td className="text-right">{formatDate(lot.purchase_date)}</td>
                                                <td className={`text-right ${lotGainLoss >= 0 ? 'text-positive' : 'text-negative'}`}>
                                                    {formatCurrency(lotGainLoss)}<br />
                                                    <small>{formatPercent(lotGainLossPercent)}</small>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* Activity Section */}
                <div>
                    <h3 className="section-title">Activity History</h3>
                    <div className="card">
                        {transactions.length === 0 ? (
                            <p className="text-muted">No activity found.</p>
                        ) : (
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Type</th>
                                        <th className="text-right">Shares</th>
                                        <th className="text-right">Price</th>
                                        <th className="text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {transactions.map(tx => (
                                        <tr key={tx.id}>
                                            <td>{formatDate(tx.date)}</td>
                                            <td>
                                                <span className={`badge badge-${tx.type === 'buy' ? 'success' : tx.type === 'sell' ? 'danger' : 'neutral'}`}>
                                                    {tx.type.toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="text-right number">{tx.shares.toLocaleString()}</td>
                                            <td className="text-right number">{formatCurrency(tx.price)}</td>
                                            <td className="text-right number">{formatCurrency(tx.total)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default StockDetail;
