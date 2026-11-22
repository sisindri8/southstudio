const ICONS: Record<string, { label: string; svg: React.ReactNode }> = {
  instagram: { label: 'Instagram', svg: <><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></> },
  youtube: { label: 'YouTube', svg: <><rect x="2" y="5" width="20" height="14" rx="4" /><path d="M10 9l5 3-5 3z" fill="currentColor" /></> },
  pinterest: { label: 'Pinterest', svg: <><circle cx="12" cy="12" r="9.5" /><path d="M10.5 19.5V8h3a3 3 0 010 6h-3" /></> },
  x: { label: 'X', svg: <path d="M4 4l16 16M20 4L4 20" /> },
};
export default function SocialIcons({ socials }: { socials: Record<string, string> }) {
  const items = (['instagram', 'youtube', 'pinterest', 'x'] as const).filter((k) => socials[k]);
  if (!items.length) return <span />;
  return (
    <ul className="flex gap-3" aria-label="Social media">
      {items.map((k) => (
        <li key={k}>
          <a href={socials[k]} target="_blank" rel="noopener" aria-label={`Studio South on ${ICONS[k].label}`}
             className="flex h-10 w-10 items-center justify-center border-2 border-ink hover:bg-ink hover:text-white">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[k].svg}</svg>
          </a>
        </li>
      ))}
    </ul>
  );
}
