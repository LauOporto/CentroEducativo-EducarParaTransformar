// Métricas de productividad del TP Unidad 4, calculadas sobre el historial
// de git (sin dependencias). Mismas definiciones que la línea base del 06/10:
//   - PR = merge "Merge pull request #n" en main dentro de la ventana.
//   - Lead Time = primer commit de la rama del PR → merge a main.
//   - Trabajo sin integrar = commits de ramas remotas que no están en main,
//     hechos dentro de la ventana.
//
// Uso:  pnpm metricas --desde 2026-10-07 [--hasta 2026-10-26T23:59]
//                        [--out metricas.json] [--base scripts/linea-base.json]
// Correr `git fetch origin` antes, para medir sobre lo que está en GitHub.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { parseArgs } from 'node:util';

const { values: args } = parseArgs({ options: { desde: { type: 'string' }, hasta: { type: 'string' }, out: { type: 'string' }, base: { type: 'string' } } });
const desde = new Date(args.desde ?? '2026-09-11').getTime() / 1000;
const hasta = (args.hasta ? new Date(args.hasta) : new Date()).getTime() / 1000;
const MAIN = 'origin/main';

const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();
const lineas = (s) => (s ? s.split('\n') : []);
const horas = (s) => s / 3600;
const dias = (s) => s / 86400;
const mediana = (xs) => {
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : null;
};
const r1 = (x) => (x == null ? null : Math.round(x * 10) / 10);

// Pull Requests mergeados a main dentro de la ventana.
const todosLosPRs = lineas(git('log', MAIN, '--merges', '--format=%H %ct %s'))
  .map((l) => l.match(/^(\w+) (\d+) Merge pull request (#\d+) from \S+?\/(\S+)/))
  .filter(Boolean);
const prs = todosLosPRs
  .filter((m) => +m[2] >= desde && +m[2] <= hasta)
  .map(([, sha, ct, pr, rama]) => {
    const tiempos = lineas(git('log', '--format=%ct', `${sha}^1..${sha}^2`)).map(Number);
    return {
      pr, rama, merge: new Date(ct * 1000).toISOString().slice(0, 10),
      commits: tiempos.length,
      leadTimeH: r1(horas(+ct - Math.min(...tiempos))),
      cambios: git('diff', '--shortstat', `${sha}^1`, sha),
      _ct: +ct,
    };
  })
  .reverse();

// Trabajo sin integrar al cierre de la ventana. Para una fecha pasada, main
// es el último merge de PR hasta esa fecha (el historial de primer padre no
// sirve: los merges de main hacia las ramas lo mezclan).
const mainAlCierre =
  hasta >= +git('log', '-1', '--format=%ct', MAIN) ? MAIN : todosLosPRs.find((m) => +m[2] <= hasta)?.[1] ?? MAIN;
// Las ramas pueden compartir commits: cada commit se cuenta una vez, y dos
// ramas que a esa fecha apuntaban al mismo commit cuentan como una (una rama
// creada después a partir de otra no existía todavía).
const sinIntegrar = new Map();
const puntasPendientes = new Set();
for (const b of lineas(git('branch', '-r', '--format=%(refname:short)'))) {
  if (!b.startsWith('origin/') || /\/(main|HEAD)$/.test(b)) continue;
  const commits = lineas(git('log', '--format=%H %ct', `--since=@${Math.floor(desde)}`, `--until=@${Math.floor(hasta)}`, b, `^${mainAlCierre}`));
  for (const l of commits) sinIntegrar.set(...l.split(' '));
  if (commits.length) puntasPendientes.add(commits[0].split(' ')[0]);
}
const ramasPendientes = [...puntasPendientes];
const fechasSinIntegrar = [...sinIntegrar.values()].map(Number);

const semanas = (hasta - desde) / (7 * 86400);
const ultimoMerge = prs.length ? prs[prs.length - 1]._ct : null;
const metricas = {
  ventana: `${new Date(desde * 1000).toISOString().slice(0, 10)} → ${new Date(hasta * 1000).toISOString().slice(0, 16)}`,
  prsMergeados: prs.length,
  frecuenciaPRsPorSemana: r1(prs.length / semanas),
  leadTimeMedianaH: r1(mediana(prs.map((p) => p.leadTimeH))),
  leadTimeMaximoH: r1(Math.max(...prs.map((p) => p.leadTimeH))),
  commitsPorPRMediana: r1(mediana(prs.map((p) => p.commits))),
  commitsPorPRMaximo: Math.max(...prs.map((p) => p.commits)),
  diasDesdeUltimoMerge: ultimoMerge ? r1(dias(hasta - ultimoMerge)) : null,
  ramasConCommitsSinIntegrar: ramasPendientes.length,
  commitsSinIntegrar: sinIntegrar.size,
  antiguedadCommitMasViejoSinIntegrarDias: sinIntegrar.size ? r1(dias(hasta - Math.min(...fechasSinIntegrar))) : 0,
};

console.log(`\nVentana: ${metricas.ventana}\n`);
console.table(prs.map(({ _ct, ...p }) => p));
const base = args.base ? JSON.parse(fs.readFileSync(args.base, 'utf8')) : null;
console.table(
  Object.entries(metricas).filter(([k]) => k !== 'ventana').map(([metrica, valor]) => ({ metrica, ...(base && { antes: base[metrica] }), valor })),
);
if (args.out) fs.writeFileSync(args.out, JSON.stringify(metricas, null, 2) + '\n');
