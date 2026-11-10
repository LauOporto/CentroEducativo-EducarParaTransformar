import { convertFormDataAsync } from 'expo/src/winter/fetch/convertFormData';
import { armarFormularioTransferencia } from '../api';

// Regresión: en el celular el fetch global es expo/fetch (SDK 58), que no
// acepta la parte { uri, name, type } de React Native y cortaba la carga de
// la transferencia con un error que la app mostraba como "sin conexión".
// Se arma el formulario como en Android y se serializa con el mismo
// conversor que usa expo/fetch.

const mockBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const BYTES = mockBytes;

jest.mock('expo-file-system', () => ({
  File: class {
    bytes() {
      return Promise.resolve(mockBytes);
    }
  },
}));

// En el celular FormData es el de React Native con el parche de Expo (el
// global de Jest es el de Node, que convierte las partes en texto). jest-expo
// reemplaza el parche por un stub, así que se carga el real.
beforeAll(() => {
  const { installFormDataPatch } = jest.requireActual('expo/src/winter/FormData');
  const RNFormData = require('react-native/Libraries/Network/FormData').default;
  installFormDataPatch(RNFormData);
  globalThis.FormData = RNFormData;
});

test('expo/fetch serializa el archivo con nombre, tipo y contenido', async () => {
  const form = await armarFormularioTransferencia({
    archivo: { uri: 'file:///cache/ImagePicker/abc.png', nombre: 'comprobante.png', tipo: 'image/png' },
    nroOperacion: 'OP-123456',
    fechaTransferencia: '2026-11-09',
    montoTransferido: '290000.00',
  });

  const { body, boundary } = await convertFormDataAsync(form, 'LIMITE');
  expect(boundary).toBe('LIMITE');
  const latin1 = (b: Uint8Array) => new TextDecoder('latin1').decode(b);
  const texto = latin1(body);

  expect(texto).toContain('content-disposition: form-data; name="archivo"; filename="comprobante.png"');
  expect(texto).toContain('content-type: image/png');
  expect(texto).toContain(latin1(BYTES));
  expect(texto).toContain('name="nroOperacion"\r\n\r\nOP-123456');
  expect(texto).toContain('name="medio"\r\n\r\nTRANSFERENCIA');
});
