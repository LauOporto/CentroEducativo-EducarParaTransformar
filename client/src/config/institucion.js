// Datos institucionales y de contacto del sitio público, en un solo lugar.
// El colegio abre en marzo de 2027 en Resistencia (Chaco): todavía no tiene
// líneas ni cuentas reales, así que estos valores son de demostración. Para
// publicar los reales, se cambian acá y se reflejan en header, footer,
// botón flotante de WhatsApp y sección de contacto.

export const INSTITUCION = {
  nombre: 'Educar para Transformar',
  ciudad: 'Resistencia, Chaco',
  direccion: 'Av. Sarmiento 3200 (acceso por Ruta Nacional 11), Resistencia, Chaco',
  horarioAtencion: 'Lunes a viernes de 7:30 a 18:00',
  inicioActividades: 'marzo de 2027',
};

export const CONTACTO = {
  telefono: '(0362) 442-7000',
  telefonoHref: 'tel:+543624427000',
  // Número de WhatsApp en formato internacional, sin "+" ni espacios.
  whatsapp: '5493624427000',
  whatsappTexto: '+54 9 362 442-7000',
  whatsappMensaje: 'Hola, quisiera hacer una consulta sobre Educar para Transformar.',
  email: 'info@educarparatransformar.edu.ar',
};

export const REDES = [
  { nombre: 'Instagram', icono: 'fa-instagram', url: 'https://www.instagram.com/educarparatransformar.chaco' },
  { nombre: 'Facebook', icono: 'fa-facebook-f', url: 'https://www.facebook.com/educarparatransformar.chaco' },
  { nombre: 'YouTube', icono: 'fa-youtube', url: 'https://www.youtube.com/@educarparatransformar' },
];

export const whatsappUrl = (mensaje = CONTACTO.whatsappMensaje) =>
  `https://wa.me/${CONTACTO.whatsapp}?text=${encodeURIComponent(mensaje)}`;
