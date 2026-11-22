export type Page = { title: string; intro?: string; sections: { h: string; p: string[] }[] };
const UPDATED = 'Last updated: 20 November 2026';

export const PAGES: Record<string, Page> = {
  about: {
    title: 'About us',
    intro: 'Studio South helps shoppers discover fashion, apparel, electronics, home and garden, beauty and sports products in one place.',
    sections: [
      { h: 'What we do', p: ['We collect interesting products from different e-commerce websites and show them here so you can browse, compare where a product is available, and go straight to the retailer that suits you.', 'We do not sell, store or ship products. When you click a Buy now button you are taken to the retailer’s own website to complete the purchase.'] },
      { h: 'How we earn', p: ['Studio South is supported by affiliate commissions. If you buy through some of our links we may earn a small commission at no extra cost to you. Read the full details on our Affiliate disclosure page.'] },
    ],
  },
  'editorial-guidelines': {
    title: 'Editorial guidelines',
    intro: 'How products are chosen and presented on Studio South.',
    sections: [
      { h: 'How products are chosen', p: ['Products are added by hand by our team. We look for items that are well presented, clearly described and available from established retailers.'] },
      { h: 'Prices and discounts', p: ['Prices are entered by us and can change at the retailer at any time. We only show a discount percentage when both a current price and an original price have been entered. We do not invent prices, stock status, ratings or reviews.'] },
      { h: 'Affiliate links', p: ['Buy buttons may use affiliate links and are marked as sponsored links. Whether a product earns us a commission is not a reason to describe it as better than it is.'] },
      { h: 'Corrections', p: ['If you spot something wrong, such as an outdated price or a broken link, please tell us through the Contact page and we will fix it.'] },
    ],
  },
  'affiliate-disclosure': {
    title: 'Affiliate disclosure',
    intro: UPDATED,
    sections: [
      { h: 'Our affiliate relationships', p: ['Studio South takes part in affiliate programs. These may include the Amazon Associates program and similar programs run by other retailers, brands or affiliate networks. As an Amazon Associate I earn from qualifying purchases.'] },
      { h: 'What this means for you', p: ['Some links on this website are affiliate links. If you click one and buy a product, the retailer may pay us a commission. This costs you nothing extra and the price you pay is set by the retailer.', 'Commissions help us pay for running the website. Links to retailers are marked rel="sponsored".'] },
      { h: 'Prices and availability', p: ['Prices and availability shown on Studio South are entered by us and may be out of date. The price on the retailer’s website at checkout is the one that applies.'] },
      { h: 'Questions', p: ['If you have a question about this disclosure, please use our Contact page.'] },
    ],
  },
  'privacy-policy': {
    title: 'Privacy policy',
    intro: UPDATED,
    sections: [
      { h: 'What we collect', p: ['Sign-in: if you sign in with Google, we receive your email address and basic profile details through our authentication provider so that we can recognise your account.', 'Contact form: your name, email address and message when you write to us.', 'Email list: if you join our deals list, your email address and the time you joined. We only add you if you tick the consent box, and you can ask us to remove you at any time through our Contact page.', 'Spam protection: if enabled, our forms use Cloudflare Turnstile to tell people from bots. It may process technical information such as your IP address and browser details.', 'Affiliate clicks: when you click a Buy now button we record which product and retailer were clicked, the time, and the page you came from. This record is not linked to your name or email.'] },
      { h: 'How we use it', p: ['To run the website, answer your messages, send the deal emails you signed up for, keep the site secure, and understand which products and retailers are popular. We do not sell your personal information.'] },
      { h: 'Who handles your data', p: ['We use Supabase for our database, sign-in and image storage, Render to host the website, and Google for sign-in. Where advertising is switched on, ads are served by Google AdSense, which may collect data through cookies as described in our Cookie policy. Retailers you visit through our links have their own privacy policies.'] },
      { h: 'Your choices', p: ['You can ask us to see, correct or delete the personal information we hold about you by using our Contact page. We keep contact messages only as long as needed to respond and for our records.'] },
      { h: 'Children', p: ['Studio South is not directed at children under 13 and we do not knowingly collect their information.'] },
      { h: 'Changes', p: ['We may update this policy from time to time. The date at the top shows when it was last changed.'] },
    ],
  },
  'terms-of-use': {
    title: 'Terms of use',
    intro: UPDATED,
    sections: [
      { h: 'Using this website', p: ['By using Studio South you agree to these terms. If you do not agree, please do not use the website.'] },
      { h: 'We are not the seller', p: ['Studio South is a product discovery website. We do not sell, store or deliver products. Any purchase is a contract between you and the retailer, and the retailer’s terms, prices, delivery and returns policies apply.'] },
      { h: 'Accuracy', p: ['We try to keep information accurate, but product details, prices and availability can change without notice and may be out of date. Please check the retailer’s website before you buy.'] },
      { h: 'Acceptable use', p: ['Do not misuse the website, attempt to access areas you are not authorised to use, or copy our content at scale without permission.'] },
      { h: 'Intellectual property', p: ['Product names, images and brand marks belong to their respective owners. The Studio South name, logo and original content belong to us.'] },
      { h: 'Liability', p: ['To the extent allowed by law, Studio South is not liable for losses arising from your use of the website or from purchases made on third-party websites.'] },
      { h: 'Changes', p: ['We may update these terms from time to time. Continued use of the website means you accept the updated terms.'] },
    ],
  },
  'cookie-policy': {
    title: 'Cookie policy',
    intro: UPDATED,
    sections: [
      { h: 'What cookies are', p: ['Cookies are small files stored in your browser. They help websites remember things such as whether you are signed in.'] },
      { h: 'Cookies we use', p: ['Essential cookies: if you sign in, our authentication provider sets cookies that keep you signed in and keep your account secure. The website does not work properly for signed-in users without them.', 'We do not set advertising cookies of our own.', 'Advertising: if advertising is switched on, Google AdSense and its partners may use cookies or similar technologies to show and measure ads, including personalised ads where the law allows. You can manage personalised ads at adssettings.google.com, and you can learn how Google uses data from sites that use its services at policies.google.com/technologies/partner-sites.'] },
      { h: 'Third-party cookies', p: ['When you click a link to a retailer, that retailer and its affiliate network may set their own cookies. These let them credit us if you make a purchase. Their cookie policies apply.'] },
      { h: 'Your choices', p: ['You can block or delete cookies in your browser settings. Blocking essential cookies means you will not be able to stay signed in.'] },
    ],
  },
  disclaimer: {
    title: 'Disclaimer',
    intro: UPDATED,
    sections: [
      { h: 'General information only', p: ['The information on Studio South is provided for general information and shopping inspiration. It is not professional, medical or financial advice.'] },
      { h: 'Third-party websites', p: ['We link to websites we do not own or control. We are not responsible for their content, products, prices, stock, delivery or customer service.'] },
      { h: 'Affiliate commissions', p: ['We may earn commissions from qualifying purchases made through our links. See the Affiliate disclosure page for details.'] },
    ],
  },
};

export const getPage = (slug: string): Page | null => (Object.prototype.hasOwnProperty.call(PAGES, slug) ? PAGES[slug] : null);
