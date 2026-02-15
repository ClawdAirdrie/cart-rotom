export default function Pokeball({ size = 40 }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        position: 'relative',
        display: 'inline-block',
      }}
    >
      {/* Outer circle container */}
      <svg
        viewBox="0 0 100 100"
        style={{
          width: '100%',
          height: '100%',
          filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))',
        }}
      >
        {/* Top red half */}
        <circle cx="50" cy="50" r="50" fill="#EF5350" />

        {/* Bottom white half */}
        <path d="M 0 50 A 50 50 0 0 1 100 50 L 100 100 Q 50 100 0 100 Z" fill="white" />

        {/* Wider center band (black divider) */}
        <rect x="0" y="44" width="100" height="12" fill="black" />

        {/* Center white circle with black border */}
        <circle cx="50" cy="50" r="16" fill="white" stroke="black" strokeWidth="2" />

        {/* Center button dot */}
        <circle cx="50" cy="50" r="7" fill="black" />
      </svg>
    </div>
  );
}
