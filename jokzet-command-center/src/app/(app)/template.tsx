/** A gentle entrance for each page (fade and a few pixels of rise). Pure CSS; the content is visible from the start. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
