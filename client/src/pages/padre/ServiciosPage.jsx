import { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { inscripcionesService } from '../../services/api/inscripcionesService';
import { transporteService } from '../../services/api/transporteService';
import { comedorService } from '../../services/api/comedorService';
import { useToast } from '../../hooks/useToast';

const DIAS_LABEL = {
  LUNES: 'Lunes',
  MARTES: 'Martes',
  MIERCOLES: 'Miércoles',
  JUEVES: 'Jueves',
  VIERNES: 'Viernes',
  SABADO: 'Sábado',
};

// Los catálogos de transporte/comedor (a diferencia de los grupos de
// deporte, que el resumen ya trae con horario incluido) llegan del backend
// como ISO completo (@db.Time), acá solo se necesita la parte HH:mm.
const horaLabel = (iso) => iso.slice(11, 16);

const selectCls = 'min-w-[260px] flex-1 rounded border border-slate-300 p-2 text-sm dark:border-slate-600 dark:bg-slate-900';
const btnPrimary = 'rounded bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50';
const btnDanger = 'rounded bg-red-500 px-2.5 py-1 text-xs text-white';
const cardCls = 'rounded-lg border border-slate-200 p-4 dark:border-slate-700';

function DeportesSection({ hijoId, resumen, onCambio }) {
  const toast = useToast();
  const [grupoId, setGrupoId] = useState('');
  const [enviando, setEnviando] = useState(false);

  const inscribir = async (e) => {
    e.preventDefault();
    if (!grupoId) return;
    setEnviando(true);
    const res = await inscripcionesService.inscribirDeporte(hijoId, Number(grupoId));
    setEnviando(false);
    if (res.exito) {
      toast.success('Inscripto al deporte.');
      setGrupoId('');
      onCambio();
    } else {
      toast.error(res.message || res.mensaje || 'No se pudo inscribir.');
    }
  };

  const desinscribir = async (grupo) => {
    if (!window.confirm(`¿Dar de baja la inscripción a ${grupo.deporte}?`)) return;
    const res = await inscripcionesService.desinscribirDeporte(hijoId, grupo.id);
    if (res.exito) {
      toast.success('Baja realizada.');
      onCambio();
    } else {
      toast.error(res.message || res.mensaje || 'No se pudo dar de baja.');
    }
  };

  return (
    <div className={cardCls}>
      <h4 className="mb-3 text-lg font-semibold">Deportes</h4>

      {resumen.inscriptos.length === 0 ? (
        <p className="mb-3 text-sm text-slate-500">Todavía no está inscripto a ningún deporte.</p>
      ) : (
        <ul className="mb-4 space-y-2">
          {resumen.inscriptos.map((g) => (
            <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 p-2 text-sm dark:border-slate-700">
              <span>
                <b>{g.deporte}</b> — {g.nivel}, {DIAS_LABEL[g.diaSemana]} {g.horaInicio} a {g.horaFin} (prof. {g.docente})
              </span>
              <button onClick={() => desinscribir(g)} className={btnDanger}>Dar de baja</button>
            </li>
          ))}
        </ul>
      )}

      {resumen.inscriptos.length >= 2 && (
        <p className="mb-2 text-xs text-slate-400">
          Ya alcanzó el máximo de 2 deportes simultáneos. Para sumar otro, primero dé de baja alguno de los actuales.
        </p>
      )}
      {resumen.disponibles.length === 0 ? (
        <p className="text-xs text-slate-400">No hay más grupos de deporte disponibles.</p>
      ) : (
        <form onSubmit={inscribir} className="flex flex-wrap gap-2">
          <select required value={grupoId} onChange={(e) => setGrupoId(e.target.value)} className={selectCls}>
            <option value="">Elegir grupo…</option>
            {resumen.disponibles.map((g) => (
              <option key={g.id} value={g.id}>
                {g.deporte} — {g.nivel}, {DIAS_LABEL[g.diaSemana]} {g.horaInicio} a {g.horaFin} (prof. {g.docente})
              </option>
            ))}
          </select>
          <button disabled={enviando} type="submit" className={btnPrimary}>
            <i className="fas fa-check" /> Inscribir
          </button>
        </form>
      )}
    </div>
  );
}

function TransporteSection({ hijoId, resumen, catalogo, onCambio }) {
  const toast = useToast();
  const [recorridoId, setRecorridoId] = useState('');
  const [enviando, setEnviando] = useState(false);

  const asignar = async (e) => {
    e.preventDefault();
    if (!recorridoId) return;
    setEnviando(true);
    const res = await inscripcionesService.setTransporte(hijoId, Number(recorridoId));
    setEnviando(false);
    if (res.exito) {
      toast.success('Transporte asignado.');
      setRecorridoId('');
      onCambio();
    } else {
      toast.error(res.message || res.mensaje || 'No se pudo asignar.');
    }
  };

  const quitar = async () => {
    if (!window.confirm('¿Quitar el servicio de transporte?')) return;
    const res = await inscripcionesService.quitarTransporte(hijoId);
    if (res.exito) {
      toast.success('Transporte dado de baja.');
      onCambio();
    } else {
      toast.error(res.message || res.mensaje || 'No se pudo dar de baja.');
    }
  };

  return (
    <div className={cardCls}>
      <h4 className="mb-3 text-lg font-semibold">Transporte</h4>

      {resumen.actual ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 p-2 text-sm dark:border-slate-700">
          <span>Recorrido actual: <b>{resumen.actual.recorrido}</b></span>
          <button onClick={quitar} className={btnDanger}>Quitar</button>
        </div>
      ) : (
        <p className="mb-3 text-sm text-slate-500">Todavía no tiene un recorrido asignado.</p>
      )}

      <form onSubmit={asignar} className="flex flex-wrap gap-2">
        <select required value={recorridoId} onChange={(e) => setRecorridoId(e.target.value)} className={selectCls}>
          <option value="">Elegir recorrido…</option>
          {catalogo.map((r) => (
            <option key={r.id} value={r.id}>
              {r.nombre} (salida {horaLabel(r.horaSalida)}, regreso {horaLabel(r.horaRegreso)})
            </option>
          ))}
        </select>
        <button disabled={enviando} type="submit" className={btnPrimary}>
          <i className="fas fa-check" /> {resumen.actual ? 'Cambiar' : 'Asignar'}
        </button>
      </form>
    </div>
  );
}

function ComedorSection({ hijoId, resumen, catalogo, onCambio }) {
  const toast = useToast();
  const [turnoId, setTurnoId] = useState('');
  const [enviando, setEnviando] = useState(false);

  const asignar = async (e) => {
    e.preventDefault();
    if (!turnoId) return;
    setEnviando(true);
    const res = await inscripcionesService.setComedor(hijoId, Number(turnoId));
    setEnviando(false);
    if (res.exito) {
      toast.success('Comedor asignado.');
      setTurnoId('');
      onCambio();
    } else {
      toast.error(res.message || res.mensaje || 'No se pudo asignar.');
    }
  };

  const quitar = async () => {
    if (!window.confirm('¿Quitar el servicio de comedor?')) return;
    const res = await inscripcionesService.quitarComedor(hijoId);
    if (res.exito) {
      toast.success('Comedor dado de baja.');
      onCambio();
    } else {
      toast.error(res.message || res.mensaje || 'No se pudo dar de baja.');
    }
  };

  return (
    <div className={cardCls}>
      <h4 className="mb-3 text-lg font-semibold">Comedor</h4>

      {resumen.actual ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 p-2 text-sm dark:border-slate-700">
          <span>Turno actual: <b>{resumen.actual.turno}</b></span>
          <button onClick={quitar} className={btnDanger}>Quitar</button>
        </div>
      ) : (
        <p className="mb-3 text-sm text-slate-500">Todavía no tiene un turno asignado.</p>
      )}

      <form onSubmit={asignar} className="flex flex-wrap gap-2">
        <select required value={turnoId} onChange={(e) => setTurnoId(e.target.value)} className={selectCls}>
          <option value="">Elegir turno…</option>
          {catalogo.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nombre} ({horaLabel(t.horaInicio)} a {horaLabel(t.horaFin)})
            </option>
          ))}
        </select>
        <button disabled={enviando} type="submit" className={btnPrimary}>
          <i className="fas fa-check" /> {resumen.actual ? 'Cambiar' : 'Asignar'}
        </button>
      </form>
    </div>
  );
}

// RF-18 a RF-22 (inscripción a deportes/transporte/comedor) + la mitad
// "deportes en que participa" de RF-23: vive toda acá, en una sola
// pantalla, para no duplicar esa información en MateriasPage.jsx (que ya
// cubre la otra mitad de RF-23, "profesores por materia").
export default function ServiciosPage() {
  const { hijoId, hijos } = useOutletContext();
  const [resumen, setResumen] = useState(null);
  const [recorridos, setRecorridos] = useState([]);
  const [turnos, setTurnos] = useState([]);

  const hijo = hijos.find((h) => h.id === hijoId);

  const cargar = useCallback(async () => {
    if (!hijoId) return;
    setResumen(null);
    const [r, rec, tur] = await Promise.all([
      inscripcionesService.getResumen(hijoId),
      transporteService.list(),
      comedorService.list(),
    ]);
    setResumen(r.exito ? r : null);
    setRecorridos(rec.exito ? rec.recorridos : []);
    setTurnos(tur.exito ? tur.turnos : []);
  }, [hijoId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (!hijoId) {
    return <p className="text-center text-slate-400">Seleccioná o vinculá un hijo primero.</p>;
  }

  if (!resumen) {
    return <p className="text-center text-slate-400">Cargando…</p>;
  }

  return (
    <div>
      <h3 className="mb-2 border-b border-slate-200 pb-3 text-xl font-bold dark:border-slate-700">Deportes y Servicios</h3>
      <p className="mb-5 text-sm text-slate-500">Gestioná la inscripción de <b>{hijo?.nombre}</b> a deportes, transporte y comedor.</p>

      <div className="space-y-6">
        <DeportesSection hijoId={hijoId} resumen={resumen.deportes} onCambio={cargar} />
        <TransporteSection hijoId={hijoId} resumen={resumen.transporte} catalogo={recorridos} onCambio={cargar} />
        <ComedorSection hijoId={hijoId} resumen={resumen.comedor} catalogo={turnos} onCambio={cargar} />
      </div>
    </div>
  );
}
