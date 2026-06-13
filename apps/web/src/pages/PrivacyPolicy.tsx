import type { ReactNode } from 'react';

// Public privacy policy page, served at /privacy. Linked from the Play Store
// listing (Google requires a privacy policy URL for apps that collect
// personal data).

// Public-facing support contact. Override at deploy with VITE_CONTACT_EMAIL to
// avoid exposing a personal address on the Play Store listing.
const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL || 'oluwaseunadesina8@gmail.com';

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="mb-8">
    <h2 className="text-xl font-serif italic mb-3 text-[#1A1A1A] dark:text-white">{title}</h2>
    <div className="text-sm leading-relaxed text-[#4A4A46] dark:text-[#B5B5B1] space-y-3">{children}</div>
  </section>
);

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[#F8F7F4] dark:bg-[#121212]">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <a href="/" className="text-xs uppercase font-bold text-[#8E8E8A] hover:underline">
          ← FitPick
        </a>
        <h1 className="text-3xl font-serif italic mt-4 mb-2 text-[#1A1A1A] dark:text-white">Privacy Policy</h1>
        <p className="text-xs text-[#8E8E8A] mb-10">Last updated: June 12, 2026</p>

        <Section title="Who we are">
          <p>
            FitPick is a personal AI stylist app that helps you catalogue your wardrobe and get outfit
            suggestions. This policy explains what data FitPick collects, how it is used, and how you can
            delete it. Questions: <a className="underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </p>
        </Section>

        <Section title="What we collect">
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>Account information</strong> — your email address, display name, and (if you sign in
              with Google) your Google profile picture. Passwords are stored only as salted hashes.
            </li>
            <li>
              <strong>Wardrobe data</strong> — the clothing items you add, including names, colors, types,
              and descriptions, plus the outfits you save and calendar events you create.
            </li>
            <li>
              <strong>Photos</strong> — when you scan a clothing item, the photo is sent to our server and to
              Google's Gemini API to identify the garment. Photos are processed in memory and are not stored
              on our servers after analysis.
            </li>
            <li>
              <strong>Location (optional)</strong> — if you grant location permission, your coordinates are
              used only to fetch local weather for outfit suggestions. Location is never stored.
            </li>
            <li>
              <strong>Activity and diagnostics</strong> — security-relevant events (sign-ins, account
              changes) and errors are recorded with your account ID and IP address for up to 90 days to keep
              the service secure and reliable.
            </li>
          </ul>
        </Section>

        <Section title="How your data is used">
          <p>
            Your data is used solely to provide FitPick's features: generating outfit suggestions and outfit
            images from your wardrobe, analyzing clothing photos, and syncing your data across devices. We do
            not sell your data or use it for advertising.
          </p>
        </Section>

        <Section title="Third-party services">
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Google Gemini</strong> — processes outfit prompts and clothing photos to generate suggestions and images.</li>
            <li><strong>Google Sign-In</strong> — optional authentication.</li>
            <li><strong>OpenWeather</strong> — receives coordinates (never your identity) for local weather.</li>
            <li><strong>Resend</strong> — sends password-reset emails.</li>
            <li><strong>New Relic</strong> — service monitoring and error reporting.</li>
          </ul>
        </Section>

        <Section title="Data retention and deletion">
          <p>
            Your account data is kept until you delete your account. You can permanently delete your account
            and all associated data (wardrobe, saved outfits, events) at any time from{' '}
            <strong>Settings → Delete Account</strong> in the app, or via our{' '}
            <a className="underline" href="/delete-account">account deletion page</a>. Deletion is immediate
            and irreversible. Activity logs expire automatically after at most 90 days.
          </p>
        </Section>

        <Section title="Children">
          <p>FitPick is not directed at children under 13, and we do not knowingly collect data from them.</p>
        </Section>

        <Section title="Changes to this policy">
          <p>
            We may update this policy as the app evolves; the date above reflects the latest revision.
            Material changes will be announced in the app.
          </p>
        </Section>
      </div>
    </div>
  );
}
