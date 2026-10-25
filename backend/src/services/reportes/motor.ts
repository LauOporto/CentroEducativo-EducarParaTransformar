import type { ReportStrategy } from './types';

const estrategias = new Map<string, ReportStrategy>();

export function registrarEstrategia(estrategia: ReportStrategy) {
  estrategias.set(estrategia.key, estrategia);
}

export function obtenerEstrategia(key: string): ReportStrategy | undefined {
  return estrategias.get(key);
}

export function listarEstrategias(): ReportStrategy[] {
  return [...estrategias.values()];
}
