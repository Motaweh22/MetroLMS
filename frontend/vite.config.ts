import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import fs from 'fs';
import type { IncomingMessage, ServerResponse } from 'http';

/**
 * Dev-only test media server plugin.
 * Serves local testing video & PDF files under frontend/src/test/
 * without copying them to public/ or bundling them into production builds.
 */
function devTestMediaPlugin(): Plugin {
  let isDemoMode = false;
  return {
    name: 'dev-test-media-server',
    apply: 'serve', // Strictly development server only
    configResolved(config) {
      isDemoMode =
        config.mode !== 'production' &&
        !config.isProduction &&
        (config.mode === 'demo' || process.env.VITE_DEMO_MODE === 'true');
    },
    configureServer(server) {
      const videoFilename = 'test.mp4';
      const pdfFilename = 'cairo-metro-network-map.pdf';
      const videoPath = path.resolve(__dirname, 'src/test', videoFilename);
      const pdfPath = path.resolve(__dirname, 'src/test', pdfFilename);

      // Video streaming endpoint with full HTTP Range request support
      const handleVideoRequest = (req: IncomingMessage, res: ServerResponse) => {
        if (!fs.existsSync(videoPath)) {
          res.statusCode = 404;
          res.end('Test video file not found on disk');
          return;
        }

        const stat = fs.statSync(videoPath);
        const fileSize = stat.size;
        const range = req.headers.range;

        if (range) {
          const parts = range.replace(/bytes=/, '').split('-');
          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
          const chunkSize = end - start + 1;
          const fileStream = fs.createReadStream(videoPath, { start, end });
          res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunkSize,
            'Content-Type': 'video/mp4',
          });
          fileStream.pipe(res);
        } else {
          res.writeHead(200, {
            'Content-Length': fileSize,
            'Accept-Ranges': 'bytes',
            'Content-Type': 'video/mp4',
          });
          fs.createReadStream(videoPath).pipe(res);
        }
      };

      server.middlewares.use('/dev-media/test-video.mp4', handleVideoRequest);
      server.middlewares.use('/dev-media/test.mp4', handleVideoRequest);

      // PDF document endpoint (supports both raw PDF stream and JSON base64 format)
      const handlePdfRequest = (req: IncomingMessage, res: ServerResponse) => {
        if (!fs.existsSync(pdfPath)) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Test PDF file not found on disk' }));
          return;
        }

        const url = req.url || '';
        const wantsJson = url.includes('format=json') || (req.headers.accept && req.headers.accept.includes('application/json'));

        if (wantsJson) {
          const data = fs.readFileSync(pdfPath);
          const base64 = data.toString('base64');
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ base64, size: data.length, mimeType: 'application/pdf', filename: pdfFilename }));
          return;
        }

        const stat = fs.statSync(pdfPath);
        if (req.method === 'HEAD') {
          res.writeHead(200, {
            'Content-Length': stat.size,
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'inline; filename="cairo-metro-network-map.pdf"',
            'Accept-Ranges': 'bytes',
          });
          res.end();
          return;
        }

        res.writeHead(200, {
          'Content-Length': stat.size,
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'inline; filename="cairo-metro-network-map.pdf"',
          'Accept-Ranges': 'bytes',
        });
        fs.createReadStream(pdfPath).pipe(res);
      };

      server.middlewares.use('/dev-media/test-document.pdf', handlePdfRequest);
      server.middlewares.use('/dev-media/cairo-metro-network-map.pdf', handlePdfRequest);
      server.middlewares.use('/dev-media/test-document', handlePdfRequest);
      server.middlewares.use('/dev-media/test-document-data', handlePdfRequest);

      // API Fallback Guard:
      if (isDemoMode) {
        const demoWorkerPath = path.resolve(__dirname, '../Demo/public/mockServiceWorker.js');
        server.middlewares.use('/mockServiceWorker.js', (_req, res) => {
          if (!fs.existsSync(demoWorkerPath)) {
            res.statusCode = 404;
            res.end('Demo mockServiceWorker.js not found');
            return;
          }
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
          fs.createReadStream(demoWorkerPath).pipe(res);
        });

        // In Demo mode, prevent Vite's SPA HTML-fallback from returning index.html for /api/*
        server.middlewares.use('/api', (req, res) => {
          console.warn(`[Demo MSW] Unhandled /api request (${req.method ?? 'GET'} ${req.url ?? ''}): MSW worker is inactive.`);
          res.statusCode = 503;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(
            JSON.stringify({
              message: 'الخدمة غير متوفرة حالياً. يرجى المحاولة بعد قليل.',
              code: 'SERVICE_UNAVAILABLE',
            })
          );
        });
      }
    },
  };
}

/**
 * Narrow production-build asset hygiene plugin.
 * Removes `mockServiceWorker.js` copied from `public/` into the build output directory (`dist/`)
 * during production builds (`apply: 'build'`), while leaving `public/mockServiceWorker.js`
 * completely untouched on disk for development (`vite`) and testing (`vitest`).
 */
function excludeMswWorkerInBuildPlugin(): Plugin {
  let resolvedOutDir = path.resolve(__dirname, 'dist');
  return {
    name: 'exclude-msw-worker-in-build',
    apply: 'build',
    configResolved(config) {
      resolvedOutDir = path.resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const workerOutputPath = path.join(resolvedOutDir, 'mockServiceWorker.js');
      if (fs.existsSync(workerOutputPath)) {
        fs.unlinkSync(workerOutputPath);
      }
    },
  };
}

function resolveDemoMswPlugin(): Plugin {
  const frontendPkgAnchor = path.resolve(__dirname, 'package.json');
  return {
    name: 'resolve-demo-msw-from-frontend',
    resolveId(source, importer) {
      if (
        importer &&
        importer.replace(/\\/g, '/').includes('/Demo/') &&
        (source === 'msw' || source.startsWith('msw/'))
      ) {
        return this.resolve(source, frontendPkgAnchor, { skipSelf: true });
      }
      return null;
    },
  };
}

function excludeTestCardsInProductionPlugin(): Plugin {
  const VIRTUAL_ID = '\0virtual:empty-test-cards-picker';
  let shouldExclude = false;
  return {
    name: 'exclude-test-cards-in-production',
    apply: 'build',
    configResolved(config) {
      const flagValue = process.env.VITE_SHOW_TEST_CARDS ?? config.env?.VITE_SHOW_TEST_CARDS;
      shouldExclude = Boolean(config.isProduction) && flagValue !== 'true';
    },
    resolveId(source, importer) {
      if (!shouldExclude) return null;
      if (
        (source === './DemoAccountPicker' || source.endsWith('/DemoAccountPicker')) &&
        importer &&
        importer.replace(/\\/g, '/').includes('/features/auth/')
      ) {
        return VIRTUAL_ID;
      }
      return null;
    },
    load(id) {
      if (id === VIRTUAL_ID) {
        return 'export const ROLE_TEST_ACCOUNTS = []; export const DemoAccountPicker = () => null;';
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    resolveDemoMswPlugin(),
    devTestMediaPlugin(),
    excludeMswWorkerInBuildPlugin(),
    excludeTestCardsInProductionPlugin(),
  ],
  resolve: {
    alias: {
      '@/mocks': path.resolve(__dirname, '../Demo/mocks'),
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        hashCharacters: 'hex',
        entryFileNames: 'assets/[hash].js',
        chunkFileNames: 'assets/[hash].js',
        assetFileNames: 'assets/[hash][extname]',
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-router')) return 'vendor-router';
            if (id.includes('react-dom') || id.includes('/react/') || id.includes('\\react\\')) {
              return 'vendor-react';
            }
            if (id.includes('lucide-react')) return 'vendor-icons';
          }
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy:
      process.env.VITE_DEMO_MODE === 'true' || process.argv.includes('demo')
        ? undefined
        : {
          '/api': {
            target: process.env.VITE_API_TARGET || 'http://127.0.0.1:8000',
            changeOrigin: true,
          },
        },
  },
  preview: {
    port: 4173,
    strictPort: true,
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    testTimeout: 10000,
  },
});

