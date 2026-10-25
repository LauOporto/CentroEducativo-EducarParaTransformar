// CP-RF18-01 — RF-18: un alumno puede estar inscripto como máximo en 2 deportes.
// Datos del seed: fbarrabino tiene Fútbol (martes) y Vóley (miércoles), y
// Básquet (viernes) le queda disponible sin superposición horaria.
const elegirGrupo = (deporte) =>
  cy
    .get('select option')
    .contains(deporte)
    .then(($opcion) => cy.get('select').select($opcion.val()));

describe('RF-18 · Máximo 2 deportes simultáneos por alumno', () => {
  beforeEach(() => cy.restaurarDeportesSeed());

  it('rechaza un tercer deporte y lo acepta después de dar de baja uno', () => {
    cy.loginUI('fbarrabino');
    cy.contains('a', 'Deportes y Servicios').click();

    // Paso 1: el alumno ve sus 2 deportes y el aviso de máximo.
    cy.get('[data-cy=deportes-inscriptos] li').should('have.length', 2);
    cy.get('[data-cy=deportes]').should('contain', 'Ya alcanzó el máximo de 2 deportes');

    // Paso 2: intenta sumar un tercero → el sistema lo rechaza y no cambia nada.
    cy.get('[data-cy=deportes]').within(() => {
      elegirGrupo('Básquet');
      cy.contains('button', 'Inscribir').click();
    });
    cy.contains('ya está inscripto en 2 deportes').should('be.visible');
    cy.get('[data-cy=deportes-inscriptos] li').should('have.length', 2);

    // Paso 3: da de baja Vóley (la confirmación del navegador se acepta sola).
    cy.get('[data-cy=deportes-inscriptos]').contains('li', 'Vóley').contains('button', 'Dar de baja').click();
    cy.contains('Baja realizada.').should('be.visible');
    cy.get('[data-cy=deportes-inscriptos] li').should('have.length', 1);

    // Paso 4: ahora sí puede inscribirse a Básquet.
    cy.get('[data-cy=deportes]').within(() => {
      elegirGrupo('Básquet');
      cy.contains('button', 'Inscribir').click();
    });
    cy.contains('Inscripto al deporte.').should('be.visible');
    cy.get('[data-cy=deportes-inscriptos] li').should('have.length', 2).and('contain', 'Básquet');
  });
});
