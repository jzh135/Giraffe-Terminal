import { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  getAccount,
  getHoldings,
  getPrices,
  getTransactions,
  getCashMovements,
  getDividends,
  createHolding,
  sellStock,
  createCashMovement,
  createDividend,
  deleteHolding,
  updateTransaction,
  updateCashMovement,
  updateDividend,
  deleteTransaction,
  deleteCashMovement,
  deleteDividend,
  recalculatePerformance,
} from '../api';
import TradeModal from '../components/modals/TradeModal';
import CashMovementModal from '../components/modals/CashMovementModal';
import DividendModal from '../components/modals/DividendModal';
import ConfirmModal from '../components/modals/ConfirmModal';
import { useSort } from '../hooks/useSort';

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

  // Edit states
  const [editTransaction, setEditTransaction] = useState(null);
  const [editCash, setEditCash] = useState(null);

  // Recalculate state
  const [recalculating, setRecalculating] = useState(false);

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
        getDividends({ account_id: id }),
      ]);

      setAccount(accountData);
      setHoldings(Array.isArray(holdingsData) ? holdingsData : []);
      setPrices(
        Array.isArray(pricesData)
          ? pricesData.reduce((acc, p) => ({ ...acc, [p.symbol]: p }), {})
          : {}
      );
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
      if (deleteConfirm.type === 'holding') {
        await deleteHolding(deleteConfirm.data.id);
      } else if (deleteConfirm.type === 'transaction') {
        await deleteTransaction(deleteConfirm.data.id);
      } else if (deleteConfirm.type === 'cash') {
        await deleteCashMovement(deleteConfirm.data.id);
      } else if (deleteConfirm.type === 'dividend') {
        await deleteDividend(deleteConfirm.data.id);
      }

      await loadData();
      setDeleteConfirm(null);
    } catch (err) {
      alert('Failed to delete: ' + err.message);
    }
  }

  // Edit Handlers
  async function handleUpdateTransaction(id, data) {
    try {
      if (editTransaction.type === 'dividend') {
        // Using the normalized type from our edit setup
        await updateDividend(id, data);
      } else {
        await updateTransaction(id, data);
      }
      await loadData();
      setEditTransaction(null);
    } catch (err) {
      alert('Failed to update: ' + err.message);
    }
  }

  async function handleUpdateCash(id, data) {
    try {
      await updateCashMovement(id, data);
      await loadData();
      setEditCash(null);
    } catch (err) {
      alert('Failed to update: ' + err.message);
    }
  }

  function openSellModal(holding) {
    setSelectedHolding(holding);
    setTradeTab('sell');
    setTradeModalOpen(true);
  }

  async function handleRecalculatePerformance() {
    if (recalculating) return;
    setRecalculating({ status: 'Starting...', percent: 0 });
    try {
      const result = await recalculatePerformance(id, (progress) => {
        setRecalculating({
          status: progress.status || 'Processing...',
          percent: progress.percent || 0,
          current: progress.current,
          total: progress.total,
          elapsed: progress.elapsed,
        });
      });
      alert(
        `Performance history recalculated! ${result.regenerated} records regenerated in ${result.elapsed}.`
      );
    } catch (err) {
      alert('Failed to recalculate: ' + err.message);
    } finally {
      setRecalculating(false);
    }
  }

  // Cash Activity - safe arrays
  const safeCashMovements = useMemo(
    () => (Array.isArray(cashMovements) ? cashMovements : []),
    [cashMovements]
  );
  const safeDividends = useMemo(() => (Array.isArray(dividends) ? dividends : []), [dividends]);
  const safeTransactions = useMemo(
    () => (Array.isArray(transactions) ? transactions : []),
    [transactions]
  );

  // Calculate dividends by symbol
  const dividendsBySymbol = useMemo(() => {
    const result = {};
    safeDividends.forEach((d) => {
      if (!result[d.symbol]) result[d.symbol] = 0;
      result[d.symbol] += d.amount;
    });
    return result;
  }, [safeDividends]);

  // Calculate realized gains by symbol
  const realizedGainsBySymbol = useMemo(() => {
    const result = {};
    safeTransactions.forEach((t) => {
      if (t.type === 'sell' && t.realized_gain != null) {
        if (!result[t.symbol]) result[t.symbol] = 0;
        result[t.symbol] += t.realized_gain;
      }
    });
    return result;
  }, [safeTransactions]);

  // Build realized gain data for the Realized Gain tab
  const realizedGainData = useMemo(() => {
    const symbols = new Set([
      ...Object.keys(dividendsBySymbol),
      ...Object.keys(realizedGainsBySymbol),
    ]);

    return Array.from(symbols)
      .map((symbol) => ({
        symbol,
        tradeGain: realizedGainsBySymbol[symbol] || 0,
        dividendGain: dividendsBySymbol[symbol] || 0,
        totalGain: (realizedGainsBySymbol[symbol] || 0) + (dividendsBySymbol[symbol] || 0),
      }))
      .sort((a, b) => b.totalGain - a.totalGain);
  }, [dividendsBySymbol, realizedGainsBySymbol]);

  // Enriched holdings for sorting
  const enrichedHoldings = useMemo(() => {
    const holdingsBySymbol = {};
    holdings.forEach((h) => {
      if (!holdingsBySymbol[h.symbol]) {
        holdingsBySymbol[h.symbol] = {
          symbol: h.symbol,
          lots: [],
          totalShares: 0,
          totalCostBasis: 0,
        };
      }
      holdingsBySymbol[h.symbol].lots.push(h);
      holdingsBySymbol[h.symbol].totalShares += h.shares;
      holdingsBySymbol[h.symbol].totalCostBasis += h.cost_basis;
    });

    return Object.values(holdingsBySymbol).map((h) => {
      const price = prices[h.symbol]?.price || 0;
      const name = prices[h.symbol]?.name || h.symbol;
      const marketValue = h.totalShares * price;
      const gainLoss = marketValue - h.totalCostBasis;
      const gainLossPercent = h.totalCostBasis > 0 ? (gainLoss / h.totalCostBasis) * 100 : 0;
      const avgCost = h.totalShares > 0 ? h.totalCostBasis / h.totalShares : 0;
      const symbolDividends = dividendsBySymbol[h.symbol] || 0;
      const symbolRealizedGain = realizedGainsBySymbol[h.symbol] || 0;
      const totalRealized = symbolDividends + symbolRealizedGain;

      return { ...h, name, price, marketValue, gainLoss, gainLossPercent, avgCost, totalRealized };
    });
  }, [holdings, prices, dividendsBySymbol, realizedGainsBySymbol]);

  // Enriched lots for sorting
  const enrichedLots = useMemo(() => {
    return holdings.map((lot) => {
      const price = prices[lot.symbol]?.price || 0;
      const marketValue = lot.shares * price;
      const gainLoss = marketValue - lot.cost_basis;
      return { ...lot, price, marketValue, gainLoss };
    });
  }, [holdings, prices]);

  // Combined cash activity
  const combinedCashActivity = useMemo(
    () => [
      ...safeCashMovements.map((m) => ({ ...m, category: 'cash', sortDate: m.date })),
      ...safeDividends.map((d) => ({
        ...d,
        category: 'dividend',
        type: 'dividend',
        sortDate: d.date,
        amount: d.amount,
      })),
    ],
    [safeCashMovements, safeDividends]
  );

  // Trade activity
  const tradeActivity = useMemo(
    () =>
      safeTransactions.map((t) => ({
        ...t,
        total: t.total,
        sortDate: t.date,
      })),
    [safeTransactions]
  );

  // Sort hooks for each table
  const {
    sortedData: sortedHoldings,
    sortConfig: holdingsSortConfig,
    requestSort: requestHoldingsSort,
    getSortIndicator: getHoldingsSortIndicator,
  } = useSort(enrichedHoldings, { key: 'marketValue', direction: 'desc' });
  const {
    sortedData: sortedLots,
    sortConfig: lotsSortConfig,
    requestSort: requestLotsSort,
    getSortIndicator: getLotsSortIndicator,
  } = useSort(enrichedLots, { key: 'symbol', direction: 'asc' });
  const {
    sortedData: sortedTrades,
    sortConfig: tradesSortConfig,
    requestSort: requestTradesSort,
    getSortIndicator: getTradesSortIndicator,
  } = useSort(tradeActivity, { key: 'date', direction: 'desc' });
  const {
    sortedData: sortedCash,
    sortConfig: cashSortConfig,
    requestSort: requestCashSort,
    getSortIndicator: getCashSortIndicator,
  } = useSort(combinedCashActivity, { key: 'sortDate', direction: 'desc' });

  // Calculate account totals
  const marketValue = holdings.reduce((sum, h) => {
    const price = prices[h.symbol]?.price || 0;
    return sum + h.shares * price;
  }, 0);
  const totalValue = marketValue + (account ? account.cash_balance : 0);

  // Calculate realized gains metrics for this account
  const realizedGainMetrics = useMemo(() => {
    const currentYear = new Date().getFullYear();

    // Trade realized gains (from sell transactions with realized_gain)
    const tradeGains = safeTransactions
      .filter((t) => t.type === 'sell' && t.realized_gain != null)
      .reduce((sum, t) => sum + t.realized_gain, 0);

    // YTD Trade realized gains
    const ytdTradeGains = safeTransactions
      .filter((t) => {
        if (t.type !== 'sell' || t.realized_gain == null) return false;
        const txYear = new Date(t.date + 'T00:00:00').getFullYear();
        return txYear === currentYear;
      })
      .reduce((sum, t) => sum + t.realized_gain, 0);

    // Total dividends
    const totalDividends = safeDividends.reduce((sum, d) => sum + d.amount, 0);

    // Total interest from cash movements
    const totalInterest = safeCashMovements
      .filter((c) => c.type === 'interest')
      .reduce((sum, c) => sum + c.amount, 0);

    // Total realized (trade gains + dividends + interest)
    const totalRealized = tradeGains + totalDividends + totalInterest;

    return {
      totalRealized,
      tradeGains,
      ytdTradeGains,
      totalDividends,
      totalInterest,
    };
  }, [safeTransactions, safeDividends, safeCashMovements]);

  const formatCurrency = (val) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  // Add T00:00:00 to parse as local time, not UTC
  const formatDate = (dateStr) => {
    const date = dateStr.includes('T') ? new Date(dateStr) : new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString();
  };

  const formatPercent = (val) =>
    new Intl.NumberFormat('en-US', {
      style: 'percent',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val / 100);

  if (loading)
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  if (error)
    return (
      <div className="card">
        <div className="text-negative">Error: {error}</div>
      </div>
    );
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
          <button
            className="btn btn-primary"
            onClick={() => {
              setSelectedHolding(null);
              setTradeTab('buy');
              setTradeModalOpen(true);
            }}
          >
            Trade
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => {
              setCashModalOpen(true);
            }}
          >
            Cash Movement
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleRecalculatePerformance}
            disabled={recalculating}
            title="Regenerate historical performance data for this account"
            style={recalculating ? { minWidth: '280px' } : {}}
          >
            {recalculating ? (
              <>
                ⏳ {recalculating.percent}%
                {recalculating.current &&
                  recalculating.total &&
                  ` (${recalculating.current}/${recalculating.total})`}
                {recalculating.elapsed && ` • ${recalculating.elapsed}`}
              </>
            ) : (
              '📊 Recalculate History'
            )}
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

      {/* Realized Gains Stats */}
      <div className="stats-grid" style={{ marginTop: 'var(--spacing-md)' }}>
        <div className="stat-card">
          <div className="stat-label">Total Realized (All)</div>
          <div
            className={`stat-value ${realizedGainMetrics.totalRealized >= 0 ? 'text-positive' : 'text-negative'}`}
          >
            {realizedGainMetrics.totalRealized >= 0 ? '+' : ''}
            {formatCurrency(realizedGainMetrics.totalRealized)}
          </div>
          <div className="stat-change" style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            Trades, dividends & interest
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Trade Gain/Loss</div>
          <div
            className={`stat-value ${realizedGainMetrics.tradeGains >= 0 ? 'text-positive' : 'text-negative'}`}
          >
            {realizedGainMetrics.tradeGains >= 0 ? '+' : ''}
            {formatCurrency(realizedGainMetrics.tradeGains)}
          </div>
          <div className="stat-change" style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            Sell transactions only
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">YTD Trade Gain/Loss</div>
          <div
            className={`stat-value ${realizedGainMetrics.ytdTradeGains >= 0 ? 'text-positive' : 'text-negative'}`}
          >
            {realizedGainMetrics.ytdTradeGains >= 0 ? '+' : ''}
            {formatCurrency(realizedGainMetrics.ytdTradeGains)}
          </div>
          <div className="stat-change" style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            {new Date().getFullYear()} • For tax purposes
          </div>
        </div>
      </div>

      <div className="tabs">
        {['holdings', 'lots', 'trade', 'cash', 'realized'].map((tab) => (
          <button
            key={tab}
            className={`tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'cash'
              ? 'Cash Movement'
              : tab === 'realized'
                ? 'Realized Gain'
                : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'holdings' && (
        <div className="card">
          {sortedHoldings.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📈</div>
              <div className="empty-state-title">No holdings yet</div>
              <p>Go to the Trade tab to buy stocks</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th
                    className={`sortable ${holdingsSortConfig.key === 'symbol' ? 'sorted' : ''}`}
                    onClick={() => requestHoldingsSort('symbol')}
                  >
                    Symbol
                    <span className="sort-indicator">{getHoldingsSortIndicator('symbol')}</span>
                  </th>
                  <th
                    className={`text-right sortable ${holdingsSortConfig.key === 'totalShares' ? 'sorted' : ''}`}
                    onClick={() => requestHoldingsSort('totalShares')}
                  >
                    Shares
                    <span className="sort-indicator">
                      {getHoldingsSortIndicator('totalShares')}
                    </span>
                  </th>
                  <th
                    className={`text-right sortable ${holdingsSortConfig.key === 'price' ? 'sorted' : ''}`}
                    onClick={() => requestHoldingsSort('price')}
                  >
                    Price<span className="sort-indicator">{getHoldingsSortIndicator('price')}</span>
                  </th>
                  <th
                    className={`text-right sortable ${holdingsSortConfig.key === 'marketValue' ? 'sorted' : ''}`}
                    onClick={() => requestHoldingsSort('marketValue')}
                  >
                    Market Value
                    <span className="sort-indicator">
                      {getHoldingsSortIndicator('marketValue')}
                    </span>
                  </th>
                  <th
                    className={`text-right sortable ${holdingsSortConfig.key === 'avgCost' ? 'sorted' : ''}`}
                    onClick={() => requestHoldingsSort('avgCost')}
                  >
                    Avg Cost
                    <span className="sort-indicator">{getHoldingsSortIndicator('avgCost')}</span>
                  </th>
                  <th
                    className={`text-right sortable ${holdingsSortConfig.key === 'gainLoss' ? 'sorted' : ''}`}
                    onClick={() => requestHoldingsSort('gainLoss')}
                  >
                    Unrealized G/L
                    <span className="sort-indicator">{getHoldingsSortIndicator('gainLoss')}</span>
                  </th>
                  <th
                    className={`text-right sortable ${holdingsSortConfig.key === 'totalRealized' ? 'sorted' : ''}`}
                    onClick={() => requestHoldingsSort('totalRealized')}
                  >
                    Realized
                    <span className="sort-indicator">
                      {getHoldingsSortIndicator('totalRealized')}
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedHoldings.map((row) => (
                  <tr
                    key={row.symbol}
                    onClick={() => navigate(`/holdings/${row.symbol}`)}
                    style={{ cursor: 'pointer' }}
                    className="hover-row"
                  >
                    <td>
                      <div style={{ fontWeight: 600 }}>{row.symbol}</div>
                      <div className="text-muted" style={{ fontSize: '0.85rem' }}>
                        {row.name}
                      </div>
                    </td>
                    <td className="text-right number">{row.totalShares.toLocaleString()}</td>
                    <td className="text-right number">{formatCurrency(row.price)}</td>
                    <td className="text-right number" style={{ fontWeight: 600 }}>
                      {formatCurrency(row.marketValue)}
                    </td>
                    <td className="text-right number">{formatCurrency(row.avgCost)}</td>
                    <td
                      className={`text-right ${row.gainLoss >= 0 ? 'text-positive' : 'text-negative'}`}
                    >
                      <div>{formatCurrency(row.gainLoss)}</div>
                      <div style={{ fontSize: '0.85rem' }}>
                        {formatPercent(row.gainLossPercent)}
                      </div>
                    </td>
                    <td
                      className={`text-right ${row.totalRealized >= 0 ? (row.totalRealized > 0 ? 'text-positive' : '') : 'text-negative'}`}
                    >
                      {row.totalRealized !== 0 ? formatCurrency(row.totalRealized) : '-'}
                    </td>
                  </tr>
                ))}
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
                <th
                  className={`sortable ${lotsSortConfig.key === 'symbol' ? 'sorted' : ''}`}
                  onClick={() => requestLotsSort('symbol')}
                >
                  Symbol<span className="sort-indicator">{getLotsSortIndicator('symbol')}</span>
                </th>
                <th
                  className={`text-right sortable ${lotsSortConfig.key === 'shares' ? 'sorted' : ''}`}
                  onClick={() => requestLotsSort('shares')}
                >
                  Shares<span className="sort-indicator">{getLotsSortIndicator('shares')}</span>
                </th>
                <th
                  className={`text-right sortable ${lotsSortConfig.key === 'purchase_date' ? 'sorted' : ''}`}
                  onClick={() => requestLotsSort('purchase_date')}
                >
                  Purchase Date
                  <span className="sort-indicator">{getLotsSortIndicator('purchase_date')}</span>
                </th>
                <th
                  className={`text-right sortable ${lotsSortConfig.key === 'cost_basis' ? 'sorted' : ''}`}
                  onClick={() => requestLotsSort('cost_basis')}
                >
                  Cost Basis
                  <span className="sort-indicator">{getLotsSortIndicator('cost_basis')}</span>
                </th>
                <th
                  className={`text-right sortable ${lotsSortConfig.key === 'gainLoss' ? 'sorted' : ''}`}
                  onClick={() => requestLotsSort('gainLoss')}
                >
                  Gain/Loss
                  <span className="sort-indicator">{getLotsSortIndicator('gainLoss')}</span>
                </th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedLots.map((lot) => (
                <tr key={lot.id}>
                  <td style={{ fontWeight: 500 }}>{lot.symbol}</td>
                  <td className="text-right number">{lot.shares}</td>
                  <td className="text-right">{formatDate(lot.purchase_date)}</td>
                  <td className="text-right number">{formatCurrency(lot.cost_basis)}</td>
                  <td
                    className={`text-right number ${lot.gainLoss >= 0 ? 'text-positive' : 'text-negative'}`}
                  >
                    {formatCurrency(lot.gainLoss)}
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
                        onClick={() => setDeleteConfirm({ type: 'holding', data: lot })}
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
        </div>
      )}

      {activeTab === 'trade' && (
        <div>
          <div className="card">
            {sortedTrades.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">🤝</div>
                <div className="empty-state-title">No trades yet</div>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th
                      className={`sortable ${tradesSortConfig.key === 'date' ? 'sorted' : ''}`}
                      onClick={() => requestTradesSort('date')}
                    >
                      Date<span className="sort-indicator">{getTradesSortIndicator('date')}</span>
                    </th>
                    <th
                      className={`sortable ${tradesSortConfig.key === 'type' ? 'sorted' : ''}`}
                      onClick={() => requestTradesSort('type')}
                    >
                      Type<span className="sort-indicator">{getTradesSortIndicator('type')}</span>
                    </th>
                    <th
                      className={`sortable ${tradesSortConfig.key === 'symbol' ? 'sorted' : ''}`}
                      onClick={() => requestTradesSort('symbol')}
                    >
                      Symbol
                      <span className="sort-indicator">{getTradesSortIndicator('symbol')}</span>
                    </th>
                    <th
                      className={`text-right sortable ${tradesSortConfig.key === 'shares' ? 'sorted' : ''}`}
                      onClick={() => requestTradesSort('shares')}
                    >
                      Shares
                      <span className="sort-indicator">{getTradesSortIndicator('shares')}</span>
                    </th>
                    <th
                      className={`text-right sortable ${tradesSortConfig.key === 'price' ? 'sorted' : ''}`}
                      onClick={() => requestTradesSort('price')}
                    >
                      Price<span className="sort-indicator">{getTradesSortIndicator('price')}</span>
                    </th>
                    <th
                      className={`text-right sortable ${tradesSortConfig.key === 'total' ? 'sorted' : ''}`}
                      onClick={() => requestTradesSort('total')}
                    >
                      Total<span className="sort-indicator">{getTradesSortIndicator('total')}</span>
                    </th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTrades.map((tx) => (
                    <tr key={tx.id}>
                      <td>{formatDate(tx.date)}</td>
                      <td>
                        <span
                          className={`badge ${tx.type === 'buy' ? 'badge-success' : 'badge-danger'}`}
                        >
                          {tx.type.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ fontWeight: 500 }}>{tx.symbol}</td>
                      <td className="text-right number">{tx.shares}</td>
                      <td className="text-right number">{formatCurrency(tx.price)}</td>
                      <td className="text-right number">{formatCurrency(tx.total)}</td>
                      <td className="text-right">
                        <div className="action-row justify-end">
                          <button
                            className="btn btn-icon"
                            onClick={() => setEditTransaction(tx)}
                            title="Edit"
                          >
                            ✏️
                          </button>
                          <button
                            className="btn btn-icon text-negative"
                            onClick={() => setDeleteConfirm({ type: 'transaction', data: tx })}
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
      )}

      {activeTab === 'cash' && (
        <div>
          <div className="card">
            {sortedCash.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">💸</div>
                <div className="empty-state-title">No cash activity</div>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th
                      className={`sortable ${cashSortConfig.key === 'sortDate' ? 'sorted' : ''}`}
                      onClick={() => requestCashSort('sortDate')}
                    >
                      Date<span className="sort-indicator">{getCashSortIndicator('sortDate')}</span>
                    </th>
                    <th
                      className={`sortable ${cashSortConfig.key === 'type' ? 'sorted' : ''}`}
                      onClick={() => requestCashSort('type')}
                    >
                      Type<span className="sort-indicator">{getCashSortIndicator('type')}</span>
                    </th>
                    <th>Description</th>
                    <th
                      className={`text-right sortable ${cashSortConfig.key === 'amount' ? 'sorted' : ''}`}
                      onClick={() => requestCashSort('amount')}
                    >
                      Amount<span className="sort-indicator">{getCashSortIndicator('amount')}</span>
                    </th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCash.map((item, idx) => (
                    <tr key={`${item.category}-${item.id || idx}`}>
                      <td>{formatDate(item.sortDate)}</td>
                      <td>
                        <span className="badge badge-neutral">{item.type.toUpperCase()}</span>
                      </td>
                      <td>
                        {item.category === 'dividend' ? (
                          <span>
                            Dividend from <strong>{item.symbol}</strong>
                          </span>
                        ) : (
                          item.notes || '-'
                        )}
                      </td>
                      <td
                        className={`text-right number ${item.amount >= 0 ? 'text-positive' : 'text-negative'}`}
                      >
                        {formatCurrency(item.amount)}
                      </td>
                      <td className="text-right">
                        <div className="action-row justify-end">
                          <button
                            className="btn btn-icon"
                            onClick={() => {
                              if (item.category === 'dividend')
                                setEditTransaction({ ...item, type: 'dividend', account_id: id }); // route dividend to TradeModal logic
                              else setEditCash(item);
                            }}
                            title="Edit"
                          >
                            ✏️
                          </button>
                          <button
                            className="btn btn-icon text-negative"
                            onClick={() =>
                              setDeleteConfirm({
                                type: item.category === 'dividend' ? 'dividend' : 'cash',
                                data: item,
                              })
                            }
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
      )}

      {activeTab === 'realized' && (
        <div>
          <div className="card">
            {realizedGainData.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">💰</div>
                <div className="empty-state-title">No realized gains yet</div>
                <p>Sell stocks or receive dividends to see realized gains</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th className="text-right">Trade Gain/Loss</th>
                    <th className="text-right">Dividends</th>
                    <th className="text-right">Total Realized</th>
                  </tr>
                </thead>
                <tbody>
                  {realizedGainData.map((row) => (
                    <tr key={row.symbol}>
                      <td style={{ fontWeight: 600 }}>{row.symbol}</td>
                      <td
                        className={`text-right number ${row.tradeGain >= 0 ? (row.tradeGain > 0 ? 'text-positive' : '') : 'text-negative'}`}
                      >
                        {row.tradeGain !== 0 ? formatCurrency(row.tradeGain) : '-'}
                      </td>
                      <td
                        className={`text-right number ${row.dividendGain > 0 ? 'text-positive' : ''}`}
                      >
                        {row.dividendGain > 0 ? formatCurrency(row.dividendGain) : '-'}
                      </td>
                      <td
                        className={`text-right number ${row.totalGain >= 0 ? (row.totalGain > 0 ? 'text-positive' : '') : 'text-negative'}`}
                        style={{ fontWeight: 600 }}
                      >
                        {formatCurrency(row.totalGain)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ fontWeight: 600, borderTop: '2px solid var(--border-color)' }}>
                    <td>Total</td>
                    <td
                      className={`text-right number ${realizedGainData.reduce((sum, r) => sum + r.tradeGain, 0) >= 0 ? 'text-positive' : 'text-negative'}`}
                    >
                      {formatCurrency(realizedGainData.reduce((sum, r) => sum + r.tradeGain, 0))}
                    </td>
                    <td className="text-right number text-positive">
                      {formatCurrency(realizedGainData.reduce((sum, r) => sum + r.dividendGain, 0))}
                    </td>
                    <td
                      className={`text-right number ${realizedGainData.reduce((sum, r) => sum + r.totalGain, 0) >= 0 ? 'text-positive' : 'text-negative'}`}
                    >
                      {formatCurrency(realizedGainData.reduce((sum, r) => sum + r.totalGain, 0))}
                    </td>
                  </tr>
                </tfoot>
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
          initialAccountId={id}
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
        <CashMovementModal onSave={handleCashMovement} onClose={() => setCashModalOpen(false)} />
      )}

      {deleteConfirm && (
        <ConfirmModal
          title={`Delete ${deleteConfirm.type === 'holding' ? 'Holding' : 'Entry'}`}
          message={`Are you sure you want to delete this ${deleteConfirm.type}?`}
          confirmText="Delete"
          onConfirm={handleDeleteHolding}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}

      {/* Edit Modals */}
      {editCash && (
        <CashMovementModal
          editingMovement={editCash}
          onUpdate={handleUpdateCash}
          onClose={() => setEditCash(null)}
        />
      )}

      {editTransaction && (
        <TradeModal
          editingTransaction={editTransaction}
          holdings={holdings}
          prices={prices}
          onUpdate={handleUpdateTransaction}
          onClose={() => setEditTransaction(null)}
        />
      )}
    </div>
  );
}

export default AccountDetail;
