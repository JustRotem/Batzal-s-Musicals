export default function BatzalLogo() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="bzg" x1="12" y1="8" x2="52" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#7b97ff" />
          <stop offset="1" stopColor="#3a58d6" />
        </linearGradient>
      </defs>
      <path
        d="M32 10C40 20 54 26 54 40c0 11-10 18-22 18S10 51 10 40c0-14 14-20 22-30z"
        fill="url(#bzg)"
      />
      <path
        d="M32 15c-6 11-10 21-8 35M32 15c6 11 10 21 8 35"
        fill="none"
        stroke="#fff"
        strokeOpacity=".38"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path d="M32 10c0-4 1-6 4-8" fill="none" stroke="#35c58b" strokeWidth="3.4" strokeLinecap="round" />
    </svg>
  );
}
