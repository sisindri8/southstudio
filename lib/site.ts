import { cache } from 'react';
import { unstable_noStore as noStore } from 'next/cache';
import { pub } from './public';
import { log } from './log';

export type Slide = { image: string; title: string; subtitle: string; button: string; link: string };
export type Site = {
  logo: string; slides: Slide[];
  ads: { enabled: boolean; client: string; slotHome: string; slotListing: string; slotProduct: string };
  cta: { text: string; button: string; link: string }; instagram: { title: string; text: string; image: string; logo: string }; socials: Record<string, string>; disclosure: string;
};
export const DEFAULT_SITE: Site = {
  logo: '', slides: [], socials: {}, ads: { enabled: false, client: '', slotHome: '', slotListing: '', slotProduct: '' }, instagram: { title: '', text: '', image: '', logo: '' },
  disclosure: 'Studio South is a product discovery website. We do not sell, store or ship products. When you click a Buy now button you go to the retailer’s own website. Some of these links are affiliate links, which means we may earn a commission if you make a qualifying purchase, at no extra cost to you. As an Amazon Associate I earn from qualifying purchases. We also take part in affiliate programs run by other retailers or affiliate networks. Prices and availability are shown as entered by us and can change at the retailer, so please check the final price on the retailer’s website before you buy.',
  cta: { text: 'Find your next favourite piece.', button: 'Shop new in', link: '/' },
};
// Shared by the public site and the admin settings form. Empty text falls back to the default (no blank banners);
// an empty button means "hide the button".
export function mergeSite(v: any = {}): Site {
  return {
    ...DEFAULT_SITE, ...v,
    slides: Array.isArray(v.slides) ? v.slides : [],
    cta: { text: v.cta?.text || DEFAULT_SITE.cta.text, button: v.cta?.button ?? DEFAULT_SITE.cta.button, link: v.cta?.link || DEFAULT_SITE.cta.link },
    socials: { ...v.socials },
    ads: { ...DEFAULT_SITE.ads, ...v.ads },
    instagram: { ...DEFAULT_SITE.instagram, ...v.instagram },
    disclosure: v.disclosure || DEFAULT_SITE.disclosure,
  };
}
// React cache() = one query per request even though layout and page both call these.
export const getSite = cache(async (): Promise<Site> => {
  try {
    const { data, error } = await pub().from('website_settings').select('value').eq('key', 'site').maybeSingle();
    if (error) throw error;
    return mergeSite(data?.value ?? {});
  } catch (e) { noStore(); log.warn('site.settings_failed', { message: (e as Error)?.message }); return DEFAULT_SITE; } // noStore: a page built from fallback settings must not be cached
});

export type Cat = { id: string; name: string; slug: string; parent_id: string | null; image_url: string | null };
export const getCategories = cache(async (): Promise<Cat[]> => {
  try {
    const { data, error } = await pub().from('categories').select('id,name,slug,parent_id,image_url').order('sort_order').order('name');
    if (error) throw error;
    return (data ?? []) as Cat[];
  } catch (e) { noStore(); log.warn('site.categories_failed', { message: (e as Error)?.message }); return []; } // noStore: never cache a menu-less page
});

export type NavCat = { name: string; slug: string; image: string | null; children: { name: string; slug: string }[] };
export const getNav = cache(async (): Promise<NavCat[]> => {
  const all = await getCategories();
  return all.filter((c) => !c.parent_id).map((p) => ({ name: p.name, slug: p.slug, image: p.image_url, children: all.filter((c) => c.parent_id === p.id).map((c) => ({ name: c.name, slug: c.slug })) }));
});
