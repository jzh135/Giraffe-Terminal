import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '../api';
import StockSplitModal from '../components/modals/StockSplitModal';
import { useSort } from '../hooks/useSort';

function Holdings() {
    const navigate = useNavigate();
    const [holdings, setHoldings] = useState([]);
    const [prices, setPrices] = useState({});
    const [accounts, setAccounts] = useState([]);
    const [dividends, setDividends] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedAccount, setSelectedAccount] = useState('');
    const [splitModalOpen, setSplitModalOpen] = useState(false);
    const [showSoldStocks, setShowSoldStocks] = useState(() => {
        return localStorage.getItem('showSoldStocks') === 'true';
    });

    // Persist showSoldStocks preference
    useEffect(() => {
        localStorage.setItem('showSoldStocks', showSoldStocks);
    }, [showSoldStocks]);

    useEffect(() => {
        loadData();
    }, [selectedAccount]);

    async function loadData() {
        try {
            const filters = selectedAccount ? { account_id: selectedAccount } : {};
            const [holdingsData, pricesData, accountsData, dividendsData, transactionsData] = await Promise.all([
                api.getHoldings(selectedAccount || undefined),
                api.getPrices(),
                api.getAccounts(),
                api.getDividends(filters),
                api.getTransactions(filters)
            ]);

            setHoldings(holdingsData);
            setPrices(pricesData.reduce((acc, p) => ({ ...acc, [p.symbol]: p }), {}));
            setAccounts(accountsData);
            setDividends(Array.isArray(dividendsData) ? dividendsData : []);
            setTransactions(Array.isArray(transactionsData) ? transactionsData : []);
        } catch (err) {
            console.error('Failed to load holdings:', err);
        } finally {
            setLoading(false);
        }
    }

    async function handleRefreshPrices() {
        setRefreshing(true);
        try {
            await api.refreshPrices();
            const pricesData = await api.getPrices(); // Get full data after refresh
            setPrices(pricesData.reduce((acc, p) => ({ ...acc, [p.symbol]: p }), {}));
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

    // Calculate dividends by symbol
    const dividendsBySymbol = useMemo(() => {
        const result = {};
        dividends.forEach(d => {
            if (!result[d.symbol]) result[d.symbol] = 0;
            result[d.symbol] += d.amount;
        });
        return result;
    }, [dividends]);

    // Calculate realized gains by symbol
    const realizedGainsBySymbol = useMemo(() => {
        const result = {};
        transactions.forEach(t => {
            if (t.type === 'sell' && t.realized_gain != null) {
                if (!result[t.symbol]) result[t.symbol] = 0;
                result[t.symbol] += t.realized_gain;
            }
        });
        return result;
    }, [transactions]);

    // Get all unique symbols from transactions (includes sold stocks)
    const allSymbolsFromTransactions = useMemo(() => {
        const symbols = new Set();
        transactions.forEach(t => symbols.add(t.symbol));
        return symbols;
    }, [transactions]);

    // Build enriched data for sorting
    const enrichedHoldings = useMemo(() => {
        const holdingsBySymbol = {};

        // Add current holdings
        holdings.forEach(h => {
            if (!holdingsBySymbol[h.symbol]) {
                holdingsBySymbol[h.symbol] = { symbol: h.symbol, lots: [], totalShares: 0, totalCostBasis: 0 };
            }
            holdingsBySymbol[h.symbol].lots.push(h);
            holdingsBySymbol[h.symbol].totalShares += h.shares;
            holdingsBySymbol[h.symbol].totalCostBasis += h.cost_basis;
        });

        // Add sold stocks (symbols from transactions that have 0 shares now)
        if (showSoldStocks) {
            allSymbolsFromTransactions.forEach(symbol => {
                if (!holdingsBySymbol[symbol]) {
                    holdingsBySymbol[symbol] = { symbol, lots: [], totalShares: 0, totalCostBasis: 0, isSold: true };
                }
            });
        }

        return Object.values(holdingsBySymbol).map(h => {
            const price = prices[h.symbol]?.price || 0;
            const name = prices[h.symbol]?.name || h.symbol;
            const marketValue = h.totalShares * price;
            const gainLoss = marketValue - h.totalCostBasis;
            const gainLossPercent = h.totalCostBasis > 0 ? (gainLoss / h.totalCostBasis) * 100 : 0;
            const avgCost = h.totalShares > 0 ? h.totalCostBasis / h.totalShares : 0;
            const symbolDividends = dividendsBySymbol[h.symbol] || 0;
            const symbolRealizedGain = realizedGainsBySymbol[h.symbol] || 0;
            const totalRealized = symbolDividends + symbolRealizedGain;

            return {
                ...h,
                name,
                price,
                marketValue,
                gainLoss,
                gainLossPercent,
                avgCost,
                totalRealized
            };
        });
    }, [holdings, prices, dividendsBySymbol, realizedGainsBySymbol, showSoldStocks, allSymbolsFromTransactions]);

    const { sortedData, sortConfig, requestSort, getSortIndicator } = useSort(enrichedHoldings, { key: 'marketValue', direction: 'desc' });

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

    const SortableHeader = ({ column, label, className = '' }) => (
        <th
            className={`${className} sortable ${sortConfig.key === column ? 'sorted' : ''}`}
            onClick={() => requestSort(column)}
        >
            {label}
            <span className="sort-indicator">{getSortIndicator(column)}</span>
        </th>
    );

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

                <label className="legend-item" style={{ marginLeft: 'auto' }}>
                    <input
                        type="checkbox"
                        checked={showSoldStocks}
                        onChange={(e) => setShowSoldStocks(e.target.checked)}
                    />
                    <span>Show Sold Stocks</span>
                </label>
            </div>

            {sortedData.length === 0 ? (
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
                                <SortableHeader column="symbol" label="Symbol" />
                                <SortableHeader column="totalShares" label="Shares" className="text-right" />
                                <SortableHeader column="price" label="Price" className="text-right" />
                                <SortableHeader column="marketValue" label="Market Value" className="text-right" />
                                <SortableHeader column="avgCost" label="Avg Cost" className="text-right" />
                                <SortableHeader column="gainLoss" label="Unrealized G/L" className="text-right" />
                                <SortableHeader column="totalRealized" label="Realized" className="text-right" />
                            </tr>
                        </thead>
                        <tbody>
                            {sortedData.map((row) => (
                                <tr
                                    key={row.symbol}
                                    onClick={() => navigate(`/holdings/${row.symbol}`)}
                                    style={{ cursor: 'pointer', opacity: row.isSold ? 0.6 : 1 }}
                                    className="hover-row"
                                >
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <span style={{ fontWeight: 600 }}>{row.symbol}</span>
                                            {row.isSold && <span className="badge badge-neutral" style={{ fontSize: '0.65rem' }}>SOLD</span>}
                                        </div>
                                        <div className="text-muted" style={{ fontSize: '0.85rem' }}>{row.name}</div>
                                    </td>
                                    <td className="text-right number">{row.totalShares.toLocaleString()}</td>
                                    <td className="text-right number">{formatCurrency(row.price)}</td>
                                    <td className="text-right number" style={{ fontWeight: 600 }}>{formatCurrency(row.marketValue)}</td>
                                    <td className="text-right number">{row.avgCost > 0 ? formatCurrency(row.avgCost) : '-'}</td>
                                    <td className={`text-right ${row.gainLoss >= 0 ? 'text-positive' : 'text-negative'}`}>
                                        {row.isSold ? '-' : (
                                            <>
                                                <div>{formatCurrency(row.gainLoss)}</div>
                                                <div style={{ fontSize: '0.85rem' }}>{formatPercent(row.gainLossPercent)}</div>
                                            </>
                                        )}
                                    </td>
                                    <td className={`text-right ${row.totalRealized >= 0 ? (row.totalRealized > 0 ? 'text-positive' : '') : 'text-negative'}`}>
                                        {row.totalRealized !== 0 ? formatCurrency(row.totalRealized) : '-'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {splitModalOpen && (
                <StockSplitModal
                    symbols={enrichedHoldings.map(h => h.symbol)}
                    onSave={handleStockSplit}
                    onClose={() => setSplitModalOpen(false)}
                />
            )}
        </div>
    );
}

export default Holdings;

