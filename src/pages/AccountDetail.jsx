import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
    getAccount, getHoldings, getPrices, getTransactions, getCashMovements, getDividends,
    createHolding, sellStock, createCashMovement, createDividend, deleteHolding
} from '../api';
import TradeModal from '../components/modals/TradeModal';
import CashMovementModal from '../components/modals/CashMovementModal';
import DividendModal from '../components/modals/DividendModal';
import ConfirmModal from '../components/modals/ConfirmModal';

function AccountDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [account, setAccount] = useState(null);
    const [holdings, setHoldings] = useState([]);
    const [prices, setPrices] = useState({});
    const [transactions, setTransactions] = useState([]);
    const [cashMovements, setCashMovements] = useState([]);
    const [dividends, setDividends] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('holdings');

    // Modal States
    // Modal States
    const [tradeModalOpen, setTradeModalOpen] = useState(false);
    const [tradeTab, setTradeTab] = useState('buy'); // 'buy' or 'sell'
    const [cashModalOpen, setCashModalOpen] = useState(false);
    const [dividendModalOpen, setDividendModalOpen] = useState(false);
    const [selectedHolding, setSelectedHolding] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState(null);

    useEffect(() => {
        loadData();
    }, [id]);

    async function loadData() {
        try {
            const [accountData, holdingsData, pricesData, txData, cashData, divData] = await Promise.all([
                getAccount(id),
                getHoldings(id),
                getPrices(),
                getTransactions({ account_id: id }),
                getCashMovements({ account_id: id }),
                getDividends({ account_id: id })
            ]);

            setAccount(accountData);
            setHoldings(Array.isArray(holdingsData) ? holdingsData : []);
            setPrices(Array.isArray(pricesData) ? pricesData.reduce((acc, p) => ({ ...acc, [p.symbol]: p }), {}) : {});
            setTransactions(Array.isArray(txData) ? txData : []);
            setCashMovements(Array.isArray(cashData) ? cashData : []);
            setDividends(Array.isArray(divData) ? divData : []);
        } catch (err) {
            console.error('AccountDetail: Data fetch failed', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    // Handlers
    async function handleAddHolding(data) {
        try {
            await createHolding({ ...data, account_id: id });
            await loadData();
        } catch (err) {
            alert('Failed to add holding: ' + err.message);
        }
    }

    async function handleSell(data) {
        try {
            await sellStock({ ...data, account_id: id });
            await loadData();
        } catch (err) {
            alert('Failed to sell stock: ' + err.message);
        }
    }

    async function handleCashMovement(data) {
        try {
            await createCashMovement({ ...data, account_id: id });
            await loadData();
        } catch (err) {
            alert('Failed to add cash movement: ' + err.message);
        }
    }

    async function handleDividend(data) {
        try {
            await createDividend({ ...data, account_id: id });
            await loadData();
        } catch (err) {
            alert('Failed to add dividend: ' + err.message);
        }
    }

    async function handleDeleteHolding() {
        if (!deleteConfirm) return;
        try {
            await deleteHolding(deleteConfirm.id);
            await loadData();
            setDeleteConfirm(null);
        } catch (err) {
            alert('Failed to delete holding: ' + err.message);
        }
    }

    function openSellModal(holding) {
        setSelectedHolding(holding);
        setTradeTab('sell');
        setTradeModalOpen(true);
    }

    // Aggregation Logic
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

    const aggregatedHoldings = Object.values(holdingsBySymbol).sort((a, b) => {
        const aValue = a.totalShares * (prices[a.symbol]?.price || 0);
        const bValue = b.totalShares * (prices[b.symbol]?.price || 0);
        return bValue - aValue;
    });

    // Cash Activity
    const safeCashMovements = Array.isArray(cashMovements) ? cashMovements : [];
    const safeDividends = Array.isArray(dividends) ? dividends : [];

    const combinedCashActivity = [
        ...safeCashMovements.map(m => ({ ...m, category: 'cash', sortDate: m.date })),
        ...safeDividends.map(d => ({ ...d, category: 'dividend', type: 'dividend', sortDate: d.date }))
    ].sort((a, b) => new Date(b.sortDate) - new Date(a.sortDate));

    // Calculate account totals
    const marketValue = holdings.reduce((sum, h) => {
        const price = prices[h.symbol]?.price || 0;
        return sum + (h.shares * price);
    }, 0);
    const totalValue = marketValue + (account ? account.cash_balance : 0);

    const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
    const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString();

    const formatPercent = (val) => new Intl.NumberFormat('en-US', {
        style: 'percent',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(val / 100);

    if (loading) return <div className="loading"><div className="spinner"></div></div>;
    if (error) return <div className="card"><div className="text-negative">Error: {error}</div></div>;
    if (!account) return <div className="card">Account not found</div>;

    return (
        <div>
            <div className="page-header">
                <div>
                    <Link to="/accounts" className="text-muted" style={{ textDecoration: 'none' }}>
                        ← Back to Accounts
                    </Link>
                    <h1 className="page-title mt-sm">{account.name}</h1>
                    <p className="page-subtitle">{account.institution || account.type}</p>
                </div>
                <div className="action-row">
                    <button className="btn btn-primary" onClick={() => {
                        setSelectedHolding(null);
                        setTradeTab('buy');
                        setTradeModalOpen(true);
                    }}>
                        Trade
                    </button>
                    <button className="btn btn-secondary" onClick={() => {
                        setCashModalOpen(true);
                    }}>
                        Cash Movement
                    </button>
                </div>
            </div>

            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-label">Total Value</div>
                    <div className="stat-value">{formatCurrency(totalValue)}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Holdings Value</div>
                    <div className="stat-value">{formatCurrency(marketValue)}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Cash Balance</div>
                    <div className={`stat-value ${account.cash_balance < 0 ? 'text-negative' : ''}`}>
                        {formatCurrency(account.cash_balance)}
                    </div>
                </div>
            </div>

            <div className="tabs">
                {['holdings', 'lots', 'trade', 'cash'].map(tab => (
                    <button
                        key={tab}
                        className={`tab ${activeTab === tab ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab)}
                    >
                        {tab === 'cash' ? 'Cash Movement' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                ))}
            </div>

            {activeTab === 'holdings' && (
                <div className="card">
                    {aggregatedHoldings.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">📈</div>
                            <div className="empty-state-title">No holdings yet</div>
                            <p>Go to the Trade tab to buy stocks</p>
                        </div>
                    ) : (
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
                                {aggregatedHoldings.map(({ symbol, totalShares, totalCostBasis }) => {
                                    const price = prices[symbol]?.price || 0;
                                    const marketValue = totalShares * price;
                                    const gainLoss = marketValue - totalCostBasis;
                                    const gainLossPercent = totalCostBasis > 0 ? (gainLoss / totalCostBasis) * 100 : 0;
                                    const avgCost = totalShares > 0 ? totalCostBasis / totalShares : 0;
                                    const name = prices[symbol]?.name || symbol;

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
                    )}
                </div>
            )}

            {activeTab === 'lots' && (
                <div className="card">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Symbol</th>
                                <th className="text-right">Shares</th>
                                <th className="text-right">Purchase Date</th>
                                <th className="text-right">Cost Basis</th>
                                <th className="text-right">Gain/Loss</th>
                                <th className="text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {holdings.map(lot => {
                                const price = prices[lot.symbol]?.price || 0;
                                const marketValue = lot.shares * price;
                                const gainLoss = marketValue - lot.cost_basis;

                                return (
                                    <tr key={lot.id}>
                                        <td style={{ fontWeight: 500 }}>{lot.symbol}</td>
                                        <td className="text-right number">{lot.shares}</td>
                                        <td className="text-right">{formatDate(lot.purchase_date)}</td>
                                        <td className="text-right number">{formatCurrency(lot.cost_basis)}</td>
                                        <td className={`text-right number ${gainLoss >= 0 ? 'text-positive' : 'text-negative'}`}>
                                            {formatCurrency(gainLoss)}
                                        </td>
                                        <td className="text-right">
                                            <div className="action-row justify-end">
                                                <button
                                                    className="btn btn-icon"
                                                    onClick={() => openSellModal(lot)}
                                                    title="Sell"
                                                >
                                                    📤
                                                </button>
                                                <button
                                                    className="btn btn-icon"
                                                    onClick={() => setDeleteConfirm(lot)}
                                                    title="Delete"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {activeTab === 'trade' && (
                <div>
                    <div className="card">
                        {transactions.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-state-icon">🤝</div>
                                <div className="empty-state-title">No trades yet</div>
                            </div>
                        ) : (
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Type</th>
                                        <th>Symbol</th>
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
                                                <span className={`badge ${tx.type === 'buy' ? 'badge-success' : 'badge-danger'}`}>
                                                    {tx.type.toUpperCase()}
                                                </span>
                                            </td>
                                            <td style={{ fontWeight: 500 }}>{tx.symbol}</td>
                                            <td className="text-right number">{tx.shares}</td>
                                            <td className="text-right number">{formatCurrency(tx.price)}</td>
                                            <td className="text-right number">{formatCurrency(tx.total)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'cash' && (
                <div>
                    <div className="card">
                        {combinedCashActivity.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-state-icon">💸</div>
                                <div className="empty-state-title">No cash activity</div>
                            </div>
                        ) : (
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Type</th>
                                        <th>Description</th>
                                        <th className="text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {combinedCashActivity.map((item, idx) => (
                                        <tr key={`${item.category}-${item.id || idx}`}>
                                            <td>{formatDate(item.sortDate)}</td>
                                            <td>
                                                <span className="badge badge-neutral">
                                                    {item.type.toUpperCase()}
                                                </span>
                                            </td>
                                            <td>
                                                {item.category === 'dividend' ? (
                                                    <span>Dividend from <strong>{item.symbol}</strong></span>
                                                ) : (
                                                    item.notes || '-'
                                                )}
                                            </td>
                                            <td className={`text-right number ${item.amount >= 0 ? 'text-positive' : 'text-negative'}`}>
                                                {formatCurrency(item.amount)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* Modals */}
            {/* Modals */}
            {tradeModalOpen && (
                <TradeModal
                    initialTab={tradeTab}
                    initialHolding={selectedHolding}
                    holdings={holdings}
                    prices={prices}
                    onBuy={handleAddHolding}
                    onSell={handleSell}
                    onDividend={handleDividend}
                    onClose={() => {
                        setTradeModalOpen(false);
                        setSelectedHolding(null);
                    }}
                />
            )}

            {cashModalOpen && (
                <CashMovementModal
                    onSave={handleCashMovement}
                    onClose={() => setCashModalOpen(false)}
                />
            )}

            {deleteConfirm && (
                <ConfirmModal
                    title="Delete Holding"
                    message={`Are you sure you want to delete this ${deleteConfirm.symbol} lot?`}
                    confirmText="Delete"
                    onConfirm={handleDeleteHolding}
                    onCancel={() => setDeleteConfirm(null)}
                />
            )}
        </div>
    );
}

export default AccountDetail;
