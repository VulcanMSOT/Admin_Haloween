import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import dotenv from 'dotenv';

// Load .env.local if present
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

if (process.env.NODE_ENV !== 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';
const DIST_DIR = path.resolve(process.cwd(), 'dist');
const API_DIR = path.resolve(process.cwd(), 'api');

const handlerCache = new Map();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.csv': 'text/csv; charset=utf-8',
};

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

function parseBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf-8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve(raw);
      }
    });
    req.on('error', () => resolve({}));
  });
}

function serveStatic(res, filePath, requestPath, isHead = false) {
  const mime = getMimeType(filePath);
  res.statusCode = 200;
  res.setHeader('Content-Type', mime);

  if (requestPath.startsWith('/assets/')) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  } else {
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  }

  if (isHead) {
    res.end();
    return;
  }

  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
}

const server = http.createServer(async (req, res) => {
  const reqUrl = req.url || '/';
  const parsedUrl = new URL(reqUrl, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // Health check endpoint for Render zero-downtime monitoring
  if (pathname === '/healthz' || pathname === '/health' || pathname === '/api/health') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ ok: true, status: 'healthy', timestamp: new Date().toISOString() }));
    return;
  }

  // API routing: /api/<route>
  if (pathname.startsWith('/api/')) {
    const route = pathname.replace(/^\/api\//, '').replace(/\/$/, '');
    const cleanRoute = path.normalize(route).replace(/^(\.\.[/\\])+/, '');
    const handlerPath = path.resolve(API_DIR, `${cleanRoute}.js`);

    if (!fs.existsSync(handlerPath) || !handlerPath.startsWith(API_DIR)) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: `API route /api/${route} not found` }));
      return;
    }

    // Attach parsed query parameters
    const query = {};
    parsedUrl.searchParams.forEach((val, key) => {
      query[key] = val;
    });
    req.query = query;

    // Attach body for requests
    req.body = await parseBody(req);

    // Decorate response helper methods if needed
    if (!res.status) {
      res.status = function (code) {
        this.statusCode = code;
        return this;
      };
    }
    if (!res.json) {
      res.json = function (data) {
        this.setHeader('Content-Type', 'application/json; charset=utf-8');
        this.end(JSON.stringify(data));
        return this;
      };
    }

    try {
      let handlerModule = handlerCache.get(handlerPath);
      if (!handlerModule) {
        handlerModule = await import(url.pathToFileURL(handlerPath).href);
        handlerCache.set(handlerPath, handlerModule);
      }

      const handler = handlerModule.default;
      if (typeof handler !== 'function') {
        throw new Error(`Handler in ${cleanRoute}.js is not a default function`);
      }

      await handler(req, res);
    } catch (err) {
      console.error(`[API Error] /api/${cleanRoute}:`, err);
      if (!res.writableEnded) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: err.message || 'Internal API Error' }));
      }
    }
    return;
  }

  // Static Frontend Assets & SPA Routing
  const isHead = req.method === 'HEAD';
  const sanitizedPath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  const targetFile = path.join(DIST_DIR, sanitizedPath === '/' ? 'index.html' : sanitizedPath);

  if (fs.existsSync(targetFile) && fs.statSync(targetFile).isFile()) {
    serveStatic(res, targetFile, sanitizedPath, isHead);
    return;
  }

  // SPA fallback to dist/index.html
  const indexFile = path.join(DIST_DIR, 'index.html');
  if (fs.existsSync(indexFile)) {
    serveStatic(res, indexFile, '/index.html', isHead);
    return;
  }

  res.statusCode = 404;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end('Static files not found. Please run "npm run build" first.');
});

server.listen(PORT, HOST, () => {
  console.log(`[Vulcan Admin] Server running on http://${HOST}:${PORT}`);
  console.log(`[Vulcan Admin] Environment: ${process.env.NODE_ENV || 'development'}`);
});

function handleShutdown(signal) {
  console.log(`\nReceived ${signal}. Gracefully shutting down...`);
  server.close(() => {
    console.log('[Vulcan Admin] Server closed.');
    process.exit(0);
  });
  setTimeout(() => {
    console.error('Forcefully terminating process after timeout.');
    process.exit(1);
  }, 5000);
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
