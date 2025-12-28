"""
Price Fetcher - Get current stock price from Giraffe Terminal API.
"""
import os
import httpx
from typing import Optional


GIRAFFE_API_URL = os.getenv("GIRAFFE_API_URL", "http://localhost:3001/api")


async def get_current_price(symbol: str) -> Optional[float]:
    """
    Get the current price for a symbol from Giraffe Terminal API.
    Returns None if price cannot be fetched.
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{GIRAFFE_API_URL}/prices/fetch/{symbol}",
                timeout=30.0
            )
            
            if response.status_code == 200:
                data = response.json()
                return data.get("price")
            else:
                print(f"Failed to fetch price for {symbol}: {response.status_code}")
                return None
    except Exception as e:
        print(f"Error fetching price for {symbol}: {e}")
        return None
