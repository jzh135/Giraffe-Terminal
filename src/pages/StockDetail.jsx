import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as api from '../api';
import TradeModal from '../components/modals/TradeModal';
import StockSplitModal from '../components/modals/StockSplitModal';
import ConfirmModal from '../components/modals/ConfirmModal';

function StockDetail() {
    const { symbol } = useParams();
    const navigate = useNavigate();
    const [holdings, setHoldings] = useState([]); // Filtered for this stock
    const [allHoldings, setAllHoldings] = useState([]); // All holdings for modal
    const [transactions, setTransactions] = useState([]);
    const [dividends, setDividends] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [price, setPrice] = useState(null);
    const [allPrices, setAllPrices] = useState({}); // For modal
    const [roles, setRoles] = useState([]); // User-defined roles
    const [themes, setThemes] = useState([]); // User-defined themes
    const [loading, setLoading] = useState(true);

    // Modal State
    const [tradeModalOpen, setTradeModalOpen] = useState(false);
    const [tradeTab, setTradeTab] = useState('buy');
    const [stockSplitModalOpen, setStockSplitModalOpen] = useState(false);

    // Edit/Delete state
    const [editTransaction, setEditTransaction] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState(null);

    // Research editing state
    const [editingResearch, setEditingResearch] = useState(false);
    const [researchForm, setResearchForm] = useState({
        theme_id: null,
        role_id: null,
        overall_rating: null,
        valuation_rating: null,
        growth_quality_rating: null,
        econ_moat_rating: null,
        leadership_rating: null,
        financial_health_rating: null
    });

    useEffect(() => {
        loadData();
    }, [symbol]);

    async function loadData() {
        try {
            const [holdingsData, transactionsData, dividendsData, priceData, allPricesData, accountsData, rolesData, themesData] = await Promise.all([
                api.getHoldings(),
                api.getTransactions({ symbol }),
                api.getDividends({ symbol }),
                api.fetchPrice(symbol),
                api.getPrices(),
                api.getAccounts(),
                api.getRoles(),
                api.getThemes()
            ]);

            // Filter holdings for this symbol
            const symbolHoldings = holdingsData.filter(h => h.symbol === symbol);
            setHoldings(symbolHoldings);
            setAllHoldings(holdingsData);
            setTransactions(transactionsData);
            setDividends(dividendsData);
            setAccounts(accountsData);
            setPrice(priceData);
            setAllPrices(allPricesData.reduce((acc, p) => ({ ...acc, [p.symbol]: p }), {}));
            setRoles(rolesData || []);
            setThemes(themesData || []);
        } catch (err) {
            console.error('Failed to load stock data:', err);
        } finally {
            setLoading(false);
        }
    }

    async function handleTradeAction(tab) {
        setTradeTab(tab);
        setTradeModalOpen(true);
    }

    async function handleBuy(data) {
        try {
            await api.createHolding(data);
            await loadData();
            setTradeModalOpen(false);
        } catch (err) {
            alert('Failed to buy stock: ' + err.message);
        }
    }

    async function handleSell(data) {
        try {
            await api.sellStock(data);
            await loadData();
            setTradeModalOpen(false);
        } catch (err) {
            alert('Failed to sell stock: ' + err.message);
        }
    }

    async function handleDividend(data) {
        try {
            await api.createDividend(data);
            await loadData();
            setTradeModalOpen(false);
        } catch (err) {
            alert('Failed to record dividend: ' + err.message);
        }
    }

    async function handleStockSplit(data) {
        try {
            await api.createStockSplit(data);
            await loadData();
            setStockSplitModalOpen(false);
        } catch (err) {
            alert('Failed to apply stock split: ' + err.message);
        }
    }

    // Edit transaction handler
    async function handleUpdateTransaction(id, data) {
        try {
            if (editTransaction.activityType === 'dividend') {
                await api.updateDividend(id, data);
            } else {
                await api.updateTransaction(id, data);
            }
            setEditTransaction(null);
            await loadData();
        } catch (err) {
            alert('Failed to update: ' + err.message);
        }
    }

    // Delete handler
    async function handleDelete() {
        if (!deleteConfirm) return;
        try {
            if (deleteConfirm.activityType === 'dividend') {
                await api.deleteDividend(deleteConfirm.id);
            } else {
                await api.deleteTransaction(deleteConfirm.id);
            }
            setDeleteConfirm(null);
            await loadData();
        } catch (err) {
            alert('Failed to delete: ' + err.message);
        }
    }

    // Research editing handlers
    function openResearchEdit() {
        setResearchForm({
            theme_id: price?.theme_id ?? null,
            role_id: price?.role_id ?? null,
            overall_rating: price?.overall_rating ?? null,
            valuation_rating: price?.valuation_rating ?? null,
            growth_quality_rating: price?.growth_quality_rating ?? null,
            econ_moat_rating: price?.econ_moat_rating ?? null,
            leadership_rating: price?.leadership_rating ?? null,
            financial_health_rating: price?.financial_health_rating ?? null
        });
        setEditingResearch(true);
    }

    async function handleSaveResearch() {
        try {
            await api.updateStockResearch(symbol, researchForm);
            setEditingResearch(false);
            await loadData();
        } catch (err) {
            alert('Failed to save research: ' + err.message);
        }
    }

    // StarRating component - inline for simplicity
    const StarRating = ({ value, onChange, readOnly = false }) => {
        const stars = [];
        for (let i = 1; i <= 5; i++) {
            const filled = value >= i;
            const halfFilled = value >= i - 0.5 && value < i;
            stars.push(
                <span
                    key={i}
                    onClick={() => !readOnly && onChange && onChange(value === i ? i - 0.5 : (value === i - 0.5 ? null : i))}
                    style={{
                        cursor: readOnly ? 'default' : 'pointer',
                        fontSize: '1.2rem',
                        color: filled || halfFilled ? '#f59e0b' : '#d1d5db'
                    }}
                    title={readOnly ? `${value || 0} stars` : `Click for ${i} stars`}
                >
                    {filled ? '★' : (halfFilled ? '⯨' : '☆')}
                </span>
            );
        }
        return <span style={{ display: 'inline-flex', gap: '2px' }}>{stars}</span>;
    };

    // Format market cap
    const formatMarketCap = (value) => {
        if (!value) return '-';
        if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
        if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
        if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
        return `$${value.toLocaleString()}`;
    };

    // Combine transactions and dividends for activity history
    const allActivity = [
        ...transactions.map(t => ({
            ...t,
            activityType: 'transaction'
        })),
        ...dividends.map(d => ({
            ...d,
            activityType: 'dividend',
            shares: '-',
            price: '-',
            total: d.amount
        }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    const totalShares = holdings.reduce((sum, h) => sum + h.shares, 0);
    const totalCostBasis = holdings.reduce((sum, h) => sum + h.cost_basis, 0);
    const currentPrice = price?.price || 0;
    const marketValue = totalShares * currentPrice;
    const gainLoss = marketValue - totalCostBasis;
    const gainLossPercent = totalCostBasis > 0 ? (gainLoss / totalCostBasis) * 100 : 0;
    const avgCost = totalShares > 0 ? totalCostBasis / totalShares : 0;

    const formatCurrency = (value) => {
        if (typeof value !== 'number') return value;
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
        // Add T00:00:00 to parse as local time, not UTC
        const date = dateStr.includes('T') ? new Date(dateStr) : new Date(dateStr + 'T00:00:00');
        return date.toLocaleDateString('en-US', {
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
                    <button className="btn btn-secondary" onClick={() => setStockSplitModalOpen(true)}>Stock Split</button>
                    <button className="btn btn-primary" onClick={() => handleTradeAction('buy')}>Trade</button>
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

            {/* Research Section */}
            <div className="card mb-lg">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ margin: 0 }}>Research</h3>
                    {!editingResearch ? (
                        <button className="btn btn-secondary btn-sm" onClick={openResearchEdit}>
                            ✏️ Edit
                        </button>
                    ) : (
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn btn-primary btn-sm" onClick={handleSaveResearch}>Save</button>
                            <button className="btn btn-secondary btn-sm" onClick={() => setEditingResearch(false)}>Cancel</button>
                        </div>
                    )}
                </div>

                {editingResearch ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '16px' }}>
                        <div>
                            <label className="form-label">Theme</label>
                            <select
                                className="form-input"
                                value={researchForm.theme_id || ''}
                                onChange={e => setResearchForm({ ...researchForm, theme_id: e.target.value ? parseInt(e.target.value) : null })}
                            >
                                <option value="">— Select —</option>
                                {themes.map(theme => (
                                    <option key={theme.id} value={theme.id}>{theme.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="form-label">Role</label>
                            <select
                                className="form-input"
                                value={researchForm.role_id || ''}
                                onChange={e => setResearchForm({ ...researchForm, role_id: e.target.value ? parseInt(e.target.value) : null })}
                            >
                                <option value="">— Select —</option>
                                {roles.map(role => (
                                    <option key={role.id} value={role.id}>{role.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="form-label">Overall Rating</label>
                            <div><StarRating value={researchForm.overall_rating} onChange={v => setResearchForm({ ...researchForm, overall_rating: v })} /></div>
                        </div>
                        <div>
                            <label className="form-label">Valuation</label>
                            <div><StarRating value={researchForm.valuation_rating} onChange={v => setResearchForm({ ...researchForm, valuation_rating: v })} /></div>
                        </div>
                        <div>
                            <label className="form-label">Growth Quality</label>
                            <div><StarRating value={researchForm.growth_quality_rating} onChange={v => setResearchForm({ ...researchForm, growth_quality_rating: v })} /></div>
                        </div>
                        <div>
                            <label className="form-label">Economic Moat</label>
                            <div><StarRating value={researchForm.econ_moat_rating} onChange={v => setResearchForm({ ...researchForm, econ_moat_rating: v })} /></div>
                        </div>
                        <div>
                            <label className="form-label">Leadership</label>
                            <div><StarRating value={researchForm.leadership_rating} onChange={v => setResearchForm({ ...researchForm, leadership_rating: v })} /></div>
                        </div>
                        <div>
                            <label className="form-label">Financial Health</label>
                            <div><StarRating value={researchForm.financial_health_rating} onChange={v => setResearchForm({ ...researchForm, financial_health_rating: v })} /></div>
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
                        <div>
                            <div className="text-muted" style={{ fontSize: '0.85rem' }}>Theme</div>
                            <div>{price?.theme_name || <span className="text-muted">-</span>}</div>
                        </div>
                        <div>
                            <div className="text-muted" style={{ fontSize: '0.85rem' }}>Role</div>
                            <div>{price?.role_name || <span className="text-muted">-</span>}</div>
                        </div>
                        <div>
                            <div className="text-muted" style={{ fontSize: '0.85rem' }}>Overall Rating</div>
                            <StarRating value={price?.overall_rating} readOnly />
                        </div>
                        <div>
                            <div className="text-muted" style={{ fontSize: '0.85rem' }}>Valuation</div>
                            <StarRating value={price?.valuation_rating} readOnly />
                        </div>
                        <div>
                            <div className="text-muted" style={{ fontSize: '0.85rem' }}>Growth Quality</div>
                            <StarRating value={price?.growth_quality_rating} readOnly />
                        </div>
                        <div>
                            <div className="text-muted" style={{ fontSize: '0.85rem' }}>Economic Moat</div>
                            <StarRating value={price?.econ_moat_rating} readOnly />
                        </div>
                        <div>
                            <div className="text-muted" style={{ fontSize: '0.85rem' }}>Leadership</div>
                            <StarRating value={price?.leadership_rating} readOnly />
                        </div>
                        <div>
                            <div className="text-muted" style={{ fontSize: '0.85rem' }}>Financial Health</div>
                            <StarRating value={price?.financial_health_rating} readOnly />
                        </div>
                    </div>
                )}
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
                        {allActivity.length === 0 ? (
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
                                        <th className="text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {allActivity.map(activity => (
                                        <tr key={`${activity.activityType}-${activity.id}`}>
                                            <td>{formatDate(activity.date)}</td>
                                            <td>
                                                <span className={`badge badge-${activity.type === 'buy' ? 'success' :
                                                    activity.type === 'sell' ? 'danger' :
                                                        activity.activityType === 'dividend' ? 'warning' : 'neutral'
                                                    }`}>
                                                    {activity.activityType === 'dividend' ? 'DIVIDEND' : activity.type.toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="text-right number">
                                                {typeof activity.shares === 'number' ? activity.shares.toLocaleString() : activity.shares}
                                            </td>
                                            <td className="text-right number">{formatCurrency(activity.price)}</td>
                                            <td className="text-right number">{formatCurrency(activity.total)}</td>
                                            <td className="text-right">
                                                <div className="action-row justify-end">
                                                    <button
                                                        className="btn btn-icon"
                                                        onClick={() => setEditTransaction(activity)}
                                                        title="Edit"
                                                    >
                                                        ✏️
                                                    </button>
                                                    <button
                                                        className="btn btn-icon text-negative"
                                                        onClick={() => setDeleteConfirm(activity)}
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
                </div>
            </div>

            {tradeModalOpen && (
                <TradeModal
                    initialTab={tradeTab}
                    initialSymbol={symbol}
                    holdings={allHoldings}
                    accounts={accounts}
                    prices={allPrices}
                    onBuy={handleBuy}
                    onSell={handleSell}
                    onDividend={handleDividend}
                    onClose={() => setTradeModalOpen(false)}
                />
            )}

            {editTransaction && (
                <TradeModal
                    editingTransaction={editTransaction}
                    holdings={allHoldings}
                    prices={allPrices}
                    onUpdate={handleUpdateTransaction}
                    onClose={() => setEditTransaction(null)}
                />
            )}

            {stockSplitModalOpen && (
                <StockSplitModal
                    symbols={[symbol]}
                    onSave={handleStockSplit}
                    onClose={() => setStockSplitModalOpen(false)}
                />
            )}

            {deleteConfirm && (
                <ConfirmModal
                    title="Delete Activity"
                    message={`Are you sure you want to delete this ${deleteConfirm.activityType === 'dividend' ? 'dividend' : 'transaction'}?`}
                    confirmText="Delete"
                    onConfirm={handleDelete}
                    onCancel={() => setDeleteConfirm(null)}
                />
            )}
        </div>
    );
}

export default StockDetail;
