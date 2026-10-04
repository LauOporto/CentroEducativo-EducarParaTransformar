import { useState } from 'react';

export default function ApproveTeacherModal({ docente, onClose, onApprove }) {
  const [ficha, setFicha] = useState({
    legajo: '',
    apellido: '',
    especialidad: '',
    telefono: '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onApprove(docente.id, ficha);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded bg-white p-5 shadow-lg dark:bg-slate-800">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">Aprobar Docente: {docente.nombre}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <i className="fas fa-times" />
          </button>
        </div>
        
        <p className="mb-4 text-sm text-slate-500">
          Por favor, completa los siguientes datos para finalizar el registro del docente.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Legajo <span className="text-red-500">*</span></label>
            <input
              required
              className="w-full rounded border border-slate-300 p-2 text-sm dark:border-slate-600 dark:bg-slate-900"
              value={ficha.legajo}
              onChange={(e) => setFicha({ ...ficha, legajo: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Apellido <span className="text-red-500">*</span></label>
            <input
              required
              className="w-full rounded border border-slate-300 p-2 text-sm dark:border-slate-600 dark:bg-slate-900"
              value={ficha.apellido}
              onChange={(e) => setFicha({ ...ficha, apellido: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Especialidad <span className="text-red-500">*</span></label>
            <input
              required
              className="w-full rounded border border-slate-300 p-2 text-sm dark:border-slate-600 dark:bg-slate-900"
              value={ficha.especialidad}
              onChange={(e) => setFicha({ ...ficha, especialidad: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Teléfono <span className="text-red-500">*</span></label>
            <input
              required
              className="w-full rounded border border-slate-300 p-2 text-sm dark:border-slate-600 dark:bg-slate-900"
              value={ficha.telefono}
              onChange={(e) => setFicha({ ...ficha, telefono: e.target.value })}
            />
          </div>
          
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded bg-slate-200 px-4 py-2 text-sm dark:bg-slate-700">
              Cancelar
            </button>
            <button type="submit" className="rounded bg-accent px-4 py-2 text-sm text-white">
              Aprobar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
