"""
LangGraph Agent for Investment Analysis.

This agent orchestrates the analysis workflow:
1. Fetch XBRL data from SEC (no LLM)
2. Extract financial metrics (no LLM)
3. Calculate trends (no LLM)
4. Get current price (no LLM)
5. Generate investment summary (uses LLM - minimal tokens)
"""
import os
from typing import TypedDict, Optional, List, Annotated
from datetime import date

from langgraph.graph import StateGraph, END
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage

from .models import QuarterlyMetrics, TrendAnalysis, AnalysisResponse
from .tools.xbrl_extractor import extract_quarterly_metrics, calculate_trends
from .tools.price_fetcher import get_current_price
from .prompts import SYNTHESIS_PROMPT, format_metrics_for_prompt


# Agent State
class AgentState(TypedDict):
    ticker: str
    num_quarters: int
    include_current_price: bool
    
    # Extracted data
    company_name: Optional[str]
    cik: Optional[str]
    quarterly_metrics: List[QuarterlyMetrics]
    trend_analysis: Optional[TrendAnalysis]
    current_price: Optional[float]
    
    # Final output
    investment_summary: Optional[str]
    error: Optional[str]


# Node functions
async def fetch_xbrl_data(state: AgentState) -> AgentState:
    """Fetch and parse XBRL data from SEC. No LLM used."""
    try:
        company_name, cik, metrics = await extract_quarterly_metrics(
            state["ticker"],
            state["num_quarters"]
        )
        return {
            **state,
            "company_name": company_name,
            "cik": cik,
            "quarterly_metrics": metrics,
        }
    except Exception as e:
        return {
            **state,
            "error": f"Failed to fetch XBRL data: {str(e)}"
        }


async def analyze_trends(state: AgentState) -> AgentState:
    """Calculate trends from the quarterly metrics. No LLM used."""
    if state.get("error"):
        return state
    
    trends = calculate_trends(state.get("quarterly_metrics", []))
    return {
        **state,
        "trend_analysis": trends,
    }


async def fetch_current_price(state: AgentState) -> AgentState:
    """Fetch current stock price from Giraffe Terminal. No LLM used."""
    if state.get("error"):
        return state
    
    if state.get("include_current_price", True):
        price = await get_current_price(state["ticker"])
        return {
            **state,
            "current_price": price,
        }
    return state


async def generate_summary(state: AgentState) -> AgentState:
    """Generate investment summary using LLM. This is the only step that uses tokens."""
    if state.get("error"):
        return state
    
    # Get LLM model from environment
    model_name = os.getenv("LLM_MODEL", "gemini-2.0-flash")
    
    try:
        llm = ChatGoogleGenerativeAI(
            model=model_name,
            temperature=0.3,
        )
        
        # Format the prompt
        metrics = state.get("quarterly_metrics", [])
        trends = state.get("trend_analysis") or TrendAnalysis()
        
        prompt = SYNTHESIS_PROMPT.format(
            ticker=state["ticker"],
            company_name=state.get("company_name", "Unknown"),
            metrics_summary=format_metrics_for_prompt(metrics),
            current_price=state.get("current_price") or "N/A",
            revenue_trend=trends.revenue_trend or "N/A",
            avg_growth=f"{trends.avg_revenue_growth_yoy*100:.1f}%" if trends.avg_revenue_growth_yoy else "N/A",
            margin_trend=trends.margin_trend or "N/A",
            eps_trend=trends.eps_trend or "N/A",
        )
        
        # Call LLM
        response = await llm.ainvoke([HumanMessage(content=prompt)])
        
        return {
            **state,
            "investment_summary": response.content,
        }
    except Exception as e:
        # If LLM fails, still return the data without summary
        return {
            **state,
            "investment_summary": f"(LLM summary unavailable: {str(e)})",
        }


def should_continue(state: AgentState) -> str:
    """Decide whether to continue or end (if error occurred)."""
    if state.get("error"):
        return "end"
    return "continue"


# Build the graph
def create_analysis_graph():
    """Create the LangGraph workflow for investment analysis."""
    workflow = StateGraph(AgentState)
    
    # Add nodes
    workflow.add_node("fetch_xbrl", fetch_xbrl_data)
    workflow.add_node("analyze_trends", analyze_trends)
    workflow.add_node("fetch_price", fetch_current_price)
    workflow.add_node("generate_summary", generate_summary)
    
    # Define edges
    workflow.set_entry_point("fetch_xbrl")
    
    workflow.add_conditional_edges(
        "fetch_xbrl",
        should_continue,
        {
            "continue": "analyze_trends",
            "end": END,
        }
    )
    
    workflow.add_edge("analyze_trends", "fetch_price")
    workflow.add_edge("fetch_price", "generate_summary")
    workflow.add_edge("generate_summary", END)
    
    return workflow.compile()


# Main analysis function
async def analyze_stock(
    ticker: str,
    num_quarters: int = 3,
    include_current_price: bool = True
) -> AnalysisResponse:
    """
    Run the complete investment analysis for a stock.
    
    Args:
        ticker: Stock ticker symbol (e.g., "AAPL")
        num_quarters: Number of 10-Q quarters to analyze
        include_current_price: Whether to fetch current price from Giraffe API
    
    Returns:
        AnalysisResponse with all extracted data and AI summary
    """
    graph = create_analysis_graph()
    
    initial_state: AgentState = {
        "ticker": ticker.upper(),
        "num_quarters": num_quarters,
        "include_current_price": include_current_price,
        "company_name": None,
        "cik": None,
        "quarterly_metrics": [],
        "trend_analysis": None,
        "current_price": None,
        "investment_summary": None,
        "error": None,
    }
    
    # Run the graph
    result = await graph.ainvoke(initial_state)
    
    # Convert to response model
    return AnalysisResponse(
        ticker=result["ticker"],
        company_name=result.get("company_name"),
        cik=result.get("cik"),
        current_price=result.get("current_price"),
        analysis_date=date.today().isoformat(),
        quarterly_metrics=result.get("quarterly_metrics", []),
        trend_analysis=result.get("trend_analysis"),
        investment_summary=result.get("investment_summary"),
        error=result.get("error"),
    )
