import { useEffect, useRef, useState } from 'react';
import { Alert, Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEsAlumno, type Aviso } from '@/auth/AuthContext';
import { AvisoBanner, Boton, Cargando, Pantalla, Tarjeta, Texto, Titulo } from '@/components/ui';
import { primerNombre, SelectorHijo } from '@/components/SelectorHijo';
import { BotonVolver } from '@/components/BotonVolver';
import { mensajeCobro } from '@/lib/cobroServicios';
import { hoyArgentina } from '@/pagos/formato';
import { useHijos } from '@/hijos/HijosContext';
import { api } from '@/lib/api';
import type { Hijo, ResumenServicios } from '@/lib/tipos';
import { colors, fonts, spacing } from '@/theme';

// RF-54: inscripción del hijo a deportes, transporte y comedor, con los
// mismos endpoints y reglas que el campus web (máximo 2 deportes, 1 recorrido,
// sin duplicados, sin superposición horaria y grupos del nivel del alumno).
// Las reglas las valida el backend; la pantalla muestra su mensaje.

const MAX_DEPORTES = 2;

const DIAS: Record<string, string> = {
  LUNES: 'Lunes',
  MARTES: 'Martes',
  MIERCOLES: 'Miércoles',
  JUEVES: 'Jueves',
  VIERNES: 'Viernes',
  SABADO: 'Sábado',
};

const pesos = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 });
// Con precio 0 el ítem no se factura (el admin todavía no fijó el valor), así que no se muestra.
const precio = (valor: number) => (valor > 0 ? `${pesos.format(valor)} por mes` : null);

type Accion = {
  ruta: string;
  method: 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  exito: string;
  /** Identifica el botón que disparó la acción, para mostrarlo cargando. */
  clave: string;
};

function confirmar(titulo: string, mensaje: string, boton: string, destructivo = true): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(globalThis.confirm(`${titulo}\n\n${mensaje}`));
  return new Promise((resolver) =>
    Alert.alert(
      titulo,
      mensaje,
      [
        { text: 'Cancelar', style: 'cancel', onPress: () => resolver(false) },
        { text: boton, style: destructivo ? 'destructive' : 'default', onPress: () => resolver(true) },
      ],
      { cancelable: true, onDismiss: () => resolver(false) },
    ),
  );
}

export default function Servicios() {
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
      <BotonVolver />
      <Titulo>Servicios</Titulo>
      <Tarjeta>
        <Texto suave>
          Todavía no tenés hijos vinculados. Vinculalos con su DNI desde el campus web, en el Panel de Padre/Tutor.
        </Texto>
      </Tarjeta>
    </Pantalla>
  ) : (
    // key: al cambiar de hijo se descartan el aviso y el estado del anterior.
    <ServiciosHijo key={seleccionado.id} hijo={seleccionado} />
  );
}

function ServiciosHijo({ hijo }: { hijo: Hijo }) {
  const queryClient = useQueryClient();
  const clave = ['servicios', hijo.id];
  const base = `/inscripciones/estudiantes/${hijo.id}`;
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);

  // El aviso queda arriba: si el botón estaba al final de la lista, se sube para que se vea.
  useEffect(() => {
    if (aviso) scroll.current?.scrollTo({ y: 0, animated: true });
  }, [aviso]);

  const consulta = useQuery({ queryKey: clave, queryFn: () => api<ResumenServicios>(`${base}/resumen`) });

  const mutacion = useMutation({
    mutationFn: (a: Accion) => api(a.ruta, { method: a.method, body: a.body }),
    onMutate: () => setAviso(null),
    onSuccess: (_r, a) => setAviso({ tipo: 'exito', texto: a.exito }),
    onError: (err) => setAviso({ tipo: 'error', texto: err.message }),
    // RNF-57: tanto si salió bien como si no (otro dispositivo pudo cambiarlo), se relee.
    onSettled: () => queryClient.invalidateQueries({ queryKey: clave }),
  });

  const ejecutar = (a: Omit<Accion, 'ruta'> & { ruta?: string }) =>
    mutacion.mutate({ ...a, ruta: base + (a.ruta ?? '') });
  const enCurso = (k: string) => mutacion.isPending && mutacion.variables?.clave === k;
  const nombre = primerNombre(hijo.nombre);
  const alumno = useEsAlumno();

  const darDeBaja = async (titulo: string, mensaje: string, accion: Parameters<typeof ejecutar>[0]) => {
    if (await confirmar(titulo, mensaje, 'Dar de baja')) ejecutar(accion);
  };

  // Alta o cambio: antes de confirmar se muestra cuánto cuesta y desde qué
  // factura se cobra (no hay cobro en el momento, ver lib/cobroServicios).
  const darDeAlta = async (
    titulo: string,
    precioMensual: number,
    boton: string,
    accion: Parameters<typeof ejecutar>[0],
  ) => {
    if (await confirmar(titulo, mensajeCobro(precioMensual, hoyArgentina()), boton, false)) ejecutar(accion);
  };

  return (
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
      <BotonVolver />
      <View style={{ gap: 2 }}>
        <Titulo>Servicios</Titulo>
        <Texto suave>
          {alumno
            ? 'Deportes, transporte y comedor. No se paga al inscribirte: cada servicio se suma a la factura mensual siguiente, que abona tu familia.'
            : 'Deportes, transporte y comedor. No se paga al inscribir: cada servicio se suma a la factura mensual siguiente, que se emite el último día hábil del mes y se paga desde Pagos.'}
        </Texto>
      </View>
      <SelectorHijo />
      {aviso ? <AvisoBanner aviso={aviso} /> : null}

      {consulta.isPending ? (
        <Cargando texto="Cargando servicios…" />
      ) : consulta.error ? (
        <>
          <AvisoBanner aviso={{ tipo: 'error', texto: consulta.error.message }} />
          <Boton titulo="Reintentar" variante="secundario" icono="refresh" onPress={() => void consulta.refetch()} />
        </>
      ) : (
        <>
          {/* Deportes */}
          <Tarjeta>
            <Text style={estilos.seccion}>Deportes</Text>
            {consulta.data.deportes.inscriptos.length === 0 ? (
              <Texto suave>{nombre} todavía no está inscripto a ningún deporte.</Texto>
            ) : (
              consulta.data.deportes.inscriptos.map((g) => (
                <Fila
                  key={g.id}
                  titulo={g.deporte}
                  detalle={[
                    `${DIAS[g.diaSemana] ?? g.diaSemana} de ${g.horaInicio} a ${g.horaFin}`,
                    `Prof. ${g.docente}`,
                  ]}
                  precio={precio(g.precioMensual)}
                  inscripto
                >
                  <Boton
                    titulo="Dar de baja"
                    etiqueta={`Dar de baja ${g.deporte}`}
                    variante="secundario"
                    cargando={enCurso(`baja-deporte-${g.id}`)}
                    deshabilitado={mutacion.isPending}
                    onPress={() =>
                      void darDeBaja(
                        `¿Dar de baja ${g.deporte}?`,
                        `${nombre} deja de estar inscripto a ${g.deporte}.`,
                        {
                          ruta: `/deportes/${g.id}`,
                          method: 'DELETE',
                          exito: `Baja de ${g.deporte} realizada.`,
                          clave: `baja-deporte-${g.id}`,
                        },
                      )
                    }
                  />
                </Fila>
              ))
            )}

            {consulta.data.deportes.nivel === null ? (
              <Texto suave>
                {nombre} no tiene curso asignado, así que no se puede inscribir a deportes. Consultá en la escuela.
              </Texto>
            ) : (
              <>
                <Text style={estilos.subtitulo}>Grupos de {consulta.data.deportes.nivel}</Text>
                {consulta.data.deportes.inscriptos.length >= MAX_DEPORTES ? (
                  <Texto suave>Ya tiene 2 deportes, el máximo. Para sumar otro, primero da de baja uno.</Texto>
                ) : null}
                {consulta.data.deportes.disponibles.length === 0 ? (
                  <Texto suave>No hay más grupos de deporte disponibles para su nivel.</Texto>
                ) : (
                  consulta.data.deportes.disponibles.map((g) => (
                    <Fila
                      key={g.id}
                      titulo={g.deporte}
                      detalle={[
                        `${DIAS[g.diaSemana] ?? g.diaSemana} de ${g.horaInicio} a ${g.horaFin}`,
                        `Prof. ${g.docente}`,
                      ]}
                      precio={precio(g.precioMensual)}
                    >
                      <Boton
                        titulo="Inscribir"
                        etiqueta={`Inscribir a ${g.deporte}`}
                        icono="add"
                        cargando={enCurso(`deporte-${g.id}`)}
                        deshabilitado={mutacion.isPending || consulta.data.deportes.inscriptos.length >= MAX_DEPORTES}
                        onPress={() =>
                          void darDeAlta(
                            alumno ? `¿Inscribirte a ${g.deporte}?` : `¿Inscribir a ${nombre} a ${g.deporte}?`,
                            g.precioMensual,
                            'Inscribir',
                            {
                              ruta: '/deportes',
                              method: 'POST',
                              body: { grupoDeporteId: g.id },
                              exito: `${nombre} quedó inscripto a ${g.deporte}.`,
                              clave: `deporte-${g.id}`,
                            },
                          )
                        }
                      />
                    </Fila>
                  ))
                )}
              </>
            )}
          </Tarjeta>

          {/* Transporte */}
          <Tarjeta>
            <Text style={estilos.seccion}>Transporte</Text>
            {consulta.data.transporte.disponibles.length === 0 ? (
              <Texto suave>No hay recorridos cargados.</Texto>
            ) : null}
            {consulta.data.transporte.actual === null ? (
              <Texto suave>{nombre} no tiene un recorrido asignado. Puede tener uno solo.</Texto>
            ) : null}
            {consulta.data.transporte.disponibles.map((r) => {
              const actual = r.id === consulta.data.transporte.actual?.recorridoId;
              return (
                <Fila
                  key={r.id}
                  titulo={r.nombre}
                  detalle={[`Salida ${r.horaSalida}, regreso ${r.horaRegreso}`]}
                  precio={precio(r.precioMensual)}
                  inscripto={actual}
                >
                  {actual ? (
                    <Boton
                      titulo="Quitar"
                      etiqueta={`Quitar ${r.nombre}`}
                      variante="secundario"
                      cargando={enCurso('baja-transporte')}
                      deshabilitado={mutacion.isPending}
                      onPress={() =>
                        void darDeBaja(
                          '¿Quitar el transporte?',
                          `${nombre} deja de usar el transporte (${r.nombre}).`,
                          {
                            ruta: '/transporte',
                            method: 'DELETE',
                            exito: 'Transporte dado de baja.',
                            clave: 'baja-transporte',
                          },
                        )
                      }
                    />
                  ) : (
                    <Boton
                      titulo={consulta.data.transporte.actual ? 'Cambiar a este' : 'Elegir'}
                      etiqueta={`${consulta.data.transporte.actual ? 'Cambiar a' : 'Elegir'} ${r.nombre}`}
                      variante={consulta.data.transporte.actual ? 'secundario' : 'primario'}
                      cargando={enCurso(`transporte-${r.id}`)}
                      deshabilitado={mutacion.isPending}
                      onPress={() =>
                        void darDeAlta(
                          consulta.data.transporte.actual
                            ? `¿Cambiar el transporte de ${nombre} a ${r.nombre}?`
                            : `¿Asignar a ${nombre} el transporte ${r.nombre}?`,
                          r.precioMensual,
                          consulta.data.transporte.actual ? 'Cambiar' : 'Asignar',
                          {
                            ruta: '/transporte',
                            method: 'PUT',
                            body: { recorridoId: r.id },
                            exito: `Transporte asignado: ${r.nombre}.`,
                            clave: `transporte-${r.id}`,
                          },
                        )
                      }
                    />
                  )}
                </Fila>
              );
            })}
          </Tarjeta>

          {/* Comedor */}
          <Tarjeta>
            <Text style={estilos.seccion}>Comedor</Text>
            {consulta.data.comedor.disponibles.length === 0 ? <Texto suave>No hay turnos cargados.</Texto> : null}
            {consulta.data.comedor.actual === null ? (
              <Texto suave>{nombre} no tiene un turno de comedor asignado.</Texto>
            ) : null}
            {consulta.data.comedor.disponibles.map((t) => {
              const actual = t.id === consulta.data.comedor.actual?.turnoId;
              return (
                <Fila
                  key={t.id}
                  titulo={t.nombre}
                  detalle={[`De ${t.horaInicio} a ${t.horaFin}`]}
                  precio={precio(t.precioMensual)}
                  inscripto={actual}
                >
                  {actual ? (
                    <Boton
                      titulo="Quitar"
                      etiqueta={`Quitar ${t.nombre}`}
                      variante="secundario"
                      cargando={enCurso('baja-comedor')}
                      deshabilitado={mutacion.isPending}
                      onPress={() =>
                        void darDeBaja('¿Quitar el comedor?', `${nombre} deja de tener comedor (${t.nombre}).`, {
                          ruta: '/comedor',
                          method: 'DELETE',
                          exito: 'Comedor dado de baja.',
                          clave: 'baja-comedor',
                        })
                      }
                    />
                  ) : (
                    <Boton
                      titulo={consulta.data.comedor.actual ? 'Cambiar a este' : 'Elegir'}
                      etiqueta={`${consulta.data.comedor.actual ? 'Cambiar a' : 'Elegir'} ${t.nombre}`}
                      variante={consulta.data.comedor.actual ? 'secundario' : 'primario'}
                      cargando={enCurso(`comedor-${t.id}`)}
                      deshabilitado={mutacion.isPending}
                      onPress={() =>
                        void darDeAlta(
                          consulta.data.comedor.actual
                            ? `¿Cambiar el comedor de ${nombre} a ${t.nombre}?`
                            : `¿Asignar a ${nombre} el comedor ${t.nombre}?`,
                          t.precioMensual,
                          consulta.data.comedor.actual ? 'Cambiar' : 'Asignar',
                          {
                            ruta: '/comedor',
                            method: 'PUT',
                            body: { turnoId: t.id },
                            exito: `Comedor asignado: ${t.nombre}.`,
                            clave: `comedor-${t.id}`,
                          },
                        )
                      }
                    />
                  )}
                </Fila>
              );
            })}
          </Tarjeta>
        </>
      )}
    </Pantalla>
  );
}

function Fila({
  titulo,
  detalle,
  precio,
  inscripto = false,
  children,
}: {
  titulo: string;
  detalle: string[];
  precio: string | null;
  inscripto?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={[estilos.fila, inscripto && estilos.filaInscripta]}>
      <View style={{ gap: 2 }}>
        <View style={estilos.filaTitulo}>
          <Text style={estilos.nombre}>{titulo}</Text>
          {inscripto ? <Text style={estilos.etiqueta}>Inscripto</Text> : null}
        </View>
        {detalle.map((d) => (
          <Texto key={d} suave>
            {d}
          </Texto>
        ))}
        {precio ? <Texto style={estilos.precio}>{precio}</Texto> : null}
      </View>
      {children}
    </View>
  );
}

const estilos = StyleSheet.create({
  seccion: { fontFamily: fonts.displayMedium, fontSize: 20, color: colors.ink },
  subtitulo: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.inkSoft, marginTop: spacing.sm },
  fila: {
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.md,
  },
  filaInscripta: {
    borderTopWidth: 0,
    backgroundColor: colors.tealSoft,
    borderRadius: 10,
    padding: spacing.md,
  },
  filaTitulo: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  nombre: { fontFamily: fonts.bodySemibold, fontSize: 16, color: colors.ink },
  etiqueta: {
    fontFamily: fonts.bodySemibold,
    fontSize: 12,
    color: '#0B6E5E',
    backgroundColor: colors.white,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
  },
  precio: { fontFamily: fonts.bodySemibold, color: colors.blue600 },
});
