import { registrarEstrategia } from './motor';
import { porAlumnoStrategy } from './porAlumno.strategy';
import { listadoAlumnosPorCursoStrategy } from './listadoAlumnosPorCurso.strategy';
import { porDocenteStrategy } from './porDocente.strategy';
import { listadoAlumnosPorMateriaStrategy } from './listadoAlumnosPorMateria.strategy';
import { listadoDocentesPorNivelStrategy } from './listadoDocentesPorNivel.strategy';
import { listadoAlumnosPorDeporteStrategy } from './listadoAlumnosPorDeporte.strategy';
import { listadoAlumnosPorDeporteYNivelStrategy } from './listadoAlumnosPorDeporteYNivel.strategy';
import { listadoAlumnosPorDeporteNivelHorarioStrategy } from './listadoAlumnosPorDeporteNivelHorario.strategy';
import { listadoAlumnosPorRecorridoStrategy } from './listadoAlumnosPorRecorrido.strategy';

registrarEstrategia(porAlumnoStrategy);
registrarEstrategia(listadoAlumnosPorCursoStrategy);
registrarEstrategia(porDocenteStrategy);
registrarEstrategia(listadoAlumnosPorMateriaStrategy);
registrarEstrategia(listadoDocentesPorNivelStrategy);
registrarEstrategia(listadoAlumnosPorDeporteStrategy);
registrarEstrategia(listadoAlumnosPorDeporteYNivelStrategy);
registrarEstrategia(listadoAlumnosPorDeporteNivelHorarioStrategy);
registrarEstrategia(listadoAlumnosPorRecorridoStrategy);

export { obtenerEstrategia, listarEstrategias } from './motor';
