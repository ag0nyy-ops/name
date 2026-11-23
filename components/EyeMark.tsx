// jay. — © 2026 Jay — https://ag0nyy-ops.github.io/ — source viewable, not reusable by others (LICENSE)

// The mascot: a drawn eye. It blinks now and then and the pupil widens on hover (CSS only).
export function EyeMark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      aria-hidden="true"
      focusable="false"
    >
      <g className="jdx-lid">
        <path d="M6 32Q32 10 58 32Q32 54 6 32Z" />
        <circle cx="32" cy="32" r="9" />
        <circle
          className="jdx-pupil"
          cx="32"
          cy="32"
          r="4.07"
          fill="currentColor"
          stroke="none"
        />
      </g>
    </svg>
  );
}
