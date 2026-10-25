## Qué cambia

<!-- Una o dos líneas: qué hace el PR y por qué. -->

Closes #

## Cómo probarlo

<!-- Pasos para que el revisor lo verifique (usuario del seed, pantalla, resultado esperado). -->

## Checklist del autor

- [ ] El CI está en verde (backend, client y e2e).
- [ ] Lo probé con cada rol afectado (admin, docente, estudiante, padre).
- [ ] Si cambia una regla de negocio, agregué o actualicé su test.
- [ ] Si cambia el esquema de Prisma, la migración está incluida.
- [ ] No hay secretos ni `.env` en el diff.
- [ ] El PR es chico: una pieza acotada del Issue (máximo 8 commits, idealmente menos de 400 líneas).

## Checklist del revisor (revisión por pares)

- [ ] Hace lo que dice el Issue y cumple sus criterios de aceptación.
- [ ] Los permisos por rol están controlados en el backend, no solo en la pantalla.
- [ ] Los errores devuelven el código HTTP correcto (400, 403, 404, 409) con un mensaje claro.
- [ ] No hay código duplicado ni comentado, ni `console.log` olvidados.
- [ ] Los nombres se entienden sin leer la implementación.
