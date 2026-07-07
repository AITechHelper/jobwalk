import type { CapacitorConfig } from "@capacitor/cli";
import { KeyboardResize, KeyboardStyle } from "@capacitor/keyboard";

// JobWalk ships as a native shell around the deployed Next.js app. Because the
// app relies on server-side routes (Clerk auth, the DB, the AI pipeline), it
// can't be statically exported — the native app loads the live production URL
// instead. Update `server.url` to the custom domain once DNS is set up.
const PRODUCTION_URL = "https://app.aitechhelper.com";

const config: CapacitorConfig = {
  appId: "com.aitechhelper.jobwalk",
  appName: "JobWalk",
  webDir: "capacitor-shell",
  server: {
    url: PRODUCTION_URL,
    cleartext: false,
    // Keep auth redirects inside the WebView instead of bouncing to Safari.
    // The production URL host is trusted automatically; these cover Clerk's
    // hosted auth domains (dev instance uses *.accounts.dev) and its bot-
    // detection challenge. With Clerk production keys on a custom domain,
    // auth becomes same-origin and most of these are no longer needed.
    allowNavigation: [
      "clerk.aitechhelper.com",
      "accounts.aitechhelper.com",
      "challenges.cloudflare.com",
    ],
  },
  ios: {
    // Edge-to-edge: let the web content run under the status bar so the navy
    // header (which pads for env(safe-area-inset-top)) fills behind it. With
    // "always" the native WebView inset the content and showed a white strip
    // behind the status bar. backgroundColor is a black backstop for any
    // native area that briefly shows through.
    contentInset: "never",
    backgroundColor: "#000000",
  },
  plugins: {
    Keyboard: {
      // Match the dark app chrome so the keyboard and its input-accessory
      // toolbar (the ‹ › Done bar) render dark instead of a white bar.
      style: KeyboardStyle.Dark,
      resize: KeyboardResize.Native,
    },
    SplashScreen: {
      // Stay up until the web app mounts and calls SplashScreen.hide()
      // (see SplashHider) — avoids a black WebView during the remote load.
      launchAutoHide: false,
      backgroundColor: "#000000",
      showSpinner: true,
      spinnerColor: "#3385ff",
    },
  },
};

export default config;
