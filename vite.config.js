import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
if (process.env.NODE_ENV !== 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

function localApiDevPlugin() {
  return {
    name: 'local-api-dev-server',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const [pathname, queryString] = (req.url || '').split('?');
        if (!pathname.startsWith('/api/')) {
          return next();
        }

        const proxyTarget = process.env.VITE_API_BASE_URL || process.env.API_PROXY_TARGET;
        if (proxyTarget && !proxyTarget.includes('localhost:5174')) {
          return next();
        }

        const route = pathname.replace(/^\/api\//, '').replace(/\/$/, '');
        const handlerPath = path.resolve(process.cwd(), `api/${route}.js`);

        if (!fs.existsSync(handlerPath)) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: `API route /api/${route} not found` }));
          return;
        }

        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', async () => {
          const rawBody = Buffer.concat(chunks).toString('utf-8');
          try {
            req.body = rawBody ? JSON.parse(rawBody) : {};
          } catch {
            req.body = rawBody;
          }

          const query = {};
          if (queryString) {
            new URLSearchParams(queryString).forEach((val, key) => { query[key] = val; });
          }
          req.query = query;

          try {
            const module = await import(`${handlerPath}?t=${Date.now()}`);
            const handler = module.default;
            if (typeof handler !== 'function') {
              throw new Error(`Handler in ${handlerPath} does not export default function`);
            }
            await handler(req, res);
          } catch (err) {
            console.error(`[Local API Error] /api/${route}:`, err);
            if (!res.writableEnded) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message || 'Internal API Error' }));
            }
          }
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxyTarget = env.VITE_API_BASE_URL || env.API_PROXY_TARGET;

  return {
    plugins: [react(), localApiDevPlugin()],
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    server: {
      port: 5174,
      proxy: proxyTarget && !proxyTarget.includes('localhost:5174')
        ? {
            '/api': {
              target: proxyTarget,
              changeOrigin: true,
              secure: true,
            },
          }
        : undefined,
    },
  };
});
