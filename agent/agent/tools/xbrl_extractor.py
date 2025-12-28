"""
XBRL Extractor - Programmatic extraction of financial metrics from SEC XBRL data.
No LLM tokens used here! This is pure Python parsing.
"""
import os
import httpx
from typing import Optional, Dict, List, Any
from ..models import QuarterlyMetrics, TrendAnalysis


# SEC requires a User-Agent header with company name and email
# Format: "Company Name admin@email.com"
# See: https://www.sec.gov/os/accessing-edgar-data
SEC_USER_AGENT = os.getenv(
    "SEC_USER_AGENT", 
    "GiraffeTerminal admin@giraffeterminal.local"
)

# SEC API endpoints
SEC_COMPANY_TICKERS_URL = "https://www.sec.gov/files/company_tickers.json"
SEC_COMPANY_FACTS_URL = "https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json"


# Common XBRL concept mappings (US-GAAP taxonomy)
# Many companies use different tags for the same concept, so we try multiple
REVENUE_CONCEPTS = [
    "Revenues",
    "RevenueFromContractWithCustomerExcludingAssessedTax",
    "RevenueFromContractWithCustomerIncludingAssessedTax",
    "SalesRevenueNet",
    "TotalRevenuesAndOtherIncome",
]

NET_INCOME_CONCEPTS = [
    "NetIncomeLoss",
    "NetIncomeLossAvailableToCommonStockholdersBasic",
    "ProfitLoss",
]

EPS_BASIC_CONCEPTS = [
    "EarningsPerShareBasic",
]

EPS_DILUTED_CONCEPTS = [
    "EarningsPerShareDiluted",
]

GROSS_PROFIT_CONCEPTS = [
    "GrossProfit",
]

OPERATING_INCOME_CONCEPTS = [
    "OperatingIncomeLoss",
]

CASH_CONCEPTS = [
    "CashAndCashEquivalentsAtCarryingValue",
    "Cash",
    "CashCashEquivalentsAndShortTermInvestments",
]

ASSETS_CONCEPTS = [
    "Assets",
]

EQUITY_CONCEPTS = [
    "StockholdersEquity",
    "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
]

OPERATING_CASH_FLOW_CONCEPTS = [
    "NetCashProvidedByUsedInOperatingActivities",
]


async def get_ticker_to_cik(ticker: str) -> Optional[Dict[str, Any]]:
    """
    Get CIK and company info for a ticker symbol.
    Returns dict with cik, cik_padded, and name.
    """
    async with httpx.AsyncClient() as client:
        response = await client.get(
            SEC_COMPANY_TICKERS_URL,
            headers={"User-Agent": SEC_USER_AGENT},
            timeout=30.0
        )
        response.raise_for_status()
        data = response.json()
    
    ticker_upper = ticker.upper()
    for entry in data.values():
        if entry.get("ticker", "").upper() == ticker_upper:
            cik = entry["cik_str"]
            return {
                "cik": str(cik),
                "cik_padded": str(cik).zfill(10),
                "name": entry.get("title", "")
            }
    return None


async def fetch_company_facts(cik_padded: str) -> Dict[str, Any]:
    """
    Fetch all XBRL facts for a company from SEC.
    Returns the full company facts JSON.
    """
    url = SEC_COMPANY_FACTS_URL.format(cik=cik_padded)
    
    async with httpx.AsyncClient() as client:
        response = await client.get(
            url,
            headers={"User-Agent": SEC_USER_AGENT},
            timeout=60.0
        )
        response.raise_for_status()
        return response.json()


def extract_metric_values(
    facts: Dict[str, Any],
    concepts: List[str],
    form_filter: str = "10-Q",
    unit_filter: str = "USD"
) -> List[Dict[str, Any]]:
    """
    Extract values for a metric from XBRL facts.
    Tries multiple concept names and returns all matching values.
    """
    us_gaap = facts.get("facts", {}).get("us-gaap", {})
    results = []
    
    for concept in concepts:
        concept_data = us_gaap.get(concept, {})
        units = concept_data.get("units", {})
        
        # Get values for the specified unit (USD or USD/shares for EPS)
        values = units.get(unit_filter, [])
        
        for v in values:
            if v.get("form") == form_filter:
                results.append({
                    "concept": concept,
                    "value": v.get("val"),
                    "end": v.get("end"),
                    "fiscal_year": v.get("fy"),
                    "fiscal_period": v.get("fp"),
                    "filed": v.get("filed"),
                    "accn": v.get("accn"),
                })
    
    # Sort by end date descending (most recent first)
    results.sort(key=lambda x: x.get("end", ""), reverse=True)
    return results


def get_most_recent_value(
    facts: Dict[str, Any],
    concepts: List[str],
    period_end: str,
    form_filter: str = "10-Q",
    unit_filter: str = "USD"
) -> Optional[float]:
    """
    Get the most recent value for a metric that matches the given period end date.
    """
    values = extract_metric_values(facts, concepts, form_filter, unit_filter)
    
    for v in values:
        if v.get("end") == period_end:
            return v.get("value")
    
    return None


def get_unique_periods(
    facts: Dict[str, Any],
    form_filter: str = "10-Q",
    limit: int = 12
) -> List[Dict[str, str]]:
    """
    Get a list of unique reporting periods from the XBRL data.
    Returns list of dicts with 'end', 'fiscal_year', 'fiscal_period'.
    """
    us_gaap = facts.get("facts", {}).get("us-gaap", {})
    periods = set()
    
    # Look through revenue concepts to find periods
    for concept in REVENUE_CONCEPTS:
        concept_data = us_gaap.get(concept, {})
        units = concept_data.get("units", {})
        values = units.get("USD", [])
        
        for v in values:
            if v.get("form") == form_filter:
                period_key = (v.get("end"), v.get("fy"), v.get("fp"))
                if period_key[0]:  # Only add if we have an end date
                    periods.add(period_key)
    
    # Sort by end date descending
    sorted_periods = sorted(periods, key=lambda x: x[0], reverse=True)
    
    return [
        {"end": p[0], "fiscal_year": p[1], "fiscal_period": p[2]}
        for p in sorted_periods[:limit]
    ]


async def extract_quarterly_metrics(
    ticker: str,
    num_quarters: int = 3
) -> tuple[str, str, List[QuarterlyMetrics]]:
    """
    Extract financial metrics for the N most recent quarters.
    Returns (company_name, cik, list of QuarterlyMetrics).
    """
    # Get CIK for ticker
    ticker_info = await get_ticker_to_cik(ticker)
    if not ticker_info:
        raise ValueError(f"Ticker '{ticker}' not found in SEC records")
    
    company_name = ticker_info["name"]
    cik = ticker_info["cik"]
    cik_padded = ticker_info["cik_padded"]
    
    # Fetch XBRL data
    facts = await fetch_company_facts(cik_padded)
    
    # Get unique 10-Q periods
    periods = get_unique_periods(facts, form_filter="10-Q", limit=num_quarters)
    
    if not periods:
        raise ValueError(f"No 10-Q filings found for {ticker}")
    
    metrics_list = []
    
    for period in periods[:num_quarters]:
        period_end = period["end"]
        
        # Extract each metric for this period
        revenue = get_most_recent_value(facts, REVENUE_CONCEPTS, period_end)
        net_income = get_most_recent_value(facts, NET_INCOME_CONCEPTS, period_end)
        eps_basic = get_most_recent_value(facts, EPS_BASIC_CONCEPTS, period_end, unit_filter="USD/shares")
        eps_diluted = get_most_recent_value(facts, EPS_DILUTED_CONCEPTS, period_end, unit_filter="USD/shares")
        gross_profit = get_most_recent_value(facts, GROSS_PROFIT_CONCEPTS, period_end)
        operating_income = get_most_recent_value(facts, OPERATING_INCOME_CONCEPTS, period_end)
        cash = get_most_recent_value(facts, CASH_CONCEPTS, period_end)
        total_assets = get_most_recent_value(facts, ASSETS_CONCEPTS, period_end)
        equity = get_most_recent_value(facts, EQUITY_CONCEPTS, period_end)
        ocf = get_most_recent_value(facts, OPERATING_CASH_FLOW_CONCEPTS, period_end)
        
        # Calculate margins if we have the data
        gross_margin = None
        if gross_profit and revenue and revenue > 0:
            gross_margin = gross_profit / revenue
        
        operating_margin = None
        if operating_income and revenue and revenue > 0:
            operating_margin = operating_income / revenue
        
        metrics = QuarterlyMetrics(
            period_end=period_end,
            fiscal_year=period.get("fiscal_year"),
            fiscal_period=period.get("fiscal_period"),
            revenue=revenue,
            net_income=net_income,
            eps_basic=eps_basic,
            eps_diluted=eps_diluted,
            gross_profit=gross_profit,
            operating_income=operating_income,
            gross_margin=gross_margin,
            operating_margin=operating_margin,
            cash=cash,
            total_assets=total_assets,
            stockholders_equity=equity,
            operating_cash_flow=ocf,
        )
        metrics_list.append(metrics)
    
    return company_name, cik, metrics_list


def calculate_trends(metrics: List[QuarterlyMetrics]) -> TrendAnalysis:
    """
    Calculate trends from quarterly metrics.
    """
    if not metrics:
        return TrendAnalysis()
    
    # Revenue trend
    revenues = [m.revenue for m in metrics if m.revenue is not None]
    if len(revenues) >= 2:
        # Check if revenues are increasing or decreasing
        if revenues[0] > revenues[-1]:
            revenue_trend = "growing"
        elif revenues[0] < revenues[-1]:
            revenue_trend = "declining"
        else:
            revenue_trend = "stable"
        
        # Calculate average growth (simplified - just compare first vs last)
        if revenues[-1] > 0:
            total_growth = (revenues[0] - revenues[-1]) / revenues[-1]
            avg_growth = total_growth / len(revenues)
        else:
            avg_growth = None
    else:
        revenue_trend = "insufficient data"
        avg_growth = None
    
    # Margin trend
    margins = [m.gross_margin for m in metrics if m.gross_margin is not None]
    if len(margins) >= 2:
        margin_diff = margins[0] - margins[-1]
        if abs(margin_diff) < 0.02:  # Less than 2% change
            margin_trend = "stable"
        elif margin_diff > 0:
            margin_trend = "expanding"
        else:
            margin_trend = "contracting"
    else:
        margin_trend = "insufficient data"
    
    # EPS trend
    eps_values = [m.eps_diluted for m in metrics if m.eps_diluted is not None]
    if len(eps_values) >= 2:
        if eps_values[0] > eps_values[-1]:
            eps_trend = "growing"
        elif eps_values[0] < eps_values[-1]:
            eps_trend = "declining"
        else:
            eps_trend = "stable"
    else:
        eps_trend = "insufficient data"
    
    return TrendAnalysis(
        revenue_trend=revenue_trend,
        avg_revenue_growth_yoy=avg_growth,
        margin_trend=margin_trend,
        eps_trend=eps_trend,
    )
