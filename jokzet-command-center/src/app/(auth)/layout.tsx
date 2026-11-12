import { BrandLogo } from "@/components/brand-logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-md space-y-7">
        <div className="flex items-center gap-3">
          <BrandLogo className="h-11 w-11" />
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-primary">Jokzet Labs</p>
            <p className="mt-1.5 font-display text-[15px] font-medium leading-tight text-foreground">
              Learning Command Center
            </p>
          </div>
        </div>
        <div className="panel animate-rise p-6 sm:p-8">{children}</div>
        <p className="text-center font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          Build Beyond Possible.
        </p>
      </div>
    </main>
  );
}
