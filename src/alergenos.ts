// src/alergenos.ts
// 14 alérgenos de declaración obligatoria (Reglamento UE 1169/2011)

export interface AlergenoDef {
  id: string;
  nombre: string;
  nombreCorto: string;
  emoji: string;
  filtroRapido?: string;
}

export const AVISO_LEGAL_CARTA =
  'Precios con IVA incluido. Información sobre los 14 alérgenos de declaración obligatoria y platos sin gluten disponible a disposición del cliente antes de ordenar. Consulta al personal sobre posibles trazas o contaminación cruzada.';

export const ALERGENOS_OFICIALES: readonly AlergenoDef[] = [
  { id: 'Gluten', nombre: 'Gluten', nombreCorto: 'Gluten', emoji: '🌾', filtroRapido: 'Sin Gluten' },
  { id: 'Crustáceos', nombre: 'Crustáceos', nombreCorto: 'Crustáceos', emoji: '🦐' },
  { id: 'Huevos', nombre: 'Huevos', nombreCorto: 'Huevos', emoji: '🥚', filtroRapido: 'Sin Huevo' },
  { id: 'Pescado', nombre: 'Pescado', nombreCorto: 'Pescado', emoji: '🐟' },
  { id: 'Cacahuetes', nombre: 'Cacahuetes', nombreCorto: 'Cacahuetes', emoji: '🥜' },
  { id: 'Soja', nombre: 'Soja', nombreCorto: 'Soja', emoji: '🫘' },
  { id: 'Lácteos', nombre: 'Lácteos', nombreCorto: 'Lácteos', emoji: '🥛', filtroRapido: 'Sin Lácteos' },
  { id: 'Frutos de cáscara', nombre: 'Frutos de cáscara', nombreCorto: 'F. cáscara', emoji: '🌰' },
  { id: 'Apio', nombre: 'Apio', nombreCorto: 'Apio', emoji: '🥬' },
  { id: 'Mostaza', nombre: 'Mostaza', nombreCorto: 'Mostaza', emoji: '🟡' },
  { id: 'Sésamo', nombre: 'Sésamo', nombreCorto: 'Sésamo', emoji: '⚪' },
  { id: 'Sulfitos', nombre: 'Sulfitos', nombreCorto: 'Sulfitos', emoji: '🍷' },
  { id: 'Altramuces', nombre: 'Altramuces', nombreCorto: 'Altramuces', emoji: '🌼' },
  { id: 'Moluscos', nombre: 'Moluscos', nombreCorto: 'Moluscos', emoji: '🦪' }
] as const;

export const FILTROS_RAPIDOS_PRINCIPALES = ['Gluten', 'Lácteos', 'Huevos'] as const;

export function normalizarListaAlergenos(valor: unknown): string[] {
  if (!Array.isArray(valor)) return [];
  const validos = new Set(ALERGENOS_OFICIALES.map((a) => a.id));
  const resultado: string[] = [];
  for (const item of valor) {
    const limpio = String(item || '').trim();
    if (validos.has(limpio) && !resultado.includes(limpio)) {
      resultado.push(limpio);
    }
  }
  return resultado;
}

export function cumpleFiltroAlergenos(
  alergenos: string[] | undefined,
  trazas: string[] | undefined,
  excluidos: string[],
  incluirTrazasEnFiltro: boolean = false
): boolean {
  if (excluidos.length === 0) return true;
  const pres = normalizarListaAlergenos(alergenos);
  const traz = normalizarListaAlergenos(trazas);
  for (const exc of excluidos) {
    if (pres.includes(exc)) return false;
    if (incluirTrazasEnFiltro && traz.includes(exc)) return false;
  }
  return true;
}

export function obtenerDefAlergeno(id: string): AlergenoDef | undefined {
  return ALERGENOS_OFICIALES.find((a) => a.id === id);
}
