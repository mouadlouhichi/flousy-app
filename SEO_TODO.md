# SEO Action Items (SEOptimer Audit)

Here is the to-do list for the remaining tasks from the SEOptimer audit. These are items that require action outside of the app's codebase (such as DNS configuration, external account creation, or off-page strategy).

## 🌐 Domain & DNS Configuration (High / Low Priority)
*These tasks require logging into your domain registrar (e.g., Namecheap, GoDaddy, Cloudflare).*
- [ ] **Add an SPF Mail Record:** Create a TXT record in your DNS settings to authorize your email provider (like Google Workspace or Outlook) to send emails on behalf of `flousy.app`. This improves email deliverability and prevents your emails from going to spam.
- [ ] **Add a DMARC Mail Record:** Once SPF is set up, add a DMARC TXT record to your DNS to protect your domain from email spoofing.

## 📱 Social Media & Third-Party Accounts (Low Priority)
*I have already added the links to the website's footer, but you need to actually create and configure these profiles.*
- [ ] **Create a Facebook Page:** Set up a business page for Flousy and ensure the handle matches `facebook.com/flousyapp`.
- [ ] **Create an X (Twitter) Profile:** Claim the `@flousyapp` handle.
- [ ] **Create an Instagram Profile:** Claim the `@flousyapp` handle.
- [ ] **Create a LinkedIn Company Page:** Set up a company page for Flousy.
- [ ] **Create a YouTube Channel:** Claim the `@flousyapp` handle.
- [ ] **Install a Facebook Pixel (Optional):** If you plan on running Meta/Facebook Ads in the future, you will need to generate a Facebook Pixel ID from your Meta Business Manager. Once you have it, we can easily add it to the website's code alongside the Vercel Analytics.

## 🚀 Off-Page Strategy (High Priority)
- [ ] **Execute a Link Building Strategy:** The audit flagged this as "High Priority". You need to get other reputable websites, finance blogs, or directory listings to link back to `https://flousy.app`. This signals authority to Google and will significantly boost your rankings.

## ℹ️ Safe to Ignore (False Positives)
- [x] **Remove Inline Styles:** The report flagged inline styles as a negative. In modern frameworks like React and Next.js (which Flousy uses), inline styles are standard practice for handling dynamic widths, progress bars, and animations. This is a false positive from SEOptimer and will not harm your actual Google ranking. 
- [x] **Optimize for Mobile PageSpeed:** Next.js and Vercel natively optimize mobile loading out of the box. SEOptimer sometimes runs its mobile test from a distant US server causing a slight delay. Your core metrics (like Core Web Vitals) will naturally perform well in production.
