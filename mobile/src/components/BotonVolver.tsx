import { router } from 'expo-router';
import { Boton } from './ui';

/**
 * "Volver" de las pestañas principales (Pagos, Servicios, Mi cuenta): vuelve a
 * la pantalla anterior (las pestañas guardan historial, ver (tabs)/_layout) y,
 * si no hay ninguna, a Inicio.
 */
export function BotonVolver() {
  return (
    <Boton
      titulo="Volver"
      variante="texto"
      icono="arrow-back"
      alInicio
      onPress={() => (router.canGoBack() ? router.back() : router.navigate('/'))}
    />
  );
}
