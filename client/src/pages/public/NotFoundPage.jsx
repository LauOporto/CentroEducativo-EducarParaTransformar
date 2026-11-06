import { Link } from 'react-router-dom';

export default function NotFoundPage({ volverA = '/', textoVolver = 'Volver al inicio', pantallaCompleta = false }) {
  const contenido = (
    <div className="py-16 text-center">
      <p className="text-sm font-semibold text-blue-500">Error 404</p>
      <h1 className="mt-2 font-display text-3xl text-ink sm:text-4xl">No encontramos esta página</h1>
      <p className="mx-auto mt-4 max-w-md text-ink-soft">
        La dirección no existe o cambió. Revisá que esté bien escrita.
      </p>
      <Link
        to={volverA}
        className="mt-8 inline-block rounded bg-blue-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-600"
      >
        {textoVolver}
      </Link>
    </div>
  );

  if (!pantallaCompleta) return contenido;
  return <main className="flex min-h-screen items-center justify-center bg-paper px-4">{contenido}</main>;
}
