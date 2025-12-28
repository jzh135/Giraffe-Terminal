"""
Prompts for the AI agent's qualitative analysis.
These prompts are minimal to reduce token usage.
"""

SYNTHESIS_PROMPT = """You are a professional investment analyst. Given the following financial metrics for {ticker} ({company_name}), provide a brief investment analysis.

QUARTERLY DATA (Most Recent 10-Q Filings):
{metrics_summary}

CURRENT PRICE: ${current_price}

TREND ANALYSIS:
- Revenue Trend: {revenue_trend}
- Average YoY Growth: {avg_growth}
- Margin Trend: {margin_trend}
- EPS Trend: {eps_trend}

Provide a concise 2-3 sentence investment summary that:
1. Summarizes the financial health based on the numbers
2. Notes key strengths or concerns
3. Gives a brief valuation perspective

Keep the response under 150 words. Be specific and cite numbers."""


def format_metrics_for_prompt(metrics_list) -> str:
    """Format quarterly metrics into a readable string for the LLM prompt."""
    if not metrics_list:
        return "No quarterly data available."
    
    lines = []
    for m in metrics_list:
        period = m.fiscal_period or m.period_end
        parts = [f"**{period}**:"]
        
        if m.revenue:
            parts.append(f"Revenue ${m.revenue/1e9:.2f}B")
        if m.net_income:
            parts.append(f"Net Income ${m.net_income/1e9:.2f}B")
        if m.eps_diluted:
            parts.append(f"EPS ${m.eps_diluted:.2f}")
        if m.gross_margin:
            parts.append(f"Gross Margin {m.gross_margin*100:.1f}%")
        
        lines.append(" | ".join(parts))
    
    return "\n".join(lines)
