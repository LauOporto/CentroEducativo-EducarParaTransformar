import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { armarFormularioTransferencia, pagosApi, type DatosTransferencia } from '../api';
import { FormularioTransferencia } from '../FormularioTransferencia';
import { PantallaComprobante } from '../PantallaComprobante';
import { PantallaFactura } from '../PantallaFactura';
import type { Comprobante, Factura, RespuestaComprobante } from '../tipos';

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
}));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
jest.mock('../api', () => ({
  ...jest.requireActual('../api'),
  pagosApi: {
    factura: jest.fn(),
    comprobante: jest.fn(),
    generarComprobante: jest.fn(),
    anular: jest.fn(),
    cargarTransferencia: jest.fn(),
  },
}));

const api = pagosApi as jest.Mocked<typeof pagosApi>;
const NBSP = ' ';

function conQuery(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { gcTime: Infinity } },
  });
  return <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>;
}

const FACTURA: Factura = {
  id: 37,
  numero: 'F-202611-000037',
  periodo: '2026-11',
  emitidaEn: '2026-11-05T16:01:12.026Z',
  vencimiento: '2026-11-10',
  total: 415000,
  pagado: 0,
  saldo: 415000,
  estado: 'PENDIENTE',
  items: [
    {
      id: 157,
      concepto: 'CUOTA',
      descripcion: 'Cuota mensual — Secundaria',
      importe: 260000,
      vencimiento: '2026-11-10',
      estado: 'PENDIENTE',
    },
    {
      id: 158,
      concepto: 'DEPORTE',
      descripcion: 'Fútbol — Martes 15:00 a 16:30',
      importe: 32000,
      vencimiento: '2026-11-10',
      estado: 'VENCIDA',
    },
    {
      id: 160,
      concepto: 'TRANSPORTE',
      descripcion: 'Recorrido Norte',
      importe: 35000,
      vencimiento: '2026-11-10',
      estado: 'EN_REVISION',
    },
  ],
  comprobantes: [],
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('PantallaFactura', () => {
  beforeEach(() => {
    api.factura.mockResolvedValue({
      exito: true,
      alumno: { id: 16, nombre: 'Franco Barrabino', curso: null },
      factura: FACTURA,
    });
  });

  test('sin selección el botón "Generar comprobante de pago" está deshabilitado', async () => {
    await render(conQuery(<PantallaFactura facturaId={37} />));
    const boton = await screen.findByRole('button', { name: /Generar comprobante de pago/ });
    expect(boton).toBeDisabled();
    expect(screen.getByTestId('total-seleccionado')).toHaveTextContent(`$${NBSP}0,00`);
  });

  test('elegir ítems actualiza el total y habilita el botón', async () => {
    await render(conQuery(<PantallaFactura facturaId={37} />));
    await fireEvent.press(await screen.findByTestId('item-157'));
    expect(screen.getByTestId('total-seleccionado')).toHaveTextContent(`$${NBSP}260.000,00`);
    await fireEvent.press(screen.getByTestId('item-158'));
    expect(screen.getByTestId('total-seleccionado')).toHaveTextContent(`$${NBSP}292.000,00`);
    expect(screen.getByTestId('item-158')).toBeChecked();
    expect(screen.getByRole('button', { name: /Generar comprobante de pago/ })).toBeEnabled();
  });

  test('un ítem EN_REVISION no se puede elegir', async () => {
    await render(conQuery(<PantallaFactura facturaId={37} />));
    const enRevision = await screen.findByTestId('item-160');
    expect(enRevision).toBeDisabled();
    await fireEvent.press(enRevision);
    expect(enRevision).not.toBeChecked();
    expect(screen.getByTestId('total-seleccionado')).toHaveTextContent(`$${NBSP}0,00`);
    expect(screen.getByText('Incluido en un comprobante en curso')).toBeTruthy();
  });

  test('"Elegir todo lo pendiente" toma PENDIENTE y VENCIDA y genera con esos ítems', async () => {
    api.generarComprobante.mockResolvedValue({
      exito: true,
      comprobante: { id: 21, alumno: { id: 16 }, items: [] } as unknown as Comprobante,
      datosBancarios: { titular: 'Colegio', cuit: '30-1', cbu: '0000', alias: 'ALIAS' },
      instrucciones: '',
    });
    await render(conQuery(<PantallaFactura facturaId={37} />));
    await fireEvent.press(await screen.findByTestId('elegir-todo'));
    expect(screen.getByTestId('total-seleccionado')).toHaveTextContent(`$${NBSP}292.000,00`);
    await fireEvent.press(screen.getByRole('button', { name: /Generar comprobante de pago/ }));
    await waitFor(() => expect(api.generarComprobante).toHaveBeenCalledWith(37, [157, 158]));
    // Al crearse, se navega al comprobante nuevo.
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith({ pathname: '/pagos/comprobante/[id]', params: { id: '21' } }),
    );
  });
});

describe('FormularioTransferencia', () => {
  const HOY = '2026-11-06';
  const pdf = {
    uri: 'file:///cache/transferencia.pdf',
    name: 'transferencia.pdf',
    mimeType: 'application/pdf',
    size: 2048,
  };

  async function renderFormulario(enviar = jest.fn()) {
    await render(
      <FormularioTransferencia comprobanteId={21} total={290000} hoy={HOY} enviar={enviar} onEnviado={jest.fn()} />,
    );
    return enviar;
  }

  test('no envía sin archivo', async () => {
    const enviar = await renderFormulario();
    await fireEvent.changeText(screen.getByTestId('campo-nro'), 'OP-123456');
    await fireEvent.press(screen.getByRole('button', { name: /Enviar transferencia/ }));
    expect(await screen.findByTestId('error-archivo')).toHaveTextContent(
      'Adjuntá el comprobante de la transferencia (foto o PDF).',
    );
    expect(enviar).not.toHaveBeenCalled();
  });

  test('valida la fecha futura y el N.º de operación', async () => {
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({ canceled: false, assets: [pdf] });
    const enviar = await renderFormulario();
    await fireEvent.press(screen.getByRole('button', { name: /Elegir PDF/ }));
    await screen.findByTestId('archivo-elegido');
    await fireEvent.changeText(screen.getByTestId('campo-nro'), 'ab');
    await fireEvent.changeText(screen.getByTestId('campo-fecha'), '07112026');
    await fireEvent.press(screen.getByRole('button', { name: /Enviar transferencia/ }));
    expect(await screen.findByText('La fecha de la transferencia no puede ser futura.')).toBeTruthy();
    expect(screen.getByText(/El N\.º de operación tiene que tener entre 4 y 40 caracteres/)).toBeTruthy();
    expect(enviar).not.toHaveBeenCalled();
  });

  test('envía los datos normalizados y el medio siempre es TRANSFERENCIA', async () => {
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({ canceled: false, assets: [pdf] });
    const enviar = await renderFormulario(jest.fn(() => new Promise(() => {})));
    // No hay forma de elegir otro medio: es un texto fijo.
    expect(screen.getByTestId('medio-pago')).toHaveTextContent(/Medio de pago.*Transferencia bancaria/);
    expect(screen.queryByText(/efectivo/i)).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: /Elegir PDF/ }));
    await screen.findByTestId('archivo-elegido');
    await fireEvent.changeText(screen.getByTestId('campo-nro'), 'OP-123456');
    await fireEvent.press(screen.getByTestId('fecha-ayer'));
    await fireEvent.press(screen.getByRole('button', { name: /Enviar transferencia/ }));

    await waitFor(() => expect(enviar).toHaveBeenCalledTimes(1));
    const datos = enviar.mock.calls[0][1] as DatosTransferencia;
    expect(datos).toEqual({
      archivo: { uri: pdf.uri, nombre: 'transferencia.pdf', tipo: 'application/pdf', tamano: 2048 },
      nroOperacion: 'OP-123456',
      fechaTransferencia: '2026-11-05',
      montoTransferido: '290000.00',
    });
    expect(datos).not.toHaveProperty('medio');

    const form = await armarFormularioTransferencia(datos);
    expect(form.getAll('medio')).toEqual(['TRANSFERENCIA']);
  });
});

describe('PantallaComprobante', () => {
  const RECHAZADO: Comprobante = {
    id: 22,
    numero: 'CP-202611-000022',
    estado: 'RECHAZADO',
    medio: 'TRANSFERENCIA',
    total: 32000,
    generadoEn: '2026-11-06T15:00:00.000Z',
    items: [{ cuotaId: 158, concepto: 'DEPORTE', descripcion: 'Fútbol', importe: 32000 }],
    factura: { id: 37, numero: 'F-202611-000037', periodo: '2026-11', vencimiento: '2026-11-10', estado: 'PENDIENTE' },
    alumno: { id: 16, nombre: 'Franco Barrabino', curso: 'Secundaria — 1° año' },
    padre: { id: 20, nombre: 'Patricia Barrabino' },
    transferencia: {
      nroOperacion: 'OP-9',
      fechaTransferencia: '2026-11-05',
      montoTransferido: 32000,
      cargadoEn: '2026-11-06T15:10:00.000Z',
    },
    tieneArchivo: true,
    motivoRechazo: 'La transferencia no figura en el banco',
    revisadoEn: '2026-11-06T16:00:00.000Z',
    pago: null,
  };
  const respuestaComprobante = (c: Comprobante): RespuestaComprobante => ({
    exito: true,
    comprobante: c,
    datosBancarios: { titular: 'Colegio', cuit: '30-1', cbu: '0000', alias: 'ALIAS' },
    instrucciones: 'Transferí exactamente…',
  });

  test('RECHAZADO muestra el motivo y el camino para generar uno nuevo', async () => {
    api.comprobante.mockResolvedValue(respuestaComprobante(RECHAZADO));
    await render(conQuery(<PantallaComprobante comprobanteId={22} />));
    expect(await screen.findByText(/Motivo: La transferencia no figura en el banco/)).toBeTruthy();
    expect(screen.getByText('Los ítems volvieron a estar pendientes: generá un comprobante nuevo.')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Ir a la factura/ })).toBeTruthy();
    // Sin formulario ni datos para transferir: ya no admite cambios.
    expect(screen.queryByTestId('form-transferencia')).toBeNull();
    expect(screen.queryByTestId('datos-bancarios')).toBeNull();
  });

  test('GENERADO muestra los datos bancarios y el formulario', async () => {
    api.comprobante.mockResolvedValue(
      respuestaComprobante({
        ...RECHAZADO,
        estado: 'GENERADO',
        transferencia: null,
        motivoRechazo: null,
        tieneArchivo: false,
      }),
    );
    await render(conQuery(<PantallaComprobante comprobanteId={22} />));
    expect(await screen.findByTestId('datos-bancarios')).toBeTruthy();
    expect(screen.getByText('Solo se aceptan pagos por transferencia bancaria.')).toBeTruthy();
    expect(screen.getByTestId('form-transferencia')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Anular comprobante/ })).toBeTruthy();
  });
});
