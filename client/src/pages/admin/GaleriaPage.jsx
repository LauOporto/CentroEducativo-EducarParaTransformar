import { useEffect, useState } from 'react';
import { galeriaService } from '../../services/api/galeriaService';
import { useToast } from '../../hooks/useToast';

export default function GaleriaPage() {
  const toast = useToast();
  const [imagenes, setImagenes] = useState(null);
  const [archivo, setArchivo] = useState(null);
  const [alt, setAlt] = useState('');
  const [subiendo, setSubiendo] = useState(false);

  const cargar = async () => {
    const data = await galeriaService.list();
    setImagenes(data.exito ? data.imagenes : []);
  };

  useEffect(() => {
    cargar();
  }, []);

  const subir = async (e) => {
    e.preventDefault();
    if (!archivo) {
      toast.warning('Elegí una imagen antes de subir.');
      return;
    }
    const formData = new FormData();
    formData.append('imagen', archivo);
    formData.append('alt', alt);
    setSubiendo(true);
    try {
      const res = await galeriaService.create(formData);
      if (res.exito) {
        toast.success('Imagen agregada a la galería.');
        setArchivo(null);
        setAlt('');
        e.target.reset();
        cargar();
      } else {
        toast.error(res.mensaje || 'No se pudo subir la imagen.');
      }
    } finally {
      setSubiendo(false);
    }
  };

  const eliminar = async (id) => {
    if (!window.confirm('¿Quitar esta imagen de la galería?')) return;
    const res = await galeriaService.remove(id);
    if (res.exito) {
      toast.success('Imagen eliminada.');
      cargar();
    } else {
      toast.error(res.mensaje || 'No se pudo eliminar.');
    }
  };

  return (
    <div>
      <h3 className="mb-4 border-b border-blue-100 pb-3 text-xl font-bold dark:border-slate-700">Galería de Imágenes</h3>

      <form onSubmit={subir} className="mb-6 flex flex-wrap items-end gap-2 rounded-lg border border-blue-100 p-4 dark:border-slate-700">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink-faint">Imagen</label>
          <input
            type="file" accept="image/*" required
            onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
            className="text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink-faint">Descripción</label>
          <input
            required placeholder="Ej: Aulas" value={alt} onChange={(e) => setAlt(e.target.value)}
            className="rounded border border-blue-200 p-2 text-sm dark:border-slate-600 dark:bg-slate-900"
          />
        </div>
        <button disabled={subiendo} type="submit" className="rounded bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          <i className="fas fa-upload" /> {subiendo ? 'Subiendo…' : 'Agregar'}
        </button>
      </form>

      {imagenes === null && <p className="text-sm text-ink-faint">Cargando…</p>}
      {imagenes?.length === 0 && <p className="text-sm text-ink-faint">Todavía no hay imágenes en la galería.</p>}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {imagenes?.map((img) => (
          <div key={img.id} className="group relative">
            <img src={img.url} alt={img.alt} className="h-32 w-full rounded-lg object-cover" />
            <p className="mt-1 truncate text-xs text-ink-faint">{img.alt}</p>
            <button
              onClick={() => eliminar(img.id)}
              className="absolute right-1 top-1 rounded bg-red-600/90 px-2 py-1 text-xs text-white opacity-0 transition group-hover:opacity-100"
            >
              <i className="fas fa-trash" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
