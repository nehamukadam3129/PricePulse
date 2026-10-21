
from urllib.parse import quote_plus
from datetime import datetime, timezone


@app.get("/compare/{product_id}")
def compare_prices(product_id: int):
    for product in load_products():
        try:
            if int(product.get("id")) != product_id:
                continue
        except (TypeError, ValueError):
            continue

        product_name = product.get("name", "")
        variant = product.get("variant", "")
        search_name = f"{product_name} {variant}".strip()
        query = quote_plus(search_name)

        store_search_urls = {
            "Amazon": f"https://www.amazon.in/s?k={query}",
            "Flipkart": f"https://www.flipkart.com/search?q={query}",
            "Croma": f"https://www.croma.com/searchB?q={query}",
        }

        prices = []

        for item in product.get("prices", []) or []:
            if not isinstance(item, dict):
                continue

            platform = str(item.get("platform", "")).strip()

            try:
                price = float(item.get("price"))
                if price <= 0:
                    continue
            except (TypeError, ValueError):
                continue

            prices.append({
                "platform": platform,
                "price": price,
                "currency": "INR",
                "product_url": store_search_urls.get(platform),
                "availability": item.get(
                    "availability", "Not verified"
                ),
                "is_live": False,
                "price_status": "Sample price - not live verified"
            })

        prices.sort(key=lambda item: item["price"])

        return {
            "status": "success",
            "product": product_name,
            "variant": variant,
            "prices": prices,
            "lowest_price": prices[0] if prices else None,
            "potential_savings": (
                round(prices[-1]["price"] - prices[0]["price"], 2)
                if len(prices) >= 2 else 0
            ),
            "price_data_status": "sample",
            "message": (
                "Sample prices only. Open each store to check its "
                "current price before purchasing."
            ),
            "count": len(prices)
        }

    return {
        "status": "error",
        "message": "Product not found"
    }
