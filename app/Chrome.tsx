'use client';
import { usePathname } from 'next/navigation';

// The storefront header/footer wrap every public page, but the admin panel (/admin/*) is its own screen:
// it should not show the shop search box, the category menu, the newsletter signup or the affiliate footer.
// Header and footer are rendered on the server in layout.tsx and passed in; this only decides whether to show them.
export default function Chrome({ header, footer, children }: { header: React.ReactNode; footer: React.ReactNode; children: React.ReactNode }) {
  const path = usePathname() || '';
  if (/^\/admin(\/|$)/.test(path)) return <main className="min-h-screen bg-chalk">{children}</main>;
  return (
    <>
      {header}
      <main>{children}</main>
      {footer}
    </>
  );
}
