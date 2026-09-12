export default function LogoMark({ size = 34 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      aria-hidden="true"
      style={{ flexShrink: 0, display: "block" }}
    >
      <circle cx="256" cy="256" r="250" fill="#0e241c" stroke="#b8862f" strokeWidth="5" />
      <circle cx="256" cy="140" r="9" fill="#dcae5b" />
      <path d="M161 372 V262 a95 95 0 0 1 190 0 V372 Z" fill="#b8862f" />
      <rect x="147" y="372" width="218" height="10" fill="#dcae5b" />
    </svg>
  );
}
