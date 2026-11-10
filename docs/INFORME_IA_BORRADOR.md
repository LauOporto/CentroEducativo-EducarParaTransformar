# Informe de uso de IA en programación — BORRADOR

> Entrega: 17/11/2026 (3° Instancia de Evaluación). Estructura según el enunciado (TP-Metodologia-3.pdf, Parte 3).
> **Este borrador lo armó un asistente de IA.** El apartado 1 describe el sistema tal como está en el código. La bitácora (apartado 2) tiene entradas reales de la sesión del 09/11/2026 y hay que completarla con las del resto del proyecto. Los apartados 3 a 5 tienen que salir de la experiencia del equipo: acá solo hay disparadores.

## 1) Relación entre aplicación web y aplicación móvil

**Qué ya existía en la web.** Autenticación con JWT y cuatro roles (Estudiante, Docente, Padre/Tutor y Administrador). Módulos de Alumnos, Profesores y Administración. Inscripción a deportes, transporte y comedor con sus reglas de negocio (tope de 2 deportes, sin superposición horaria y sin duplicados). Vínculo padre-hijo. Motor de reportes en PDF (patrón Strategy). Notificaciones automáticas (patrón Factory Method).

**Qué se incorporó en la app móvil (Expo SDK 58 + React Native + TypeScript).** La app es solo para Padres/Tutores y tiene:
- inicio y cierre de sesión, recuperación de contraseña con un código por email, y cambio de contraseña;
- selector de hijo;
- pestaña **Pagos**: estado de cuenta por período, cuotas pendientes, pagadas y vencidas, deuda por ítem (cuota, deporte, transporte y comedor), facturas con su PDF, historial de pagos, selección de ítems a pagar, comprobante de pago generado por el sistema y carga de la transferencia (una factura admite varios comprobantes);
- pestaña **Servicios**: inscripción a deportes, transporte y comedor con las mismas reglas de la web.

**Qué información comparten.** Comparten la misma base PostgreSQL (Neon) y las mismas tablas: `User`, `ParentStudentLink`, `GrupoDeporte`, `InscripcionDeporte`, `InscripcionTransporte`, `InscripcionComedor`, `Factura`, `Cuota`, `ComprobantePago`, `Pago` y `Session`. La app no tiene base ni backend propios.

**Cómo se comunican.** Por la misma API REST (`/api`) sobre HTTPS:
- la app manda el header `X-Client-Type: mobile`;
- el access token (15 min) vive solo en memoria;
- el refresh token viaja en el body (no en una cookie) y se guarda en `expo-secure-store`;
- ante un 401, la app renueva el token una vez y reintenta.

**Qué modificaciones hubo que hacer en el backend:**
- login móvil, solo para PADRE (`utils/clienteMovil.ts`), y refresh/logout por body sobre la misma tabla `Session`;
- recuperación de contraseña (`PasswordReset`, `services/password.service.ts`);
- modelos de facturación y precios por nivel, deporte, recorrido y turno, generados con la migración `facturacion_y_pagos`;
- `pagos.facade.ts` (estado de cuenta), `comprobantes.service.ts` (comprobante, transferencia y anulación) y almacenamiento privado en Cloudinary;
- revisión de pagos del Administrador y los cinco listados financieros;
- mails automáticos: emisión el último día hábil y aviso de deuda el día 20, vía `POST /api/jobs/diario` y GitHub Actions;
- una regla nueva: un grupo de deporte solo admite alumnos de su nivel.

**Qué información se reutiliza:**
- los endpoints de inscripciones (`/api/inscripciones/estudiantes/:id/...`) y la fachada `panelFamilia.facade.ts`;
- `GET /api/parent/hijos` y el control de acceso padre-hijo;
- la Factory de notificaciones y el Motor de reportes.

**Cómo se mantienen sincronizados.** No hay copias locales de datos: los dos clientes leen y escriben la misma base a través de la misma API. Además, en la app (react-query):
- después de cada operación se vuelven a pedir el estado de cuenta, la factura y el comprobante;
- los datos se recargan al volver a la app y con pull-to-refresh;
- mientras un comprobante está "En revisión", se consulta cada 20 segundos.

Así, un comprobante que el Administrador aprueba en la web aparece aprobado en la app sin recargar.

## 2) Registro de uso de la IA — Bitácora

Herramienta en estas entradas: Claude Code (modelo Claude Opus 5.5).

| Nº | Problema | Prompt utilizado | Herramienta de IA | Respuesta de IA | ¿Funcionó? | Modificaciones realizadas | Resultado |
|---|---|---|---|---|---|---|---|
| 1 | Configurar y ejecutar el proyecto en una PC nueva | "ejecuta y configura el siguiente proyecto, una vez configurado hazlo correr" | Claude Code | Detectó Node 26, pnpm 11 y PostgreSQL 18; instaló dependencias y creó `backend/.env` con secretos JWT aleatorios | Parcialmente | La conexión a PostgreSQL pedía la contraseña del usuario `postgres`: la IA no la adivinó y la pidió al equipo | Correcto, con intervención humana |
| 2 | `npm run build:apk` fallaba con "eas no se reconoce como un comando" | Se pegó el log completo de la terminal | Claude Code | Explicó que `npx eas-cli login` no instala `eas` global y propuso `npx eas-cli build --platform android --profile preview` | Sí | Se cambió el script `build:apk` de `mobile/package.json` para usar `npx eas-cli` | Correcto |
| 3 | Verificar que el sistema cumpla con todo el enunciado | "Analiza el documento TP-Metodologia-3 … genera un checklist con lo que faltaría resolver" | Claude Code | Contrastó el PDF con el código y con la app deployada. Encontró precios en $0 y sin facturas en producción, falta de WhatsApp y redes, noticias fijas, sin horario de cursado y un checklist interno desactualizado | Sí | El equipo decidió qué arreglar y qué dejar (los roles quedaron como estaban) | Correcto |
| 4 | Generar automáticamente el horario de cursado de 14 cursos | (parte del pedido de "agregar toda la parte 2") | Claude Code | La primera versión llenaba curso por curso | Parcialmente | Al verificarlo por SQL quedaban 18 materias sin ningún bloque (profesores compartidos sin agenda libre). Se cambió a dos vueltas globales: primero un bloque por materia en todos los cursos | Correcto: 0 materias sin horario y 0 superposiciones |
| 5 | Reporte por docente con hojas casi vacías | Revisión del PDF generado | Claude Code | Detectó que, si la tabla empezaba al pie de la hoja, PDFKit paginaba cada título de columna por separado | Sí | Se agregó `asegurarEspacio()` en `pdfHelpers.ts` antes de títulos y encabezados | Correcto |
| 6 | Interpretar "discriminado por año y por año a que alumno corresponde" | (parte del pedido de corregir lo que no cerraba) | Claude Code | Lo interpretó como año calendario + año escolar (curso) del alumno | Parcialmente | **A validar con la cátedra**: se agregó el corte por curso sin quitar el de año ni el de alumno | Pendiente de validación |
| 7 | "Último día hábil del mes" sin feriados | (ídem) | Claude Code | Calcula los feriados nacionales: inamovibles, Carnaval y Viernes Santo por Pascua, y trasladables de la Ley 27.399 | Sí | Como los puentes los fija un decreto cada año, se agregó la variable `FERIADOS_EXTRA` | Correcto |
| … | *(completar con las entradas del resto del proyecto: Partes 1, 2 y 3)* | | | | | | |

## 3) IA vs. conocimiento del sistema

**¿Por qué una IA puede generar una solución técnicamente correcta pero incorrecta para nuestro sistema?**

*[Completar con la experiencia del equipo.]* Disparadores, con ejemplos reales del proyecto:
- **Contexto:** sin el enunciado, la IA no sabe que el colegio abre en 2027. Una noticia que decía "comenzó el ciclo lectivo 2026" era correcta como texto, pero falsa para el sistema.
- **Arquitectura:** la app debe reutilizar la API existente. Una IA podría proponer una base local o un backend nuevo para la app, lo que viola RNF-56.
- **Reglas de negocio:** "dos deportes" se cuenta por deporte y no por grupo. "Solo transferencia" implica que no existe el efectivo como opción.
- **Base de datos:** notas y asistencias guardan la materia por nombre. Renombrar una materia sin actualizarlas en cascada deja registros huérfanos.
- **Requisitos:** la frase ambigua de los listados de pagos (entrada 6 de la bitácora).
- **Permisos:** un padre solo puede ver a sus hijos. Un endpoint "correcto" sin el control padre-hijo es una fuga de datos (Ley 25.326).
- **Tecnologías:** Render free bloquea SMTP, así que nodemailer "funciona" en local pero no en producción; por eso se usa la API de Resend.

## 4) Comparación: desarrollo tradicional vs. desarrollo asistido por IA

*[Completar a partir de la experiencia real del equipo.]*

| Aspecto | Sin IA | Con IA |
|---|---|---|
| Generación de código | | |
| Tiempo de desarrollo | | |
| Comprensión del código | | |
| Detección de errores | | |
| Documentación | | |
| Aprendizaje | | |
| Integración | | |
| Seguridad | | |
| Mantenimiento | | |
| Calidad del resultado | | |

## 5) Reflexión crítica

*[Responder con la experiencia del equipo.]*

1. ¿La utilización de IA redujo realmente el tiempo de desarrollo?
2. ¿En qué tareas resultó más útil?
3. ¿En qué tareas produjo errores?
4. ¿Qué tipo de errores fueron más frecuentes?
5. ¿Fue necesario modificar código generado por IA? *(ver entradas 4 y 5 de la bitácora)*
6. ¿La IA comprendió correctamente la base de datos?
7. ¿La IA comprendió correctamente las reglas de negocio?
8. ¿Qué riesgos identificaron?
9. ¿Qué conocimientos necesitó el equipo para validar las respuestas de IA?
10. ¿Consideran que utilizar IA permite reemplazar el conocimiento del programador? Fundamentar.
