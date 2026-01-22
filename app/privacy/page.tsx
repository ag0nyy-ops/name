export default function PrivacyPage() {
  return (
    <section className="glass-card flex flex-col gap-6 p-8 md:p-12">
      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.4em] text-mist">Privacy</p>
        <h1 className="section-title">Private by design.</h1>
        <p className="section-subtitle">
          Name Rarity runs entirely in your browser. We do not store, log, or transmit your input.
        </p>
      </div>
      <div className="space-y-4 text-sm text-mist">
        <p>
          We do not use analytics, cookies, or tracking scripts. There is no backend data collection
          and no third-party APIs.
        </p>
        <p>
          Every calculation is performed locally. Refreshing the page clears all input. Theme
          preference is stored in localStorage only so the UI can remember your choice.
        </p>
        <p>
          If you share or download a card, the image is generated locally on your device.
        </p>
      </div>
    </section>
  );
}
