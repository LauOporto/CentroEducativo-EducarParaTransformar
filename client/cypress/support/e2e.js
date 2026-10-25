// Comandos compartidos por las pruebas E2E. Los usuarios y la contraseña
// (123456) son los del seed de la base de pruebas, nunca datos reales.
const PASSWORD_SEED = '123456';

// Login por API: devuelve { id, nombre, tipo, token } para preparar datos.
Cypress.Commands.add('loginApi', (usuario) =>
  cy.request('POST', '/api/auth/login', { usuario, password: PASSWORD_SEED }).its('body.usuario'),
);

// Request autenticado que no corta la prueba si la API responde 4xx.
Cypress.Commands.add('api', (method, url, token, body) =>
  cy.request({ method, url, body, headers: { Authorization: `Bearer ${token}` }, failOnStatusCode: false }),
);

// Login por la interfaz, como lo haría un usuario real.
Cypress.Commands.add('loginUI', (usuario) => {
  cy.visit('/');
  cy.contains('button', 'Iniciar sesión').click();
  cy.get('input[placeholder="Usuario"]').type(usuario);
  cy.get('input[placeholder="Contraseña"]').type(PASSWORD_SEED);
  cy.contains('button', 'Ingresar').click();
});

// Deja a fbarrabino como en el seed: Fútbol y Vóley de Secundaria. Así cada
// prueba arranca del mismo estado, sin depender del orden en que corren.
// Hay varios grupos por deporte: se identifica el del seed por día y nivel.
const GRUPOS_SEED = [
  { deporte: 'Fútbol', nivel: 'Secundaria', diaSemana: 'MARTES' },
  { deporte: 'Vóley', nivel: 'Secundaria', diaSemana: 'MIERCOLES' },
];
const esDelSeed = (g, s) => g.deporte === s.deporte && g.nivel === s.nivel && g.diaSemana === s.diaSemana;
const BASE_INSCRIPCIONES = '/api/inscripciones/estudiantes';

Cypress.Commands.add('restaurarDeportesSeed', () => {
  cy.loginApi('fbarrabino').then(({ id, token }) => {
    cy.api('GET', `${BASE_INSCRIPCIONES}/${id}/resumen`, token).then(({ body }) => {
      const { inscriptos, disponibles } = body.deportes;
      for (const g of inscriptos.filter((g) => !GRUPOS_SEED.some((s) => esDelSeed(g, s)))) {
        cy.api('DELETE', `${BASE_INSCRIPCIONES}/${id}/deportes/${g.id}`, token);
      }
      for (const s of GRUPOS_SEED.filter((s) => !inscriptos.some((g) => esDelSeed(g, s)))) {
        const grupo = disponibles.find((g) => esDelSeed(g, s));
        cy.api('POST', `${BASE_INSCRIPCIONES}/${id}/deportes`, token, { grupoDeporteId: grupo.id });
      }
    });
  });
});
