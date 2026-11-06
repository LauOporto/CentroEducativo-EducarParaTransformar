import { useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { Aviso } from '@/auth/AuthContext';
import { AvisoBanner, Boton, Cargando, Pantalla, Tarjeta, Texto, Titulo } from '@/components/ui';
import { colors, fonts, spacing } from '@/theme';
import { clavesPagos, compartirPdf, invalidarPagos, pagosApi } from './api';
import { Casilla, Etiqueta, estilosPagos, FilaDato, Seccion } from './componentes';
import { ETIQUETA_CONCEPTO, fechaCorta, periodoLargo, pesos } from './formato';
import { depurar, esElegible, todoLoPendiente, totalSeleccionado } from './seleccion';
import type { Factura, ItemFactura } from './tipos';

// RF-50: detalle de una factura. El padre elige los ítems PENDIENTES o
// VENCIDOS que quiere pagar y el sistema genera el comprobante de pago con
// los datos para transferir. Una factura admite varios comprobantes (HU8).

export function volver() {
  if (router.canGoBack()) router.back();
  else router.replace('/pagos');
}

const ACTIVOS = new Set(['GENERADO', 'EN_REVISION']);

export function PantallaFactura({ facturaId }: { facturaId: number }) {
  const queryClient = useQueryClient();
  const [elegidos, setElegidos] = useState<ReadonlySet<number>>(new Set());
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [descargando, setDescargando] = useState(false);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);

  useEffect(() => {
    if (aviso) scroll.current?.scrollTo({ y: 0, animated: true });
  }, [aviso]);

  const consulta = useQuery({ queryKey: clavesPagos.factura(facturaId), queryFn: () => pagosApi.factura(facturaId) });
  const factura = consulta.data?.factura;
  const hijoId = consulta.data?.alumno.id;

  // Los comprobantes en curso dicen qué ítems tienen tomados ("Incluido en el
  // comprobante CP-…"). Comparten la clave con la pantalla del comprobante.
  const activos = factura?.comprobantes.filter((c) => ACTIVOS.has(c.estado)) ?? [];
  const detalles = useQueries({
    queries: activos.map((c) => ({
      queryKey: clavesPagos.comprobante(c.id),
      queryFn: () => pagosApi.comprobante(c.id),
    })),
  });
  const comprobanteDeItem = new Map<number, string>();
  for (const d of detalles) {
    for (const i of d.data?.comprobante.items ?? []) comprobanteDeItem.set(i.cuotaId, d.data!.comprobante.numero);
  }

  // Si al recargar un ítem dejó de estar pendiente, sale de la selección.
  const seleccion = factura ? depurar(factura.items, elegidos) : new Set<number>();
  const total = factura ? totalSeleccionado(factura.items, seleccion) : 0;

  const generar = useMutation({
    mutationFn: () => pagosApi.generarComprobante(facturaId, [...seleccion]),
    onMutate: () => setAviso(null),
    onSuccess: (r) => {
      queryClient.setQueryData(clavesPagos.comprobante(r.comprobante.id), r);
      setElegidos(new Set());
      void invalidarPagos(queryClient, { hijoId: r.comprobante.alumno.id, facturaId });
      router.push({ pathname: '/pagos/comprobante/[id]', params: { id: String(r.comprobante.id) } });
    },
    onError: (err) => {
      setAviso({ tipo: 'error', texto: err.message });
      // Un 409 dice que otro comprobante tomó algún ítem: se relee la factura.
      void invalidarPagos(queryClient, { hijoId, facturaId });
    },
  });

  async function descargar(f: Factura) {
    setDescargando(true);
    setAviso(null);
    try {
      const uri = await pagosApi.descargarFacturaPdf(f.id, f.numero);
      await compartirPdf(uri, `Factura ${f.numero}`);
    } catch (err) {
      setAviso({ tipo: 'error', texto: err instanceof Error ? err.message : 'No pudimos descargar la factura.' });
    } finally {
      setDescargando(false);
    }
  }

  const hayElegibles = factura?.items.some(esElegible) ?? false;

  return (
    <View style={estilos.contenedor}>
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
          <Cargando texto="Cargando la factura…" />
        ) : consulta.error ? (
          <>
            <AvisoBanner aviso={{ tipo: 'error', texto: consulta.error.message }} />
            <Boton titulo="Reintentar" variante="secundario" icono="refresh" onPress={() => void consulta.refetch()} />
          </>
        ) : factura ? (
          <>
            <View style={estilosPagos.encabezado}>
              <Texto suave>Factura de {consulta.data.alumno.nombre}</Texto>
              <Titulo testID="factura-titulo">{periodoLargo(factura.periodo)}</Titulo>
            </View>
            {aviso ? <AvisoBanner aviso={aviso} /> : null}

            <Tarjeta>
              <View style={estilosPagos.fila}>
                <Text style={estilosPagos.subtitulo}>Estado</Text>
                <Etiqueta tipo="factura" estado={factura.estado} testID="factura-estado" />
              </View>
              <FilaDato etiqueta="N.º" valor={factura.numero} />
              <FilaDato etiqueta="Vencimiento" valor={fechaCorta(factura.vencimiento)} />
              <FilaDato etiqueta="Total" valor={pesos(factura.total)} fuerte />
              <FilaDato etiqueta="Pagado" valor={pesos(factura.pagado)} color="#0B6E5E" />
              <FilaDato
                etiqueta="Saldo"
                valor={pesos(factura.saldo)}
                fuerte
                color={factura.saldo > 0 ? colors.blue700 : undefined}
                ultimo
                testID="factura-saldo"
              />
            </Tarjeta>

            <View style={{ gap: spacing.md }}>
              <Seccion>Ítems</Seccion>
              {hayElegibles ? (
                <Texto suave>Elegí qué querés pagar. Se genera un comprobante con los datos para transferir.</Texto>
              ) : (
                <Texto suave>No quedan ítems pendientes de pago en esta factura.</Texto>
              )}
              {factura.items.map((item) => (
                <FilaItem
                  key={item.id}
                  item={item}
                  marcado={seleccion.has(item.id)}
                  comprobante={comprobanteDeItem.get(item.id)}
                  onAlternar={() =>
                    setElegidos((prev) => {
                      const nuevo = new Set(prev);
                      if (nuevo.has(item.id)) nuevo.delete(item.id);
                      else nuevo.add(item.id);
                      return nuevo;
                    })
                  }
                />
              ))}
            </View>

            <Tarjeta>
              <Seccion>Comprobantes de esta factura</Seccion>
              {factura.comprobantes.length === 0 ? (
                <Texto suave>Todavía no generaste comprobantes para esta factura.</Texto>
              ) : (
                factura.comprobantes.map((c, n) => (
                  <Pressable
                    key={c.id}
                    testID={`comprobante-${c.id}`}
                    onPress={() => router.push({ pathname: '/pagos/comprobante/[id]', params: { id: String(c.id) } })}
                    accessibilityRole="button"
                    accessibilityLabel={`Comprobante ${c.numero}, ${pesos(c.total)}. Ver detalle`}
                    style={[estilos.comprobante, n > 0 && estilosPagos.separador]}
                  >
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={estilosPagos.nombre}>{c.numero}</Text>
                      <Etiqueta tipo="comprobante" estado={c.estado} />
                    </View>
                    <Text style={estilosPagos.monto}>{pesos(c.total)}</Text>
                    <Ionicons name="chevron-forward" size={18} color={colors.inkSoft} />
                  </Pressable>
                ))
              )}
            </Tarjeta>

            <Boton
              titulo="Descargar factura (PDF)"
              variante="secundario"
              icono="document-text-outline"
              cargando={descargando}
              onPress={() => void descargar(factura)}
            />
          </>
        ) : null}
      </Pantalla>

      {factura && hayElegibles ? (
        <View style={estilos.barra} testID="barra-pago">
          <View style={estilosPagos.fila}>
            <View style={{ gap: 2 }}>
              <Text style={estilos.barraEtiqueta}>Total seleccionado</Text>
              <Text style={estilos.barraTotal} testID="total-seleccionado">
                {pesos(total)}
              </Text>
            </View>
            <Pressable
              onPress={() => setElegidos(todoLoPendiente(factura.items))}
              accessibilityRole="button"
              hitSlop={8}
              testID="elegir-todo"
            >
              <Text style={estilos.atajo}>Elegir todo lo pendiente</Text>
            </Pressable>
          </View>
          <Boton
            titulo="Generar comprobante de pago"
            icono="receipt-outline"
            deshabilitado={seleccion.size === 0}
            cargando={generar.isPending}
            onPress={() => generar.mutate()}
          />
        </View>
      ) : null}
    </View>
  );
}

function FilaItem({
  item,
  marcado,
  comprobante,
  onAlternar,
}: {
  item: ItemFactura;
  marcado: boolean;
  comprobante: string | undefined;
  onAlternar: () => void;
}) {
  const elegible = esElegible(item);
  const motivo =
    item.estado === 'PAGADA'
      ? 'Pagado'
      : item.estado === 'EN_REVISION'
        ? comprobante
          ? `Incluido en el comprobante ${comprobante}`
          : 'Incluido en un comprobante en curso'
        : null;
  return (
    <Casilla
      testID={`item-${item.id}`}
      marcada={marcado}
      deshabilitada={!elegible}
      onPress={onAlternar}
      etiqueta={`${ETIQUETA_CONCEPTO[item.concepto]}: ${item.descripcion}, ${pesos(item.importe)}${motivo ? `. ${motivo}` : ''}`}
      estilo={!elegible ? { backgroundColor: colors.paper } : undefined}
    >
      <View style={estilos.itemCabecera}>
        <Text style={[estilos.concepto, !elegible && { color: colors.inkFaint }]}>
          {ETIQUETA_CONCEPTO[item.concepto]}
        </Text>
        <Text style={[estilosPagos.monto, !elegible && { color: colors.inkSoft }]}>{pesos(item.importe)}</Text>
      </View>
      <Text style={estilosPagos.detalle}>{item.descripcion}</Text>
      <View style={estilos.itemPie}>
        <Etiqueta tipo="item" estado={item.estado} />
        {motivo ? <Text style={estilos.motivo}>{motivo}</Text> : null}
      </View>
    </Casilla>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colors.paper },
  comprobante: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  itemCabecera: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  concepto: { fontFamily: fonts.bodySemibold, fontSize: 15, color: colors.ink },
  itemPie: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  motivo: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.inkSoft, flexShrink: 1 },
  barra: {
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  barraEtiqueta: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft },
  barraTotal: { fontFamily: fonts.bodyBold, fontSize: 20, color: colors.ink },
  atajo: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.blue500 },
});
