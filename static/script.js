
/* ==========================================
   PRICEPULSE - COMPLETE SCRIPT.JS
========================================== */

const WATCHLIST_KEY = "pricepulse_watchlist";
const COMPARE_KEY = "pricepulse_compare";

let allProducts = [];
let visibleProducts = [];
let comparisonProducts = [];

const $ = (id) => document.getElementById(id);

/* ==========================================
   SAFE HELPERS
========================================== */

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function getNumber(value) {
    if (typeof value === "number") return value;

    if (typeof value === "string") {
        const parsed = Number(value.replace(/[₹,\s]/g, ""));
        return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
}

function getProductId(product) {
    return String(product.id ?? product.product_id ?? product._id ?? product.name ?? "");
}

function getProductName(product) {
    return product.name ?? product.title ?? "Unnamed product";
}

function getProductBrand(product) {
    return product.brand ?? product.name?.split(" ")[0] ?? "";
}

function getProductCategory(product) {
    return product.category ?? product.categories?.[0] ?? "";
}

function getProductRating(product) {
    return getNumber(product.rating ?? product.ratings) ?? 0;
}

function getProductPrice(product) {
    if (product.price != null) {
        return getNumber(product.price);
    }

    if (Array.isArray(product.prices) && product.prices.length) {
        const prices = product.prices
            .map(item => getNumber(item.price))
            .filter(price => price !== null && price >= 0);

        return prices.length ? Math.min(...prices) : null;
    }

    return null;
}

function formatPrice(price) {
    if (price === null || price === undefined) return "Price unavailable";

    return "₹" + Number(price).toLocaleString("en-IN", {
        maximumFractionDigits: 2
    });
}

function getSavedItems(key) {
    try {
        const value = JSON.parse(localStorage.getItem(key) || "[]");
        return Array.isArray(value) ? value : [];
    } catch {
        return [];
    }
}

function saveItems(key, items) {
    localStorage.setItem(key, JSON.stringify(items));
}

/* ==========================================
   LOAD PRODUCTS FROM FASTAPI
========================================== */

async function loadProducts() {
    try {
        const response = await fetch("/products");

        if (!response.ok) {
            throw new Error("Could not load products.");
        }

        const data = await response.json();

        // Supports either a list or an object containing products.
        allProducts = Array.isArray(data)
            ? data
            : Array.isArray(data.products)
                ? data.products
                : [];

        visibleProducts = [...allProducts];

        applyURLCategory();
        runFilters();

    } catch (error) {
        console.error("PricePulse product loading error:", error);

        const results = $("compareResults");

        if (results) {
            results.innerHTML = `
                <div class="empty-state">
                    <h3>Unable to load products</h3>
                    <p>Check that your FastAPI server is running and try again.</p>
                </div>
            `;
        }
    }
}

/* ==========================================
   PRODUCT CARD
========================================== */

function createProductCard(product) {
    const id = getProductId(product);
    const name = getProductName(product);
    const price = getProductPrice(product);
    const category = getProductCategory(product);
    const brand = getProductBrand(product);
    const rating = getProductRating(product);

    const image = product.image_url ?? product.image ?? product.imageUrl ?? "";

    const safeId = escapeHTML(id);

    return `
        <article class="product-card">
            <div class="product-image">
                ${
                    image
                        ? `<img src="${escapeHTML(image)}"
                               alt="${escapeHTML(name)}"
                               loading="lazy"
                               onerror="this.style.display='none'">`
                        : `<span class="product-placeholder">▣</span>`
                }
            </div>

            <p class="product-meta">
                ${escapeHTML(brand)}
                ${category ? " · " + escapeHTML(category) : ""}
            </p>

            <h3>${escapeHTML(name)}</h3>

            <div class="product-price">${formatPrice(price)}</div>

            ${
                rating > 0
                    ? `<p class="product-rating">★ ${rating.toFixed(1)} / 5</p>`
                    : `<p class="product-meta">Rating unavailable</p>`
            }

            <div class="product-actions">
                <button type="button"
                    data-action="compare"
                    data-id="${safeId}">
                    Compare
                </button>

                <button type="button"
                    data-action="track"
                    data-id="${safeId}">
                    ♡ Track Price
                </button>
            </div>
        </article>
    `;
}

function renderProducts(products, containerId = "compareResults") {
    const container = $(containerId);
    if (!container) return;

    if (!products.length) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">⌕</span>
                <h3>No products found</h3>
                <p>Try another search or change your filters.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = products.map(createProductCard).join("");
}

/* ==========================================
   SEARCH
========================================== */


async function searchProducts(query) {
    const cleanedQuery = query.trim();

    if (!cleanedQuery) {
        visibleProducts = [...allProducts];
        runFilters();
        return;
    }

    // Clear previous filters so they don't block new searches.
    if ($("categoryFilter")) $("categoryFilter").value = "";
    if ($("brandFilter")) $("brandFilter").value = "";
    if ($("maxPriceFilter")) $("maxPriceFilter").value = "";
    if ($("ratingFilter")) $("ratingFilter").value = "0";

    try {
        const response = await fetch(
            `/search?q=${encodeURIComponent(cleanedQuery)}`
        );

        if (!response.ok) {
            throw new Error("Search request failed.");
        }

        const data = await response.json();

        const results = Array.isArray(data)
            ? data
            : Array.isArray(data.products)
                ? data.products
                : [];

        visibleProducts = results;
        runFilters();

    } catch (error) {
        console.error("Search error:", error);

        const queryLower = cleanedQuery.toLowerCase();

        visibleProducts = allProducts.filter(product =>
            getProductName(product).toLowerCase().includes(queryLower) ||
            getProductBrand(product).toLowerCase().includes(queryLower) ||
            String(product.model ?? "").toLowerCase().includes(queryLower) ||
            getProductCategory(product).toLowerCase().includes(queryLower)
        );

        runFilters();
    }
}


        // Local fallback if the search endpoint is temporarily unavailable.
        const queryLower = cleanedQuery.toLowerCase();

        visibleProducts = allProducts.filter(product =>
            getProductName(product).toLowerCase().includes(queryLower) ||
            getProductBrand(product).toLowerCase().includes(queryLower) ||
            getProductCategory(product).toLowerCase().includes(queryLower)
        );

        runFilters();
    }
}

/* ==========================================
   FILTERS AND SORTING
========================================== */

function runFilters() {
    let products = [...visibleProducts];

    const category = $("categoryFilter")?.value?.toLowerCase() ?? "";
    const brand = $("brandFilter")?.value?.trim().toLowerCase() ?? "";
    const maxPrice = getNumber($("maxPriceFilter")?.value);
    const minRating = getNumber($("ratingFilter")?.value) ?? 0;
    const sort = $("sortFilter")?.value ?? "lowest";

    if (category) {
        products = products.filter(product =>
            getProductCategory(product).toLowerCase() === category
        );
    }

    if (brand) {
        products = products.filter(product =>
            getProductBrand(product).toLowerCase().includes(brand)
        );
    }

    if (maxPrice !== null && maxPrice >= 0) {
        products = products.filter(product => {
            const price = getProductPrice(product);
            return price !== null && price <= maxPrice;
        });
    }

    if (minRating > 0) {
        products = products.filter(product =>
            getProductRating(product) >= minRating
        );
    }

    if (sort === "lowest") {
        products.sort((a, b) =>
            (getProductPrice(a) ?? Infinity) -
            (getProductPrice(b) ?? Infinity)
        );
    } else if (sort === "highest") {
        products.sort((a, b) =>
            (getProductPrice(b) ?? -Infinity) -
            (getProductPrice(a) ?? -Infinity)
        );
    } else if (sort === "rating") {
        products.sort((a, b) =>
            getProductRating(b) - getProductRating(a)
        );
    }

    renderProducts(products);

    const count = $("resultsCount");

    if (count) {
        count.textContent =
            `${products.length} product${products.length === 1 ? "" : "s"} found`;
    }
}

/* ==========================================
   COMPARE PRODUCTS
========================================== */

function addToComparison(product) {
    const id = getProductId(product);

    if (comparisonProducts.some(item => getProductId(item) === id)) {
        alert("This product is already in your comparison list.");
        return;
    }

    comparisonProducts.push(product);

    saveItems(COMPARE_KEY, comparisonProducts.map(item => ({
        id: getProductId(item),
        name: getProductName(item),
        price: getProductPrice(item),
        category: getProductCategory(item)
    })));

    renderComparison();
}

function removeFromComparison(id) {
    comparisonProducts = comparisonProducts.filter(
        product => getProductId(product) !== String(id)
    );

    saveItems(COMPARE_KEY, comparisonProducts.map(item => ({
        id: getProductId(item),
        name: getProductName(item),
        price: getProductPrice(item),
        category: getProductCategory(item)
    })));

    renderComparison();
}

function renderComparison() {
    const container = $("comparisonResults");
    const message = $("comparisonMessage");

    if (!container) return;

    if (!comparisonProducts.length) {
        container.innerHTML = "";

        if (message) {
            message.textContent =
                "Add products using the Compare button to build your shortlist.";
        }

        return;
    }

    if (message) {
        message.textContent =
            `${comparisonProducts.length} product${comparisonProducts.length === 1 ? "" : "s"} selected.`;
    }

    container.innerHTML = comparisonProducts.map(product => `
        <article class="comparison-item">
            <div>
                <h3>${escapeHTML(getProductName(product))}</h3>
                <p>${escapeHTML(getProductCategory(product))}</p>
                <strong>${formatPrice(getProductPrice(product))}</strong>
            </div>

            <button type="button"
                class="remove-comparison"
                data-remove-compare="${escapeHTML(getProductId(product))}">
                Remove
            </button>
        </article>
    `).join("");
}

/* ==========================================
   PRICE WATCHLIST
========================================== */

function addToWatchlist(product) {
    const items = getSavedItems(WATCHLIST_KEY);
    const id = getProductId(product);

    if (items.some(item => String(item.id) === id)) {
        alert("This product is already in your watchlist.");
        return;
    }

    items.push({
        id,
        name: getProductName(product),
        price: getProductPrice(product),
        targetPrice: null
    });

    saveItems(WATCHLIST_KEY, items);
    alert("Product added to your watchlist!");
}

/* ==========================================
   CLICK EVENTS FOR PRODUCT CARDS
========================================== */

document.addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button) return;

    const action = button.dataset.action;
    const id = button.dataset.id;

    if (action === "compare") {
        const product = visibleProducts.find(
            item => getProductId(item) === id
        ) || allProducts.find(item => getProductId(item) === id);

        if (product) addToComparison(product);
    }

    if (action === "track") {
        const product = visibleProducts.find(
            item => getProductId(item) === id
        ) || allProducts.find(item => getProductId(item) === id);

        if (product) addToWatchlist(product);
    }

    if (button.dataset.removeCompare) {
        removeFromComparison(button.dataset.removeCompare);
    }
});

/* ==========================================
   PAGE INITIALISATION
========================================== */

function applyURLCategory() {
    const params = new URLSearchParams(window.location.search);
    const category = params.get("category");

    if (category && $("categoryFilter")) {
        $("categoryFilter").value = category;
    }
}

function setupComparePage() {
    const form = $("compareSearchForm");
    const input = $("compareSearchInput");

    if (form && input) {
        form.addEventListener("submit", event => {
            event.preventDefault();
            searchProducts(input.value);
        });

        input.addEventListener("input", () => {
            if (!input.value.trim()) {
                visibleProducts = [...allProducts];
                runFilters();
            }
        });
    }

    $("applyFilters")?.addEventListener("click", runFilters);
    $("sortFilter")?.addEventListener("change", runFilters);
    $("categoryFilter")?.addEventListener("change", runFilters);

    $("brandFilter")?.addEventListener("input", runFilters);
    $("maxPriceFilter")?.addEventListener("input", runFilters);
    $("ratingFilter")?.addEventListener("change", runFilters);

    $("resetFilters")?.addEventListener("click", () => {
        if ($("categoryFilter")) $("categoryFilter").value = "";
        if ($("brandFilter")) $("brandFilter").value = "";
        if ($("maxPriceFilter")) $("maxPriceFilter").value = "";
        if ($("ratingFilter")) $("ratingFilter").value = "0";
        if ($("sortFilter")) $("sortFilter").value = "lowest";

        const input = $("compareSearchInput");

        if (input) input.value = "";

        visibleProducts = [...allProducts];
        runFilters();
    });
}

function setupHomePage() {
    const form = $("homeSearchForm");
    const input = $("homeSearchInput");
    const results = $("homeSearchResults");

    if (form && input) {
        form.addEventListener("submit", async event => {
            event.preventDefault();

            if (results) {
                results.innerHTML = `
                    <div class="empty-state">
                        <p>Searching products...</p>
                    </div>
                `;
            }

            try {
                const response = await fetch(
                    `/search?q=${encodeURIComponent(input.value.trim())}`
                );

                if (!response.ok) throw new Error("Search failed.");

                const data = await response.json();

                const products = Array.isArray(data)
                    ? data
                    : Array.isArray(data.products)
                        ? data.products
                        : [];

                renderProducts(products, "homeSearchResults");

            } catch (error) {
                console.error(error);

                if (results) {
                    results.innerHTML = `
                        <div class="empty-state">
                            <h3>Search unavailable</h3>
                            <p>Please check the backend and try again.</p>
                        </div>
                    `;
                }
            }
        });
    }

    document.querySelectorAll("[data-search]").forEach(button => {
        button.addEventListener("click", () => {
            if (input) {
                input.value = button.dataset.search;
                form?.requestSubmit();
            }
        });
    });
}

document.addEventListener("DOMContentLoaded", () => {
    setupComparePage();
    setupHomePage();
    renderComparison();
    loadProducts();
});
