// Zona horaria de los tests: la del negocio (Argentina, UTC-3).
// Se fija acá, antes de que Jest arranque los workers, para que valga igual en
// la PC de cualquiera (WSL, PowerShell o CMD) y en el CI de GitHub, que corre en UTC.
// Asignar process.env.TZ dentro de un archivo de test no alcanza: Jest le da a cada
// test una copia de process.env y el cambio no llega al proceso real.
module.exports = async () => {
  process.env.TZ = 'America/Argentina/Buenos_Aires';
};
