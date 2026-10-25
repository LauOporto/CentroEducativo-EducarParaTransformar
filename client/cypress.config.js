import { defineConfig } from 'cypress';

// Pruebas E2E: se corren con `pnpm e2e` desde la raíz (scripts/e2e.mjs), que
// prepara la base de pruebas y levanta la app en el puerto 4100.
export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:4100',
    specPattern: 'cypress/e2e/**/*.cy.js',
    viewportWidth: 1280,
    viewportHeight: 800,
    video: false,
  },
});
