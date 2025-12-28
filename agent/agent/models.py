"""
Pydantic models for the AI Investment Analysis Agent.
"""
from typing import Optional, List
from pydantic import BaseModel


class QuarterlyMetrics(BaseModel):
    """Financial metrics for a single quarter from 10-Q filing."""
    period_end: str
    form: str = "10-Q"
    fiscal_year: Optional[int] = None
    fiscal_period: Optional[str] = None  # Q1, Q2, Q3, Q4
    
    # Income Statement
    revenue: Optional[float] = None
    net_income: Optional[float] = None
    eps_basic: Optional[float] = None
    eps_diluted: Optional[float] = None
    gross_profit: Optional[float] = None
    operating_income: Optional[float] = None
    
    # Calculated margins
    gross_margin: Optional[float] = None
    operating_margin: Optional[float] = None
    
    # Balance Sheet
    cash: Optional[float] = None
    total_debt: Optional[float] = None
    total_assets: Optional[float] = None
    stockholders_equity: Optional[float] = None
    
    # Cash Flow
    operating_cash_flow: Optional[float] = None
    
    # YoY changes (calculated)
    revenue_yoy_change: Optional[float] = None
    net_income_yoy_change: Optional[float] = None


class TrendAnalysis(BaseModel):
    """Trend analysis across multiple quarters."""
    revenue_trend: Optional[str] = None  # "growing", "declining", "stable"
    avg_revenue_growth_yoy: Optional[float] = None
    margin_trend: Optional[str] = None
    eps_trend: Optional[str] = None


class AnalysisRequest(BaseModel):
    """Request to analyze a stock."""
    num_quarters: int = 3
    include_current_price: bool = True


class AnalysisResponse(BaseModel):
    """Complete analysis response."""
    ticker: str
    company_name: Optional[str] = None
    cik: Optional[str] = None
    current_price: Optional[float] = None
    analysis_date: str
    
    quarterly_metrics: List[QuarterlyMetrics] = []
    trend_analysis: Optional[TrendAnalysis] = None
    investment_summary: Optional[str] = None
    
    # Error info
    error: Optional[str] = None
