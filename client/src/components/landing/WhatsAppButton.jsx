import { whatsappUrl } from '../../config/institucion';

// Acceso directo a WhatsApp, visible en todo el sitio público.
export default function WhatsAppButton() {
  return (
    <a
      href={whatsappUrl()}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Escribinos por WhatsApp"
      title="Escribinos por WhatsApp"
      className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-3xl text-white shadow-float transition hover:scale-105"
    >
      <i className="fab fa-whatsapp" aria-hidden="true" />
    </a>
  );
}
