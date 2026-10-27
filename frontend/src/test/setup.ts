import '@testing-library/jest-dom';

// Polyfill URL.createObjectURL and URL.revokeObjectURL for jsdom environment
let blobCounter = 0;
if (typeof URL.createObjectURL === 'undefined') {
  URL.createObjectURL = () => {
    blobCounter++;
    return `blob:http://localhost/test-blob-${blobCounter}`;
  };
}

if (typeof URL.revokeObjectURL === 'undefined') {
  URL.revokeObjectURL = () => {};
}

// Workaround for Node 24 + jsdom AbortSignal cross-realm instance mismatch in React Router v7 Data Router
if (typeof globalThis !== 'undefined' && globalThis.Request) {
  const OriginalRequest = globalThis.Request;
  globalThis.Request = class extends OriginalRequest {
    constructor(input: RequestInfo | URL, init?: RequestInit) {
      if (init && init.signal) {
        try {
          super(input, init);
        } catch {
          const rest = { ...init };
          delete rest.signal;
          super(input, rest);
        }
      } else {
        super(input, init);
      }
    }
  };
  if (typeof window !== 'undefined') {
    window.Request = globalThis.Request;
  }
}


