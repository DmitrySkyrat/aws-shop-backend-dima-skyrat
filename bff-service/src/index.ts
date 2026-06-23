import Fastify from 'fastify';
import axios, { AxiosRequestConfig } from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const app = Fastify({ logger: true });
const PORT = parseInt(process.env.PORT || '3000', 10);

// ─── Cache (optional +20) ─────────────────────────────────────────────────────
const CACHE_TTL_MS = 2 * 60 * 1000;
interface CacheEntry { data: unknown; expiresAt: number; }
const cache = new Map<string, CacheEntry>();

function getCached(key: string): unknown | null {
  const entry = cache.get(key);
  if (entry && entry.expiresAt > Date.now()) {
    app.log.info(`[cache] HIT ${key}`);
    return entry.data;
  }
  cache.delete(key);
  return null;
}

function setCached(key: string, data: unknown): void {
  app.log.info(`[cache] SET ${key}`);
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ─── Hop-by-hop headers (must not be forwarded) ───────────────────────────────
const HOP_BY_HOP = new Set([
  'host', 'connection', 'content-length',
  'transfer-encoding', 'keep-alive', 'upgrade', 'te', 'trailer',
]);

// ─── Proxy handler ────────────────────────────────────────────────────────────
app.all('*', async (request, reply) => {
  const pathOnly = request.url.split('?')[0];
  const parts = pathOnly.split('/').filter(Boolean);
  const serviceName = parts[0];

  if (!serviceName) {
    return reply.status(502).send({ message: 'Cannot process request' });
  }

  const recipientURL = process.env[serviceName];
  if (!recipientURL) {
    return reply.status(502).send({ message: 'Cannot process request' });
  }

  const forwardPath = '/' + parts.slice(1).join('/');
  const queryString = request.url.includes('?') ? request.url.split('?')[1] : '';
  const targetURL = `${recipientURL}${forwardPath}`;

  // Cache: only GET /product/products
  const isProductsList =
    serviceName === 'product' &&
    request.method === 'GET' &&
    (forwardPath === '/products' || forwardPath === '/');

  if (isProductsList) {
    const cached = getCached(`${targetURL}?${queryString}`);
    if (cached !== null) return reply.send(cached);
  }

  // Build forward headers
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(request.headers)) {
    if (!HOP_BY_HOP.has(key.toLowerCase()) && typeof value === 'string') {
      headers[key] = value;
    }
  }

  try {
    const config: AxiosRequestConfig = {
      method: request.method as AxiosRequestConfig['method'],
      url: targetURL,
      headers,
      params: request.query,
    };
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      config.data = request.body;
    }

    app.log.info(`[bff] ${request.method} ${request.url} → ${targetURL}`);
    const response = await axios(config);

    if (isProductsList) {
      setCached(`${targetURL}?${queryString}`, response.data);
    }

    return reply.status(response.status).send(response.data);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      return reply.status(error.response.status).send(error.response.data);
    }
    app.log.error(error);
    return reply.status(502).send({ message: 'Cannot process request' });
  }
});

const start = async () => {
  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();