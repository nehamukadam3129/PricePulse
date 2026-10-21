
import json
from pathlib import Path
from urllib.parse import quote_plus

from fastapi import FastAPI, Query
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi import Request

BASE_DIR = Path(__file__).resolve().parent
DATA_FILE = BASE_DIR / "data" / "products.json"

app = FastAPI(
    title="PricePulse",
    description="Multi-Platform Online Product Price Comparison System",
    version="1.0"
)

app.mount(
    "/static",
    StaticFiles(directory=str(BASE_DIR / "static")),
    name="static"
)

templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))


def load_products():
    try:
        with open(DATA_FILE, "r", encoding="utf-8") as file:
            data = json.load(file)
            return data if isinstance(data, list) else []
    except (FileNotFoundError, json.JSONDecodeError):
        return []


@app.get("/health")
def health():
    return {"status": "success", "message": "PricePulse backend is running"}


@app.get("/", response_class=HTMLResponse)
def home(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={"products": load_products()}
    )


@app.get("/compare", response_class=HTMLResponse)
def compare_page(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="compare.html",
        context={"products": load_products()}
    )


@app.get("/categories", response_class=HTMLResponse)
def categories_page(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="categories.html",
        context={"products": load_products()}
    )


@app.get("/tracking", response_class=HTMLResponse)
def tracking_page(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="tracking.html",
        context={"products": load_products()}
    )


@app.get("/about", response_class=HTMLResponse)
def about_page(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="about.html",
        context={"products": load_products()}
    )


@app.get("/products")
def get_products():
    return {"status": "success", "products": load_products()}


@app.get("/search")
def search_products(q: str = Query(default="")):
    query = q.strip().lower()

    if not query:
        return {"status": "success", "products": []}

    matches = [
        product for product in load_products()
        if query in str(product.get("name", "")).lower()
        or query in str(product.get("brand", "")).lower()
        or query in str(product.get("model", "")).lower()
        or query in str(product.get("category", "")).lower()
    ]

    return {"status": "success", "products": matches}


@app.get("/browse")
def browse_products(category: str = ""):
    products = load_products()

    if category:
        products = [
            p for p in products
            if str(p.get("category", "")).lower() == category.lower()
        ]

    return {"status": "success", "products": products}


@app.get("/products/{product_id}")
def get_product(product_id: int):
    for product in load_products():
        if product.get("id") == product_id:
            return {"status": "success", "product": product}

    return {"status": "error", "message": "Product not found"}


@app.get("/compare/{product_id}")
def compare_prices(product_id: int):
    product = next(
        (
            p for p in load_products()
            if str(p.get("id")) == str(product_id)
        ),
        None
    )

    if not product:
        return {"status": "error", "message": "Product not found"}

    product_name = str(product.get("name", ""))
    variant = str(product.get("variant", ""))
    query = quote_plus(f"{product_name} {variant}".strip())

    store_urls = {
        "Amazon": f"https://www.amazon.in/s?k={query}",
        "Flipkart": f"https://www.flipkart.com/search?q={query}",
        "Croma": f"https://www.croma.com/searchB?q={query}"
    }

    prices = []

    for item in product.get("prices", []):
        if not isinstance(item, dict):
            continue

        platform = str(item.get("platform", "")).strip()

        try:
            price = float(item.get("price", 0))
        except (TypeError, ValueError):
            continue

        if price <= 0:
            continue

        prices.append({
            "platform": platform,
            "price": price,
            "currency": "INR",
            "product_url": store_urls.get(platform),
            "availability": item.get("availability", "Not verified"),
            "is_live": False,
            "price_status": "Stored price - not live verified"
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
            "Stored prices are not verified live. Open each store "
            "to check the current price before purchasing."
        ),
        "count": len(prices)
    }
