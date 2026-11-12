import { Briefcase, BrainCircuit, Camera, Clapperboard, Cloud, Code2, PenTool, Server, ShieldAlert, type LucideIcon } from "lucide-react";

const GLYPHS: Record<string, LucideIcon> = { Code2, PenTool, ShieldAlert, Cloud, Server, BrainCircuit, Camera, Clapperboard, Briefcase };

export function DeptGlyph({ icon, className = "h-4 w-4" }: { icon: string; className?: string }) {
  const Glyph = GLYPHS[icon] || Code2;
  return <Glyph className={className} strokeWidth={1.6} />;
}
