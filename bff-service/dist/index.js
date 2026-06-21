"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// ─── Cache (optional +20) ────────────────────────────────────────────────────
// Caches GET /products responses from the product service for 2 minutes.
const CACHE_TTL_MS = 2 * 60 * 1000;
const cache = new Map();
function getCached(key) {
    const entry = cache.get(key);
    if (entry && entry.expiresAt > Date.now()) {
        console.log(`[cache] HIT  ${key}`);
        return entry.data;
    }
    cache.delete(key);
    return null;
}
function setCached(key, data) {
    console.log(`[cache] SET  ${key} (TTL ${CACHE_TTL_MS / 1000}s)`);
    cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}
// ─── Headers ─────────────────────────────────────────────────────────────────
// Strip hop-by-hop headers that must not be forwarded.
const HOP_BY_HOP = new Set([
    'host',
    'connection',
    'content-length',
    'transfer-encoding',
    'keep-alive',
    'upgrade',
    'te',
    'trailer',
]);
function buildForwardHeaders(req) {
    const headers = {};
    for (const [key, value] of Object.entries(req.headers)) {
        if (!HOP_BY_HOP.has(key.toLowerCase()) && typeof value === 'string') {
            headers[key] = value;
        }
    }
    return headers;
}
// ─── Proxy middleware ─────────────────────────────────────────────────────────
app.use(express_1.default.json());
app.all('*', async (req, res) => {
    // Extract service name from the first path segment: /product/... → "product"
    const parts = req.path.split('/').filter(Boolean);
    const serviceName = parts[0];
    if (!serviceName) {
        return res.status(502).json({ message: 'Cannot process request' });
    }
    // Look up the recipient URL using the service name as the env variable key.
    // e.g. process.env['product'] or process.env['cart']
    const recipientURL = process.env[serviceName];
    if (!recipientURL) {
        return res.status(502).json({ message: 'Cannot process request' });
    }
    // Forward path with the service name prefix stripped.
    // /product/products → /products
    // /cart/api/profile/cart → /api/profile/cart
    const forwardPath = '/' + parts.slice(1).join('/');
    const targetURL = `${recipientURL}${forwardPath}`;
    // ── Cache check (GET /product/products only) ──────────────────────────────
    const isProductsList = serviceName === 'product' &&
        req.method === 'GET' &&
        (forwardPath === '/products' || forwardPath === '/');
    if (isProductsList) {
        const cacheKey = `${targetURL}?${new URLSearchParams(req.query).toString()}`;
        const cached = getCached(cacheKey);
        if (cached !== null) {
            return res.json(cached);
        }
    }
    // ── Forward request ───────────────────────────────────────────────────────
    try {
        const config = {
            method: req.method,
            url: targetURL,
            headers: buildForwardHeaders(req),
            params: req.query,
            // Avoid axios automatically parsing response as JSON so we can forward
            // any content type transparently.
            responseType: 'json',
        };
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            config.data = req.body;
        }
        console.log(`[bff] ${req.method} ${req.path} → ${targetURL}`);
        const response = await (0, axios_1.default)(config);
        // Store product list in cache
        if (isProductsList) {
            const cacheKey = `${targetURL}?${new URLSearchParams(req.query).toString()}`;
            setCached(cacheKey, response.data);
        }
        return res.status(response.status).json(response.data);
    }
    catch (error) {
        if (axios_1.default.isAxiosError(error) && error.response) {
            return res.status(error.response.status).json(error.response.data);
        }
        console.error('[bff] proxy error:', error);
        return res.status(502).json({ message: 'Cannot process request' });
    }
});
app.listen(PORT, () => {
    console.log(`BFF Service is running on port ${PORT}`);
});
