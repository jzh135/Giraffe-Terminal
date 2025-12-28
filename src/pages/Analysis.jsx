import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '../api';

// Common ETF symbols to exclude
const ETF_SYMBOLS = [
  'SPY',
  'VOO',
  'VTI',
  'QQQ',
  'IWM',
  'VEA',
  'VWO',
  'BND',
  'AGG',
  'VNQ',
  'GLD',
  'SLV',
  'XLF',
  'XLE',
  'XLK',
  'XLV',
  'XLP',
  'XLY',
  'XLI',
  'XLB',
  'XLU',
  'XLRE',
  'VGT',
  'VHT',
  'VIG',
  'VYM',
  'ARKK',
  'ARKG',
  'ARKF',
  'ARKW',
  'ARKQ',
  'SCHD',
  'JEPI',
  'JEPQ',
  'SPHD',
  'HDV',
  'DVY',
];

// Utility functions
function formatCurrency(value) {
  if (value == null || isNaN(value)) return '-';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function formatPercent(value) {
  if (value == null || isNaN(value)) return '-';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export default function Analysis() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [holdings, setHoldings] = useState([]);
  const [prices, setPrices] = useState({});
  const [analytics, setAnalytics] = useState({
    weightedMedianGrowth: 0,
    weightedMedianGrowthStocksOnly: 0,
    totalPortfolioValue: 0,
    nearBuy: [],
    nearSell: [],
    allTargets: [],
  });
  const [sortConfig, setSortConfig] = useState({ key: 'medianGrowth', direction: 'desc' });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      // Fetch all holdings and prices
      const [holdingsData, pricesData] = await Promise.all([api.getHoldings(), api.getPrices()]);

      setHoldings(holdingsData);

      // Create price lookup
      const priceLookup = {};
      pricesData.forEach((p) => {
        priceLookup[p.symbol] = p;
      });
      setPrices(priceLookup);

      // Calculate analytics
      calculateAnalytics(holdingsData, priceLookup);
    } catch (err) {
      console.error('Failed to load analysis data:', err);
    } finally {
      setLoading(false);
    }
  }

  function calculateAnalytics(holdingsData, priceLookup) {
    // Group holdings by symbol and calculate totals
    const symbolTotals = {};
    holdingsData.forEach((h) => {
      if (!symbolTotals[h.symbol]) {
        symbolTotals[h.symbol] = { symbol: h.symbol, shares: 0, costBasis: 0 };
      }
      symbolTotals[h.symbol].shares += h.shares;
      symbolTotals[h.symbol].costBasis += h.shares * h.avg_cost;
    });

    // Calculate weighted median growth and categorize stocks
    let totalValue = 0;
    let totalValueStocksOnly = 0;
    let weightedGrowthSum = 0;
    let weightedGrowthSumStocksOnly = 0;
    const nearBuy = [];
    const nearSell = [];
    const allTargets = [];

    Object.values(symbolTotals).forEach((stock) => {
      if (stock.shares <= 0) return;

      const priceData = priceLookup[stock.symbol];
      if (!priceData) return;

      const currentPrice = priceData.price || 0;
      const marketValue = stock.shares * currentPrice;
      const isETF = ETF_SYMBOLS.includes(stock.symbol.toUpperCase());

      totalValue += marketValue;
      if (!isETF) {
        totalValueStocksOnly += marketValue;
      }

      const hasTargets =
        priceData.target_median_price > 0 ||
        priceData.buy_target_price > 0 ||
        priceData.sell_target_price > 0;

      if (!hasTargets) return;

      // Calculate percentage distances
      const medianTarget = priceData.target_median_price || 0;
      const buyTarget = priceData.buy_target_price || 0;
      const sellTarget = priceData.sell_target_price || 0;

      const medianGrowth =
        medianTarget > 0 && currentPrice > 0
          ? ((medianTarget - currentPrice) / currentPrice) * 100
          : null;
      const buyDistance =
        buyTarget > 0 && currentPrice > 0 ? ((currentPrice - buyTarget) / buyTarget) * 100 : null;
      const sellDistance =
        sellTarget > 0 && currentPrice > 0
          ? ((sellTarget - currentPrice) / currentPrice) * 100
          : null;

      const stockInfo = {
        symbol: stock.symbol,
        name: priceData.name,
        currentPrice,
        marketValue,
        shares: stock.shares,
        medianTarget,
        buyTarget,
        sellTarget,
        medianGrowth,
        buyDistance,
        sellDistance,
        isETF,
      };

      allTargets.push(stockInfo);

      // Contribute to weighted growth if has median target
      if (medianGrowth !== null) {
        weightedGrowthSum += marketValue * medianGrowth;
        if (!isETF) {
          weightedGrowthSumStocksOnly += marketValue * medianGrowth;
        }
      }

      // Near buy: price within 15% above buy target
      if (buyDistance !== null && buyDistance >= -5 && buyDistance <= 15) {
        nearBuy.push(stockInfo);
      }

      // Near sell: price within 15% below sell target
      if (sellDistance !== null && sellDistance >= -5 && sellDistance <= 15) {
        nearSell.push(stockInfo);
      }
    });

    // Sort near buy by closest to buy target
    nearBuy.sort((a, b) => (a.buyDistance || 999) - (b.buyDistance || 999));

    // Sort near sell by closest to sell target
    nearSell.sort((a, b) => (a.sellDistance || 999) - (b.sellDistance || 999));

    const weightedMedianGrowth = totalValue > 0 ? weightedGrowthSum / totalValue : 0;
    const weightedMedianGrowthStocksOnly =
      totalValueStocksOnly > 0 ? weightedGrowthSumStocksOnly / totalValueStocksOnly : 0;

    setAnalytics({
      weightedMedianGrowth,
      weightedMedianGrowthStocksOnly,
      totalPortfolioValue: totalValue,
      nearBuy,
      nearSell,
      allTargets,
    });
  }

  // Sortable table logic
  const sortedTargets = useMemo(() => {
    const sorted = [...analytics.allTargets];
    sorted.sort((a, b) => {
      let aVal, bVal;

      switch (sortConfig.key) {
        case 'symbol':
          aVal = a.symbol;
          bVal = b.symbol;
          break;
        case 'name':
          aVal = a.name || '';
          bVal = b.name || '';
          break;
        case 'currentPrice':
          aVal = a.currentPrice || 0;
          bVal = b.currentPrice || 0;
          break;
        case 'medianTarget':
          aVal = a.medianTarget || 0;
          bVal = b.medianTarget || 0;
          break;
        case 'medianGrowth':
          aVal = a.medianGrowth ?? -9999;
          bVal = b.medianGrowth ?? -9999;
          break;
        case 'buyTarget':
          aVal = a.buyTarget || 0;
          bVal = b.buyTarget || 0;
          break;
        case 'sellTarget':
          aVal = a.sellTarget || 0;
          bVal = b.sellTarget || 0;
          break;
        default:
          return 0;
      }

      if (typeof aVal === 'string') {
        return sortConfig.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
    });
    return sorted;
  }, [analytics.allTargets, sortConfig]);

  function handleSort(key) {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc',
    }));
  }

  function SortHeader({ label, sortKey, align = 'left' }) {
    const isActive = sortConfig.key === sortKey;
    return (
      <th
        style={{ textAlign: align, cursor: 'pointer', userSelect: 'none' }}
        onClick={() => handleSort(sortKey)}
      >
        {label} {isActive && (sortConfig.direction === 'desc' ? '▼' : '▲')}
      </th>
    );
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1>🔬 Analysis</h1>
        </div>
        <div className="card">Loading analysis data...</div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>🔬 Analysis</h1>
        <p className="text-muted">Price target analytics and opportunities</p>
      </div>

      {/* Summary Card */}
      <div
        className="card mb-lg"
        style={{
          background:
            'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%)',
          border: '1px solid rgba(99, 102, 241, 0.3)',
        }}
      >
        <h3 style={{ margin: 0, marginBottom: '16px' }}>📊 Portfolio Target Summary</h3>
        <div className="stats-grid">
          <div>
            <div className="text-muted">Weighted Growth (All)</div>
            <div
              className={`stat-value ${analytics.weightedMedianGrowth >= 0 ? 'text-positive' : 'text-negative'}`}
            >
              {formatPercent(analytics.weightedMedianGrowth)}
            </div>
          </div>
          <div>
            <div className="text-muted">Weighted Growth (Stocks Only)</div>
            <div
              className={`stat-value ${analytics.weightedMedianGrowthStocksOnly >= 0 ? 'text-positive' : 'text-negative'}`}
            >
              {formatPercent(analytics.weightedMedianGrowthStocksOnly)}
            </div>
          </div>
          <div>
            <div className="text-muted">Stocks with Targets</div>
            <div className="stat-value">{analytics.allTargets.length}</div>
          </div>
          <div>
            <div className="text-muted">Near Buy Zone</div>
            <div className="stat-value" style={{ color: '#10b981' }}>
              {analytics.nearBuy.length}
            </div>
          </div>
          <div>
            <div className="text-muted">Near Sell Zone</div>
            <div className="stat-value" style={{ color: '#ef4444' }}>
              {analytics.nearSell.length}
            </div>
          </div>
        </div>
      </div>

      {/* Near Buy Opportunities */}
      <div className="card mb-lg">
        <h3 style={{ margin: 0, marginBottom: '16px', color: '#10b981' }}>🟢 Near Buy Zone</h3>
        <p className="text-muted" style={{ marginBottom: '16px', fontSize: '0.85rem' }}>
          Stocks within 15% of your buy target price
        </p>
        {analytics.nearBuy.length === 0 ? (
          <p className="text-muted">No stocks currently near buy targets</p>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Name</th>
                  <th style={{ textAlign: 'right' }}>Current</th>
                  <th style={{ textAlign: 'right' }}>Buy Target</th>
                  <th style={{ textAlign: 'right' }}>Distance</th>
                </tr>
              </thead>
              <tbody>
                {analytics.nearBuy.map((stock) => (
                  <tr
                    key={stock.symbol}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/holdings/${stock.symbol}`)}
                  >
                    <td>
                      <strong>{stock.symbol}</strong>
                    </td>
                    <td>{stock.name}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(stock.currentPrice)}</td>
                    <td style={{ textAlign: 'right', color: '#10b981' }}>
                      {formatCurrency(stock.buyTarget)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className={stock.buyDistance <= 0 ? 'text-positive' : 'text-muted'}>
                        {stock.buyDistance <= 0
                          ? '✓ Below target'
                          : `${stock.buyDistance.toFixed(1)}% above`}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Near Sell Opportunities */}
      <div className="card mb-lg">
        <h3 style={{ margin: 0, marginBottom: '16px', color: '#ef4444' }}>🔴 Near Sell Zone</h3>
        <p className="text-muted" style={{ marginBottom: '16px', fontSize: '0.85rem' }}>
          Stocks within 15% of your sell target price
        </p>
        {analytics.nearSell.length === 0 ? (
          <p className="text-muted">No stocks currently near sell targets</p>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Name</th>
                  <th style={{ textAlign: 'right' }}>Current</th>
                  <th style={{ textAlign: 'right' }}>Sell Target</th>
                  <th style={{ textAlign: 'right' }}>Distance</th>
                </tr>
              </thead>
              <tbody>
                {analytics.nearSell.map((stock) => (
                  <tr
                    key={stock.symbol}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/holdings/${stock.symbol}`)}
                  >
                    <td>
                      <strong>{stock.symbol}</strong>
                    </td>
                    <td>{stock.name}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(stock.currentPrice)}</td>
                    <td style={{ textAlign: 'right', color: '#ef4444' }}>
                      {formatCurrency(stock.sellTarget)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className={stock.sellDistance <= 0 ? 'text-negative' : 'text-muted'}>
                        {stock.sellDistance <= 0
                          ? '✓ Above target'
                          : `${stock.sellDistance.toFixed(1)}% below`}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* All Stocks with Targets */}
      <div className="card">
        <h3 style={{ margin: 0, marginBottom: '16px' }}>🎯 All Price Targets</h3>
        <p className="text-muted" style={{ marginBottom: '16px', fontSize: '0.85rem' }}>
          Click column headers to sort
        </p>
        {analytics.allTargets.length === 0 ? (
          <p className="text-muted">
            No stocks have price targets set. Add targets in the Research page for each stock.
          </p>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <SortHeader label="Symbol" sortKey="symbol" />
                  <SortHeader label="Name" sortKey="name" />
                  <SortHeader label="Current" sortKey="currentPrice" align="right" />
                  <SortHeader label="Median Target" sortKey="medianTarget" align="right" />
                  <SortHeader label="Upside" sortKey="medianGrowth" align="right" />
                  <SortHeader label="Buy" sortKey="buyTarget" align="right" />
                  <SortHeader label="Sell" sortKey="sellTarget" align="right" />
                </tr>
              </thead>
              <tbody>
                {sortedTargets.map((stock) => (
                  <tr
                    key={stock.symbol}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/holdings/${stock.symbol}`)}
                  >
                    <td>
                      <strong>{stock.symbol}</strong>
                      {stock.isETF && (
                        <span
                          className="text-muted"
                          style={{ marginLeft: '4px', fontSize: '0.75rem' }}
                        >
                          (ETF)
                        </span>
                      )}
                    </td>
                    <td>{stock.name}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(stock.currentPrice)}</td>
                    <td style={{ textAlign: 'right' }}>
                      {stock.medianTarget > 0 ? formatCurrency(stock.medianTarget) : '-'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {stock.medianGrowth !== null ? (
                        <span
                          className={stock.medianGrowth >= 0 ? 'text-positive' : 'text-negative'}
                        >
                          {formatPercent(stock.medianGrowth)}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td style={{ textAlign: 'right', color: '#10b981' }}>
                      {stock.buyTarget > 0 ? formatCurrency(stock.buyTarget) : '-'}
                    </td>
                    <td style={{ textAlign: 'right', color: '#ef4444' }}>
                      {stock.sellTarget > 0 ? formatCurrency(stock.sellTarget) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
