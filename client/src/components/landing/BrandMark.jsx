// Isologo propio: un anillo trazado a mano (como el del logo real de la
// institución) con cinco puntos — uno por cada color del emblema
// original — alcanzando el centro. Mismo motivo que se repite, a mayor
// escala, en el hero.
export default function BrandMark({ className = 'h-9 w-9' }) {
  const puntos = [
    { color: '#0F9E86', angle: -55, r: 15 },
    { color: '#D1348A', angle: 15, r: 15 },
    { color: '#7A4FCB', angle: 85, r: 15 },
    { color: '#E85A32', angle: 155, r: 15 },
    { color: '#1D63B4', angle: 225, r: 15 },
  ];

  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <circle cx="24" cy="24" r="19" fill="none" stroke="#1D63B4" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="88 28" />
      {puntos.map((p) => {
        const rad = (p.angle * Math.PI) / 180;
        const cx = 24 + p.r * Math.cos(rad);
        const cy = 24 + p.r * Math.sin(rad);
        return <circle key={p.color} cx={cx} cy={cy} r="4.2" fill={p.color} />;
      })}
    </svg>
  );
}
