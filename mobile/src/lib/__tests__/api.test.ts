import { Platform } from 'react-native';
import { File } from 'expo-file-system';
import { ApiError, apiMultipart, descargarArchivo, registrarFinDeSesion, setAccessToken } from '../api';
import { guardarRefreshToken } from '../tokenStore';

// apiMultipart y descargarArchivo: X-Client-Type en toda request, 401 →
// UNA renovación → reintento, y refresh rechazado → fin de sesión.

jest.mock('../tokenStore', () => {
  let guardado: string | null = 'refresh-1';
  return {
    leerRefreshToken: jest.fn(async () => guardado),
    guardarRefreshToken: jest.fn(async (t: string) => {
      guardado = t;
    }),
    borrarRefreshToken: jest.fn(async () => {
      guardado = null;
    }),
  };
});

jest.mock('expo-file-system', () => {
  class FileMock {
    uri: string;
    constructor(dir: string, nombre: string) {
      this.uri = `file:///${dir}/${nombre}`;
    }
    static downloadFileAsync = jest.fn();
  }
  return { File: FileMock, Paths: { cache: 'cache' } };
});

type Llamada = { url: string; init: RequestInit & { headers: Record<string, string> } };

const respuesta = (status: number, cuerpo: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => cuerpo,
  blob: async () => new Blob(['%PDF-1.4']),
});

const sesionRenovada = respuesta(200, {
  exito: true,
  usuario: { id: 20, nombre: 'Patricia', tipo: 'PADRE', token: 'access-nuevo' },
  refreshToken: 'refresh-2',
});

let llamadas: Llamada[];
let fetchMock: jest.Mock;
const finDeSesion = jest.fn();
const descargar = File.downloadFileAsync as unknown as jest.Mock;

beforeEach(async () => {
  llamadas = [];
  fetchMock = jest.fn();
  globalThis.fetch = ((url: string, init: Llamada['init']) => {
    llamadas.push({ url, init });
    return fetchMock(url, init);
  }) as unknown as typeof fetch;
  setAccessToken('access-viejo');
  await guardarRefreshToken('refresh-1');
  finDeSesion.mockClear();
  descargar.mockReset();
  registrarFinDeSesion(finDeSesion);
  Platform.OS = 'ios';
});

const esRefresh = (l: Llamada) => l.url.endsWith('/api/auth/refresh');

describe('apiMultipart', () => {
  test('manda el FormData tal cual, sin Content-Type propio, con X-Client-Type y Bearer', async () => {
    fetchMock.mockResolvedValueOnce(respuesta(200, { exito: true }));
    const form = new FormData();
    form.append('nroOperacion', 'OP-1');

    await apiMultipart('/pagos/comprobantes/5/transferencia', form);

    const [l] = llamadas;
    expect(l?.url).toMatch(/\/api\/pagos\/comprobantes\/5\/transferencia$/);
    expect(l?.init.method).toBe('POST');
    expect(l?.init.body).toBe(form);
    expect(l?.init.headers['X-Client-Type']).toBe('mobile');
    expect(l?.init.headers.Authorization).toBe('Bearer access-viejo');
    expect(l?.init.headers['Content-Type']).toBeUndefined();
  });

  test('401 → renueva una sola vez y reintenta con el token nuevo', async () => {
    fetchMock
      .mockResolvedValueOnce(respuesta(401, { message: 'Token vencido' }))
      .mockResolvedValueOnce(sesionRenovada)
      .mockResolvedValueOnce(respuesta(200, { exito: true, mensaje: 'ok' }));

    const r = await apiMultipart<{ mensaje: string }>('/pagos/comprobantes/5/transferencia', new FormData());

    expect(r.mensaje).toBe('ok');
    expect(llamadas).toHaveLength(3);
    expect(llamadas.filter(esRefresh)).toHaveLength(1);
    expect(llamadas[1]?.init.headers['X-Client-Type']).toBe('mobile');
    expect(llamadas[2]?.init.headers.Authorization).toBe('Bearer access-nuevo');
    expect(guardarRefreshToken).toHaveBeenLastCalledWith('refresh-2');
  });

  test('dos 401 a la vez comparten la misma renovación', async () => {
    fetchMock.mockImplementation(async (url: string, init: Llamada['init']) => {
      if (url.endsWith('/auth/refresh')) return sesionRenovada;
      return init.headers.Authorization === 'Bearer access-nuevo'
        ? respuesta(200, { exito: true })
        : respuesta(401, { message: 'Token vencido' });
    });

    await Promise.all([
      apiMultipart('/pagos/comprobantes/5/transferencia', new FormData()),
      apiMultipart('/pagos/comprobantes/6/transferencia', new FormData()),
    ]);

    expect(llamadas.filter(esRefresh)).toHaveLength(1);
  });

  test('si el refresh también da 401, la sesión termina y no se reintenta', async () => {
    fetchMock
      .mockResolvedValueOnce(respuesta(401, { message: 'Token vencido' }))
      .mockResolvedValueOnce(respuesta(401, { message: 'Tu sesión expiró. Iniciá sesión de nuevo.' }));

    await expect(apiMultipart('/pagos/comprobantes/5/transferencia', new FormData())).rejects.toMatchObject({
      status: 401,
    });
    expect(llamadas).toHaveLength(2);
    expect(finDeSesion).toHaveBeenCalledTimes(1);
    expect(finDeSesion).toHaveBeenCalledWith('Tu sesión expiró. Iniciá sesión de nuevo.');
  });

  test('un 422 del backend llega con su mensaje', async () => {
    fetchMock.mockResolvedValueOnce(
      respuesta(422, { error: 'HttpError', message: 'El monto transferido debe ser exactamente $ 290.000,00.' }),
    );
    const error = (await apiMultipart('/pagos/comprobantes/5/transferencia', new FormData()).catch(
      (e: unknown) => e,
    )) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(422);
    expect(error.message).toMatch(/exactamente/);
  });
});

describe('descargarArchivo', () => {
  test('nativo: baja con expo-file-system a la caché, con X-Client-Type y Bearer', async () => {
    descargar.mockResolvedValueOnce({ uri: 'file:///cache/factura-F-202611-000037.pdf' });

    const uri = await descargarArchivo('/pagos/facturas/37/pdf', 'factura-F-202611-000037.pdf');

    expect(uri).toBe('file:///cache/factura-F-202611-000037.pdf');
    const [url, destino, opciones] = descargar.mock.calls[0];
    expect(url).toMatch(/\/api\/pagos\/facturas\/37\/pdf$/);
    expect(destino.uri).toBe('file:///cache/factura-F-202611-000037.pdf');
    expect(opciones.headers).toEqual({ 'X-Client-Type': 'mobile', Authorization: 'Bearer access-viejo' });
    expect(opciones.idempotent).toBe(true);
  });

  test('nativo: 401 → una renovación → reintento con el token nuevo', async () => {
    descargar
      .mockRejectedValueOnce(new Error('UnableToDownload: response has status: 401'))
      .mockResolvedValueOnce({ uri: 'file:///cache/x.pdf' });
    fetchMock.mockResolvedValueOnce(sesionRenovada);

    await expect(descargarArchivo('/pagos/comprobantes/5/pdf', 'x.pdf')).resolves.toBe('file:///cache/x.pdf');
    expect(llamadas.filter(esRefresh)).toHaveLength(1);
    expect(descargar).toHaveBeenCalledTimes(2);
    expect(descargar.mock.calls[1][2].headers.Authorization).toBe('Bearer access-nuevo');
  });

  test('nativo: refresh rechazado → fin de sesión', async () => {
    descargar.mockRejectedValue(new Error('response has status 401'));
    fetchMock.mockResolvedValueOnce(respuesta(401, { message: 'Tu sesión expiró.' }));

    await expect(descargarArchivo('/pagos/comprobantes/5/pdf', 'x.pdf')).rejects.toMatchObject({ status: 401 });
    expect(descargar).toHaveBeenCalledTimes(1);
    expect(finDeSesion).toHaveBeenCalledWith('Tu sesión expiró.');
  });

  test('nativo: un 403 no renueva la sesión', async () => {
    descargar.mockRejectedValueOnce(new Error('response has status: 403'));
    await expect(descargarArchivo('/pagos/facturas/1/pdf', 'x.pdf')).rejects.toMatchObject({
      status: 403,
      message: 'No tenés acceso a este archivo.',
    });
    expect(llamadas).toHaveLength(0);
  });

  test('web: fetch con headers → blob → object URL, con el mismo reintento ante 401', async () => {
    Platform.OS = 'web';
    const crear = jest.fn(() => 'blob:http://localhost/123');
    globalThis.URL.createObjectURL = crear;
    fetchMock
      .mockResolvedValueOnce(respuesta(401, { message: 'Token vencido' }))
      .mockResolvedValueOnce(sesionRenovada)
      .mockResolvedValueOnce(respuesta(200, null));

    await expect(descargarArchivo('/pagos/facturas/37/pdf', 'f.pdf')).resolves.toBe('blob:http://localhost/123');
    expect(llamadas[0]?.init.headers['X-Client-Type']).toBe('mobile');
    expect(llamadas[2]?.init.headers.Authorization).toBe('Bearer access-nuevo');
    expect(crear).toHaveBeenCalledTimes(1);
    expect(descargar).not.toHaveBeenCalled();
  });
});
