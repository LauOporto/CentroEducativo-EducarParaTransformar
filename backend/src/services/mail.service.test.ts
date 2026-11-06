import { test, before, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

import { logger } from '../utils/logger';

// D11: envío de mails por la API de Resend. fetch se reemplaza por un doble
// que registra la request, así ningún test sale a internet.
let svc: typeof import('./mail.service');

before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
  process.env.JWT_ACCESS_SECRET ??= 'a'.repeat(32);
  process.env.JWT_REFRESH_SECRET ??= 'b'.repeat(32);
  process.env.CLOUDINARY_CLOUD_NAME ??= 'test';
  process.env.CLOUDINARY_API_KEY ??= 'test';
  process.env.CLOUDINARY_API_SECRET ??= 'test';
  svc = await import('./mail.service');
});

let logs: { msg: string; meta: any }[];

beforeEach(() => {
  logs = [];
  mock.restoreAll();
  mock.method(logger, 'info', (msg: string, meta: any) => logs.push({ msg, meta }));
});

interface Pedido {
  url: string;
  headers: Record<string, string>;
  body: any;
}

function fetchFalso(status: number, respuesta: unknown) {
  const pedidos: Pedido[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    pedidos.push({ url, headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) });
    return new Response(JSON.stringify(respuesta), { status, headers: { 'Content-Type': 'application/json' } });
  }) as unknown as typeof fetch;
  return { impl, pedidos };
}

const MAIL = { para: 'padre@mail.com', asunto: 'Tu factura', texto: 'Hola' };

test('sin API key no sale a la red: el mail queda en el log', async () => {
  const { impl, pedidos } = fetchFalso(200, {});
  const enviar = svc.crearEnviadorMail({ from: 'Colegio <a@b.com>', fetch: impl });

  const r = await enviar({ ...MAIL, adjuntos: [{ nombre: 'factura.pdf', contenido: Buffer.from('pdf') }] });

  assert.deepEqual(r, { transporte: 'log', id: null, destinatario: 'padre@mail.com' });
  assert.equal(pedidos.length, 0);
  assert.equal(logs[0].meta.texto, 'Hola');
  assert.deepEqual(logs[0].meta.adjuntos, ['factura.pdf']);
});

test('con API key manda a Resend con auth, remitente y adjuntos en base64', async () => {
  const { impl, pedidos } = fetchFalso(200, { id: 'msg-1' });
  const enviar = svc.crearEnviadorMail({ apiKey: 're_test', from: 'Colegio <a@b.com>', fetch: impl });

  const r = await enviar({
    ...MAIL,
    html: '<p>Hola</p>',
    adjuntos: [{ nombre: 'f.pdf', contenido: Buffer.from('pdf') }],
  });

  assert.deepEqual(r, { transporte: 'resend', id: 'msg-1', destinatario: 'padre@mail.com' });
  assert.equal(pedidos[0].url, 'https://api.resend.com/emails');
  assert.equal(pedidos[0].headers.Authorization, 'Bearer re_test');
  assert.deepEqual(pedidos[0].body, {
    from: 'Colegio <a@b.com>',
    to: ['padre@mail.com'],
    subject: 'Tu factura',
    text: 'Hola',
    html: '<p>Hola</p>',
    attachments: [{ filename: 'f.pdf', content: Buffer.from('pdf').toString('base64') }],
  });
});

test('el log de un envío real no incluye el contenido del mail', async () => {
  const { impl } = fetchFalso(200, { id: 'msg-2' });
  const enviar = svc.crearEnviadorMail({ apiKey: 're_test', from: 'a@b.com', fetch: impl });

  await enviar({ ...MAIL, texto: 'Tu código es 123456' });

  assert.ok(logs.every((l) => !JSON.stringify(l.meta).includes('123456')));
});

test('con redirección todo va a la casilla de la demo y el asunto dice a quién iba', async () => {
  const { impl, pedidos } = fetchFalso(200, { id: 'msg-3' });
  const enviar = svc.crearEnviadorMail({
    apiKey: 're_test',
    from: 'a@b.com',
    redirigirA: 'demo@equipo.com',
    fetch: impl,
  });

  const r = await enviar(MAIL);

  assert.equal(r.destinatario, 'demo@equipo.com');
  assert.deepEqual(pedidos[0].body.to, ['demo@equipo.com']);
  assert.equal(pedidos[0].body.subject, '[para: padre@mail.com] Tu factura');
});

test('si Resend rechaza el envío, lanza MailError con el motivo', async () => {
  const { impl } = fetchFalso(403, { message: 'You can only send testing emails to your own email address' });
  const enviar = svc.crearEnviadorMail({ apiKey: 're_test', from: 'a@b.com', fetch: impl });

  await assert.rejects(
    () => enviar(MAIL),
    (err) => err instanceof svc.MailError && /403/.test(err.message) && /own email address/.test(err.message),
  );
});

test('si no hay conexión, lanza MailError', async () => {
  const enviar = svc.crearEnviadorMail({
    apiKey: 're_test',
    from: 'a@b.com',
    fetch: (async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch,
  });

  await assert.rejects(() => enviar(MAIL), svc.MailError);
});

test('en los tests el enviador por defecto nunca usa el proveedor', async () => {
  const r = await svc.enviarMail(MAIL);
  assert.equal(r.transporte, 'log');
});

test('la plantilla escapa el HTML de los datos', () => {
  const html = svc.htmlMail({ saludo: 'Hola, <b>Ana</b>:', parrafos: ['a & b'], destacado: ['Total', '$ 100'] });
  assert.match(html, /Hola, &lt;b&gt;Ana&lt;\/b&gt;:/);
  assert.match(html, /a &amp; b/);
  assert.match(html, /\$ 100/);
});
