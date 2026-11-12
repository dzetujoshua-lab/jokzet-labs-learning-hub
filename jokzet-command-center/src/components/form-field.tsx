export function FormField({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="mono-label mb-1.5">{label}</p>
      {children}
    </div>
  );
}
