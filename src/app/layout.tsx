import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SplashHider from "@/components/SplashHider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "JobWalker",
  description:
    "Walk the job, narrate what you see, snap photos — get a client-ready report.",
};

// App-like viewport: prevent pinch-zoom and the iOS focus auto-zoom that
// otherwise leaves the WebView stuck zoomed in. viewportFit covers the notch.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "#3385ff",
          colorNeutral: "#ffffff",
          colorBackground: "#0a0f1e",
          colorInput: "#000000",
          colorForeground: "#ffffff",
          colorMutedForeground: "rgba(255, 255, 255, 0.6)",
          colorInputForeground: "#ffffff",
        },
      }}
    >
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col">
          <SplashHider />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
