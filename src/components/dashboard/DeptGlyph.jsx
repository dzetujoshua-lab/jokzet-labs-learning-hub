import { Code2, PenTool, ShieldAlert, Cloud, Server, BrainCircuit, Camera, Clapperboard, Briefcase } from 'lucide-react';

const GLYPHS = { Code2, PenTool, ShieldAlert, Cloud, Server, BrainCircuit, Camera, Clapperboard, Briefcase };

export default function DeptGlyph({ icon, className = 'h-4 w-4' }) {
  const Glyph = GLYPHS[icon] || Code2;
  return <Glyph className={className} strokeWidth={1.6} />;
}