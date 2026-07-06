export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background p-4">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">
          Job<span className="text-brand">Walk</span>
        </h1>
        <p className="mt-1 text-sm text-white/60">
          Walk the job. Get the report.
        </p>
      </div>
      {children}
    </div>
  );
}
