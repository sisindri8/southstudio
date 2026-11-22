import { admin, requireAdmin } from '@/lib/supabase';
import { mergeSite } from '@/lib/site';
import ErrorBanner from '../ErrorBanner';
import { saveSettings } from '../actions';

function Img({ name, url, label }: { name: string; url?: string; label: string }) {
  return (
    <div className="text-sm">
      <p className="font-medium">{label}</p>
      {url && /* eslint-disable-next-line @next/next/no-img-element */ <img src={url} alt="" className="my-1 h-16 border border-line object-cover" />}
      <input type="file" name={name} accept="image/jpeg,image/png,image/webp" className="field" />
      {url && <label className="text-xs"><input type="checkbox" name={`${name}_remove`} /> Remove this image</label>}
    </div>
  );
}

export default async function Settings({ searchParams }: { searchParams: { saved?: string; err?: string } }) {
  await requireAdmin();
  const { data } = await admin().from('website_settings').select('value').eq('key', 'site').maybeSingle();
  const site = mergeSite(data?.value ?? {});
  return (
    <form action={saveSettings} className="max-w-2xl space-y-8 border border-line bg-white p-5 sm:p-6">
      <h1 className="font-display text-3xl font-extrabold uppercase">Site settings</h1>
      <ErrorBanner message={searchParams.err} />
      {searchParams.saved && <p role="status" className="bg-lime p-2 text-sm">Saved. Your changes are live.</p>}
      <p className="text-sm text-ink/70">Links can be a full address (https://...) or a page on your site (like /?cat=fashion). Leave a slide empty to hide it.</p>

      <fieldset className="space-y-3"><legend className="font-semibold">Logo</legend>
        <Img name="logo" url={site.logo} label="Header logo (PNG with transparent background, about 600×200)" />
      </fieldset>

      <fieldset className="space-y-6"><legend className="font-semibold">Home sales banners (up to 5). Upload the banner image (best size 1600×560) and set where it goes, such as an Amazon, Flipkart or Myntra sale page. Clicking the banner opens that link. Heading and button text are optional.</legend>
        {Array.from({ length: 5 }, (_, i) => { const s = site.slides[i]; return (
          <div key={i} className="space-y-2 border border-line p-3">
            <p className="text-sm font-semibold">Slide {i + 1}</p>
            <Img name={`slide${i}_image`} url={s?.image} label="Photo" />
            <input name={`slide${i}_title`} defaultValue={s?.title} placeholder="Heading" className="field" />
            <input name={`slide${i}_subtitle`} defaultValue={s?.subtitle} placeholder="Small text (optional)" className="field" />
            <div className="grid grid-cols-2 gap-2">
              <input name={`slide${i}_button`} defaultValue={s?.button} placeholder="Button text, e.g. Shop now" className="field" />
              <input name={`slide${i}_link`} defaultValue={s?.link} placeholder="Button link" className="field" />
            </div>
          </div>); })}
      </fieldset>

      <fieldset className="space-y-2"><legend className="font-semibold">Yellow banner above the footer</legend>
        <input name="cta_text" defaultValue={site.cta.text} placeholder="Heading" className="field" />
        <div className="grid grid-cols-2 gap-2">
          <input name="cta_button" defaultValue={site.cta.button} placeholder="Button text" className="field" />
          <input name="cta_link" defaultValue={site.cta.link} placeholder="Button link" className="field" />
        </div>
      </fieldset>

      <fieldset className="space-y-2"><legend className="font-semibold">Instagram page (shows above the footer once your Instagram link below is set)</legend>
        <Img name="ig_logo" url={site.instagram.logo} label="Heading logo (replaces the heading text, e.g. a partner or brand logo image)" />
        <input name="ig_title" defaultValue={site.instagram.title} placeholder="Heading (used when no heading logo is set)" className="field" />
        <textarea name="ig_text" rows={2} defaultValue={site.instagram.text} placeholder="Tagline (shown under the logo)" className="field" />
        <Img name="ig_image" url={site.instagram.image} label="Instagram photo (square, 1080×1080)" />
      </fieldset>

      <fieldset className="space-y-3"><legend className="font-semibold">Google AdSense (horizontal banner ads only)</legend>
        <p className="text-sm text-ink/70">Step 1: paste your Publisher ID and save (leave “Show ads” off). This lets Google verify the site and find <code>/ads.txt</code>. Step 2: after Google approves the site, create 3 <strong>Display ad</strong> units (size: Responsive) and paste each unit’s number below. A blank unit simply shows no ad in that spot. Then tick “Show ads”. Turn <strong>Auto ads OFF</strong> in your AdSense account.</p>
        <label className="block text-sm">Publisher ID<input name="ads_client" defaultValue={site.ads.client} placeholder="ca-pub-1234567890123456" className="field mt-1" /></label>
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="block text-sm">Unit: home page (between rows and grid)<input name="ads_slot_home" defaultValue={site.ads.slotHome} inputMode="numeric" placeholder="1234567890" className="field mt-1" /></label>
          <label className="block text-sm">Unit: end of product lists<input name="ads_slot_listing" defaultValue={site.ads.slotListing} inputMode="numeric" placeholder="1234567890" className="field mt-1" /></label>
          <label className="block text-sm">Unit: below product details<input name="ads_slot_product" defaultValue={site.ads.slotProduct} inputMode="numeric" placeholder="1234567890" className="field mt-1" /></label>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="ads_enabled" defaultChecked={site.ads.enabled} /> Show ads on the site</label>
      </fieldset>

      <fieldset className="space-y-2"><legend className="font-semibold">Affiliate disclosure (shown in the footer on every page)</legend>
        <textarea name="disclosure" rows={6} defaultValue={site.disclosure} className="field" />
      </fieldset>

      <fieldset className="space-y-2"><legend className="font-semibold">Social links (icons show in the footer once a link is added)</legend>
        {(['instagram', 'youtube', 'pinterest', 'x'] as const).map((k) => (
          <input key={k} name={`s_${k}`} defaultValue={site.socials[k]} placeholder={`${k[0].toUpperCase() + k.slice(1)} link`} className="field" />
        ))}
      </fieldset>
      <button className="btn">Save settings</button>
    </form>
  );
}
