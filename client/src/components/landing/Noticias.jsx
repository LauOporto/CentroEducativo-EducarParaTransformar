import { useEffect, useState } from 'react';
import { noticiasService } from '../../services/api/contenidoService';

const formatoFecha = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
const fechaLabel = (iso) => formatoFecha.format(new Date(`${iso}T00:00:00Z`));

export default function Noticias() {
  const [noticias, setNoticias] = useState(null);
  const [abierta, setAbierta] = useState(null);

  useEffect(() => {
    noticiasService
      .listPublicas()
      .then((data) => setNoticias(data.exito ? data.noticias : []))
      .catch(() => setNoticias([]));
  }, []);

  return (
    <section id="noticias">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-10 max-w-2xl">
          <div className="mb-5 h-1 w-14 rounded-full bg-violet" />
          <h2 className="font-display text-3xl text-ink sm:text-4xl">Noticias</h2>
        </div>

        {noticias === null && <p className="text-ink-faint">Cargando noticias…</p>}
        {noticias?.length === 0 && <p className="text-ink-faint">Pronto vamos a publicar novedades.</p>}

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {noticias?.map((n) => {
            const expandida = abierta === n.id;
            return (
              <article key={n.id} className="flex flex-col overflow-hidden rounded-xl border border-blue-100 bg-white">
                {n.imagenUrl && <img src={n.imagenUrl} alt="" className="h-44 w-full object-cover" loading="lazy" />}
                <div className="flex flex-1 flex-col p-5">
                  <time dateTime={n.fecha} className="text-sm text-ink-faint">
                    {fechaLabel(n.fecha)}
                  </time>
                  <h3 className="mt-1.5 font-display text-xl leading-snug text-ink">{n.titulo}</h3>
                  <p className="mt-2 text-ink-soft">{n.resumen}</p>
                  {expandida && <p className="mt-3 whitespace-pre-line text-ink">{n.contenido}</p>}
                  <button
                    type="button"
                    onClick={() => setAbierta(expandida ? null : n.id)}
                    aria-expanded={expandida}
                    className="mt-4 self-start text-sm font-semibold text-blue-500 hover:text-blue-600"
                  >
                    {expandida ? 'Ver menos' : 'Leer más'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
