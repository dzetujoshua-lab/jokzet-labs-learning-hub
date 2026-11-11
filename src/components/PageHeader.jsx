export default function PageHeader({ eyebrow, title, description, children }) {
  return (
    <header className="animate-rise flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? <p className="mono-label">{eyebrow}</p> : null}
        <h1 className="mt-3 font-display text-[26px] font-medium leading-none tracking-tight text-foreground md:text-[34px]">
          {title}
        </h1>
        {description ? (
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </header>
  );
}