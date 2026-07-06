"use client";

import { useEffect } from "react";

// In the native iOS/Android shell the app loads a remote URL, so there's a gap
// between launch and first paint. Keep Capacitor's branded splash visible until
// the first client component mounts (content is ready), instead of letting it
// auto-hide into a black WebView. No-op in a normal browser.
export default function SplashHider() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) return;
        const { SplashScreen } = await import("@capacitor/splash-screen");
        if (!cancelled) await SplashScreen.hide();
      } catch {
        // Not running inside Capacitor — ignore.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
