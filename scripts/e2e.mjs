// Pruebas E2E con Cypress contra la app compilada y una base propia:
//   1. prepara la base de E2E (migraciones pendientes + seed),
//   2. levanta el backend compilado (sirve API + client/dist) en el puerto 4100,
//   3. corre Cypress y 4. apaga el servidor.
//
// Uso:  pnpm build && pnpm e2e        (pnpm e2e --open abre la interfaz de Cypress;
//       pnpm e2e --spec cypress/e2e/<archivo>.cy.js corre una sola prueba)
// La base sale de E2E_DATABASE_URL o, si no está, de backend/.env cambiando el
// nombre de la base por "educar_e2e": nunca se usa la base de desarrollo.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';

const PUERTO = 4100;
const URL_APP = `http://localhost:${PUERTO}`;

function urlBaseE2E() {
  if (process.env.E2E_DATABASE_URL) return process.env.E2E_DATABASE_URL;
  const linea = fs.readFileSync('backend/.env', 'utf8').match(/^DATABASE_URL=["']?([^"'\r\n]+)/m);
  if (!linea) throw new Error('Definí E2E_DATABASE_URL o DATABASE_URL en backend/.env');
  const url = new URL(linea[1]);
  url.pathname = '/educar_e2e';
  return url.toString();
}

const env = {
  ...process.env,
  NODE_ENV: 'test',
  PORT: String(PUERTO),
  DATABASE_URL: urlBaseE2E(),
  CORS_ORIGIN: URL_APP,
  JWT_ACCESS_SECRET: 'e2e-access-secret-solo-para-pruebas-000000',
  JWT_REFRESH_SECRET: 'e2e-refresh-secret-solo-para-pruebas-00000',
  // Las pruebas no suben archivos: Cloudinary no se llama.
  CLOUDINARY_CLOUD_NAME: 'e2e',
  CLOUDINARY_API_KEY: 'e2e',
  CLOUDINARY_API_SECRET: 'e2e',
};

// shell: true para encontrar pnpm.cmd en Windows; los argumentos son fijos (sin espacios).
const run = (cmd, args, cwd) => spawnSync([cmd, ...args].join(' '), { cwd, env, stdio: 'inherit', shell: true }).status;

// Sin `migrate reset`: no se borra nada. El seed es idempotente (upserts) y
// cada prueba restaura por API el estado que necesita.
for (const paso of [
  ['migrate', 'deploy'],
  ['db', 'seed'],
]) {
  if (run('pnpm', ['exec', 'prisma', ...paso], 'backend') !== 0) process.exit(1);
}

const servidor = spawn('node', ['dist/index.js'], { cwd: 'backend', env, stdio: 'inherit' });
const apagar = () => servidor.kill();
process.on('exit', apagar);

for (let i = 0; ; i++) {
  try {
    if ((await fetch(`${URL_APP}/health`)).ok) break;
  } catch {
    // todavía arrancando
  }
  if (i === 60) throw new Error(`El servidor no respondió en ${URL_APP}/health`);
  await new Promise((r) => setTimeout(r, 1000));
}

// Lo que no sea --open pasa directo a Cypress (ej. --spec cypress/e2e/rf18-deportes.cy.js).
const extra = process.argv.slice(2).filter((a) => a !== '--open');
const modo = process.argv.includes('--open') ? 'open' : 'run';
const codigo = run('pnpm', ['exec', 'cypress', modo, '--config', `baseUrl=${URL_APP}`, ...extra], 'client');
apagar();
process.exit(codigo ?? 1);
