const IMAGENES = [
  { url: 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=500', alt: 'Aulas' },
  { url: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=500', alt: 'Biblioteca' },
  { url: 'https://images.unsplash.com/photo-1576267423445-b2e0074d68a4?w=500', alt: 'Deportes' },
  { url: 'https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?w=500', alt: 'Patio' },
];

export default function Galeria() {
  return (
    <section id="galeria" className="mx-auto max-w-4xl px-6 py-16">
      <h2 className="mb-8 text-center text-3xl font-bold">Galería de Imágenes</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {IMAGENES.map((img) => (
          <img key={img.alt} src={img.url} alt={img.alt} className="h-32 w-full rounded-lg object-cover" />
        ))}
      </div>
    </section>
  );
}
