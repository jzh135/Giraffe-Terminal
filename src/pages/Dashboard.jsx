import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import * as api from '../api';

function Dashboard() {
  const [accounts, setAccounts] = useState([]);
  const [holdings, setHoldings] = useState([]);
  const [prices, setPrices] = useState({});
  const [performance, setPerformance] = useState(null);
  const [allocation, setAllocation] = useState([]);
  const [allocationGroupBy, setAllocationGroupBy] = useState('role');
  const [allocationExpanded, setAllocationExpanded] = useState(false);
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
  }, [chartTimeframe, accounts.length]);

  useEffect(() => {
    loadAllocation();
  }, [allocationGroupBy, selectedAccount]);

  async function loadData() {
    try {
      const accountId = selectedAccount || undefined;

      // Load all data in parallel (using cached prices for speed)
      const [accountsData, holdingsData, pricesData, perfData, allocData] = await Promise.all([
        api.getAccounts(),
        api.getHoldings(accountId),
        api.getPrices(),
        api.getPerformance(accountId),
        api.getAllocation({ accountId, groupBy: allocationGroupBy }),
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

  async function loadAllocation() {
    try {
      const accountId = selectedAccount || undefined;
      const allocData = await api.getAllocation({ accountId, groupBy: allocationGroupBy });
      setAllocation(allocData);
    } catch (err) {
      console.error('Failed to load allocation:', err);
    }
  }

  async function loadChartData() {
    if (accounts.length === 0) return;

    setChartLoading(true);
    try {
      const accountIds =
        chartAccounts.length > 0 ? chartAccounts.join(',') : accounts.map((a) => a.id).join(',');

      const data = await api.getPerformanceChart({
        account_ids: accountIds,
        timeframe: chartTimeframe,
        skip_refresh: 'true',
      });

      setChartData(data);

      // Initialize chart accounts if empty
      if (chartAccounts.length === 0 && data.accounts) {
        setChartAccounts(data.accounts.map((a) => a.id));
      }
    } catch (err) {
      console.error('Failed to load chart data:', err);
    } finally {
      setChartLoading(false);
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
      // Check if market is open before fetching new prices
      if (!isMarketOpen()) {
        console.log('Market is closed - using cached prices');
        // Still reload cached data to ensure UI is in sync
        const accountId = selectedAccount || undefined;
        const [pricesData, holdingsData, allocData, perfData] = await Promise.all([
          api.getPrices(),
          api.getHoldings(accountId),
          api.getAllocation({ accountId, groupBy: allocationGroupBy }),
          api.getPerformance(accountId),
        ]);
        setPrices(pricesData.reduce((acc, p) => ({ ...acc, [p.symbol]: p }), {}));
        setHoldings(holdingsData);
        setAllocation(allocData);
        setPerformance(perfData);
        return;
      }

      await api.refreshPrices();
      // Reload all data to get updated prices and recalculate portfolio value
      const accountId = selectedAccount || undefined;
      const [pricesData, holdingsData, allocData, perfData] = await Promise.all([
        api.getPrices(),
        api.getHoldings(accountId),
        api.getAllocation({ accountId, groupBy: allocationGroupBy }),
        api.getPerformance(accountId),
      ]);
      setPrices(pricesData.reduce((acc, p) => ({ ...acc, [p.symbol]: p }), {}));
      setHoldings(holdingsData);
      setAllocation(allocData);
      setPerformance(perfData);
    } catch (err) {
      console.error('Failed to refresh prices:', err);
    } finally {
      setRefreshing(false);
    }
  }

  function toggleChartAccount(accountId) {
    setChartAccounts((prev) => {
      if (prev.includes(accountId)) {
        return prev.filter((id) => id !== accountId);
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

  const totalRealizedGain = accounts.reduce((sum, a) => {
    if (selectedAccount && a.id.toString() !== selectedAccount.toString()) return sum;
    return sum + (a.realized_gain || 0);
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
    return sum + data.shares * price;
  }, 0);

  const totalCostBasis = Object.values(holdingsBySymbol).reduce(
    (sum, data) => sum + data.costBasis,
    0
  );
  const totalGainLoss = totalMarketValue - totalCostBasis; // Unrealized
  const totalGainLossPercent = totalCostBasis > 0 ? (totalGainLoss / totalCostBasis) * 100 : 0;
  const totalGains = totalGainLoss + totalRealizedGain; // Total = Unrealized + Realized

  const portfolioValue = totalMarketValue + totalCash;

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
    YTD: 'YTD',
    '1Y': '1Y',
    ALL: 'All',
  };

  return (
    <div>
      {/* Header */}
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
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <button className="btn btn-secondary" onClick={handleRefreshPrices} disabled={refreshing}>
            {refreshing ? '⏳ Refreshing...' : '🔄 Refresh Prices'}
          </button>
        </div>
      </div>

      {/* Key Metrics */}
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
          <div className="stat-label">Total Gains</div>
          <div className={`stat-value ${totalGains >= 0 ? 'positive' : 'negative'}`}>
            {formatCurrency(totalGains)}
          </div>
          <div className="stat-change" style={{ color: 'var(--text-muted)' }}>
            Unrealized: {formatCurrency(totalGainLoss)} | Realized:{' '}
            {formatCurrency(totalRealizedGain)}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Time-Weighted Return (YTD)</div>
          <div className={`stat-value ${(performance?.twr || 0) >= 0 ? 'positive' : 'negative'}`}>
            {formatPercent(performance?.twr || 0)}
          </div>
          {performance?.spy_return !== null && (
            <div className="stat-change">S&P 500: {formatPercent(performance.spy_return)}</div>
          )}
        </div>
      </div>

      {/* Performance Chart - Full Width */}
      <div className="card mb-lg">
        <div className="card-header">
          <h2 className="card-title">📈 Performance</h2>
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
          <div className="loading" style={{ height: 320 }}>
            <div className="spinner"></div>
          </div>
        ) : chartData?.data?.length > 0 ? (
          <>
            <div style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData.data}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
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
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: '#f0f0f5' }}
                    formatter={(value, name) => {
                      const formattedName =
                        name === 'spy'
                          ? 'S&P 500'
                          : chartData.accounts?.find((a) => `account_${a.id}` === name)?.name ||
                            name;
                      return [`${value?.toFixed(2)}%`, formattedName];
                    }}
                    labelFormatter={formatChartDate}
                  />
                  <Legend
                    formatter={(value) => {
                      if (value === 'spy') return 'S&P 500';
                      const account = chartData.accounts?.find((a) => `account_${a.id}` === value);
                      return account?.name || value;
                    }}
                  />

                  {/* Account lines */}
                  {chartData.accounts
                    ?.filter((a) => chartAccounts.includes(a.id))
                    .map((account) => (
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
                {chartData.accounts?.map((account) => (
                  <label key={account.id} className="legend-item">
                    <input
                      type="checkbox"
                      checked={chartAccounts.includes(account.id)}
                      onChange={() => toggleChartAccount(account.id)}
                    />
                    <span
                      className="legend-color"
                      style={{ backgroundColor: account.color }}
                    ></span>
                    <span className="legend-name">{account.name}</span>
                  </label>
                ))}
                <label className="legend-item">
                  <input
                    type="checkbox"
                    checked={showSpy}
                    onChange={(e) => setShowSpy(e.target.checked)}
                  />
                  <span
                    className="legend-color"
                    style={{ backgroundColor: chartData.spy_color || '#fbbf24' }}
                  ></span>
                  <span className="legend-name">S&P 500</span>
                </label>
              </div>
            </div>
          </>
        ) : (
          <div className="empty-state" style={{ height: 320 }}>
            <div className="empty-state-icon">📈</div>
            <div className="empty-state-title">No performance data</div>
            <p>Add some transactions to see performance over time</p>
          </div>
        )}
      </div>

      {/* Allocation & Holdings Row */}
      <div className="grid grid-cols-2 gap-lg mb-lg">
        {/* Allocation Chart */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              🎯 Allocation by{' '}
              {allocationGroupBy === 'role'
                ? 'Role'
                : allocationGroupBy === 'theme'
                  ? 'Theme'
                  : 'Stock'}
            </h2>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <div className="timeframe-selector">
                <button
                  className={`timeframe-btn ${allocationGroupBy === 'role' ? 'active' : ''}`}
                  onClick={() => setAllocationGroupBy('role')}
                >
                  Role
                </button>
                <button
                  className={`timeframe-btn ${allocationGroupBy === 'theme' ? 'active' : ''}`}
                  onClick={() => setAllocationGroupBy('theme')}
                >
                  Theme
                </button>
                <button
                  className={`timeframe-btn ${allocationGroupBy === 'stock' ? 'active' : ''}`}
                  onClick={() => setAllocationGroupBy('stock')}
                >
                  Stock
                </button>
              </div>
              <button
                className="btn btn-icon"
                onClick={() => setAllocationExpanded(true)}
                title="Expand chart"
              >
                ⛶
              </button>
            </div>
          </div>
          <div style={{ height: 280, display: 'flex', gap: '0.5rem' }}>
            {allocation.length === 0 ? (
              <div className="empty-state" style={{ flex: 1 }}>
                <div className="empty-state-icon">📊</div>
                <div className="empty-state-title">No allocation data</div>
              </div>
            ) : (
              <>
                <div style={{ flex: 1 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={allocation}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={85}
                        paddingAngle={2}
                        startAngle={90}
                        endAngle={-270}
                        label={({ name, percent }) =>
                          percent >= 3 ? `${name} ${percent.toFixed(0)}%` : ''
                        }
                        labelLine={({ percent }) => percent >= 3}
                      >
                        {allocation.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} stroke="#1a1a25" />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1a1a25',
                          border: '1px solid #2a2a3a',
                          borderRadius: '8px',
                        }}
                        itemStyle={{ color: '#f0f0f5' }}
                        formatter={(value, name, props) => [
                          `${formatCurrency(value)} (${props.payload.percent.toFixed(1)}%)`,
                          name,
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {/* Sidebar for small allocations (<3%) */}
                {allocation.filter((a) => a.percent < 3).length > 0 && (
                  <div
                    style={{
                      width: '120px',
                      maxHeight: 280,
                      overflowY: 'auto',
                      borderLeft: '1px solid var(--border-color)',
                      paddingLeft: '0.5rem',
                      fontSize: '0.75rem',
                    }}
                  >
                    <div
                      style={{
                        color: 'var(--text-muted)',
                        marginBottom: '0.5rem',
                        fontWeight: 500,
                      }}
                    >
                      Other
                    </div>
                    {allocation
                      .filter((a) => a.percent < 3)
                      .map((item, index) => (
                        <div
                          key={index}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            marginBottom: '0.25rem',
                          }}
                        >
                          <div
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              backgroundColor: item.color,
                              flexShrink: 0,
                            }}
                          />
                          <span
                            style={{
                              color: 'var(--text-secondary)',
                              flex: 1,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {item.name}
                          </span>
                          <span style={{ color: 'var(--text-muted)' }}>
                            {item.percent.toFixed(1)}%
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Top Holdings */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">💼 Top Holdings</h2>
            <Link to="/holdings" className="btn btn-secondary btn-sm">
              View All →
            </Link>
          </div>

          {Object.keys(holdingsBySymbol).length === 0 ? (
            <div className="empty-state" style={{ height: 280 }}>
              <div className="empty-state-icon">📈</div>
              <div className="empty-state-title">No holdings yet</div>
              <p>Add stocks to your accounts to track them here</p>
            </div>
          ) : (
            <div style={{ maxHeight: 280, overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Symbol</th>
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
                    .slice(0, 6)
                    .map(([symbol, data]) => {
                      const price = prices[symbol]?.price || 0;
                      const marketValue = data.shares * price;
                      const gainLoss = marketValue - data.costBasis;
                      const gainLossPercent =
                        data.costBasis > 0 ? (gainLoss / data.costBasis) * 100 : 0;

                      return (
                        <tr key={symbol}>
                          <td>
                            <Link to={`/holdings/${symbol}`} className="symbol-link">
                              {symbol}
                            </Link>
                          </td>
                          <td className="text-right number">{formatCurrency(marketValue)}</td>
                          <td
                            className={`text-right ${gainLoss >= 0 ? 'text-positive' : 'text-negative'}`}
                          >
                            {formatPercent(gainLossPercent)}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Accounts Section */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">🏦 Accounts</h2>
          <Link to="/accounts" className="btn btn-secondary btn-sm">
            Manage →
          </Link>
        </div>

        {accounts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🏦</div>
            <div className="empty-state-title">No accounts yet</div>
            <p>Create your first account to get started</p>
            <Link to="/accounts" className="btn btn-primary mt-md">
              Add Account
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', padding: '0.5rem 0' }}>
            {accounts
              .filter((a) => !selectedAccount || a.id.toString() === selectedAccount.toString())
              .map((account) => (
                <Link
                  key={account.id}
                  to={`/accounts/${account.id}`}
                  style={{
                    textDecoration: 'none',
                    minWidth: '200px',
                    padding: '1rem',
                    background: 'var(--bg-secondary)',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    transition: 'all 0.2s ease',
                  }}
                  className="hover-lift"
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '0.5rem',
                    }}
                  >
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {account.name}
                    </div>
                    <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>
                      {account.type}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: '0.85rem',
                      color: 'var(--text-muted)',
                      marginBottom: '0.25rem',
                    }}
                  >
                    {account.institution || 'No institution'}
                  </div>
                  <div
                    style={{
                      fontWeight: 600,
                      color: account.cash_balance < 0 ? 'var(--negative)' : 'var(--text-primary)',
                    }}
                  >
                    {formatCurrency(account.cash_balance)}
                  </div>
                </Link>
              ))}
          </div>
        )}
      </div>

      {/* Expanded Allocation Modal */}
      {allocationExpanded && (
        <div className="modal-overlay" onClick={() => setAllocationExpanded(false)}>
          <div
            className="modal"
            style={{ maxWidth: '900px', maxHeight: '90vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 className="modal-title">
                🎯 Allocation by{' '}
                {allocationGroupBy === 'role'
                  ? 'Role'
                  : allocationGroupBy === 'theme'
                    ? 'Theme'
                    : 'Stock'}
              </h2>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <div className="timeframe-selector">
                  <button
                    className={`timeframe-btn ${allocationGroupBy === 'role' ? 'active' : ''}`}
                    onClick={() => setAllocationGroupBy('role')}
                  >
                    Role
                  </button>
                  <button
                    className={`timeframe-btn ${allocationGroupBy === 'theme' ? 'active' : ''}`}
                    onClick={() => setAllocationGroupBy('theme')}
                  >
                    Theme
                  </button>
                  <button
                    className={`timeframe-btn ${allocationGroupBy === 'stock' ? 'active' : ''}`}
                    onClick={() => setAllocationGroupBy('stock')}
                  >
                    Stock
                  </button>
                </div>
                <button className="modal-close" onClick={() => setAllocationExpanded(false)}>
                  ×
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1.5rem' }}>
              <div style={{ flex: 1, height: 500 }}>
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
                        innerRadius={80}
                        outerRadius={160}
                        paddingAngle={1}
                        startAngle={90}
                        endAngle={-270}
                        label={({ name, percent }) =>
                          percent >= 3 ? `${name} ${percent.toFixed(1)}%` : ''
                        }
                        labelLine={({ percent }) => percent >= 3}
                      >
                        {allocation.map((entry, index) => (
                          <Cell key={`cell-exp-${index}`} fill={entry.color} stroke="#1a1a25" />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1a1a25',
                          border: '1px solid #2a2a3a',
                          borderRadius: '8px',
                        }}
                        itemStyle={{ color: '#f0f0f5' }}
                        formatter={(value, name, props) => [
                          `${formatCurrency(value)} (${props.payload.percent.toFixed(1)}%)`,
                          name,
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
              {/* Sidebar for small allocations (<3%) */}
              {allocation.filter((a) => a.percent < 3).length > 0 && (
                <div
                  style={{
                    width: '200px',
                    maxHeight: 500,
                    overflowY: 'auto',
                    borderLeft: '1px solid var(--border-color)',
                    paddingLeft: '1rem',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-muted)',
                      marginBottom: '0.75rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    Other ({allocation.filter((a) => a.percent < 3).length})
                  </div>
                  {allocation
                    .filter((a) => a.percent < 3)
                    .map((item, index) => (
                      <div
                        key={index}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          marginBottom: '0.5rem',
                          fontSize: '0.85rem',
                        }}
                      >
                        <div
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            backgroundColor: item.color,
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ color: 'var(--text-secondary)', flex: 1 }}>{item.name}</span>
                        <span style={{ color: 'var(--text-muted)' }}>
                          {item.percent.toFixed(1)}%
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
