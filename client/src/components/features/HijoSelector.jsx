import { useState } from 'react';
import { parentService } from '../../services/api/parentService';
import { useToast } from '../../hooks/useToast';

export default function HijoSelector({ hijos, hijoId, onChange, onVinculado }) {
  const toast = useToast();
  const [dni, setDni] = useState('');

  const vincular = async (e) => {
    e.preventDefault();
    if (!dni.trim()) return;
    const res = await parentService.vincularHijo(dni.trim());
    if (res.exito) {
      toast.success('Hijo vinculado correctamente: ' + res.hijo.nombre);
      setDni('');
      onVinculado();
    } else {
      toast.error(res.mensaje || 'No se pudo vincular.');
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <i className="fas fa-child text-lg text-accent" />
      <label className="font-semibold">Alumno a cargo:</label>
      <select
        value={hijoId ?? ''}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        className="min-w-[200px] flex-1 rounded border border-slate-300 p-2 text-sm dark:border-slate-600 dark:bg-slate-800"
      >
        {hijos.length === 0 && <option value="">— Sin hijos vinculados —</option>}
        {hijos.map((h) => (
          <option key={h.id} value={h.id}>{h.nombre}{h.curso ? ` (${h.curso})` : ''}</option>
        ))}
      </select>
      <form onSubmit={vincular} className="flex gap-2">
        <input
          value={dni}
          onChange={(e) => setDni(e.target.value)}
          placeholder="DNI de otro hijo"
          required
          className="w-40 rounded border border-slate-300 p-2 text-sm dark:border-slate-600 dark:bg-slate-800"
        />
        <button type="submit" className="rounded bg-blue-500 px-4 py-2 text-sm font-semibold text-white">
          <i className="fas fa-link" /> Vincular
        </button>
      </form>
    </div>
  );
}
