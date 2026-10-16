import { useEffect, useState } from 'react';
import { galeriaService } from '../../services/api/galeriaService';

export default function Galeria() {
  const [imagenes, setImagenes] = useState([]);

  useEffect(() => {
    galeriaService.list().then((data) => data.exito && setImagenes(data.imagenes));
  }, []);

  if (imagenes.length === 0) return null;

  return (
    <section id="galeria" className="mx-auto max-w-6xl px-6 py-20">
      <div className="mb-10 max-w-2xl">
        <div className="mb-5 h-1 w-14 rounded-full bg-coral" />
        <h2 className="font-display text-3xl text-ink sm:text-4xl">Galería</h2>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {imagenes.map((img) => (
          <img key={img.id} src={img.url} alt={img.alt} className="h-36 w-full rounded object-cover" />
        ))}
      </div>
    </section>
  );
}
