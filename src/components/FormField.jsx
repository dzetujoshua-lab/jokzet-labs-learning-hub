export default function FormField({ label, children, className = '' }) {
  return (
    <div className={className}>
      <p className="mono-label mb-1.5">{label}</p>
      {children}
    </div>
  );
}