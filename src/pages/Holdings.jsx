import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '../api';
import StockSplitModal from '../components/modals/StockSplitModal';
import { ToastContainer, useToast } from '../components/Toast';
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
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);

  // Toast notifications
  const { toasts, addToast, removeToast } = useToast();

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
      const [holdingsData, pricesData, accountsData, dividendsData, transactionsData] =
        await Promise.all([
          api.getHoldings(selectedAccount || undefined),
          api.getPrices(),
          api.getAccounts(),
          api.getDividends(filters),
          api.getTransactions(filters),
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

  // Check if US stock market is currently open (9:30 AM - 4:00 PM ET, Mon-Fri)
  function isMarketOpen() {
    const now = new Date();

    // Convert to ET timezone
    const etTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));

    const day = etTime.getDay(); // 0 = Sunday, 6 = Saturday
    const hours = etTime.getHours();
    const minutes = etTime.getMinutes();
    const timeInMinutes = hours * 60 + minutes;

    // Market closed on weekends
    if (day === 0 || day === 6) {
      return false;
    }

    // Market hours: 9:30 AM (570 min) to 4:00 PM (960 min) ET
    const marketOpen = 9 * 60 + 30; // 9:30 AM = 570 minutes
    const marketClose = 16 * 60; // 4:00 PM = 960 minutes

    return timeInMinutes >= marketOpen && timeInMinutes < marketClose;
  }

  async function handleRefreshPrices() {
    setRefreshing(true);
    try {
      const marketOpen = isMarketOpen();

      // Always refresh to fill missing history, even when market is closed
      const result = await api.refreshPrices();
      const pricesData = await api.getPrices(); // Get full data after refresh
      setPrices(pricesData.reduce((acc, p) => ({ ...acc, [p.symbol]: p }), {}));

      // Show success toast with details
      const historyMsg = result.historyUpdated > 0
        ? ` (+${result.historyUpdated} history points)`
        : '';
      const marketStatus = !marketOpen ? ' (market closed)' : '';
      addToast(`Refreshed ${result.prices?.length || 0} prices${historyMsg}${marketStatus}`, 'success');
    } catch (err) {
      console.error('Failed to refresh prices:', err);
      addToast('Failed to refresh prices: ' + err.message, 'error');
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
    dividends.forEach((d) => {
      if (!result[d.symbol]) result[d.symbol] = 0;
      result[d.symbol] += d.amount;
    });
    return result;
  }, [dividends]);

  // Calculate realized gains by symbol
  const realizedGainsBySymbol = useMemo(() => {
    const result = {};
    transactions.forEach((t) => {
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
    transactions.forEach((t) => symbols.add(t.symbol));
    return symbols;
  }, [transactions]);

  // Build enriched data for sorting
  const enrichedHoldings = useMemo(() => {
    const holdingsBySymbol = {};

    // Add current holdings
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

    // Add sold stocks (symbols from transactions that have 0 shares now)
    if (showSoldStocks) {
      allSymbolsFromTransactions.forEach((symbol) => {
        if (!holdingsBySymbol[symbol]) {
          holdingsBySymbol[symbol] = {
            symbol,
            lots: [],
            totalShares: 0,
            totalCostBasis: 0,
            isSold: true,
          };
        }
      });
    }

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

      return {
        ...h,
        name,
        price,
        marketValue,
        gainLoss,
        gainLossPercent,
        avgCost,
        totalRealized,
      };
    });
  }, [
    holdings,
    prices,
    dividendsBySymbol,
    realizedGainsBySymbol,
    showSoldStocks,
    allSymbolsFromTransactions,
  ]);

  const { sortedData, sortConfig, requestSort, getSortIndicator } = useSort(enrichedHoldings, {
    key: 'marketValue',
    direction: 'desc',
  });

  const formatCurrency = (value) => {
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

  const SortableHeader = ({ column, label, className = '' }) => (
    <th
      className={`${className} sortable ${sortConfig.key === column ? 'sorted' : ''}`}
      onClick={() => requestSort(column)}
    >
      {label}
      <span className="sort-indicator">{getSortIndicator(column)}</span>
    </th>
  );

  // Export functions
  const getExportData = () => {
    const accountName = selectedAccount
      ? accounts.find((a) => a.id.toString() === selectedAccount.toString())?.name || 'Account'
      : 'All_Accounts';

    const data = sortedData.map((row) => ({
      symbol: row.symbol,
      name: row.name,
      shares: row.totalShares,
      price: row.price,
      marketValue: row.marketValue,
      avgCost: row.avgCost,
      costBasis: row.totalCostBasis,
      unrealizedGainLoss: row.gainLoss,
      unrealizedGainLossPercent: row.gainLossPercent,
      realizedGains: row.totalRealized,
      isSold: row.isSold || false,
    }));

    return { data, accountName };
  };

  const exportToCSV = () => {
    const { data, accountName } = getExportData();

    const headers = [
      'Symbol',
      'Name',
      'Shares',
      'Price',
      'Market Value',
      'Avg Cost',
      'Cost Basis',
      'Unrealized G/L',
      'Unrealized G/L %',
      'Realized Gains',
      'Sold',
    ];

    const csvContent = [
      headers.join(','),
      ...data.map((row) =>
        [
          row.symbol,
          `"${row.name.replace(/"/g, '""')}"`,
          row.shares,
          row.price.toFixed(2),
          row.marketValue.toFixed(2),
          row.avgCost.toFixed(2),
          row.costBasis.toFixed(2),
          row.unrealizedGainLoss.toFixed(2),
          row.unrealizedGainLossPercent.toFixed(2),
          row.realizedGains.toFixed(2),
          row.isSold ? 'Yes' : 'No',
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().split('T')[0];
    link.href = url;
    link.download = `holdings_${accountName}_${timestamp}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setExportDropdownOpen(false);
  };

  const exportToJSON = () => {
    const { data, accountName } = getExportData();

    const exportObj = {
      exportDate: new Date().toISOString(),
      account: selectedAccount ? accountName : 'All Accounts',
      totalHoldings: data.length,
      totalMarketValue: data.reduce((sum, r) => sum + r.marketValue, 0),
      totalUnrealizedGainLoss: data.reduce((sum, r) => sum + r.unrealizedGainLoss, 0),
      totalRealizedGains: data.reduce((sum, r) => sum + r.realizedGains, 0),
      holdings: data,
    };

    const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().split('T')[0];
    link.href = url;
    link.download = `holdings_${accountName}_${timestamp}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setExportDropdownOpen(false);
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
      {/* Toast notifications */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <div className="page-header">
        <div>
          <h1 className="page-title">Holdings</h1>
          <p className="page-subtitle">All your stock positions across accounts</p>
        </div>
        <div className="action-row">
          <button className="btn btn-secondary" onClick={() => setSplitModalOpen(true)}>
            ✂️ Stock Split
          </button>
          <button className="btn btn-secondary" onClick={handleRefreshPrices} disabled={refreshing}>
            {refreshing ? '⏳ Refreshing...' : '🔄 Refresh Prices'}
          </button>
          <div style={{ position: 'relative' }}>
            <button
              className="btn btn-secondary"
              onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
            >
              📤 Export
            </button>
            {exportDropdownOpen && (
              <>
                <div
                  style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 99,
                  }}
                  onClick={() => setExportDropdownOpen(false)}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '0.25rem',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                    zIndex: 100,
                    minWidth: '140px',
                    overflow: 'hidden',
                  }}
                >
                  <button
                    className="btn"
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '0.75rem 1rem',
                      border: 'none',
                      borderRadius: 0,
                      background: 'transparent',
                      color: 'var(--text-primary)',
                    }}
                    onClick={exportToCSV}
                    onMouseEnter={(e) => (e.target.style.background = 'var(--bg-tertiary)')}
                    onMouseLeave={(e) => (e.target.style.background = 'transparent')}
                  >
                    📊 Export CSV
                  </button>
                  <button
                    className="btn"
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '0.75rem 1rem',
                      border: 'none',
                      borderRadius: 0,
                      background: 'transparent',
                      color: 'var(--text-primary)',
                    }}
                    onClick={exportToJSON}
                    onMouseEnter={(e) => (e.target.style.background = 'var(--bg-tertiary)')}
                    onMouseLeave={(e) => (e.target.style.background = 'transparent')}
                  >
                    📋 Export JSON
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="filter-row">
        <select
          className="form-select"
          value={selectedAccount}
          onChange={(e) => setSelectedAccount(e.target.value)}
        >
          <option value="">All Accounts</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
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
                      {row.isSold && (
                        <span className="badge badge-neutral" style={{ fontSize: '0.65rem' }}>
                          SOLD
                        </span>
                      )}
                    </div>
                    <div className="text-muted" style={{ fontSize: '0.85rem' }}>
                      {row.name}
                    </div>
                  </td>
                  <td className="text-right number">{row.totalShares.toLocaleString()}</td>
                  <td className="text-right number">{formatCurrency(row.price)}</td>
                  <td className="text-right number" style={{ fontWeight: 600 }}>
                    {formatCurrency(row.marketValue)}
                  </td>
                  <td className="text-right number">
                    {row.avgCost > 0 ? formatCurrency(row.avgCost) : '-'}
                  </td>
                  <td
                    className={`text-right ${row.gainLoss >= 0 ? 'text-positive' : 'text-negative'}`}
                  >
                    {row.isSold ? (
                      '-'
                    ) : (
                      <>
                        <div>{formatCurrency(row.gainLoss)}</div>
                        <div style={{ fontSize: '0.85rem' }}>
                          {formatPercent(row.gainLossPercent)}
                        </div>
                      </>
                    )}
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
        </div>
      )}

      {splitModalOpen && (
        <StockSplitModal
          symbols={enrichedHoldings.map((h) => h.symbol)}
          onSave={handleStockSplit}
          onClose={() => setSplitModalOpen(false)}
        />
      )}
    </div>
  );
}

export default Holdings;
