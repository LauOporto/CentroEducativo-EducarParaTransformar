import { useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { Aviso } from '@/auth/AuthContext';
import { AvisoBanner, Boton, Campo, Tarjeta, Texto } from '@/components/ui';
import { colors, fonts, radius, spacing } from '@/theme';
import { pagosApi, type ArchivoElegido, type DatosTransferencia } from './api';
import { Chip, Seccion } from './componentes';
import { hoyArgentina, pesos } from './formato';
import {
  aDMA,
  mascaraFecha,
  montoParaCampo,
  MSG_SIN_ARCHIVO,
  MSG_TIPO_ARCHIVO,
  sumarDias,
  tamanoLegible,
  tipoDeArchivo,
  validarFecha,
  validarMonto,
  validarNroOperacion,
  validarTamano,
} from './transferencia';
import type { RespuestaTransferencia } from './tipos';

// RF-50 (D5 paso 3): el padre carga la transferencia que hizo. Solo
// transferencia bancaria: el medio es fijo y no se puede cambiar.

type Errores = { nro?: string | null; fecha?: string | null; monto?: string | null; archivo?: string | null };

/** Tamaño de un archivo local cuando el selector no lo informa. */
function tamanoLocal(uri: string): number | undefined {
  if (Platform.OS === 'web') return undefined;
  try {
    return new File(uri).size ?? undefined;
  } catch {
    return undefined;
  }
}

function archivoDeImagen(asset: ImagePicker.ImagePickerAsset): ArchivoElegido | string {
  const nombre = asset.fileName ?? asset.uri.split('/').pop() ?? 'transferencia.jpg';
  const tipo = tipoDeArchivo(asset.mimeType, nombre);
  if (!tipo || tipo === 'application/pdf') return MSG_TIPO_ARCHIVO;
  const tamano = asset.fileSize ?? asset.file?.size ?? tamanoLocal(asset.uri);
  const error = validarTamano(tamano);
  if (error) return error;
  return { uri: asset.uri, nombre, tipo, tamano };
}

export function FormularioTransferencia({
  comprobanteId,
  total,
  onEnviado,
  hoy = hoyArgentina(),
  enviar = pagosApi.cargarTransferencia,
}: {
  comprobanteId: number;
  total: number;
  onEnviado: (r: RespuestaTransferencia) => void;
  hoy?: string;
  enviar?: (id: number, datos: DatosTransferencia) => Promise<RespuestaTransferencia>;
}) {
  const [nro, setNro] = useState('');
  const [fecha, setFecha] = useState(aDMA(hoy));
  const [monto, setMonto] = useState(montoParaCampo(total));
  const [archivo, setArchivo] = useState<ArchivoElegido | null>(null);
  const [errores, setErrores] = useState<Errores>({});
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Al corregir un campo, su error desaparece.
  const limpiar = (campo: keyof Errores) => setErrores((e) => (e[campo] ? { ...e, [campo]: null } : e));
  const cambiarFecha = (texto: string) => {
    setFecha(mascaraFecha(texto));
    limpiar('fecha');
  };

  const elegir = (resultado: ArchivoElegido | string | null) => {
    if (resultado === null) return; // canceló
    if (typeof resultado === 'string') {
      setErrores((e) => ({ ...e, archivo: resultado }));
      return;
    }
    setArchivo(resultado);
    setErrores((e) => ({ ...e, archivo: null }));
  };

  async function sacarFoto() {
    setAviso(null);
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) {
      setErrores((e) => ({
        ...e,
        archivo:
          'Necesitamos permiso para usar la cámara. Habilitalo en la configuración del teléfono o elegí una imagen de la galería.',
      }));
      return;
    }
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
    elegir(r.canceled || !r.assets[0] ? null : archivoDeImagen(r.assets[0]));
  }

  async function elegirDeGaleria() {
    setAviso(null);
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    elegir(r.canceled || !r.assets[0] ? null : archivoDeImagen(r.assets[0]));
  }

  async function elegirPdf() {
    setAviso(null);
    const r = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
    const doc = r.canceled ? null : r.assets[0];
    if (!doc) return;
    if (tipoDeArchivo(doc.mimeType, doc.name) !== 'application/pdf') return elegir(MSG_TIPO_ARCHIVO);
    const tamano = doc.size ?? doc.file?.size ?? tamanoLocal(doc.uri);
    const error = validarTamano(tamano);
    elegir(error ?? { uri: doc.uri, nombre: doc.name, tipo: 'application/pdf', tamano });
  }

  async function enviarFormulario() {
    const f = validarFecha(fecha, hoy);
    const m = validarMonto(monto, total);
    const nuevos: Errores = {
      nro: validarNroOperacion(nro),
      fecha: 'error' in f ? f.error : null,
      monto: 'error' in m ? m.error : null,
      archivo: archivo ? null : MSG_SIN_ARCHIVO,
    };
    setErrores(nuevos);
    setAviso(null);
    if (!archivo || 'error' in f || 'error' in m || nuevos.nro) {
      setAviso({ tipo: 'error', texto: 'Revisá los datos marcados antes de enviar.' });
      return;
    }

    setEnviando(true);
    try {
      const r = await enviar(comprobanteId, {
        archivo,
        nroOperacion: nro.trim(),
        fechaTransferencia: f.fecha,
        montoTransferido: m.monto,
      });
      onEnviado(r);
    } catch (err) {
      // 400, 409, 413 y 422: el mensaje del backend ya está en español.
      setAviso({ tipo: 'error', texto: err instanceof Error ? err.message : 'No pudimos enviar la transferencia.' });
      setEnviando(false);
    }
  }

  return (
    <Tarjeta>
      <View testID="form-transferencia" style={{ gap: spacing.md }}>
        <Seccion>Cargar transferencia</Seccion>
        <Texto suave>Cuando hayas transferido, cargá los datos y el comprobante del banco.</Texto>
        {aviso ? <AvisoBanner aviso={aviso} /> : null}

        <View style={estilos.medio} testID="medio-pago">
          <Ionicons name="lock-closed-outline" size={18} color={colors.inkSoft} />
          <View style={{ flex: 1 }}>
            <Text style={estilos.medioEtiqueta}>Medio de pago</Text>
            <Text style={estilos.medioValor}>Transferencia bancaria</Text>
          </View>
        </View>

        <Campo
          testID="campo-nro"
          etiqueta="N.º de operación"
          value={nro}
          onChangeText={(t) => {
            setNro(t);
            limpiar('nro');
          }}
          error={errores.nro}
          ayuda="El que figura en el comprobante del banco. Letras, números y guiones."
          maxLength={40}
          autoCapitalize="characters"
          placeholder="Ej.: OP-123456"
        />

        <View style={{ gap: spacing.sm }}>
          <Campo
            testID="campo-fecha"
            etiqueta="Fecha de la transferencia"
            value={fecha}
            onChangeText={cambiarFecha}
            error={errores.fecha}
            keyboardType="number-pad"
            maxLength={10}
            placeholder="DD/MM/AAAA"
          />
          <View style={estilos.chips}>
            <Chip testID="fecha-hoy" texto="Hoy" activo={fecha === aDMA(hoy)} onPress={() => cambiarFecha(aDMA(hoy))} />
            <Chip
              testID="fecha-ayer"
              texto="Ayer"
              activo={fecha === aDMA(sumarDias(hoy, -1))}
              onPress={() => cambiarFecha(aDMA(sumarDias(hoy, -1)))}
            />
          </View>
        </View>

        <Campo
          testID="campo-monto"
          etiqueta="Monto transferido"
          value={monto}
          onChangeText={(t) => {
            setMonto(t);
            limpiar('monto');
          }}
          error={errores.monto}
          ayuda={`Tiene que ser exactamente ${pesos(total)}.`}
          keyboardType="decimal-pad"
        />

        <View style={{ gap: spacing.sm }}>
          <Text style={estilos.etiqueta}>Comprobante del banco</Text>
          {archivo ? (
            <View style={estilos.vista} testID="archivo-elegido">
              {archivo.tipo === 'application/pdf' ? (
                <View style={estilos.miniaturaPdf}>
                  <Ionicons name="document-text" size={28} color={colors.coral} />
                </View>
              ) : (
                <Image
                  source={{ uri: archivo.uri }}
                  style={estilos.miniatura}
                  accessibilityLabel="Vista previa del comprobante"
                />
              )}
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={estilos.archivoNombre} numberOfLines={2}>
                  {archivo.nombre}
                </Text>
                <Text style={estilos.archivoDetalle}>
                  {archivo.tipo === 'application/pdf' ? 'PDF' : 'Imagen'}
                  {archivo.tamano !== undefined ? ` · ${tamanoLegible(archivo.tamano)}` : ''}
                </Text>
              </View>
              <Pressable
                onPress={() => setArchivo(null)}
                accessibilityRole="button"
                accessibilityLabel="Quitar el archivo"
                hitSlop={8}
              >
                <Ionicons name="close-circle" size={24} color={colors.inkFaint} />
              </Pressable>
            </View>
          ) : null}
          <View style={estilos.botonesArchivo}>
            <Boton titulo="Sacar foto" variante="secundario" icono="camera-outline" onPress={() => void sacarFoto()} />
            <Boton
              titulo="Elegir de la galería"
              variante="secundario"
              icono="images-outline"
              onPress={() => void elegirDeGaleria()}
            />
            <Boton
              titulo="Elegir PDF"
              variante="secundario"
              icono="document-outline"
              onPress={() => void elegirPdf()}
            />
          </View>
          {errores.archivo ? (
            <Text style={estilos.error} testID="error-archivo">
              {errores.archivo}
            </Text>
          ) : (
            <Text style={estilos.ayuda}>JPG, PNG o PDF de hasta 5 MB.</Text>
          )}
        </View>

        <Boton
          titulo="Enviar transferencia"
          icono="cloud-upload-outline"
          cargando={enviando}
          onPress={() => void enviarFormulario()}
        />
      </View>
    </Tarjeta>
  );
}

const estilos = StyleSheet.create({
  medio: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  medioEtiqueta: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft },
  medioValor: { fontFamily: fonts.bodySemibold, fontSize: 15, color: colors.ink },
  chips: { flexDirection: 'row', gap: spacing.sm },
  etiqueta: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.ink },
  vista: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.blue100,
    backgroundColor: colors.blue50,
  },
  miniatura: { width: 56, height: 56, borderRadius: radius.sm, backgroundColor: colors.line },
  miniaturaPdf: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    backgroundColor: colors.coralSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  archivoNombre: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.ink },
  archivoDetalle: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft },
  botonesArchivo: { gap: spacing.sm },
  error: { fontFamily: fonts.bodyMedium, fontSize: 13, color: '#A63A1C' },
  ayuda: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft },
});
