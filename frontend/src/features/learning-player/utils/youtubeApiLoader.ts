/**
 * YouTube IFrame Player API Singleton Loader
 * Ensures the official YouTube IFrame API script is injected once,
 * safely chains onYouTubeIframeAPIReady callbacks, and resolves when window.YT.Player is ready.
 */

let ytApiPromise: Promise<void> | null = null;

export function loadYouTubeIframeApi(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }

  // If YT.Player is already fully available, resolve immediately
  if (window.YT && typeof window.YT.Player === 'function') {
    return Promise.resolve();
  }

  // If a loading promise is already in flight, reuse it
  if (ytApiPromise) {
    return ytApiPromise;
  }

  ytApiPromise = new Promise<void>((resolve) => {
    // Double check before setting up listeners
    if (window.YT && typeof window.YT.Player === 'function') {
      resolve();
      return;
    }

    const checkReady = (): boolean => {
      if (typeof window !== 'undefined' && window.YT && typeof window.YT.Player === 'function') {
        resolve();
        return true;
      }
      return false;
    };

    // Chain into onYouTubeIframeAPIReady
    const prevCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prevCallback === 'function') {
        try {
          prevCallback();
        } catch {
          // ignore error in previous hook
        }
      }
      checkReady();
    };

    // Inject the script tag if not present
    const existingScript = document.getElementById('youtube-iframe-api');
    if (!existingScript) {
      const tag = document.createElement('script');
      tag.id = 'youtube-iframe-api';
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.async = true;
      tag.onerror = () => {
        // Resolve anyway so the player component can handle error state gracefully
        resolve();
      };
      document.body.appendChild(tag);
    }

    // Safety polling in case onYouTubeIframeAPIReady fired before our hook or script is cached
    const interval = setInterval(() => {
      if (typeof window === 'undefined' || checkReady()) {
        clearInterval(interval);
      }
    }, 50);

    // Timeout after 10s to prevent hanging indefinitely
    setTimeout(() => {
      clearInterval(interval);
      resolve();
    }, 10000);
  });

  return ytApiPromise;
}

/**
 * Reset loader state (primarily used in automated tests)
 */
export function resetYouTubeApiLoaderForTesting(): void {
  ytApiPromise = null;
}
