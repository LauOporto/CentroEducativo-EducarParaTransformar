// Isologo de la institución redibujado en vector a partir de MET II/logo.PNG
// (197×174 px): anillo de pincel, cinco figuras en ronda y, en la versión
// completa, el wordmark en arco. Las figuras se acercan y alejan del centro
// en loop, como buscando darse la mano (keyframe `reach` en tailwind.config.js).

// Centro de la ronda de figuras y del anillo, en unidades del PNG original.
const C = { x: 106, y: 87 };
const RING = { x: 104.5, y: 91.5, r: 49 };

// Una sola figura (la naranja) relativa al centro; las otras cuatro son la
// misma rotada de a 72°, en el orden horario del logo.
const FIG = {
  junction: [-1, -20],
  head: { x: 5.8, y: -13.4, r: 3.7 },
  // [punta, semiancho en la base]
  spikes: [
    [[-7.5, -35], 3.6], // pierna exterior
    [[14, -26], 2.6], // brazo
    [[0.5, -3.5], 3.1], // brazo hacia el centro
  ],
};
const COLORES = ['#F25E41', '#EE2EA0', '#9E2694', '#4AA3DF', '#90CA48'];

function spikePath([[tx, ty], w]) {
  const [jx, jy] = FIG.junction;
  const len = Math.hypot(tx - jx, ty - jy);
  const nx = (-(ty - jy) / len) * w, ny = ((tx - jx) / len) * w;
  const mx = (jx + tx) / 2, my = (jy + ty) / 2;
  // lados levemente cóncavos, como el trazo del original
  return `M${jx + nx} ${jy + ny}Q${mx + nx * 0.35} ${my + ny * 0.35} ${tx} ${ty}Q${mx - nx * 0.35} ${my - ny * 0.35} ${jx - nx} ${jy - ny}Z`;
}
const FIG_D = FIG.spikes.map(spikePath).join('');

// Anillo de pincel: grueso abajo a la derecha, se afina hacia arriba y queda
// abierto arriba a la derecha.
function ringPath() {
  const desde = 8, hasta = 274, pasos = 60, out = [], inn = [];
  for (let i = 0; i <= pasos; i++) {
    const t = i / pasos, a = ((desde + (hasta - desde) * t) * Math.PI) / 180;
    const grosor = 0.8 + 5.6 * Math.pow(1 - t, 1.3) * Math.min(1, t * 12 + 0.35);
    const p = (r) => `${(RING.x + r * Math.cos(a)).toFixed(2)} ${(RING.y + r * Math.sin(a)).toFixed(2)}`;
    out.push(p(RING.r + grosor / 2));
    inn.unshift(p(RING.r - grosor / 2));
  }
  return `M${out.join('L')}L${inn.join('L')}Z`;
}
const RING_D = ringPath();

// Arco del wordmark, de izquierda a derecha por arriba. Es más largo que el
// texto a propósito: textPath descarta los glifos que caen fuera del trazado,
// y el texto se centra con startOffset="50%".
const TXT_R = 57;
const arc = (deg) => [RING.x + TXT_R * Math.cos((deg * Math.PI) / 180), RING.y + TXT_R * Math.sin((deg * Math.PI) / 180)];
const [ax, ay] = arc(140), [bx, by] = arc(40);
const TXT_D = `M${ax} ${ay}A${TXT_R} ${TXT_R} 0 1 1 ${bx} ${by}`;

// `animated`: solo el logo grande de la página inicial se mueve; en navbar,
// footer y panel queda quieto.
export default function BrandMark({ className = 'h-9 w-9', full = false, animated = false }) {
  return (
    <svg
      viewBox={full ? '30 18 150 140' : '53 39 104 104'}
      className={className}
      role={full ? 'img' : undefined}
      aria-label={full ? 'Educar para Transformar, centro educativo' : undefined}
      aria-hidden={full ? undefined : 'true'}
    >
      <path d={RING_D} fill="#4AA3DF" />
      <path
        d={`M${RING.x + 45.5} ${RING.y + 12}A45.5 45.5 0 0 1 ${RING.x - 30} ${RING.y + 34}`}
        fill="none"
        stroke="#77BFEA"
        strokeWidth="0.7"
        opacity="0.8"
      />

      {COLORES.map((color, i) => (
        <g key={color} transform={`translate(${C.x} ${C.y}) rotate(${i * 72})`}>
          {/* Las cinco se mueven en sincronía sobre su propio eje: en el
              punto máximo las manos interiores se juntan en el centro. */}
          <g className={animated ? 'motion-safe:animate-reach' : undefined} fill={color}>
            <path d={FIG_D} />
            <circle cx={FIG.junction[0]} cy={FIG.junction[1]} r="3.4" />
            <circle cx={FIG.head.x} cy={FIG.head.y} r={FIG.head.r} />
          </g>
        </g>
      ))}

      {full && (
        <>
          <path id="brandmark-arc" d={TXT_D} fill="none" />
          <text fill="#1F4FAA" fontSize="12" fontWeight="800" letterSpacing="2.3" style={{ fontFamily: '"Hanken Grotesk", system-ui, sans-serif' }}>
            <textPath href="#brandmark-arc" startOffset="50%" textAnchor="middle">
              EDUCAR PARA TRANSFORMAR
            </textPath>
          </text>
          <text
            x={RING.x + 3}
            y="153"
            textAnchor="middle"
            fill="#5A5DBF"
            fontSize="6.4"
            fontWeight="700"
            letterSpacing="1.9"
            style={{ fontFamily: '"Hanken Grotesk", system-ui, sans-serif' }}
          >
            CENTRO EDUCATIVO
          </text>
        </>
      )}
    </svg>
  );
}
