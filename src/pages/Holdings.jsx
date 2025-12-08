import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '../api';
import StockSplitModal from '../components/modals/StockSplitModal';

function Holdings() {
    const navigate = useNavigate();
    const [holdings, setHoldings] = useState([]);
    const [prices, setPrices] = useState({});
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedAccount, setSelectedAccount] = useState('');
    const [splitModalOpen, setSplitModalOpen] = useState(false);

    useEffect(() => {
        loadData();
    }, [selectedAccount]);

    async function loadData() {
        try {
            const [holdingsData, pricesData, accountsData] = await Promise.all([
                api.getHoldings(selectedAccount || undefined),
                api.getPrices(),
                api.getAccounts()
            ]);

            setHoldings(holdingsData);
            setPrices(pricesData.reduce((acc, p) => ({ ...acc, [p.symbol]: p }), {}));
            setAccounts(accountsData);
        } catch (err) {
            console.error('Failed to load holdings:', err);
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

    async function handleStockSplit(data) {
        try {
            await api.createStockSplit(data);
            await loadData();
            setSplitModalOpen(false);
        } catch (err) {
            console.error('Failed to apply stock split:', err);
        }
    }

    // Group by symbol
    const holdingsBySymbol = {};
    holdings.forEach(h => {
        if (!holdingsBySymbol[h.symbol]) {
            holdingsBySymbol[h.symbol] = {
                symbol: h.symbol,
                lots: [],
                totalShares: 0,
                totalCostBasis: 0
            };
        }
        holdingsBySymbol[h.symbol].lots.push(h);
        holdingsBySymbol[h.symbol].totalShares += h.shares;
        holdingsBySymbol[h.symbol].totalCostBasis += h.cost_basis;
    });

    // Sort by market value (descending)
    const sortedSymbols = Object.values(holdingsBySymbol).sort((a, b) => {
        const aValue = a.totalShares * (prices[a.symbol]?.price || 0);
        const bValue = b.totalShares * (prices[b.symbol]?.price || 0);
        return bValue - aValue;
    });

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
                    <h1 className="page-title">Holdings</h1>
                    <p className="page-subtitle">All your stock positions across accounts</p>
                </div>
                <div className="action-row">
                    <button className="btn btn-secondary" onClick={() => setSplitModalOpen(true)}>
                        ✂️ Stock Split
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={handleRefreshPrices}
                        disabled={refreshing}
                    >
                        {refreshing ? '⏳ Refreshing...' : '🔄 Refresh Prices'}
                    </button>
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

            {sortedSymbols.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <div className="empty-state-icon">📈</div>
                        <div className="empty-state-title">No holdings yet</div>
                        <p>Add stocks to your accounts to see them here</p>
                    </div>
                </div>
            ) : (
                <div className="card">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Symbol</th>
                                <th className="text-right">Shares</th>
                                <th className="text-right">Price</th>
                                <th className="text-right">Market Value</th>
                                <th className="text-right">Avg Cost</th>
                                <th className="text-right">Total Gain/Loss</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedSymbols.map(({ symbol, totalShares, totalCostBasis }) => {
                                const price = prices[symbol]?.price || 0;
                                const name = prices[symbol]?.name || symbol;
                                const marketValue = totalShares * price;
                                const gainLoss = marketValue - totalCostBasis;
                                const gainLossPercent = totalCostBasis > 0 ? (gainLoss / totalCostBasis) * 100 : 0;
                                const avgCost = totalShares > 0 ? totalCostBasis / totalShares : 0;

                                return (
                                    <tr
                                        key={symbol}
                                        onClick={() => navigate(`/holdings/${symbol}`)}
                                        style={{ cursor: 'pointer' }}
                                        className="hover-row"
                                    >
                                        <td>
                                            <div style={{ fontWeight: 600 }}>{symbol}</div>
                                            <div className="text-muted" style={{ fontSize: '0.85rem' }}>{name}</div>
                                        </td>
                                        <td className="text-right number">{totalShares.toLocaleString()}</td>
                                        <td className="text-right number">{formatCurrency(price)}</td>
                                        <td className="text-right number" style={{ fontWeight: 600 }}>{formatCurrency(marketValue)}</td>
                                        <td className="text-right number">{formatCurrency(avgCost)}</td>
                                        <td className={`text-right ${gainLoss >= 0 ? 'text-positive' : 'text-negative'}`}>
                                            <div>{formatCurrency(gainLoss)}</div>
                                            <div style={{ fontSize: '0.85rem' }}>{formatPercent(gainLossPercent)}</div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {splitModalOpen && (
                <StockSplitModal
                    symbols={Object.keys(holdingsBySymbol)}
                    onSave={handleStockSplit}
                    onClose={() => setSplitModalOpen(false)}
                />
            )}
        </div>
    );
}

export default Holdings;
