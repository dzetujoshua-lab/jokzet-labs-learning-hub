import { BosTabs } from "@/components/businessos/bos-ui";

export default function CapstoneLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <BosTabs />
      {children}
    </div>
  );
}
