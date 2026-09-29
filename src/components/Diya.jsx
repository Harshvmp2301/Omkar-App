export default function Diya({ lit, onClick, label }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="diya-btn"
      type="button"
    >
      <svg width="22" height="26" viewBox="0 0 22 26" aria-hidden="true">
        <ellipse cx="11" cy="21" rx="10" ry="4" fill="var(--diya-base)" stroke="var(--diya-base-stroke)" strokeWidth="1" />
        <path
          d="M11 6 C 8 10, 8 14, 11 16 C 14 14, 14 10, 11 6 Z"
          fill={lit ? "var(--diya-flame)" : "transparent"}
          stroke={lit ? "var(--diya-flame-stroke)" : "var(--muted)"}
          strokeWidth="1"
          className={lit ? "diya-flicker" : ""}
        />
      </svg>
    </button>
  );
}
