// Recortes al final de un texto sin regex. Un `texto.replace(/x+$/, '')`
// prueba el cuantificador desde cada posición y es cuadrático en el peor caso
// (ReDoS, regla S8786): con un texto controlado por el usuario lleno de "x"
// seguidas de otro carácter, el tiempo crece con el cuadrado del largo.
// Recorrer desde el final una sola vez es siempre lineal.

export function recortarFinal(texto: string, quitar: (caracter: string) => boolean): string {
  let fin = texto.length;
  while (fin > 0 && quitar(texto[fin - 1])) fin--;
  return texto.slice(0, fin);
}

const esEspacio = (c: string) => c.trim() === '';

// "http://host/" → "http://host"
export const sinBarrasFinales = (url: string): string => recortarFinal(url, (c) => c === '/');

// "Monto incorrecto. " → "Monto incorrecto" (para agregar el punto propio).
export const sinPuntoFinal = (texto: string): string => recortarFinal(texto, (c) => c === '.' || esEspacio(c));
