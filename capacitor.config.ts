import type { CapacitorConfig } from "@capacitor/cli";

// JobWalk ships as a native shell around the deployed Next.js app. Because the
// app relies on server-side routes (Clerk auth, the DB, the AI pipeline), it
// can't be statically exported — the native app loads the live production URL
// instead. Update `server.url` to the custom domain once DNS is set up.
const PRODUCTION_URL = "https://jobwalk-ebon.vercel.app";

const config: CapacitorConfig = {
  appId: "com.aitechhelper.jobwalk",
  appName: "JobWalk",
  webDir: "capacitor-shell",
  server: {
    url: PRODUCTION_URL,
    cleartext: false,
  },
  ios: {
    contentInset: "always",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: "#000000",
      showSpinner: false,
    },
  },
};

export default config;
