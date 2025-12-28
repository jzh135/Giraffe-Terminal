"""
Investment Analysis AI Agent - FastAPI Server

This server provides REST API endpoints for the AI investment analysis agent.
Run with: uvicorn main:app --reload --port 8000
"""
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from agent.models import AnalysisRequest, AnalysisResponse
from agent.graph import analyze_stock


# Create FastAPI app
app = FastAPI(
    title="Giraffe Terminal AI Agent",
    description="AI-powered investment analysis using SEC 10-Q filings",
    version="1.0.0"
)

# Add CORS middleware for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "status": "running",
        "service": "Giraffe Terminal AI Agent",
        "version": "1.0.0"
    }


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy"}


@app.post("/analyze/{ticker}", response_model=AnalysisResponse)
async def analyze(ticker: str, request: AnalysisRequest = None):
    """
    Analyze a stock using SEC 10-Q filings and AI.
    
    This endpoint:
    1. Fetches XBRL data from SEC (no LLM tokens)
    2. Extracts financial metrics (no LLM tokens)
    3. Calculates trends (no LLM tokens)
    4. Gets current price from Giraffe Terminal
    5. Generates investment summary (minimal LLM tokens)
    
    Args:
        ticker: Stock ticker symbol (e.g., "AAPL", "MSFT")
        request: Optional analysis configuration
    
    Returns:
        AnalysisResponse with quarterly metrics, trends, and AI summary
    """
    if request is None:
        request = AnalysisRequest()
    
    try:
        result = await analyze_stock(
            ticker=ticker,
            num_quarters=request.num_quarters,
            include_current_price=request.include_current_price
        )
        
        if result.error:
            raise HTTPException(status_code=400, detail=result.error)
        
        return result
    
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


# Run with: python main.py
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
