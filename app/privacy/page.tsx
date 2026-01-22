export default function PrivacyPage() {
  return (
    <section className="glass-card flex flex-col gap-6 p-8 md:p-12">
      <div className="flex flex-col gap-3">
        <p className="label-text">Privacy</p>
        <h1 className="section-title">Private by design.</h1>
        <p className="section-subtitle">
          whatsmynamerarity runs entirely in your browser. We do not store, log, or transmit your
          input.
        </p>
      </div>
      <div className="space-y-4 text-sm text-mist">
        <p>
          There are no analytics, cookies, or tracking scripts. No external APIs are called at
          runtime.
        </p>
        <p>
          All calculations happen locally. Refreshing the page clears input. Theme preference is the
          only setting stored, and it stays in localStorage.
        </p>
        <p>
          If you share or download a card, the image is generated locally on your device.
        </p>
        <p>
          We never store raw inputs, and we never attempt to identify individuals.
        </p>
      </div>
    </section>
  );
}
