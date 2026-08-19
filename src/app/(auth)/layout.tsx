import Link from "next/link";

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background p-4">
      <div className="text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/jobwalker-logo.png"
          alt="JobWalker"
          className="mx-auto h-24 w-auto"
        />
        <p className="mt-2 text-sm text-white/60">
          Walk the job. Get the report.
        </p>
      </div>
      {children}
      <p className="text-center text-xs text-white/40">
        By continuing you agree to our{" "}
        <Link href="/terms" className="underline hover:text-white/60">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline hover:text-white/60">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}
