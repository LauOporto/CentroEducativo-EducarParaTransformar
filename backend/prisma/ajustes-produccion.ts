import { prisma } from '../src/db/prisma';
import { ajustarCatalogo, generarHorarios, sembrarNoticias } from './contenido';

// Ajustes de datos para una base que ya está en uso (producción en Neon):
// catálogo de deportes del enunciado, turnos de comedor duplicados, noticias
// iniciales del sitio y horario de cursado de los cursos que no lo tienen.
// Idempotente: no duplica nada y no pisa lo que haya cargado el Admin.
//
// Uso (con la DATABASE_URL de producción):
//   DATABASE_URL="postgresql://…neon.tech/neondb?sslmode=require" pnpm --filter backend prisma:ajustes-produccion
// Después, para precios, facturas y pagos de demo:
//   DATABASE_URL="…" pnpm --filter backend prisma:seed-facturacion

async function main() {
  console.log('🔧 Ajustes de datos…');
  const log = await ajustarCatalogo(prisma);
  for (const linea of log) console.log(`   ${linea}`);
  if (log.length === 0) console.log('   Catálogo de deportes y comedor: sin cambios.');

  const noticias = await sembrarNoticias(prisma);
  console.log(`   Noticias nuevas: ${noticias}`);

  const horarios = await generarHorarios(prisma);
  console.log(`   Horario de cursado: ${horarios.bloques} bloques en ${horarios.cursos} cursos sin horario`);
  console.log('✅ Listo.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
