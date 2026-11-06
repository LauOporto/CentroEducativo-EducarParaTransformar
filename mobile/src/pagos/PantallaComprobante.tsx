import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { Aviso } from '@/auth/AuthContext';
import { AvisoBanner, Boton, Cargando, Pantalla, Tarjeta, Texto, Titulo } from '@/components/ui';
import { colors, fonts, radius, spacing } from '@/theme';
import { clavesPagos, compartirPdf, invalidarPagos, pagosApi, verArchivoCargado } from './api';
import { confirmar, Etiqueta, estilosPagos, FilaDato, Seccion } from './componentes';
import { ETIQUETA_CONCEPTO, fechaCorta, fechaDeInstante, periodoLargo, pesos } from './formato';
import { FormularioTransferencia } from './FormularioTransferencia';
import { volver } from './PantallaFactura';
import type { Comprobante, DatosBancarios, EstadoComprobante, RespuestaComprobante } from './tipos';

// RF-50: comprobante de pago. Con los datos para transferir, la carga de la
// transferencia, la anulación y el seguimiento de la revisión. Mientras está
// EN_REVISION se consulta cada 20 s: si la administración lo aprueba o
// rechaza desde el web, la app lo muestra sola (RNF-57).

export const INTERVALO_REVISION_MS = 20_000;

export function PantallaComprobante({ comprobanteId }: { comprobanteId: number }) {
  const queryClient = useQueryClient();
  const clave = clavesPagos.comprobante(comprobanteId);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [descargando, setDescargando] = useState(false);
  const [abriendo, setAbriendo] = useState(false);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);

  useEffect(() => {
    if (aviso) scroll.current?.scrollTo({ y: 0, animated: true });
  }, [aviso]);

  const consulta = useQuery({
    queryKey: clave,
    queryFn: () => pagosApi.comprobante(comprobanteId),
    refetchInterval: (q) => (q.state.data?.comprobante.estado === 'EN_REVISION' ? INTERVALO_REVISION_MS : false),
  });
  const c = consulta.data?.comprobante;

  // Si el estado cambió por fuera de esta pantalla (el admin aprobó o
  // rechazó), también se releen la factura y el estado de cuenta.
  const estadoAnterior = useRef<EstadoComprobante | undefined>(undefined);
  useEffect(() => {
    if (!c) return;
    if (estadoAnterior.current && estadoAnterior.current !== c.estado) {
      setAviso(null);
      void invalidarPagos(queryClient, { hijoId: c.alumno.id, facturaId: c.factura.id });
    }
    estadoAnterior.current = c.estado;
  }, [c, queryClient]);

  const actualizar = (comprobante: Comprobante) => {
    queryClient.setQueryData<RespuestaComprobante>(clave, (previo) => (previo ? { ...previo, comprobante } : previo));
    estadoAnterior.current = comprobante.estado;
    void invalidarPagos(queryClient, {
      hijoId: comprobante.alumno.id,
      facturaId: comprobante.factura.id,
      comprobanteId: comprobante.id,
    });
  };

  const anular = useMutation({
    mutationFn: () => pagosApi.anular(comprobanteId),
    onMutate: () => setAviso(null),
    onSuccess: (r) => {
      actualizar(r.comprobante);
      setAviso({ tipo: 'exito', texto: 'Anulaste el comprobante. Sus ítems volvieron a estar pendientes.' });
    },
    onError: (err) => {
      setAviso({ tipo: 'error', texto: err.message });
      void queryClient.invalidateQueries({ queryKey: clave });
    },
  });

  async function descargar(comp: Comprobante) {
    setDescargando(true);
    setAviso(null);
    try {
      const uri = await pagosApi.descargarComprobantePdf(comp.id, comp.numero);
      await compartirPdf(uri, `Comprobante ${comp.numero}`);
    } catch (err) {
      setAviso({ tipo: 'error', texto: err instanceof Error ? err.message : 'No pudimos descargar el comprobante.' });
    } finally {
      setDescargando(false);
    }
  }

  async function verArchivo() {
    setAbriendo(true);
    try {
      await verArchivoCargado(comprobanteId);
    } catch (err) {
      setAviso({ tipo: 'error', texto: err instanceof Error ? err.message : 'No pudimos abrir el archivo.' });
    } finally {
      setAbriendo(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Pantalla
        scrollRef={scroll}
        refreshControl={
          <RefreshControl
            refreshing={consulta.isRefetching}
            onRefresh={() => void consulta.refetch()}
            tintColor={colors.blue500}
          />
        }
      >
        <Boton titulo="Volver" variante="texto" icono="arrow-back" alInicio onPress={volver} />

        {consulta.isPending ? (
          <Cargando texto="Cargando el comprobante…" />
        ) : consulta.error ? (
          <>
            <AvisoBanner aviso={{ tipo: 'error', texto: consulta.error.message }} />
            <Boton titulo="Reintentar" variante="secundario" icono="refresh" onPress={() => void consulta.refetch()} />
          </>
        ) : c ? (
          <>
            <View style={estilosPagos.encabezado}>
              <Texto suave>Comprobante de pago</Texto>
              <Titulo testID="comprobante-numero">{c.numero}</Titulo>
            </View>
            {aviso ? <AvisoBanner aviso={aviso} /> : null}

            <SegunEstado comprobante={c} onIrFactura={() => irAFactura(c.factura.id)} />

            <Tarjeta>
              <View style={estilosPagos.fila}>
                <View style={{ gap: 2, flexShrink: 1 }}>
                  <Text style={estilosPagos.subtitulo}>{c.estado === 'GENERADO' ? 'Total a pagar' : 'Total'}</Text>
                  <Text style={estilosPagos.montoGrande} testID="comprobante-total">
                    {pesos(c.total)}
                  </Text>
                </View>
                <Etiqueta tipo="comprobante" estado={c.estado} testID="comprobante-estado" />
              </View>
              <FilaDato etiqueta="Factura" valor={c.factura.numero} />
              <FilaDato etiqueta="Período" valor={periodoLargo(c.factura.periodo)} />
              <FilaDato etiqueta="Alumno" valor={c.alumno.nombre} />
              <FilaDato etiqueta="Generado" valor={fechaDeInstante(c.generadoEn)} ultimo />
            </Tarjeta>

            <Tarjeta>
              <Seccion>Ítems incluidos</Seccion>
              {c.items.map((i, n) => (
                <View key={i.cuotaId} style={[estilosPagos.fila, n > 0 && estilosPagos.separador]}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={estilosPagos.nombre}>{ETIQUETA_CONCEPTO[i.concepto]}</Text>
                    <Text style={estilosPagos.detalle}>{i.descripcion}</Text>
                  </View>
                  <Text style={estilosPagos.monto}>{pesos(i.importe)}</Text>
                </View>
              ))}
            </Tarjeta>

            {c.estado === 'GENERADO' && consulta.data ? (
              <>
                <DatosParaTransferir datos={consulta.data.datosBancarios} instrucciones={consulta.data.instrucciones} />
                <Boton
                  titulo="Descargar comprobante (PDF)"
                  variante="secundario"
                  icono="document-text-outline"
                  cargando={descargando}
                  onPress={() => void descargar(c)}
                />
                <FormularioTransferencia
                  comprobanteId={c.id}
                  total={c.total}
                  onEnviado={(r) => {
                    actualizar(r.comprobante);
                    setAviso({ tipo: 'exito', texto: r.mensaje });
                  }}
                />
                <Boton
                  titulo="Anular comprobante"
                  variante="texto"
                  icono="close-circle-outline"
                  cargando={anular.isPending}
                  onPress={async () => {
                    const ok = await confirmar(
                      '¿Anular el comprobante?',
                      `Se anula ${c.numero} y sus ítems vuelven a estar pendientes. No lo anules si ya transferiste.`,
                      'Anular',
                    );
                    if (ok) anular.mutate();
                  }}
                />
              </>
            ) : null}

            {c.transferencia ? (
              <Tarjeta>
                <Seccion>Transferencia cargada</Seccion>
                <FilaDato etiqueta="N.º de operación" valor={c.transferencia.nroOperacion ?? '—'} />
                <FilaDato
                  etiqueta="Fecha"
                  valor={c.transferencia.fechaTransferencia ? fechaCorta(c.transferencia.fechaTransferencia) : '—'}
                />
                <FilaDato
                  etiqueta="Monto"
                  valor={c.transferencia.montoTransferido === null ? '—' : pesos(c.transferencia.montoTransferido)}
                />
                <FilaDato etiqueta="Cargada el" valor={fechaDeInstante(c.transferencia.cargadoEn)} ultimo />
                {c.tieneArchivo ? (
                  <Boton
                    titulo="Ver archivo cargado"
                    variante="secundario"
                    icono="eye-outline"
                    cargando={abriendo}
                    onPress={() => void verArchivo()}
                  />
                ) : null}
              </Tarjeta>
            ) : null}
          </>
        ) : null}
      </Pantalla>
    </KeyboardAvoidingView>
  );
}

function irAFactura(facturaId: number) {
  router.push({ pathname: '/pagos/factura/[id]', params: { id: String(facturaId) } });
}

function SegunEstado({ comprobante: c, onIrFactura }: { comprobante: Comprobante; onIrFactura: () => void }) {
  switch (c.estado) {
    case 'GENERADO':
      return (
        <View testID="estado-generado">
          <AvisoBanner
            aviso={{
              tipo: 'info',
              texto: 'Transferí el total con los datos de abajo y después cargá el comprobante del banco.',
            }}
          />
        </View>
      );
    case 'EN_REVISION':
      return (
        <View testID="estado-en-revision">
          <AvisoBanner
            aviso={{ tipo: 'info', texto: 'En revisión por la administración. Te avisamos cuando se acredite.' }}
          />
        </View>
      );
    case 'APROBADO':
      return (
        <View testID="estado-aprobado">
          <AvisoBanner
            aviso={{
              tipo: 'exito',
              texto: c.pago
                ? `Pago acreditado el ${fechaDeInstante(c.pago.fechaAcreditacion)} por ${pesos(c.pago.monto)}.`
                : 'Pago acreditado.',
            }}
          />
        </View>
      );
    case 'RECHAZADO':
      return (
        <View testID="estado-rechazado" style={{ gap: spacing.md }}>
          <AvisoBanner
            aviso={{
              tipo: 'error',
              texto: `La administración rechazó este comprobante. Motivo: ${c.motivoRechazo ?? 'sin especificar'}`,
            }}
          />
          <Tarjeta>
            <Texto>Los ítems volvieron a estar pendientes: generá un comprobante nuevo.</Texto>
            <Boton titulo="Ir a la factura" icono="arrow-forward" onPress={onIrFactura} />
          </Tarjeta>
        </View>
      );
    case 'ANULADO':
      return (
        <View testID="estado-anulado">
          <Tarjeta style={{ backgroundColor: '#F1F3F6' }}>
            <Texto suave>Este comprobante está anulado. Sus ítems volvieron a estar pendientes en la factura.</Texto>
            <Boton titulo="Ir a la factura" variante="secundario" icono="arrow-forward" onPress={onIrFactura} />
          </Tarjeta>
        </View>
      );
  }
}

function DatosParaTransferir({ datos, instrucciones }: { datos: DatosBancarios; instrucciones: string }) {
  const [copiado, setCopiado] = useState<'cbu' | 'alias' | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (temporizador.current) clearTimeout(temporizador.current);
    },
    [],
  );

  async function copiar(campo: 'cbu' | 'alias', valor: string) {
    await Clipboard.setStringAsync(valor);
    setCopiado(campo);
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setCopiado(null), 2500);
  }

  return (
    <Tarjeta>
      <View testID="datos-bancarios" style={{ gap: spacing.md }}>
        <Seccion>Datos para transferir</Seccion>
        <FilaDato etiqueta="Titular" valor={datos.titular} />
        <FilaDato etiqueta="CUIT" valor={datos.cuit} />
        <DatoCopiable
          etiqueta="CBU"
          valor={datos.cbu}
          copiado={copiado === 'cbu'}
          onCopiar={() => void copiar('cbu', datos.cbu)}
        />
        <DatoCopiable
          etiqueta="Alias"
          valor={datos.alias}
          copiado={copiado === 'alias'}
          onCopiar={() => void copiar('alias', datos.alias)}
        />
        <Texto style={{ fontSize: 14 }}>{instrucciones}</Texto>
        <View style={estilos.leyenda}>
          <Ionicons name="swap-horizontal" size={18} color={colors.blue700} />
          <Text style={estilos.leyendaTexto}>Solo se aceptan pagos por transferencia bancaria.</Text>
        </View>
      </View>
    </Tarjeta>
  );
}

function DatoCopiable({
  etiqueta,
  valor,
  copiado,
  onCopiar,
}: {
  etiqueta: string;
  valor: string;
  copiado: boolean;
  onCopiar: () => void;
}) {
  return (
    <View style={estilos.copiable}>
      <View style={estilos.copiableCabecera}>
        <Text style={estilos.copiableEtiqueta}>{etiqueta}</Text>
        <Pressable
          testID={`copiar-${etiqueta.toLowerCase()}`}
          onPress={onCopiar}
          accessibilityRole="button"
          accessibilityLabel={`Copiar ${etiqueta}`}
          style={({ pressed }) => [estilos.copiar, copiado && estilos.copiarHecho, pressed && { opacity: 0.85 }]}
        >
          <Ionicons
            name={copiado ? 'checkmark' : 'copy-outline'}
            size={16}
            color={copiado ? '#0B6E5E' : colors.blue500}
          />
          <Text accessibilityLiveRegion="polite" style={[estilos.copiarTexto, copiado && { color: '#0B6E5E' }]}>
            {copiado ? 'Copiado' : 'Copiar'}
          </Text>
        </Pressable>
      </View>
      <Text style={estilos.copiableValor} selectable>
        {valor}
      </Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  copiable: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  copiableCabecera: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  copiableEtiqueta: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft },
  copiableValor: { fontFamily: fonts.bodySemibold, fontSize: 16, color: colors.ink, letterSpacing: 0.3 },
  copiar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.blue100,
    backgroundColor: colors.white,
  },
  copiarHecho: { borderColor: '#BFE6DD', backgroundColor: colors.tealSoft },
  copiarTexto: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.blue500 },
  leyenda: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.blue50,
  },
  leyendaTexto: { flex: 1, fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.blue700 },
});
