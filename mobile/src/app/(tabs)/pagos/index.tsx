import { useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AvisoBanner, Boton, Cargando, Pantalla, Tarjeta, Texto, Titulo } from '@/components/ui';
import { SelectorHijo } from '@/components/SelectorHijo';
import { useHijos } from '@/hijos/HijosContext';
import type { Hijo } from '@/lib/tipos';
import { clavesPagos, pagosApi } from '@/pagos/api';
import { Etiqueta, estilosPagos, Seccion } from '@/pagos/componentes';
import { FiltroPeriodo } from '@/pagos/FiltroPeriodo';
import {
  CONCEPTOS,
  ETIQUETA_CONCEPTO,
  fechaCorta,
  fechaDeInstante,
  hoyArgentina,
  periodoLargo,
  pesos,
} from '@/pagos/formato';
import { FILTRO_INICIAL, rangoDelFiltro, type Filtro } from '@/pagos/rango';
import type { Concepto, EstadoCuenta, Factura } from '@/pagos/tipos';
import { colors, fonts, radius, spacing } from '@/theme';

// RF-49: estado de cuenta del hijo elegido. Resumen, deuda discriminada por
// ítem (cuota, deporte, transporte, comedor), facturas con sus comprobantes
// e historial de pagos, filtrado por meses. Los datos salen de la misma API
// que el web (RNF-56) y se releen al volver a la app, al deslizar y después
// de cada pago (RNF-57).

export default function Pagos() {
  const { hijos, seleccionado, cargando, error, recargar } = useHijos();

  return cargando ? (
    <Pantalla>
      <Cargando texto="Cargando tus hijos…" />
    </Pantalla>
  ) : error ? (
    <Pantalla>
      <AvisoBanner aviso={{ tipo: 'error', texto: error.message }} />
      <Boton titulo="Reintentar" variante="secundario" icono="refresh" onPress={() => void recargar()} />
    </Pantalla>
  ) : !seleccionado || hijos.length === 0 ? (
    <Pantalla>
      <Titulo>Pagos</Titulo>
      <Tarjeta>
        <Texto suave>
          Todavía no tenés hijos vinculados. Vinculalos con su DNI desde el campus web, en el Panel de Padre/Tutor.
        </Texto>
      </Tarjeta>
    </Pantalla>
  ) : (
    <PagosHijo key={seleccionado.id} hijo={seleccionado} />
  );
}

function PagosHijo({ hijo }: { hijo: Hijo }) {
  const [filtro, setFiltro] = useState<Filtro>(FILTRO_INICIAL);
  const hoy = hoyArgentina();
  const calculado = rangoDelFiltro(filtro, hoy);
  const rango = 'rango' in calculado ? calculado.rango : null;

  const consulta = useQuery({
    queryKey: clavesPagos.estadoCuenta(hijo.id, rango?.desde ?? '', rango?.hasta ?? ''),
    queryFn: () => pagosApi.estadoCuenta(hijo.id, rango!),
    enabled: rango !== null,
    // Al cambiar el período se sigue mostrando el anterior hasta que llega el nuevo.
    placeholderData: keepPreviousData,
  });

  return (
    <Pantalla
      refreshControl={
        <RefreshControl
          refreshing={consulta.isRefetching && !consulta.isPlaceholderData}
          onRefresh={() => void consulta.refetch()}
          tintColor={colors.blue500}
        />
      }
    >
      <View style={estilosPagos.encabezado}>
        <Titulo>Pagos</Titulo>
        <Texto suave>Cuotas, deuda por ítem, facturas y pagos. Solo se paga por transferencia bancaria.</Texto>
      </View>
      <SelectorHijo />
      <FiltroPeriodo filtro={filtro} hoy={hoy} onCambiar={setFiltro} />

      {rango === null ? null : consulta.isPending ? (
        <Cargando texto="Cargando el estado de cuenta…" />
      ) : consulta.error ? (
        <>
          <AvisoBanner aviso={{ tipo: 'error', texto: consulta.error.message }} />
          <Boton titulo="Reintentar" variante="secundario" icono="refresh" onPress={() => void consulta.refetch()} />
        </>
      ) : (
        <EstadoDeCuenta datos={consulta.data} actualizando={consulta.isPlaceholderData} />
      )}
    </Pantalla>
  );
}

function EstadoDeCuenta({ datos, actualizando }: { datos: EstadoCuenta; actualizando: boolean }) {
  const { resumen, facturas, pagos } = datos;
  return (
    <View style={[{ gap: spacing.lg }, actualizando && { opacity: 0.6 }]}>
      <Tarjeta>
        <Seccion>Resumen</Seccion>
        <View style={estilos.resumen} testID="pagos-resumen">
          <Total etiqueta="Adeudado" valor={resumen.totalAdeudado} color={colors.ink} testID="resumen-adeudado" />
          <Total etiqueta="Vencido" valor={resumen.totalVencido} color={colors.coral} testID="resumen-vencido" />
          <Total
            etiqueta="En revisión"
            valor={resumen.totalEnRevision}
            color={colors.blue500}
            testID="resumen-en-revision"
          />
          <Total etiqueta="Pagado" valor={resumen.totalPagado} color={colors.teal} testID="resumen-pagado" />
        </View>
      </Tarjeta>

      <DeudaPorItem facturas={facturas} deuda={resumen.deudaPorConcepto} />

      <View style={{ gap: spacing.md }}>
        <Seccion>Facturas</Seccion>
        {facturas.length === 0 ? (
          <Tarjeta>
            <Texto suave testID="facturas-vacio">
              No hay facturas en este período.
            </Texto>
          </Tarjeta>
        ) : (
          facturas.map((f) => <TarjetaFactura key={f.id} factura={f} />)
        )}
      </View>

      <Tarjeta>
        <Seccion>Historial de pagos</Seccion>
        {pagos.length === 0 ? (
          <Texto suave>No hay pagos acreditados en este período.</Texto>
        ) : (
          pagos.map((p, i) => (
            <View key={p.id} testID={`pago-${p.id}`} style={[estilos.pago, i > 0 && estilosPagos.separador]}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={estilosPagos.nombre}>{fechaDeInstante(p.fechaAcreditacion)}</Text>
                <Text style={estilosPagos.detalle}>{periodoLargo(p.periodo)}</Text>
                <Text style={estilos.pagoComprobante}>{p.comprobanteNumero}</Text>
              </View>
              <Text style={[estilosPagos.monto, { color: '#0B6E5E' }]}>{pesos(p.monto)}</Text>
            </View>
          ))
        )}
      </Tarjeta>
    </View>
  );
}

function Total({ etiqueta, valor, color, testID }: { etiqueta: string; valor: number; color: string; testID: string }) {
  return (
    <View style={estilos.total}>
      <Text style={estilos.totalEtiqueta}>{etiqueta}</Text>
      <Text testID={testID} style={[estilos.totalValor, { color }]} adjustsFontSizeToFit numberOfLines={1}>
        {pesos(valor)}
      </Text>
    </View>
  );
}

// Historial de deuda discriminado por ítem (enunciado): una fila por concepto
// que se despliega con los ítems impagos de ese concepto.
function DeudaPorItem({ facturas, deuda }: { facturas: Factura[]; deuda: Record<Concepto, number> }) {
  const [abierto, setAbierto] = useState<Concepto | null>(null);
  const impagos = facturas.flatMap((f) =>
    f.items.filter((i) => i.estado !== 'PAGADA').map((i) => ({ ...i, periodo: f.periodo, facturaId: f.id })),
  );

  return (
    <Tarjeta>
      <Seccion>Deuda por ítem</Seccion>
      {CONCEPTOS.map((c, n) => {
        const items = impagos.filter((i) => i.concepto === c);
        const expandido = abierto === c && items.length > 0;
        return (
          <View key={c} style={n > 0 ? estilosPagos.separador : null}>
            <Pressable
              testID={`deuda-${c}`}
              onPress={() => setAbierto(expandido ? null : c)}
              disabled={items.length === 0}
              accessibilityRole="button"
              accessibilityLabel={`${ETIQUETA_CONCEPTO[c]}: ${pesos(deuda[c])} adeudado`}
              accessibilityState={{ expanded: expandido, disabled: items.length === 0 }}
              style={estilosPagos.fila}
            >
              <Text style={estilosPagos.nombre}>{ETIQUETA_CONCEPTO[c]}</Text>
              <View style={estilos.deudaValor}>
                <Text style={[estilosPagos.monto, deuda[c] === 0 && { color: colors.inkFaint }]}>
                  {deuda[c] === 0 ? 'Sin deuda' : pesos(deuda[c])}
                </Text>
                {items.length > 0 ? (
                  <Ionicons name={expandido ? 'chevron-up' : 'chevron-down'} size={18} color={colors.inkSoft} />
                ) : (
                  <View style={{ width: 18 }} />
                )}
              </View>
            </Pressable>
            {expandido ? (
              <View style={estilos.desplegado} testID={`deuda-${c}-items`}>
                {items.map((i) => (
                  <Pressable
                    key={i.id}
                    onPress={() =>
                      router.push({ pathname: '/pagos/factura/[id]', params: { id: String(i.facturaId) } })
                    }
                    accessibilityRole="link"
                    accessibilityLabel={`${i.descripcion}, ${periodoLargo(i.periodo)}, ${pesos(i.importe)}`}
                    style={estilos.itemDeuda}
                  >
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={estilos.itemPeriodo}>{periodoLargo(i.periodo)}</Text>
                      <Text style={estilosPagos.detalle}>{i.descripcion}</Text>
                      <Etiqueta tipo="item" estado={i.estado} />
                    </View>
                    <Text style={estilosPagos.monto}>{pesos(i.importe)}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        );
      })}
    </Tarjeta>
  );
}

function TarjetaFactura({ factura: f }: { factura: Factura }) {
  return (
    <Pressable
      testID={`factura-${f.id}`}
      onPress={() => router.push({ pathname: '/pagos/factura/[id]', params: { id: String(f.id) } })}
      accessibilityRole="button"
      accessibilityLabel={`Factura de ${periodoLargo(f.periodo)}, saldo ${pesos(f.saldo)}. Ver detalle`}
      style={({ pressed }) => [estilos.factura, pressed && { opacity: 0.85 }]}
    >
      <View style={estilosPagos.fila}>
        <Text style={estilos.facturaPeriodo}>{periodoLargo(f.periodo)}</Text>
        <Etiqueta tipo="factura" estado={f.estado} />
      </View>
      <Text style={estilosPagos.detalle}>
        N.º {f.numero} · Vence {fechaCorta(f.vencimiento)}
      </Text>
      <View style={estilos.montos}>
        <Monto etiqueta="Total" valor={f.total} />
        <Monto etiqueta="Pagado" valor={f.pagado} color="#0B6E5E" />
        <Monto etiqueta="Saldo" valor={f.saldo} color={f.saldo > 0 ? colors.blue700 : undefined} fuerte />
      </View>
      <View style={estilos.verDetalle}>
        <Text style={estilos.verDetalleTexto}>{f.saldo > 0 ? 'Ver detalle y pagar' : 'Ver detalle'}</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.blue500} />
      </View>
    </Pressable>
  );
}

function Monto({
  etiqueta,
  valor,
  color,
  fuerte = false,
}: {
  etiqueta: string;
  valor: number;
  color?: string;
  fuerte?: boolean;
}) {
  return (
    <View style={estilosPagos.fila}>
      <Text style={estilos.montoEtiqueta}>{etiqueta}</Text>
      <Text style={[estilosPagos.monto, { fontSize: fuerte ? 16 : 15 }, color ? { color } : null]}>{pesos(valor)}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  resumen: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.md },
  total: { width: '50%', gap: 2, paddingRight: spacing.sm },
  totalEtiqueta: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft },
  totalValor: { fontFamily: fonts.bodyBold, fontSize: 18 },
  deudaValor: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 32 },
  desplegado: { gap: spacing.sm, marginTop: spacing.md },
  itemDeuda: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.paper,
  },
  itemPeriodo: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.ink },
  factura: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  facturaPeriodo: { fontFamily: fonts.displayMedium, fontSize: 20, color: colors.ink, flexShrink: 1 },
  montos: { gap: 6, marginTop: spacing.xs, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line },
  montoEtiqueta: { fontFamily: fonts.body, fontSize: 14, color: colors.inkSoft },
  verDetalle: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.xs },
  verDetalleTexto: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.blue500 },
  pago: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  pagoComprobante: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.inkFaint },
});
