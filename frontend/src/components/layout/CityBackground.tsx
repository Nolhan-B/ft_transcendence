// Full-screen Miami Vice / Hotline Miami backdrop shared across all pages.
// Fixed behind the content with a subtle dark scrim to preserve readability.
export function CityBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-gradient-to-b from-[#090414] via-[#1a0b2e] to-[#260c3a]"
    >
      {/* Atmospheric neon glows */}
      <div className="hero-glow absolute left-1/2 top-[44%] size-[38rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-3xl" />
      <div className="hero-glow absolute -left-24 top-1/4 size-96 rounded-full bg-secondary/14 blur-3xl" />
      <div className="hero-glow absolute -right-24 bottom-1/4 size-96 rounded-full bg-tertiary/20 blur-3xl [animation-delay:2s]" />

      {/* Crisp vector sliced sunset */}
      <svg
        viewBox="0 0 400 400"
        className="absolute left-1/2 top-[46%] h-[360px] w-[360px] -translate-x-1/2 -translate-y-1/2 opacity-80 sm:h-[500px] sm:w-[500px]"
      >
        <defs>
          <linearGradient id="bg-miami-sun" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffd23f" />
            <stop offset="48%" stopColor="#ff6b4a" />
            <stop offset="100%" stopColor="#ff2a85" />
          </linearGradient>
          <mask id="bg-miami-sun-slices">
            <rect width="400" height="400" fill="white" />
            <rect x="0" y="218" width="400" height="6" fill="black" />
            <rect x="0" y="242" width="400" height="9" fill="black" />
            <rect x="0" y="268" width="400" height="12" fill="black" />
            <rect x="0" y="298" width="400" height="16" fill="black" />
            <rect x="0" y="332" width="400" height="22" fill="black" />
          </mask>
        </defs>
        <circle
          cx="200"
          cy="200"
          r="175"
          fill="url(#bg-miami-sun)"
          mask="url(#bg-miami-sun-slices)"
        />
      </svg>

      {/* Vector city skyline anchored to the horizon */}
      <svg
        viewBox="0 0 1440 220"
        preserveAspectRatio="none"
        className="absolute inset-x-0 bottom-[30%] h-28 w-full sm:h-44"
      >
        <path
          fill="#160a2b"
          d="M0,220 L0,145 L48,145 L48,110 L96,110 L96,155 L145,155 L145,78 L205,78 L205,130 L260,130 L260,92 L320,92 L320,165 L390,165 L390,120 L450,120 L450,175 L520,175 L520,140 L590,140 L590,185 L850,185 L850,135 L915,135 L915,165 L980,165 L980,95 L1050,95 L1050,145 L1120,145 L1120,68 L1190,68 L1190,125 L1255,125 L1255,102 L1330,102 L1330,150 L1390,150 L1390,120 L1440,120 L1440,220 Z"
        />
        <path
          fill="#0b0617"
          d="M0,220 L0,168 L62,168 L62,128 L115,128 L115,172 L170,172 L170,96 L228,96 L228,154 L285,154 L285,116 L340,116 L340,182 L430,182 L430,148 L485,148 L485,196 L955,196 L955,152 L1015,152 L1015,180 L1085,180 L1085,112 L1148,112 L1148,160 L1215,160 L1215,86 L1278,86 L1278,144 L1350,144 L1350,128 L1405,128 L1405,168 L1440,168 L1440,220 Z"
        />
        <g opacity="0.7">
          <rect x="184" y="112" width="8" height="3" fill="#00f0ff" />
          <rect x="202" y="112" width="8" height="3" fill="#00f0ff" />
          <rect x="184" y="124" width="8" height="3" fill="#ff2a85" />
          <rect x="196" y="138" width="14" height="3" fill="#00f0ff" />
          <rect x="298" y="130" width="10" height="3" fill="#ff2a85" />
          <rect x="314" y="142" width="10" height="3" fill="#ffd23f" />
          <rect x="1102" y="126" width="10" height="3" fill="#00f0ff" />
          <rect x="1118" y="138" width="12" height="3" fill="#ff2a85" />
          <rect x="1230" y="102" width="10" height="3" fill="#00f0ff" />
          <rect x="1248" y="102" width="10" height="3" fill="#00f0ff" />
          <rect x="1230" y="116" width="18" height="3" fill="#ff2a85" />
          <rect x="1238" y="132" width="10" height="3" fill="#ffd23f" />
        </g>
      </svg>

      {/* Neon horizon line + single perspective floor */}
      <div className="absolute inset-x-0 bottom-0 h-[30%] overflow-hidden bg-[#0b0617]/70">
        <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-secondary to-transparent shadow-[0_0_18px_var(--color-secondary)]" />
        <div className="miami-floor h-[220%] w-full" />
      </div>

      {/* Framing palm tree silhouettes */}
      <svg
        viewBox="0 0 220 320"
        className="absolute bottom-0 left-0 hidden h-72 w-auto opacity-90 drop-shadow-[2px_0_12px_rgba(255,42,133,0.28)] md:block lg:h-96"
      >
        <path
          fill="#090414"
          d="M28,320 C36,248 54,182 86,118 L99,122 C69,186 55,250 48,320 Z"
        />
        <g fill="#090414">
          <path d="M90,118 C64,88 26,82 0,96 C26,96 58,104 86,124 Z" />
          <path d="M92,116 C74,76 42,54 12,56 C38,68 64,88 88,120 Z" />
          <path d="M95,114 C96,72 114,42 146,34 C122,56 108,82 100,118 Z" />
          <path d="M98,118 C126,92 166,86 202,102 C168,102 134,110 102,126 Z" />
          <path d="M96,124 C126,116 156,128 182,154 C150,140 122,134 94,132 Z" />
          <path d="M88,124 C56,124 28,142 10,168 C36,150 62,138 90,132 Z" />
        </g>
      </svg>

      <svg
        viewBox="0 0 220 320"
        className="absolute bottom-0 right-0 hidden h-72 w-auto -scale-x-100 opacity-90 drop-shadow-[2px_0_12px_rgba(0,240,255,0.28)] md:block lg:h-96"
      >
        <path
          fill="#090414"
          d="M28,320 C36,248 54,182 86,118 L99,122 C69,186 55,250 48,320 Z"
        />
        <g fill="#090414">
          <path d="M90,118 C64,88 26,82 0,96 C26,96 58,104 86,124 Z" />
          <path d="M92,116 C74,76 42,54 12,56 C38,68 64,88 88,120 Z" />
          <path d="M95,114 C96,72 114,42 146,34 C122,56 108,82 100,118 Z" />
          <path d="M98,118 C126,92 166,86 202,102 C168,102 134,110 102,126 Z" />
          <path d="M96,124 C126,116 156,128 182,154 C150,140 122,134 94,132 Z" />
          <path d="M88,124 C56,124 28,142 10,168 C36,150 62,138 90,132 Z" />
        </g>
      </svg>

      {/* Subtle dark veil so page content stays readable */}
      <div className="absolute inset-0 bg-gradient-to-b from-base-300/45 via-transparent to-base-300/40" />
    </div>
  );
}
