import { registrarEstrategia } from './motor';
import { porAlumnoStrategy } from './porAlumno.strategy';
import { listadoAlumnosPorCursoStrategy } from './listadoAlumnosPorCurso.strategy';

// Alta de estrategias del Motor de Reportes. Sumar un reporte nuevo es
// agregar un archivo <clave>.strategy.ts + una línea acá — no hace
// falta tocar el motor ni el router.
registrarEstrategia(porAlumnoStrategy);
registrarEstrategia(listadoAlumnosPorCursoStrategy);

export { obtenerEstrategia, listarEstrategias } from './motor';
