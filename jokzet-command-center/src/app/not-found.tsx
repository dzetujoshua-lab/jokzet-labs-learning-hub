import Link from "next/link";
import { Compass } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export default function NotFound() {
  return (
    <main className="mx-auto grid min-h-screen max-w-xl place-items-center px-4">
      <EmptyState icon={Compass} title="Page not found" hint="That address does not exist in the Command Center.">
        <Link href="/" className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary">
          back to command
        </Link>
      </EmptyState>
    </main>
  );
}
