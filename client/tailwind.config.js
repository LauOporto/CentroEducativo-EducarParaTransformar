/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  // 'class' (no 'media'): quedan "dark:" sueltos en pantallas que esta
  // pasada de rediseño no tocó, y como ya no existe el toggle que
  // agregaba la clase .dark, esto los mantiene inertes en vez de que
  // se activen solos según el SO del usuario.
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Paleta derivada del isologo real de la institución (MET II/logo.PNG):
        // el anillo y el wordmark son el azul de marca; las cinco figuras que
        // forman el emblema aportan la constelación de acentos.
        paper: '#F7F8FA',
        ink: {
          DEFAULT: '#16243F',
          soft: '#4A5873',
          faint: '#8D97AC',
        },
        blue: {
          50: '#EEF4FC',
          100: '#DCEAFB',
          200: '#AFCCF0',
          500: '#1D63B4',
          600: '#17539B',
          700: '#163A68',
          900: '#0E2440',
        },
        // Acentos "constelación" — uno a la vez, nunca los cinco juntos
        // salvo en el emblema de marca.
        coral: '#E85A32',
        teal: '#0F9E86',
        violet: '#7A4FCB',
        magenta: '#D1348A',
        accent: {
          DEFAULT: '#1D63B4',
          dark: '#163A68',
        },
      },
      fontFamily: {
        display: ['"Fraunces"', 'serif'],
        sans: ['"Hanken Grotesk"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '0.5rem',
        lg: '0.625rem',
        xl: '0.875rem',
      },
      boxShadow: {
        // Reservada para superficies flotantes reales (modales, menús),
        // no para tarjetas en reposo — evita el "kit de tarjetas SaaS".
        float: '0 12px 32px -8px rgba(22, 36, 63, 0.28)',
      },
      keyframes: {
        'orbit-in': {
          '0%': { opacity: '0', transform: 'scale(0.92) rotate(-4deg)' },
          '100%': { opacity: '1', transform: 'scale(1) rotate(0deg)' },
        },
      },
      animation: {
        'orbit-in': 'orbit-in 900ms cubic-bezier(0.16, 1, 0.3, 1) both',
      },
    },
  },
  plugins: [],
};
