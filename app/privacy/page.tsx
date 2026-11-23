import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy · whatsmynamerarity" };

export default function PrivacyPage() {
  return (
    <section className="glass-card flex flex-col gap-6 p-5 sm:p-8 md:p-12">
      <div className="flex flex-col gap-3">
        <p className="label-text">Privacy</p>
        <h1 className="section-title">Your name stays on your device.</h1>
        <p className="section-subtitle">
          The scoring engine and both name lists download to your browser, and
          everything is worked out there.
        </p>
      </div>
      <div className="prose-block">
        <ul>
          <li>
            No analytics, cookies, ads or tracking scripts. No outside services
            are called.
          </li>
          <li>
            The name you type goes into the page address after a <code>#</code>,
            so you can share or bookmark a result. Browsers never send that part
            of the address to the server.
          </li>
          <li>
            The only thing saved is your light or dark theme choice, in your
            browser&apos;s local storage.
          </li>
          <li>Share cards are drawn on your device. Nothing is uploaded.</li>
          <li>
            The site never looks up real people. It only reads public counts of
            names.
          </li>
        </ul>
      </div>
    </section>
  );
}
