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

        {/* Center band */}
        <line x1="0" y1="50" x2="100" y2="50" stroke="black" strokeWidth="3" />

        {/* Center white circle with red border */}
        <circle cx="50" cy="50" r="18" fill="white" stroke="black" strokeWidth="2" />
        <circle cx="50" cy="50" r="14" fill="#EF5350" stroke="black" strokeWidth="2" />

        {/* Center dot (button) */}
        <circle cx="50" cy="50" r="8" fill="white" stroke="black" strokeWidth="1.5" />
      </svg>
    </div>
  );
}
