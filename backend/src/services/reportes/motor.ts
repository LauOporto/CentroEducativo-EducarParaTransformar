import type { ReportStrategy } from './types';

const estrategias = new Map<string, ReportStrategy<any, any>>();

export function registrarEstrategia(estrategia: ReportStrategy<any, any>) {
  estrategias.set(estrategia.key, estrategia);
}

export function obtenerEstrategia(key: string): ReportStrategy<any, any> | undefined {
  return estrategias.get(key);
}

export function listarEstrategias(): ReportStrategy<any, any>[] {
  return [...estrategias.values()];
}
