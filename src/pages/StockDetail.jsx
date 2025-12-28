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
  const [loading, setLoading] = useState(true);

  // Modal State
  const [tradeModalOpen, setTradeModalOpen] = useState(false);
  const [tradeTab, setTradeTab] = useState('buy');
  const [stockSplitModalOpen, setStockSplitModalOpen] = useState(false);

  // Edit/Delete state
  const [editTransaction, setEditTransaction] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Research panel expansion
  const [researchExpanded, setResearchExpanded] = useState(false);

  // SEC 10-K Filings
  const [secFilings, setSecFilings] = useState([]);
  const [sec10QFilings, setSec10QFilings] = useState([]);
  const [secLoading, setSecLoading] = useState(false);
  const [secError, setSecError] = useState(null);
  const [secExpanded, setSecExpanded] = useState(false);
  const [secTab, setSecTab] = useState('10-K'); // '10-K' or '10-Q'

  useEffect(() => {
    loadData();
  }, [symbol]);

  async function loadData() {
    try {
      const [
        holdingsData,
        transactionsData,
        dividendsData,
        priceData,
        allPricesData,
        accountsData,
      ] = await Promise.all([
        api.getHoldings(),
        api.getTransactions({ symbol }),
        api.getDividends({ symbol }),
        api.fetchPrice(symbol),
        api.getPrices(),
        api.getAccounts(),
      ]);

      // Filter holdings for this symbol
      const symbolHoldings = holdingsData.filter((h) => h.symbol === symbol);
      setHoldings(symbolHoldings);
      setAllHoldings(holdingsData);
      setTransactions(transactionsData);
      setDividends(dividendsData);
      setAccounts(accountsData);
      setPrice(priceData);
      setAllPrices(allPricesData.reduce((acc, p) => ({ ...acc, [p.symbol]: p }), {}));
    } catch (err) {
      console.error('Failed to load stock data:', err);
    } finally {
      setLoading(false);
    }
  }

  // Load SEC 10-K filings
  async function loadSecFilings() {
    if (secFilings.length > 0 && sec10QFilings.length > 0) return; // Already loaded
    setSecLoading(true);
    setSecError(null);
    try {
      const [data10K, data10Q] = await Promise.all([
        api.getSecFilings(symbol, { form: '10-K', limit: 5 }),
        api.getSecFilings(symbol, { form: '10-Q', limit: 5 })
      ]);
      setSecFilings(data10K.filings || []);
      setSec10QFilings(data10Q.filings || []);
    } catch (err) {
      console.error('Failed to load SEC filings:', err);
      setSecError(err.message);
    } finally {
      setSecLoading(false);
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

  // StarRating component - inline for simplicity
  const StarRating = ({ value, onChange, readOnly = false }) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      const filled = value >= i;
      const halfFilled = value >= i - 0.5 && value < i;
      stars.push(
        <span
          key={i}
          onClick={() =>
            !readOnly && onChange && onChange(value === i ? i - 0.5 : value === i - 0.5 ? null : i)
          }
          style={{
            cursor: readOnly ? 'default' : 'pointer',
            fontSize: '1.2rem',
            color: filled || halfFilled ? '#f59e0b' : '#d1d5db',
          }}
          title={readOnly ? `${value || 0} stars` : `Click for ${i} stars`}
        >
          {filled ? '★' : halfFilled ? '⯨' : '☆'}
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
    ...transactions.map((t) => ({
      ...t,
      activityType: 'transaction',
    })),
    ...dividends.map((d) => ({
      ...d,
      activityType: 'dividend',
      shares: '-',
      price: '-',
      total: d.amount,
    })),
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
      minimumFractionDigits: 2,
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
      day: 'numeric',
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
            {symbol}{' '}
            <span className="text-muted" style={{ fontSize: '1rem', fontWeight: 'normal' }}>
              {price?.name}
            </span>
          </h1>
        </div>
        <div className="action-row">
          <button className="btn btn-secondary" onClick={() => setStockSplitModalOpen(true)}>
            Stock Split
          </button>
          <button className="btn btn-primary" onClick={() => handleTradeAction('buy')}>
            Trade
          </button>
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

      {/* Research Section - Clickable to go to dedicated page */}
      <div
        className="card mb-lg"
        style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = '#6366f1';
          e.currentTarget.style.boxShadow = '0 4px 20px rgba(99, 102, 241, 0.2)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = '';
          e.currentTarget.style.boxShadow = '';
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
          }}
          onClick={() => navigate(`/holdings/${symbol}/research`)}
        >
          <h3 style={{ margin: 0 }}>📊 Research</h3>
          <span className="btn btn-secondary btn-sm" style={{ pointerEvents: 'none' }}>
            View & Edit →
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '16px',
          }}
          onClick={() => navigate(`/holdings/${symbol}/research`)}
        >
          <div>
            <div className="text-muted" style={{ fontSize: '0.85rem' }}>
              Theme
            </div>
            <div>{price?.theme_name || <span className="text-muted">-</span>}</div>
          </div>
          <div>
            <div className="text-muted" style={{ fontSize: '0.85rem' }}>
              Role
            </div>
            <div>{price?.role_name || <span className="text-muted">-</span>}</div>
          </div>
          <div>
            <div className="text-muted" style={{ fontSize: '0.85rem' }}>
              Overall Rating
            </div>
            <StarRating value={price?.overall_rating} readOnly />
          </div>
          <div>
            <div className="text-muted" style={{ fontSize: '0.85rem' }}>
              Valuation
            </div>
            <StarRating value={price?.valuation_rating} readOnly />
          </div>
          <div>
            <div className="text-muted" style={{ fontSize: '0.85rem' }}>
              Growth Quality
            </div>
            <StarRating value={price?.growth_quality_rating} readOnly />
          </div>
          <div>
            <div className="text-muted" style={{ fontSize: '0.85rem' }}>
              Economic Moat
            </div>
            <StarRating value={price?.econ_moat_rating} readOnly />
          </div>
          <div>
            <div className="text-muted" style={{ fontSize: '0.85rem' }}>
              Leadership
            </div>
            <StarRating value={price?.leadership_rating} readOnly />
          </div>
          <div>
            <div className="text-muted" style={{ fontSize: '0.85rem' }}>
              Financial Health
            </div>
            <StarRating value={price?.financial_health_rating} readOnly />
          </div>
          {price?.target_median_price > 0 && (
            <div>
              <div className="text-muted" style={{ fontSize: '0.85rem' }}>
                Median Target
              </div>
              <div>
                {formatCurrency(price.target_median_price)}{' '}
                <span
                  className={
                    (price.target_median_price - currentPrice) / currentPrice >= 0
                      ? 'text-positive'
                      : 'text-negative'
                  }
                >
                  {formatPercent(((price.target_median_price - currentPrice) / currentPrice) * 100)}
                </span>
              </div>
            </div>
          )}
          {price?.buy_target_price > 0 && (
            <div>
              <div className="text-muted" style={{ fontSize: '0.85rem' }}>
                Buy Target
              </div>
              <div style={{ color: '#10b981' }}>
                {formatCurrency(price.buy_target_price)}{' '}
                <span
                  className={
                    (price.buy_target_price - currentPrice) / currentPrice >= 0
                      ? 'text-positive'
                      : 'text-negative'
                  }
                >
                  {formatPercent(((price.buy_target_price - currentPrice) / currentPrice) * 100)}
                </span>
              </div>
            </div>
          )}
          {price?.sell_target_price > 0 && (
            <div>
              <div className="text-muted" style={{ fontSize: '0.85rem' }}>
                Sell Target
              </div>
              <div style={{ color: '#ef4444' }}>
                {formatCurrency(price.sell_target_price)}{' '}
                <span
                  className={
                    (price.sell_target_price - currentPrice) / currentPrice >= 0
                      ? 'text-positive'
                      : 'text-negative'
                  }
                >
                  {formatPercent(((price.sell_target_price - currentPrice) / currentPrice) * 100)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Expand/Collapse Button */}
        <div
          style={{
            marginTop: '16px',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            paddingTop: '12px',
          }}
        >
          <button
            className="btn btn-secondary"
            onClick={(e) => {
              e.stopPropagation();
              setResearchExpanded(!researchExpanded);
            }}
            style={{ width: '100%' }}
          >
            {researchExpanded ? '▲ Collapse Notes' : '▼ Expand Notes'}
          </button>
        </div>

        {/* Expanded Notes Section */}
        {researchExpanded && (
          <div style={{ marginTop: '16px' }} onClick={(e) => e.stopPropagation()}>
            {/* Investment Thesis */}
            {price?.overall_notes && (
              <div
                style={{
                  marginBottom: '16px',
                  padding: '12px',
                  background: 'rgba(99, 102, 241, 0.1)',
                  borderRadius: '8px',
                }}
              >
                <div
                  className="text-muted"
                  style={{
                    fontSize: '0.85rem',
                    marginBottom: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  ⭐ Investment Thesis
                </div>
                <div style={{ fontSize: '0.9rem', color: '#e5e7eb', whiteSpace: 'pre-wrap' }}>
                  {price.overall_notes}
                </div>
              </div>
            )}

            {/* Valuation Notes */}
            {price?.valuation_notes && (
              <div
                style={{
                  marginBottom: '12px',
                  padding: '12px',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: '8px',
                }}
              >
                <div
                  className="text-muted"
                  style={{
                    fontSize: '0.85rem',
                    marginBottom: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  💰 Valuation Notes
                </div>
                <div style={{ fontSize: '0.9rem', color: '#d1d5db', whiteSpace: 'pre-wrap' }}>
                  {price.valuation_notes}
                </div>
              </div>
            )}

            {/* Growth Quality Notes */}
            {price?.growth_quality_notes && (
              <div
                style={{
                  marginBottom: '12px',
                  padding: '12px',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: '8px',
                }}
              >
                <div
                  className="text-muted"
                  style={{
                    fontSize: '0.85rem',
                    marginBottom: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  📈 Growth Quality Notes
                </div>
                <div style={{ fontSize: '0.9rem', color: '#d1d5db', whiteSpace: 'pre-wrap' }}>
                  {price.growth_quality_notes}
                </div>
              </div>
            )}

            {/* Economic Moat Notes */}
            {price?.econ_moat_notes && (
              <div
                style={{
                  marginBottom: '12px',
                  padding: '12px',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: '8px',
                }}
              >
                <div
                  className="text-muted"
                  style={{
                    fontSize: '0.85rem',
                    marginBottom: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  🏰 Economic Moat Notes
                </div>
                <div style={{ fontSize: '0.9rem', color: '#d1d5db', whiteSpace: 'pre-wrap' }}>
                  {price.econ_moat_notes}
                </div>
              </div>
            )}

            {/* Leadership Notes */}
            {price?.leadership_notes && (
              <div
                style={{
                  marginBottom: '12px',
                  padding: '12px',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: '8px',
                }}
              >
                <div
                  className="text-muted"
                  style={{
                    fontSize: '0.85rem',
                    marginBottom: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  👔 Leadership Notes
                </div>
                <div style={{ fontSize: '0.9rem', color: '#d1d5db', whiteSpace: 'pre-wrap' }}>
                  {price.leadership_notes}
                </div>
              </div>
            )}

            {/* Financial Health Notes */}
            {price?.financial_health_notes && (
              <div
                style={{
                  marginBottom: '12px',
                  padding: '12px',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: '8px',
                }}
              >
                <div
                  className="text-muted"
                  style={{
                    fontSize: '0.85rem',
                    marginBottom: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  🏥 Financial Health Notes
                </div>
                <div style={{ fontSize: '0.9rem', color: '#d1d5db', whiteSpace: 'pre-wrap' }}>
                  {price.financial_health_notes}
                </div>
              </div>
            )}

            {/* No notes message */}
            {!price?.overall_notes &&
              !price?.valuation_notes &&
              !price?.growth_quality_notes &&
              !price?.econ_moat_notes &&
              !price?.leadership_notes &&
              !price?.financial_health_notes && (
                <div
                  className="text-muted"
                  style={{ textAlign: 'center', padding: '16px', fontSize: '0.9rem' }}
                >
                  No research notes added yet. Click "View & Edit" to add notes.
                </div>
              )}
          </div>
        )}
      </div>

      {/* SEC Filings Section */}
      <div className="card mb-lg">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
          }}
          onClick={() => {
            setSecExpanded(!secExpanded);
            if (!secExpanded) loadSecFilings();
          }}
        >
          <h3 style={{ margin: 0 }}>📄 SEC Filings</h3>
          <span className="btn btn-secondary btn-sm" style={{ pointerEvents: 'none' }}>
            {secExpanded ? '▲ Collapse' : '▼ Expand'}
          </span>
        </div>

        {secExpanded && (
          <div style={{ marginTop: '16px' }}>
            {/* Tab Buttons */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <button
                className={`btn ${secTab === '10-K' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={(e) => { e.stopPropagation(); setSecTab('10-K'); }}
              >
                10-K (Annual)
              </button>
              <button
                className={`btn ${secTab === '10-Q' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={(e) => { e.stopPropagation(); setSecTab('10-Q'); }}
              >
                10-Q (Quarterly)
              </button>
            </div>

            {secLoading && (
              <div className="text-muted" style={{ textAlign: 'center', padding: '20px' }}>
                <div className="spinner" style={{ margin: '0 auto 10px' }}></div>
                Loading SEC filings...
              </div>
            )}

            {secError && (
              <div style={{
                padding: '12px',
                background: 'rgba(239, 68, 68, 0.1)',
                borderRadius: '8px',
                color: '#ef4444'
              }}>
                ⚠️ {secError}
                <div className="text-muted" style={{ fontSize: '0.85rem', marginTop: '4px' }}>
                  This may be an ETF or the ticker is not found in SEC records.
                </div>
              </div>
            )}

            {!secLoading && !secError && (
              <>
                {/* 10-K Tab */}
                {secTab === '10-K' && (
                  <>
                    {secFilings.length === 0 ? (
                      <div className="text-muted" style={{ textAlign: 'center', padding: '16px' }}>
                        No 10-K filings found for {symbol}.
                      </div>
                    ) : (
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Filing Date</th>
                            <th>Form</th>
                            <th>Document</th>
                            <th className="text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {secFilings.map((filing, idx) => (
                            <tr key={idx}>
                              <td>{formatDate(filing.filingDate)}</td>
                              <td>
                                <span className="badge badge-neutral">{filing.form}</span>
                              </td>
                              <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {filing.primaryDocument}
                              </td>
                              <td className="text-right">
                                <div className="action-row justify-end">
                                  <a
                                    href={filing.documentUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-secondary btn-sm"
                                    title="View on SEC"
                                  >
                                    🔗 View
                                  </a>
                                  <a
                                    href={filing.indexUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-secondary btn-sm"
                                    title="View all filing documents"
                                  >
                                    📁 Index
                                  </a>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </>
                )}

                {/* 10-Q Tab */}
                {secTab === '10-Q' && (
                  <>
                    {sec10QFilings.length === 0 ? (
                      <div className="text-muted" style={{ textAlign: 'center', padding: '16px' }}>
                        No 10-Q filings found for {symbol}.
                      </div>
                    ) : (
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Filing Date</th>
                            <th>Form</th>
                            <th>Document</th>
                            <th className="text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sec10QFilings.map((filing, idx) => (
                            <tr key={idx}>
                              <td>{formatDate(filing.filingDate)}</td>
                              <td>
                                <span className="badge badge-warning">{filing.form}</span>
                              </td>
                              <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {filing.primaryDocument}
                              </td>
                              <td className="text-right">
                                <div className="action-row justify-end">
                                  <a
                                    href={filing.documentUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-secondary btn-sm"
                                    title="View on SEC"
                                  >
                                    🔗 View
                                  </a>
                                  <a
                                    href={filing.indexUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-secondary btn-sm"
                                    title="View all filing documents"
                                  >
                                    📁 Index
                                  </a>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </>
                )}
              </>
            )}

            <div className="text-muted" style={{ fontSize: '0.8rem', marginTop: '12px', textAlign: 'center' }}>
              Data from SEC EDGAR. Click 🔗 View to read the full filing on SEC.gov.
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
                  {holdings.map((lot) => {
                    const lotValue = lot.shares * currentPrice;
                    const lotGainLoss = lotValue - lot.cost_basis;
                    const lotGainLossPercent =
                      lot.cost_basis > 0 ? (lotGainLoss / lot.cost_basis) * 100 : 0;

                    return (
                      <tr key={lot.id}>
                        <td>{lot.account_name}</td>
                        <td className="text-right number">{lot.shares.toLocaleString()}</td>
                        <td className="text-right number">{formatCurrency(lot.cost_basis)}</td>
                        <td className="text-right">{formatDate(lot.purchase_date)}</td>
                        <td
                          className={`text-right ${lotGainLoss >= 0 ? 'text-positive' : 'text-negative'}`}
                        >
                          {formatCurrency(lotGainLoss)}
                          <br />
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
                  {allActivity.map((activity) => (
                    <tr key={`${activity.activityType}-${activity.id}`}>
                      <td>{formatDate(activity.date)}</td>
                      <td>
                        <span
                          className={`badge badge-${activity.type === 'buy'
                            ? 'success'
                            : activity.type === 'sell'
                              ? 'danger'
                              : activity.activityType === 'dividend'
                                ? 'warning'
                                : 'neutral'
                            }`}
                        >
                          {activity.activityType === 'dividend'
                            ? 'DIVIDEND'
                            : activity.type.toUpperCase()}
                        </span>
                      </td>
                      <td className="text-right number">
                        {typeof activity.shares === 'number'
                          ? activity.shares.toLocaleString()
                          : activity.shares}
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
