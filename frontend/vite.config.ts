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
  return {
    name: 'dev-test-media-server',
    apply: 'serve', // Strictly development server only
    configureServer(server) {
      const videoFilename = 'Inside Zoho Desk \uFF1A Product Overview.mp4';
      const pdfFilename = 'sample-technical-guide.pdf';
      const videoPath = path.resolve(__dirname, 'src/test', videoFilename);
      const pdfPath = path.resolve(__dirname, 'src/test', pdfFilename);

      // Video streaming endpoint with full HTTP Range request support
      server.middlewares.use('/dev-media/test-video.mp4', (req, res) => {
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
      });

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
            'Content-Disposition': 'inline; filename="proposal.pdf"',
            'Accept-Ranges': 'bytes',
          });
          res.end();
          return;
        }

        res.writeHead(200, {
          'Content-Length': stat.size,
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'inline; filename="proposal.pdf"',
          'Accept-Ranges': 'bytes',
        });
        fs.createReadStream(pdfPath).pipe(res);
      };

      server.middlewares.use('/dev-media/test-document.pdf', handlePdfRequest);
      server.middlewares.use('/dev-media/test-document', handlePdfRequest);
      server.middlewares.use('/dev-media/test-document-data', handlePdfRequest);

      // API Fallback Guard:
      // If MSW Service Worker is bypassed, delayed, or fails to intercept /api/*,
      // prevent Vite's default SPA HTML-fallback from returning index.html (HTTP 200 text/html)
      // which would cause JSON parser syntax errors.
      server.middlewares.use('/api', (_req, res) => {
        res.statusCode = 503;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(
          JSON.stringify({
            message: 'خدمة محاكاة واجهة البرمجة (MSW) غير متوفرة أو لم تبدأ بعد. يرجى إعادة تحميل الصفحة.',
            code: 'MSW_NOT_ACTIVE',
          })
        );
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    devTestMediaPlugin(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    testTimeout: 10000,
  },
});

