const API_BASE = '/api';

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  };

  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }

  const response = await fetch(url, config);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

// Admin
export const getAdminStats = () => request('/admin/stats');
export const resetDatabase = () => request('/admin/reset', { method: 'POST' });
export const restartServer = () => request('/admin/restart', { method: 'POST' });
export const clearPriceCache = () => request('/admin/clear-cache', { method: 'POST' });
export const getAppSettings = () => request('/admin/settings');
export const updateAppSettings = (data) =>
  request('/admin/settings', { method: 'POST', body: data });

// Accounts
export const getAccounts = () => request('/accounts');
export const getAccount = (id) => request(`/accounts/${id}`);
export const createAccount = (data) => request('/accounts', { method: 'POST', body: data });
export const updateAccount = (id, data) =>
  request(`/accounts/${id}`, { method: 'PUT', body: data });
export const deleteAccount = (id) => request(`/accounts/${id}`, { method: 'DELETE' });

// Holdings
export const getHoldings = (accountId) => {
  const params = accountId ? `?account_id=${accountId}` : '';
  return request(`/holdings${params}`);
};
export const getHolding = (id) => request(`/holdings/${id}`);
export const createHolding = (data) => request('/holdings', { method: 'POST', body: data });
export const updateHolding = (id, data) =>
  request(`/holdings/${id}`, { method: 'PUT', body: data });
export const deleteHolding = (id) => request(`/holdings/${id}`, { method: 'DELETE' });

// Transactions
export const getTransactions = (filters = {}) => {
  const params = new URLSearchParams(filters).toString();
  return request(`/transactions${params ? `?${params}` : ''}`);
};
export const createTransaction = (data) => request('/transactions', { method: 'POST', body: data });
export const updateTransaction = (id, data) =>
  request(`/transactions/${id}`, { method: 'PUT', body: data });
export const deleteTransaction = (id) => request(`/transactions/${id}`, { method: 'DELETE' });
export const sellStock = (data) => request('/transactions/sell', { method: 'POST', body: data });

// Dividends
export const getDividends = (filters = {}) => {
  const params = new URLSearchParams(filters).toString();
  return request(`/dividends${params ? `?${params}` : ''}`);
};
export const createDividend = (data) => request('/dividends', { method: 'POST', body: data });
export const updateDividend = (id, data) =>
  request(`/dividends/${id}`, { method: 'PUT', body: data });
export const deleteDividend = (id) => request(`/dividends/${id}`, { method: 'DELETE' });

// Cash Movements
export const getCashMovements = (filters = {}) => {
  const params = new URLSearchParams(filters).toString();
  return request(`/cash-movements${params ? `?${params}` : ''}`);
};
export const createCashMovement = (data) =>
  request('/cash-movements', { method: 'POST', body: data });
export const updateCashMovement = (id, data) =>
  request(`/cash-movements/${id}`, { method: 'PUT', body: data });
export const deleteCashMovement = (id) => request(`/cash-movements/${id}`, { method: 'DELETE' });

// Stock Splits
export const getStockSplits = (symbol) => {
  const params = symbol ? `?symbol=${symbol}` : '';
  return request(`/stock-splits${params}`);
};
export const createStockSplit = (data) => request('/stock-splits', { method: 'POST', body: data });
export const deleteStockSplit = (id) => request(`/stock-splits/${id}`, { method: 'DELETE' });

export const getPrices = (symbols) => {
  const params = symbols ? `?symbols=${symbols.join(',')}` : '';
  return request(`/prices${params}`);
};
export const refreshPrices = () => request('/prices/refresh', { method: 'POST' });
export const fetchPrice = (symbol) => request(`/prices/fetch/${symbol}`);
export const updateStockResearch = (symbol, data) =>
  request(`/prices/${symbol}`, { method: 'PUT', body: data });

// Performance
export const getPerformance = (accountId) => {
  const params = accountId ? `?account_id=${accountId}` : '';
  return request(`/performance${params}`);
};
export const getPerformanceHistory = (accountId) => {
  const params = accountId ? `?account_id=${accountId}` : '';
  return request(`/performance/history${params}`);
};
export const getPerformanceChart = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return request(`/performance/chart${query ? `?${query}` : ''}`);
};
export const getAllocation = (options = {}) => {
  const params = new URLSearchParams();
  if (options.accountId) params.append('account_id', options.accountId);
  if (options.groupBy) params.append('group_by', options.groupBy);
  const query = params.toString();
  return request(`/performance/allocation${query ? `?${query}` : ''}`);
};

// SSE-based recalculate with progress callback
export const recalculatePerformance = (accountId, onProgress) => {
  return new Promise((resolve, reject) => {
    const eventSource = new EventSource(`${API_BASE}/performance/recalculate/${accountId}`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.error) {
          eventSource.close();
          reject(new Error(data.error));
          return;
        }

        if (onProgress) {
          onProgress(data);
        }

        if (data.complete) {
          eventSource.close();
          resolve(data);
        }
      } catch (e) {
        console.error('Failed to parse SSE data:', e);
      }
    };

    eventSource.onerror = (err) => {
      eventSource.close();
      reject(new Error('Connection lost'));
    };
  });
};

// Stock Roles
export const getRoles = () => request('/roles');
export const createRole = (data) => request('/roles', { method: 'POST', body: data });
export const updateRole = (id, data) => request(`/roles/${id}`, { method: 'PUT', body: data });
export const deleteRole = (id) => request(`/roles/${id}`, { method: 'DELETE' });

// Stock Themes
export const getThemes = () => request('/themes');
export const createTheme = (data) => request('/themes', { method: 'POST', body: data });
export const updateTheme = (id, data) => request(`/themes/${id}`, { method: 'PUT', body: data });
export const deleteTheme = (id) => request(`/themes/${id}`, { method: 'DELETE' });
