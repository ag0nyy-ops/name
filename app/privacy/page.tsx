// jay. — © 2026 Jay — https://ag0nyy-ops.github.io/ — source viewable, not reusable by others (LICENSE)
import type { Metadata } from "next";
import { FileHeader } from "../../components/FileHeader";

export const metadata: Metadata = { title: "Privacy · Name rarity" };

export default function PrivacyPage() {
  return (
    <section className="file enter">
      <FileHeader number="04" label="Privacy" title="Privacy">
        <p className="lede">
          <strong className="font-medium text-fg">Your name stays on your device.</strong>{" "}
          The scoring engine and both name lists download to your browser, and
          everything is worked out there.
        </p>
      </FileHeader>
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
            Nothing is saved on your device: no cookies, no local storage. The
            fonts are served from this site, not from a font service.
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
