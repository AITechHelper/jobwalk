"use client";

import { SignIn, SignUp } from "@clerk/nextjs";
import { useSyncExternalStore } from "react";

// Google OAuth cannot complete inside the iOS WebView: Google blocks OAuth in
// embedded webviews (403 disallowed_useragent), which is the error Apple's
// reviewer hit after tapping "Continue with Google". Inside the native app we
// hide *only* the Google button — Sign in with Apple works fine in the WebView
// and stays, as does email sign-in. On the desktop web nothing is hidden.
// Targeting both the block and icon button variants so Google is hidden
// regardless of how Clerk lays the social buttons out.
const hideGoogleAppearance = {
  elements: {
    socialButtonsBlockButton__google: { display: "none" },
    socialButtonsIconButton__google: { display: "none" },
  },
} as const;

function isNativePlatform(): boolean {
  const cap = (
    window as unknown as {
      Capacitor?: { isNativePlatform?: () => boolean };
    }
  ).Capacitor;
  return !!cap?.isNativePlatform?.();
}

// The platform is a client-only value: unknown on the server. useSyncExternalStore
// reads it without a hydration mismatch — the server snapshot is null, so the
// first client render also yields null and we render nothing until we know the
// platform. That keeps the native app from ever flashing the (broken) Google
// button before hiding it.
const subscribe = () => () => {};

export default function AuthPanel({ mode }: { mode: "sign-in" | "sign-up" }) {
  const isNative = useSyncExternalStore<boolean | null>(
    subscribe,
    () => isNativePlatform(),
    () => null,
  );

  if (isNative === null) return null;

  const appearance = isNative ? hideGoogleAppearance : undefined;

  return mode === "sign-in" ? (
    <SignIn fallbackRedirectUrl="/record" appearance={appearance} />
  ) : (
    <SignUp forceRedirectUrl="/onboarding" appearance={appearance} />
  );
}
