// Feriados nacionales de Argentina, calculados (sin depender de un servicio
// externo) para decidir el "último día hábil del mes" de los mails de la
// Parte 3. Cubre:
// - inamovibles (Ley 27.399): 1/1, 24/3, 2/4, 1/5, 25/5, 20/6, 9/7, 8/12, 25/12;
// - móviles por Pascua: lunes y martes de Carnaval y Viernes Santo;
// - trasladables (art. 6 Ley 27.399): 17/6, 17/8, 12/10 y 20/11. Si caen
//   martes o miércoles pasan al lunes anterior; jueves o viernes, al lunes
//   siguiente.
// Los días no laborables y los "puentes" turísticos los fija un decreto cada
// año: se agregan con la variable FERIADOS_EXTRA (ver config/env.ts).

const INAMOVIBLES = ['01-01', '03-24', '04-02', '05-01', '05-25', '06-20', '07-09', '12-08', '12-25'];
const TRASLADABLES = ['06-17', '08-17', '10-12', '11-20'];

const iso = (d: Date) => d.toISOString().slice(0, 10);
const sumarDias = (d: Date, dias: number) => new Date(d.getTime() + dias * 86_400_000);

// Domingo de Pascua (algoritmo de Meeus/Jones/Butcher, calendario gregoriano).
export function domingoDePascua(anio: number): Date {
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(anio, mes - 1, dia));
}

function trasladar(fecha: Date): Date {
  switch (fecha.getUTCDay()) {
    case 2: // martes
      return sumarDias(fecha, -1);
    case 3: // miércoles
      return sumarDias(fecha, -2);
    case 4: // jueves
      return sumarDias(fecha, 4);
    case 5: // viernes
      return sumarDias(fecha, 3);
    default:
      return fecha;
  }
}

const cache = new Map<number, Set<string>>();

export function feriadosNacionales(anio: number): Set<string> {
  const guardado = cache.get(anio);
  if (guardado) return guardado;

  const pascua = domingoDePascua(anio);
  const fechas = new Set<string>([
    ...INAMOVIBLES.map((md) => `${anio}-${md}`),
    iso(sumarDias(pascua, -48)), // lunes de Carnaval
    iso(sumarDias(pascua, -47)), // martes de Carnaval
    iso(sumarDias(pascua, -2)), // Viernes Santo
    ...TRASLADABLES.map((md) => iso(trasladar(new Date(`${anio}-${md}T00:00:00.000Z`)))),
  ]);
  cache.set(anio, fechas);
  return fechas;
}

// "AAAA-MM-DD,AAAA-MM-DD" → fechas válidas (lo demás se ignora).
export function parseFeriadosExtra(valor: string | undefined): Set<string> {
  return new Set(
    (valor ?? '')
      .split(',')
      .map((f) => f.trim())
      .filter((f) => /^\d{4}-\d{2}-\d{2}$/.test(f)),
  );
}

export function esFeriado(fecha: string, extras: Set<string> = new Set()): boolean {
  return extras.has(fecha) || feriadosNacionales(Number(fecha.slice(0, 4))).has(fecha);
}
