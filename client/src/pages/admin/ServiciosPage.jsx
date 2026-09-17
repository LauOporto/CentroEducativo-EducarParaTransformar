import { useEffect, useState } from 'react';
import { useToast } from '../../hooks/useToast';
import { deportesService } from '../../services/api/deportesService';
import { transporteService } from '../../services/api/transporteService';
import { comedorService } from '../../services/api/comedorService';
import { nivelesService } from '../../services/api/nivelesService';
import { adminService } from '../../services/api/adminService';
import DataTable from '../../components/ui/DataTable';

const inputCls = 'rounded border border-slate-300 p-2 text-sm dark:border-slate-600 dark:bg-slate-900';
const btnPrimary = 'rounded bg-accent px-3 py-2 text-xs font-semibold text-white disabled:opacity-50';
const btnDanger = 'rounded bg-red-500 px-2.5 py-1.5 text-xs text-white';
const btnMuted = 'rounded bg-slate-500 px-2.5 py-1.5 text-xs text-white';

const DIAS = [
  { value: 'LUNES', label: 'Lunes' },
  { value: 'MARTES', label: 'Martes' },
  { value: 'MIERCOLES', label: 'Miércoles' },
  { value: 'JUEVES', label: 'Jueves' },
  { value: 'VIERNES', label: 'Viernes' },
  { value: 'SABADO', label: 'Sábado' },
];
const diaLabel = (value) => DIAS.find((d) => d.value === value)?.label ?? value;

function confirmarBorrado(mensaje) {
  return window.confirm(mensaje);
}

function DeportesSection() {
  const toast = useToast();
  const [deportes, setDeportes] = useState(null);
  const [nombre, setNombre] = useState('');
  const [editId, setEditId] = useState(null);
  const [editNombre, setEditNombre] = useState('');

  const cargar = async () => {
    const data = await deportesService.list();
    setDeportes(data.exito ? data.deportes : []);
  };
  useEffect(() => { cargar(); }, []);

  const crear = async (e) => {
    e.preventDefault();
    const res = await deportesService.create({ nombre });
    if (res.exito) { toast.success('Deporte creado.'); setNombre(''); cargar(); }
    else toast.error(res.message || res.mensaje || 'No se pudo crear.');
  };

  const guardarEdicion = async (id) => {
    const res = await deportesService.update(id, { nombre: editNombre });
    if (res.exito) { toast.success('Deporte actualizado.'); setEditId(null); cargar(); }
    else toast.error(res.message || res.mensaje || 'No se pudo actualizar.');
  };

  const borrar = async (d) => {
    if (!confirmarBorrado(`¿Eliminar el deporte "${d.nombre}"?`)) return;
    const res = await deportesService.remove(d.id);
    if (res.exito) { toast.success('Deporte eliminado.'); cargar(); }
    else toast.error(res.message || res.mensaje || 'No se pudo eliminar.');
  };

  const columns = [
    {
      key: 'nombre', label: 'Nombre',
      render: (d) => editId === d.id
        ? <input autoFocus value={editNombre} onChange={(e) => setEditNombre(e.target.value)} className={inputCls} />
        : d.nombre,
    },
    {
      key: 'acciones', label: 'Acciones',
      render: (d) => editId === d.id ? (
        <div className="flex gap-1.5">
          <button onClick={() => guardarEdicion(d.id)} className={btnPrimary}>Guardar</button>
          <button onClick={() => setEditId(null)} className={btnMuted}>Cancelar</button>
        </div>
      ) : (
        <div className="flex gap-1.5">
          <button onClick={() => { setEditId(d.id); setEditNombre(d.nombre); }} className={btnMuted}>Editar</button>
          <button onClick={() => borrar(d)} className={btnDanger}>Eliminar</button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <form onSubmit={crear} className="mb-4 flex gap-2">
        <input required placeholder="Nuevo deporte (ej: Fútbol)" value={nombre} onChange={(e) => setNombre(e.target.value)} className={`flex-1 ${inputCls}`} />
        <button type="submit" className={btnPrimary}><i className="fas fa-plus" /> Agregar</button>
      </form>
      <DataTable columns={columns} rows={deportes ?? []} loading={deportes === null} emptyMessage="Sin deportes cargados." />
    </div>
  );
}

const GRUPO_FORM_INICIAL = { deporteId: '', nivelId: '', diaSemana: '', horaInicio: '', horaFin: '', docenteId: '' };

function GruposDeporteSection() {
  const toast = useToast();
  const [grupos, setGrupos] = useState(null);
  const [deportes, setDeportes] = useState([]);
  const [niveles, setNiveles] = useState([]);
  const [docentes, setDocentes] = useState([]);
  const [form, setForm] = useState(GRUPO_FORM_INICIAL);

  const cargar = async () => {
    const [g, d, n, doc] = await Promise.all([
      deportesService.listGrupos(),
      deportesService.list(),
      nivelesService.list(),
      adminService.listUsers({ role: 'DOCENTE' }),
    ]);
    setGrupos(g.exito ? g.grupos : []);
    setDeportes(d.exito ? d.deportes : []);
    setNiveles(n.exito ? n.niveles : []);
    setDocentes(doc.exito ? doc.usuarios : []);
  };
  useEffect(() => { cargar(); }, []);

  const crear = async (e) => {
    e.preventDefault();
    const res = await deportesService.createGrupo({
      deporteId: Number(form.deporteId),
      nivelId: Number(form.nivelId),
      diaSemana: form.diaSemana,
      horaInicio: form.horaInicio,
      horaFin: form.horaFin,
      docenteId: Number(form.docenteId),
    });
    if (res.exito) { toast.success('Grupo de deporte creado.'); setForm(GRUPO_FORM_INICIAL); cargar(); }
    else toast.error(res.message || res.mensaje || 'No se pudo crear.');
  };

  const borrar = async (g) => {
    if (!confirmarBorrado(`¿Eliminar el grupo de ${g.deporte} (${g.nivel}, ${diaLabel(g.diaSemana)} ${g.horaInicio}-${g.horaFin})?`)) return;
    const res = await deportesService.removeGrupo(g.id);
    if (res.exito) { toast.success('Grupo eliminado.'); cargar(); }
    else toast.error(res.message || res.mensaje || 'No se pudo eliminar.');
  };

  const columns = [
    { key: 'deporte', label: 'Deporte' },
    { key: 'nivel', label: 'Nivel' },
    { key: 'dia', label: 'Día', render: (g) => diaLabel(g.diaSemana) },
    { key: 'horario', label: 'Horario', render: (g) => `${g.horaInicio} - ${g.horaFin}` },
    { key: 'docente', label: 'Profesor' },
    {
      key: 'acciones', label: 'Acciones',
      render: (g) => <button onClick={() => borrar(g)} className={btnDanger}>Eliminar</button>,
    },
  ];

  return (
    <div>
      <p className="mb-3 text-sm text-slate-500">
        Cada grupo combina deporte + nivel + día + horario + profesor responsable (RF-14). No puede haber dos grupos
        con exactamente esa misma combinación.
      </p>
      <form onSubmit={crear} className="mb-4 flex flex-wrap gap-2">
        <select required value={form.deporteId} onChange={(e) => setForm({ ...form, deporteId: e.target.value })} className={inputCls}>
          <option value="">Deporte…</option>
          {deportes.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
        </select>
        <select required value={form.nivelId} onChange={(e) => setForm({ ...form, nivelId: e.target.value })} className={inputCls}>
          <option value="">Nivel…</option>
          {niveles.map((n) => <option key={n.id} value={n.id}>{n.nombre}</option>)}
        </select>
        <select required value={form.diaSemana} onChange={(e) => setForm({ ...form, diaSemana: e.target.value })} className={inputCls}>
          <option value="">Día…</option>
          {DIAS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
        <input required type="time" value={form.horaInicio} onChange={(e) => setForm({ ...form, horaInicio: e.target.value })} className={inputCls} />
        <input required type="time" value={form.horaFin} onChange={(e) => setForm({ ...form, horaFin: e.target.value })} className={inputCls} />
        <select required value={form.docenteId} onChange={(e) => setForm({ ...form, docenteId: e.target.value })} className={inputCls}>
          <option value="">Profesor…</option>
          {docentes.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
        </select>
        <button type="submit" className={btnPrimary}><i className="fas fa-plus" /> Agregar</button>
      </form>
      <DataTable columns={columns} rows={grupos ?? []} loading={grupos === null} emptyMessage="Sin grupos de deporte cargados." />
    </div>
  );
}

function TransporteSection() {
  const toast = useToast();
  const [recorridos, setRecorridos] = useState(null);
  const [form, setForm] = useState({ nombre: '', horario: '' });
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({ nombre: '', horario: '' });

  const cargar = async () => {
    const data = await transporteService.list();
    setRecorridos(data.exito ? data.recorridos : []);
  };
  useEffect(() => { cargar(); }, []);

  const crear = async (e) => {
    e.preventDefault();
    const res = await transporteService.create(form);
    if (res.exito) { toast.success('Recorrido creado.'); setForm({ nombre: '', horario: '' }); cargar(); }
    else toast.error(res.message || res.mensaje || 'No se pudo crear.');
  };

  const guardarEdicion = async (id) => {
    const res = await transporteService.update(id, editForm);
    if (res.exito) { toast.success('Recorrido actualizado.'); setEditId(null); cargar(); }
    else toast.error(res.message || res.mensaje || 'No se pudo actualizar.');
  };

  const borrar = async (r) => {
    if (!confirmarBorrado(`¿Eliminar el recorrido "${r.nombre}"?`)) return;
    const res = await transporteService.remove(r.id);
    if (res.exito) { toast.success('Recorrido eliminado.'); cargar(); }
    else toast.error(res.message || res.mensaje || 'No se pudo eliminar.');
  };

  const columns = [
    {
      key: 'nombre', label: 'Nombre',
      render: (r) => editId === r.id
        ? <input autoFocus value={editForm.nombre} onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })} className={inputCls} />
        : r.nombre,
    },
    {
      key: 'horario', label: 'Horario',
      render: (r) => editId === r.id
        ? <input value={editForm.horario} onChange={(e) => setEditForm({ ...editForm, horario: e.target.value })} className={inputCls} />
        : r.horario,
    },
    {
      key: 'acciones', label: 'Acciones',
      render: (r) => editId === r.id ? (
        <div className="flex gap-1.5">
          <button onClick={() => guardarEdicion(r.id)} className={btnPrimary}>Guardar</button>
          <button onClick={() => setEditId(null)} className={btnMuted}>Cancelar</button>
        </div>
      ) : (
        <div className="flex gap-1.5">
          <button onClick={() => { setEditId(r.id); setEditForm({ nombre: r.nombre, horario: r.horario }); }} className={btnMuted}>Editar</button>
          <button onClick={() => borrar(r)} className={btnDanger}>Eliminar</button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <form onSubmit={crear} className="mb-4 flex flex-wrap gap-2">
        <input required placeholder="Nombre (ej: Recorrido Norte)" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className={inputCls} />
        <input required placeholder="Horario (ej: Salida 07:00 / Regreso 17:30)" value={form.horario} onChange={(e) => setForm({ ...form, horario: e.target.value })} className={`flex-1 ${inputCls}`} />
        <button type="submit" className={btnPrimary}><i className="fas fa-plus" /> Agregar</button>
      </form>
      <DataTable columns={columns} rows={recorridos ?? []} loading={recorridos === null} emptyMessage="Sin recorridos cargados." />
    </div>
  );
}

function ComedorSection() {
  const toast = useToast();
  const [turnos, setTurnos] = useState(null);
  const [form, setForm] = useState({ nombre: '', horario: '' });
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({ nombre: '', horario: '' });

  const cargar = async () => {
    const data = await comedorService.list();
    setTurnos(data.exito ? data.turnos : []);
  };
  useEffect(() => { cargar(); }, []);

  const crear = async (e) => {
    e.preventDefault();
    const res = await comedorService.create(form);
    if (res.exito) { toast.success('Turno creado.'); setForm({ nombre: '', horario: '' }); cargar(); }
    else toast.error(res.message || res.mensaje || 'No se pudo crear.');
  };

  const guardarEdicion = async (id) => {
    const res = await comedorService.update(id, editForm);
    if (res.exito) { toast.success('Turno actualizado.'); setEditId(null); cargar(); }
    else toast.error(res.message || res.mensaje || 'No se pudo actualizar.');
  };

  const borrar = async (t) => {
    if (!confirmarBorrado(`¿Eliminar el turno "${t.nombre}"?`)) return;
    const res = await comedorService.remove(t.id);
    if (res.exito) { toast.success('Turno eliminado.'); cargar(); }
    else toast.error(res.message || res.mensaje || 'No se pudo eliminar.');
  };

  const columns = [
    {
      key: 'nombre', label: 'Nombre',
      render: (t) => editId === t.id
        ? <input autoFocus value={editForm.nombre} onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })} className={inputCls} />
        : t.nombre,
    },
    {
      key: 'horario', label: 'Horario',
      render: (t) => editId === t.id
        ? <input value={editForm.horario} onChange={(e) => setEditForm({ ...editForm, horario: e.target.value })} className={inputCls} />
        : t.horario,
    },
    {
      key: 'acciones', label: 'Acciones',
      render: (t) => editId === t.id ? (
        <div className="flex gap-1.5">
          <button onClick={() => guardarEdicion(t.id)} className={btnPrimary}>Guardar</button>
          <button onClick={() => setEditId(null)} className={btnMuted}>Cancelar</button>
        </div>
      ) : (
        <div className="flex gap-1.5">
          <button onClick={() => { setEditId(t.id); setEditForm({ nombre: t.nombre, horario: t.horario }); }} className={btnMuted}>Editar</button>
          <button onClick={() => borrar(t)} className={btnDanger}>Eliminar</button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <form onSubmit={crear} className="mb-4 flex flex-wrap gap-2">
        <input required placeholder="Nombre (ej: Primer turno)" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className={inputCls} />
        <input required placeholder="Horario (ej: 12:00 a 13:00)" value={form.horario} onChange={(e) => setForm({ ...form, horario: e.target.value })} className={`flex-1 ${inputCls}`} />
        <button type="submit" className={btnPrimary}><i className="fas fa-plus" /> Agregar</button>
      </form>
      <DataTable columns={columns} rows={turnos ?? []} loading={turnos === null} emptyMessage="Sin turnos cargados." />
    </div>
  );
}

const TABS = [
  { key: 'deportes', label: 'Deportes', Component: DeportesSection },
  { key: 'grupos', label: 'Grupos de deporte', Component: GruposDeporteSection },
  { key: 'transporte', label: 'Transporte', Component: TransporteSection },
  { key: 'comedor', label: 'Comedor', Component: ComedorSection },
];

export default function ServiciosPage() {
  const [tab, setTab] = useState('deportes');
  const Activo = TABS.find((t) => t.key === tab).Component;

  return (
    <div>
      <h3 className="mb-5 border-b border-slate-200 pb-3 text-xl font-bold dark:border-slate-700">Deportes, Transporte y Comedor</h3>

      <div className="mb-5 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
              tab === t.key ? 'bg-accent text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Activo />
    </div>
  );
}
