import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// SEC EDGAR API URLs
const SEC_COMPANY_TICKERS_URL = 'https://www.sec.gov/files/company_tickers.json';
const SEC_SUBMISSIONS_URL = 'https://data.sec.gov/submissions/CIK';
const SEC_ARCHIVES_URL = 'https://www.sec.gov/Archives/edgar/data';

// Cache for ticker-to-CIK mapping (refreshed daily)
let tickerToCikCache = null;
let cacheTimestamp = null;
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// SEC requires a User-Agent header with contact info
const SEC_USER_AGENT = 'GiraffeTerminal/1.0 (Personal Use)';

// Directory to store downloaded 10-K filings
const FILINGS_DIR = path.join(__dirname, '..', '..', 'data', 'sec-filings');

// Ensure filings directory exists
if (!fs.existsSync(FILINGS_DIR)) {
  fs.mkdirSync(FILINGS_DIR, { recursive: true });
}

/**
 * Fetch and cache the ticker-to-CIK mapping from SEC
 */
async function getTickerToCikMap() {
  const now = Date.now();

  // Return cache if still valid
  if (tickerToCikCache && cacheTimestamp && (now - cacheTimestamp) < CACHE_TTL) {
    return tickerToCikCache;
  }

  try {
    console.log('Fetching ticker-to-CIK mapping from SEC...');
    const response = await fetch(SEC_COMPANY_TICKERS_URL, {
      headers: { 'User-Agent': SEC_USER_AGENT }
    });

    if (!response.ok) {
      throw new Error(`SEC API returned ${response.status}`);
    }

    const data = await response.json();

    // Convert to a map: ticker -> { cik, name }
    // Data format: { "0": { "cik_str": 320193, "ticker": "AAPL", "title": "Apple Inc." }, ... }
    tickerToCikCache = {};
    for (const key of Object.keys(data)) {
      const entry = data[key];
      const ticker = entry.ticker.toUpperCase();
      tickerToCikCache[ticker] = {
        cik: entry.cik_str,
        cikPadded: String(entry.cik_str).padStart(10, '0'),
        name: entry.title
      };
    }

    cacheTimestamp = now;
    console.log(`Cached ${Object.keys(tickerToCikCache).length} ticker-to-CIK mappings`);

    return tickerToCikCache;
  } catch (err) {
    console.error('Failed to fetch ticker-to-CIK mapping:', err.message);
    // Return existing cache if available, even if stale
    if (tickerToCikCache) {
      return tickerToCikCache;
    }
    throw err;
  }
}

/**
 * GET /api/sec/cik/:ticker
 * Get CIK number for a ticker symbol
 */
router.get('/cik/:ticker', async (req, res) => {
  try {
    const ticker = req.params.ticker.toUpperCase();
    const tickerMap = await getTickerToCikMap();

    if (!tickerMap[ticker]) {
      return res.status(404).json({
        error: 'Ticker not found',
        ticker,
        message: 'This ticker symbol was not found in SEC records'
      });
    }

    res.json({
      ticker,
      ...tickerMap[ticker]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/sec/filings/:ticker
 * Get list of SEC filings for a company (optionally filtered by form type)
 */
router.get('/filings/:ticker', async (req, res) => {
  try {
    const ticker = req.params.ticker.toUpperCase();
    const formType = req.query.form || '10-K'; // Default to 10-K
    const limit = parseInt(req.query.limit) || 10;

    // Get CIK for ticker
    const tickerMap = await getTickerToCikMap();
    if (!tickerMap[ticker]) {
      return res.status(404).json({
        error: 'Ticker not found',
        ticker
      });
    }

    const { cik, cikPadded, name } = tickerMap[ticker];

    // Fetch company submissions from SEC
    const submissionsUrl = `${SEC_SUBMISSIONS_URL}${cikPadded}.json`;
    console.log(`Fetching filings from: ${submissionsUrl}`);

    const response = await fetch(submissionsUrl, {
      headers: { 'User-Agent': SEC_USER_AGENT }
    });

    if (!response.ok) {
      throw new Error(`SEC API returned ${response.status}`);
    }

    const data = await response.json();

    // Extract recent filings
    const recentFilings = data.filings?.recent || {};
    const forms = recentFilings.form || [];
    const accessionNumbers = recentFilings.accessionNumber || [];
    const filingDates = recentFilings.filingDate || [];
    const primaryDocuments = recentFilings.primaryDocument || [];
    const primaryDocDescriptions = recentFilings.primaryDocDescription || [];

    // Filter by form type and build results
    const filings = [];
    for (let i = 0; i < forms.length && filings.length < limit; i++) {
      if (forms[i] === formType || forms[i] === `${formType}/A`) { // Include amendments
        const accessionNumber = accessionNumbers[i];
        const accessionForUrl = accessionNumber.replace(/-/g, '');

        filings.push({
          form: forms[i],
          filingDate: filingDates[i],
          accessionNumber,
          primaryDocument: primaryDocuments[i],
          description: primaryDocDescriptions[i],
          documentUrl: `${SEC_ARCHIVES_URL}/${cik}/${accessionForUrl}/${primaryDocuments[i]}`,
          indexUrl: `${SEC_ARCHIVES_URL}/${cik}/${accessionForUrl}/`
        });
      }
    }

    res.json({
      ticker,
      cik,
      companyName: name,
      formType,
      filings
    });
  } catch (err) {
    console.error('Error fetching filings:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/sec/10k/:ticker
 * Get the most recent 10-K filing content (or specific year)
 */
router.get('/10k/:ticker', async (req, res) => {
  try {
    const ticker = req.params.ticker.toUpperCase();
    const year = req.query.year; // Optional: specific fiscal year

    // Get CIK for ticker
    const tickerMap = await getTickerToCikMap();
    if (!tickerMap[ticker]) {
      return res.status(404).json({
        error: 'Ticker not found',
        ticker
      });
    }

    const { cik, cikPadded, name } = tickerMap[ticker];

    // Fetch company submissions
    const submissionsUrl = `${SEC_SUBMISSIONS_URL}${cikPadded}.json`;
    const response = await fetch(submissionsUrl, {
      headers: { 'User-Agent': SEC_USER_AGENT }
    });

    if (!response.ok) {
      throw new Error(`SEC API returned ${response.status}`);
    }

    const data = await response.json();
    const recentFilings = data.filings?.recent || {};
    const forms = recentFilings.form || [];
    const accessionNumbers = recentFilings.accessionNumber || [];
    const filingDates = recentFilings.filingDate || [];
    const primaryDocuments = recentFilings.primaryDocument || [];

    // Find the 10-K filing (optionally by year)
    let targetIndex = -1;
    for (let i = 0; i < forms.length; i++) {
      if (forms[i] === '10-K') {
        if (year) {
          // Check if this filing is for the requested year
          const filingYear = filingDates[i].substring(0, 4);
          if (filingYear === year || filingYear === String(parseInt(year) + 1)) {
            // 10-K for fiscal year X is usually filed in early year X+1
            targetIndex = i;
            break;
          }
        } else {
          // Get the most recent
          targetIndex = i;
          break;
        }
      }
    }

    if (targetIndex === -1) {
      return res.status(404).json({
        error: '10-K not found',
        message: year ? `No 10-K found for fiscal year ${year}` : 'No 10-K filings found'
      });
    }

    const accessionNumber = accessionNumbers[targetIndex];
    const accessionForUrl = accessionNumber.replace(/-/g, '');
    const primaryDoc = primaryDocuments[targetIndex];
    const documentUrl = `${SEC_ARCHIVES_URL}/${cik}/${accessionForUrl}/${primaryDoc}`;

    // Check if we already have this filing cached locally
    const localFilename = `${ticker}_10K_${filingDates[targetIndex]}.htm`;
    const localPath = path.join(FILINGS_DIR, localFilename);

    let content;
    if (fs.existsSync(localPath)) {
      console.log(`Loading cached 10-K for ${ticker} from ${localPath}`);
      content = fs.readFileSync(localPath, 'utf-8');
    } else {
      // Download the filing
      console.log(`Downloading 10-K for ${ticker} from ${documentUrl}`);
      const docResponse = await fetch(documentUrl, {
        headers: { 'User-Agent': SEC_USER_AGENT }
      });

      if (!docResponse.ok) {
        throw new Error(`Failed to download document: ${docResponse.status}`);
      }

      content = await docResponse.text();

      // Cache locally
      fs.writeFileSync(localPath, content, 'utf-8');
      console.log(`Cached 10-K to ${localPath}`);
    }

    res.json({
      ticker,
      cik,
      companyName: name,
      filingDate: filingDates[targetIndex],
      accessionNumber,
      documentUrl,
      localPath,
      contentLength: content.length,
      // Include the raw content for AI processing
      content: req.query.includeContent === 'true' ? content : undefined,
      message: req.query.includeContent === 'true'
        ? 'Full content included'
        : 'Add ?includeContent=true to include raw HTML content'
    });
  } catch (err) {
    console.error('Error fetching 10-K:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/sec/10k/:ticker/text
 * Get the 10-K content as plain text (stripped HTML)
 */
router.get('/10k/:ticker/text', async (req, res) => {
  try {
    const ticker = req.params.ticker.toUpperCase();

    // Get CIK for ticker
    const tickerMap = await getTickerToCikMap();
    if (!tickerMap[ticker]) {
      return res.status(404).json({ error: 'Ticker not found', ticker });
    }

    const { cik, cikPadded, name } = tickerMap[ticker];

    // Fetch company submissions
    const submissionsUrl = `${SEC_SUBMISSIONS_URL}${cikPadded}.json`;
    const response = await fetch(submissionsUrl, {
      headers: { 'User-Agent': SEC_USER_AGENT }
    });

    if (!response.ok) {
      throw new Error(`SEC API returned ${response.status}`);
    }

    const data = await response.json();
    const recentFilings = data.filings?.recent || {};
    const forms = recentFilings.form || [];
    const accessionNumbers = recentFilings.accessionNumber || [];
    const filingDates = recentFilings.filingDate || [];
    const primaryDocuments = recentFilings.primaryDocument || [];

    // Find most recent 10-K
    let targetIndex = forms.findIndex(f => f === '10-K');
    if (targetIndex === -1) {
      return res.status(404).json({ error: '10-K not found' });
    }

    const accessionNumber = accessionNumbers[targetIndex];
    const accessionForUrl = accessionNumber.replace(/-/g, '');
    const primaryDoc = primaryDocuments[targetIndex];
    const documentUrl = `${SEC_ARCHIVES_URL}/${cik}/${accessionForUrl}/${primaryDoc}`;

    // Check cache
    const localFilename = `${ticker}_10K_${filingDates[targetIndex]}.htm`;
    const localPath = path.join(FILINGS_DIR, localFilename);

    let content;
    if (fs.existsSync(localPath)) {
      content = fs.readFileSync(localPath, 'utf-8');
    } else {
      const docResponse = await fetch(documentUrl, {
        headers: { 'User-Agent': SEC_USER_AGENT }
      });

      if (!docResponse.ok) {
        throw new Error(`Failed to download: ${docResponse.status}`);
      }

      content = await docResponse.text();
      fs.writeFileSync(localPath, content, 'utf-8');
    }

    // Strip HTML tags to get plain text
    const plainText = content
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#\d+;/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    res.json({
      ticker,
      cik,
      companyName: name,
      filingDate: filingDates[targetIndex],
      documentUrl,
      textLength: plainText.length,
      text: plainText
    });
  } catch (err) {
    console.error('Error getting 10-K text:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/sec/10q/:ticker
 * Get the most recent 10-Q filing content (or specific quarter)
 */
router.get('/10q/:ticker', async (req, res) => {
  try {
    const ticker = req.params.ticker.toUpperCase();
    const quarter = req.query.quarter; // Optional: Q1, Q2, Q3, or year like 2024

    // Get CIK for ticker
    const tickerMap = await getTickerToCikMap();
    if (!tickerMap[ticker]) {
      return res.status(404).json({
        error: 'Ticker not found',
        ticker
      });
    }

    const { cik, cikPadded, name } = tickerMap[ticker];

    // Fetch company submissions
    const submissionsUrl = `${SEC_SUBMISSIONS_URL}${cikPadded}.json`;
    const response = await fetch(submissionsUrl, {
      headers: { 'User-Agent': SEC_USER_AGENT }
    });

    if (!response.ok) {
      throw new Error(`SEC API returned ${response.status}`);
    }

    const data = await response.json();
    const recentFilings = data.filings?.recent || {};
    const forms = recentFilings.form || [];
    const accessionNumbers = recentFilings.accessionNumber || [];
    const filingDates = recentFilings.filingDate || [];
    const primaryDocuments = recentFilings.primaryDocument || [];

    // Find the 10-Q filing (optionally by quarter/year)
    let targetIndex = -1;
    for (let i = 0; i < forms.length; i++) {
      if (forms[i] === '10-Q') {
        if (quarter) {
          // Check if this filing is for the requested year
          const filingYear = filingDates[i].substring(0, 4);
          if (filingYear === quarter) {
            targetIndex = i;
            break;
          }
        } else {
          // Get the most recent
          targetIndex = i;
          break;
        }
      }
    }

    if (targetIndex === -1) {
      return res.status(404).json({
        error: '10-Q not found',
        message: quarter ? `No 10-Q found for ${quarter}` : 'No 10-Q filings found'
      });
    }

    const accessionNumber = accessionNumbers[targetIndex];
    const accessionForUrl = accessionNumber.replace(/-/g, '');
    const primaryDoc = primaryDocuments[targetIndex];
    const documentUrl = `${SEC_ARCHIVES_URL}/${cik}/${accessionForUrl}/${primaryDoc}`;

    // Check if we already have this filing cached locally
    const localFilename = `${ticker}_10Q_${filingDates[targetIndex]}.htm`;
    const localPath = path.join(FILINGS_DIR, localFilename);

    let content;
    if (fs.existsSync(localPath)) {
      console.log(`Loading cached 10-Q for ${ticker} from ${localPath}`);
      content = fs.readFileSync(localPath, 'utf-8');
    } else {
      // Download the filing
      console.log(`Downloading 10-Q for ${ticker} from ${documentUrl}`);
      const docResponse = await fetch(documentUrl, {
        headers: { 'User-Agent': SEC_USER_AGENT }
      });

      if (!docResponse.ok) {
        throw new Error(`Failed to download document: ${docResponse.status}`);
      }

      content = await docResponse.text();

      // Cache locally
      fs.writeFileSync(localPath, content, 'utf-8');
      console.log(`Cached 10-Q to ${localPath}`);
    }

    res.json({
      ticker,
      cik,
      companyName: name,
      filingDate: filingDates[targetIndex],
      accessionNumber,
      documentUrl,
      localPath,
      contentLength: content.length,
      // Include the raw content for AI processing
      content: req.query.includeContent === 'true' ? content : undefined,
      message: req.query.includeContent === 'true'
        ? 'Full content included'
        : 'Add ?includeContent=true to include raw HTML content'
    });
  } catch (err) {
    console.error('Error fetching 10-Q:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/sec/10q/:ticker/text
 * Get the 10-Q content as plain text (stripped HTML)
 */
router.get('/10q/:ticker/text', async (req, res) => {
  try {
    const ticker = req.params.ticker.toUpperCase();

    // Get CIK for ticker
    const tickerMap = await getTickerToCikMap();
    if (!tickerMap[ticker]) {
      return res.status(404).json({ error: 'Ticker not found', ticker });
    }

    const { cik, cikPadded, name } = tickerMap[ticker];

    // Fetch company submissions
    const submissionsUrl = `${SEC_SUBMISSIONS_URL}${cikPadded}.json`;
    const response = await fetch(submissionsUrl, {
      headers: { 'User-Agent': SEC_USER_AGENT }
    });

    if (!response.ok) {
      throw new Error(`SEC API returned ${response.status}`);
    }

    const data = await response.json();
    const recentFilings = data.filings?.recent || {};
    const forms = recentFilings.form || [];
    const accessionNumbers = recentFilings.accessionNumber || [];
    const filingDates = recentFilings.filingDate || [];
    const primaryDocuments = recentFilings.primaryDocument || [];

    // Find most recent 10-Q
    let targetIndex = forms.findIndex(f => f === '10-Q');
    if (targetIndex === -1) {
      return res.status(404).json({ error: '10-Q not found' });
    }

    const accessionNumber = accessionNumbers[targetIndex];
    const accessionForUrl = accessionNumber.replace(/-/g, '');
    const primaryDoc = primaryDocuments[targetIndex];
    const documentUrl = `${SEC_ARCHIVES_URL}/${cik}/${accessionForUrl}/${primaryDoc}`;

    // Check cache
    const localFilename = `${ticker}_10Q_${filingDates[targetIndex]}.htm`;
    const localPath = path.join(FILINGS_DIR, localFilename);

    let content;
    if (fs.existsSync(localPath)) {
      content = fs.readFileSync(localPath, 'utf-8');
    } else {
      const docResponse = await fetch(documentUrl, {
        headers: { 'User-Agent': SEC_USER_AGENT }
      });

      if (!docResponse.ok) {
        throw new Error(`Failed to download: ${docResponse.status}`);
      }

      content = await docResponse.text();
      fs.writeFileSync(localPath, content, 'utf-8');
    }

    // Strip HTML tags to get plain text
    const plainText = content
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#\d+;/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    res.json({
      ticker,
      cik,
      companyName: name,
      filingDate: filingDates[targetIndex],
      documentUrl,
      textLength: plainText.length,
      text: plainText
    });
  } catch (err) {
    console.error('Error getting 10-Q text:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/sec/search
 * Search for companies by name or ticker
 */
router.get('/search', async (req, res) => {
  try {
    const query = (req.query.q || '').toUpperCase();
    const limit = parseInt(req.query.limit) || 20;

    if (!query || query.length < 2) {
      return res.status(400).json({
        error: 'Query too short',
        message: 'Please provide at least 2 characters'
      });
    }

    const tickerMap = await getTickerToCikMap();

    // Search by ticker and company name
    const results = [];
    for (const [ticker, info] of Object.entries(tickerMap)) {
      if (results.length >= limit) break;

      if (ticker.includes(query) || info.name.toUpperCase().includes(query)) {
        results.push({
          ticker,
          ...info
        });
      }
    }

    res.json({
      query,
      count: results.length,
      results
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
