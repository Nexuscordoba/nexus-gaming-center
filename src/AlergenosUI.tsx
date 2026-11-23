// src/AlergenosUI.tsx
import { useState, useMemo } from 'react';
import {
  ALERGENOS_OFICIALES,
  AVISO_LEGAL_CARTA,
  FILTROS_RAPIDOS_PRINCIPALES,
  normalizarListaAlergenos,
  obtenerDefAlergeno
} from './alergenos';
import { ShieldAlert, Filter, X, AlertTriangle, Check, Info, Search } from 'lucide-react';

export interface ProductoAlergenoTabla {
  id: string | number;
  nombre: string;
  categoria?: string;
  precioTexto?: string;
  alergenos?: string[];
  trazas?: string[];
}

export function AlergenosBadges({
  alergenos,
  trazas,
  compact = false
}: {
  alergenos?: string[];
  trazas?: string[];
  compact?: boolean;
}) {
  const pres = normalizarListaAlergenos(alergenos);
  const traz = normalizarListaAlergenos(trazas).filter((t) => !pres.includes(t));

  if (pres.length === 0 && traz.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
      {pres.map((id) => {
        const def = obtenerDefAlergeno(id);
        return (
          <span
            key={`pres-${id}`}
            title={`Contiene ${def?.nombre || id}`}
            className={`inline-flex items-center gap-1 rounded-md border border-rose-500/40 bg-rose-500/15 text-rose-200 font-semibold ${
              compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]'
            }`}
          >
            <span>{def?.emoji || '⚠️'}</span>
            <span>{compact ? def?.nombreCorto || id : def?.nombre || id}</span>
          </span>
        );
      })}
      {traz.map((id) => {
        const def = obtenerDefAlergeno(id);
        return (
          <span
            key={`traz-${id}`}
            title={`Puede contener trazas de ${def?.nombre || id}`}
            className={`inline-flex items-center gap-1 rounded-md border border-amber-500/35 bg-amber-500/10 text-amber-300 font-medium ${
              compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]'
            }`}
          >
            <span>{def?.emoji || '⚠️'}</span>
            <span>Trazas: {def?.nombreCorto || id}</span>
          </span>
        );
      })}
    </div>
  );
}

export function FiltroAlergenosBar({
  excluidos,
  onToggleExcluido,
  onLimpiarFiltros,
  incluirTrazas,
  onToggleIncluirTrazas,
  onAbrirTablaAlergenos,
  totalOcultos = 0
}: {
  excluidos: string[];
  onToggleExcluido: (alergenoId: string) => void;
  onLimpiarFiltros: () => void;
  incluirTrazas?: boolean;
  onToggleIncluirTrazas?: () => void;
  onAbrirTablaAlergenos: () => void;
  totalOcultos?: number;
}) {
  const [verTodos, setVerTodos] = useState(false);

  const principales = ALERGENOS_OFICIALES.filter((a) =>
    (FILTROS_RAPIDOS_PRINCIPALES as readonly string[]).includes(a.id)
  );
  const resto = ALERGENOS_OFICIALES.filter(
    (a) => !(FILTROS_RAPIDOS_PRINCIPALES as readonly string[]).includes(a.id)
  );

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0e1018]/90 backdrop-blur p-3.5 sm:p-4 space-y-3 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
          <Filter className="h-4 w-4 text-amber-400 shrink-0" />
          <span>Filtrar por intolerancias / alérgenos:</span>
          {excluidos.length > 0 && totalOcultos > 0 && (
            <span className="text-[11px] font-medium text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full">
              {totalOcultos} oculto{totalOcultos === 1 ? '' : 's'}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onAbrirTablaAlergenos}
          className="inline-flex items-center gap-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/50 text-amber-200 px-3.5 py-2 text-xs font-bold transition-all cursor-pointer shadow-sm"
        >
          <ShieldAlert className="h-4 w-4 text-amber-400 shrink-0" />
          <span>Tabla de Alérgenos e Info Legal</span>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {principales.map((al) => {
          const activo = excluidos.includes(al.id);
          return (
            <button
              key={al.id}
              type="button"
              onClick={() => onToggleExcluido(al.id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold border transition-all cursor-pointer ${
                activo
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                  : 'bg-white/[0.04] border-white/10 text-slate-300 hover:border-white/25 hover:text-white'
              }`}
            >
              <span>{al.emoji}</span>
              <span>{al.filtroRapido || `Sin ${al.nombre}`}</span>
              {activo && <Check className="h-3.5 w-3.5 text-emerald-400" />}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setVerTodos((prev) => !prev)}
          className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold border border-white/10 bg-white/[0.03] text-slate-400 hover:text-white hover:border-white/25 transition-all cursor-pointer"
        >
          <span>{verTodos ? 'Menos alérgenos' : '+ Otros 11 alérgenos'}</span>
        </button>

        {excluidos.length > 0 && (
          <button
            type="button"
            onClick={onLimpiarFiltros}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold text-rose-300 hover:text-rose-200 bg-rose-500/10 border border-rose-500/30 transition-all cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
            <span>Limpiar</span>
          </button>
        )}
      </div>

      {verTodos && (
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-white/[0.06]">
          {resto.map((al) => {
            const activo = excluidos.includes(al.id);
            return (
              <button
                key={al.id}
                type="button"
                onClick={() => onToggleExcluido(al.id)}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold border transition-all cursor-pointer ${
                  activo
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                    : 'bg-white/[0.03] border-white/10 text-slate-400 hover:text-white hover:border-white/25'
                }`}
              >
                <span>{al.emoji}</span>
                <span>Sin {al.nombre}</span>
                {activo && <Check className="h-3 w-3 text-emerald-400" />}
              </button>
            );
          })}
        </div>
      )}

      {excluidos.length > 0 && onToggleIncluirTrazas && (
        <label className="inline-flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer pt-1">
          <input
            type="checkbox"
            checked={Boolean(incluirTrazas)}
            onChange={onToggleIncluirTrazas}
            className="rounded border-slate-600 bg-slate-900 text-amber-500 focus:ring-amber-500"
          />
          <span>Ocultar también platos con posibles trazas de los alérgenos seleccionados</span>
        </label>
      )}
    </div>
  );
}

export function TablaAlergenosModal({
  abierto,
  onCerrar,
  productos,
  titulo = 'Tabla de Alérgenos e Información Legal'
}: {
  abierto: boolean;
  onCerrar: () => void;
  productos: ProductoAlergenoTabla[];
  titulo?: string;
}) {
  const [busqueda, setBusqueda] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('TODAS');

  const categorias = useMemo(() => {
    const setCat = new Set<string>();
    productos.forEach((p) => {
      if (p.categoria) setCat.add(p.categoria);
    });
    return ['TODAS', ...Array.from(setCat)];
  }, [productos]);

  const productosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return productos.filter((p) => {
      const okCat = categoriaFiltro === 'TODAS' || p.categoria === categoriaFiltro;
      const okQ = !q || p.nombre.toLowerCase().includes(q) || (p.categoria || '').toLowerCase().includes(q);
      return okCat && okQ;
    });
  }, [productos, busqueda, categoriaFiltro]);

  if (!abierto) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-sm p-0 sm:p-4"
      onClick={onCerrar}
    >
      <div
        className="w-full max-w-6xl max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-3xl border border-amber-500/30 bg-[#0c0e16] text-slate-200 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera fija */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-white/10 bg-[#111420]">
          <div>
            <div className="flex items-center gap-2 text-amber-400">
              <ShieldAlert className="h-5 w-5 shrink-0" />
              <h3 className="font-black text-white text-base sm:text-lg">{titulo}</h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Reglamento (UE) nº 1169/2011 · 14 alérgenos de declaración obligatoria
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="text-slate-400 hover:text-white p-1.5 rounded-xl bg-white/5 hover:bg-white/10 cursor-pointer"
            aria-label="Cerrar tabla de alérgenos"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Leyenda y Aviso Legal */}
        <div className="px-5 py-3 bg-amber-950/20 border-b border-amber-500/20 space-y-2.5">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-200 font-bold">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-rose-400" />
              Contiene (Presente en el plato)
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-200 font-bold">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400" />
              Trazas por cocina compartida
            </span>
          </div>

          <div className="flex items-start gap-2 rounded-xl border border-white/10 bg-[#08090d]/80 p-3 text-xs text-slate-300 leading-relaxed">
            <Info className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <p>{AVISO_LEGAL_CARTA}</p>
          </div>
        </div>

        {/* Buscador y filtro de categoría */}
        <div className="px-5 py-3 border-b border-white/[0.06] flex flex-col sm:flex-row gap-2.5 bg-[#0c0e16]">
          <div className="relative flex-1">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar plato o producto..."
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
          </div>
          {categorias.length > 2 && (
            <select
              value={categoriaFiltro}
              onChange={(e) => setCategoriaFiltro(e.target.value)}
              className="bg-[#141724] border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
            >
              {categorias.map((c) => (
                <option key={c} value={c}>
                  {c === 'TODAS' ? 'Todas las familias' : c}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Contenido scrollable: Tabla en desktop + Tarjetas claras en móvil */}
        <div className="flex-1 overflow-auto p-4 sm:p-5">
          {productosFiltrados.length === 0 ? (
            <div className="text-center py-10 text-sm text-slate-400">
              No se encontraron productos con ese criterio.
            </div>
          ) : (
            <>
              {/* Vista móvil */}
              <div className="space-y-3 md:hidden">
                {productosFiltrados.map((prod) => {
                  const pres = normalizarListaAlergenos(prod.alergenos);
                  const traz = normalizarListaAlergenos(prod.trazas).filter((t) => !pres.includes(t));
                  return (
                    <div
                      key={prod.id}
                      className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-sm text-white">{prod.nombre}</div>
                          {prod.categoria && (
                            <div className="text-[11px] text-slate-400">{prod.categoria}</div>
                          )}
                        </div>
                        {prod.precioTexto && (
                          <span className="text-xs font-bold text-amber-300 shrink-0">
                            {prod.precioTexto}
                          </span>
                        )}
                      </div>
                      {pres.length === 0 && traz.length === 0 ? (
                        <div className="text-[11px] text-emerald-300">
                          Sin alérgenos declarados (consulta por trazas en cocina compartida)
                        </div>
                      ) : (
                        <AlergenosBadges alergenos={pres} trazas={traz} />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Vista tabla desktop */}
              <div className="hidden md:block overflow-x-auto rounded-2xl border border-white/10">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-[#141724] text-slate-300 sticky top-0 z-10">
                    <tr>
                      <th className="py-3 px-3 font-bold border-b border-white/10 min-w-[210px]">
                        Producto / Plato
                      </th>
                      {ALERGENOS_OFICIALES.map((al) => (
                        <th
                          key={al.id}
                          className="py-2.5 px-1.5 text-center font-semibold border-b border-white/10 min-w-[54px]"
                          title={al.nombre}
                        >
                          <div className="text-base leading-none">{al.emoji}</div>
                          <div className="text-[10px] text-slate-400 mt-1 leading-tight">
                            {al.nombreCorto}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {productosFiltrados.map((prod) => {
                      const pres = normalizarListaAlergenos(prod.alergenos);
                      const traz = normalizarListaAlergenos(prod.trazas).filter((t) => !pres.includes(t));
                      return (
                        <tr key={prod.id} className="hover:bg-white/[0.03] transition-colors">
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-white">{prod.nombre}</div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-2">
                              {prod.categoria && <span>{prod.categoria}</span>}
                              {prod.precioTexto && (
                                <span className="text-amber-300 font-bold">{prod.precioTexto}</span>
                              )}
                            </div>
                          </td>
                          {ALERGENOS_OFICIALES.map((al) => {
                            const tiene = pres.includes(al.id);
                            const esTraza = !tiene && traz.includes(al.id);
                            return (
                              <td key={al.id} className="py-2 px-1 text-center">
                                {tiene ? (
                                  <span
                                    title={`Contiene ${al.nombre}`}
                                    className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-rose-500/25 border border-rose-400/60 text-rose-200 font-black text-[11px]"
                                  >
                                    ●
                                  </span>
                                ) : esTraza ? (
                                  <span
                                    title={`Posibles trazas de ${al.nombre}`}
                                    className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20 border border-amber-400/50 text-amber-300 font-black text-[11px]"
                                  >
                                    ◐
                                  </span>
                                ) : (
                                  <span className="text-slate-700">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Pie */}
        <div className="px-5 py-3 border-t border-white/10 bg-[#111420] flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <span>Si tienes alergia severa, avisa siempre al personal antes de pedir.</span>
          </span>
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-xl bg-amber-500 hover:bg-amber-400 px-5 py-2 text-xs font-bold text-slate-950 cursor-pointer"
          >
            Entendido / Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

export function SelectorAlergenosChips({
  alergenos,
  trazas,
  onChangeAlergenos,
  onChangeTrazas
}: {
  alergenos: string[];
  trazas: string[];
  onChangeAlergenos: (next: string[]) => void;
  onChangeTrazas: (next: string[]) => void;
}) {
  const pres = normalizarListaAlergenos(alergenos);
  const traz = normalizarListaAlergenos(trazas);

  const toggleAlergeno = (id: string) => {
    if (pres.includes(id)) {
      onChangeAlergenos(pres.filter((x) => x !== id));
    } else {
      onChangeAlergenos([...pres, id]);
      // Si se marca como presente, lo quitamos de trazas para no duplicar
      if (traz.includes(id)) {
        onChangeTrazas(traz.filter((x) => x !== id));
      }
    }
  };

  const toggleTraza = (id: string) => {
    if (traz.includes(id)) {
      onChangeTrazas(traz.filter((x) => x !== id));
    } else {
      onChangeTrazas([...traz, id]);
      // Si se marca como traza, lo quitamos de presentes
      if (pres.includes(id)) {
        onChangeAlergenos(pres.filter((x) => x !== id));
      }
    }
  };

  return (
    <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-3">
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-[11px] font-black uppercase text-rose-300 flex items-center gap-1.5">
            <span>●</span> Alérgenos presentes (Reglamento UE 1169/2011)
          </span>
          {pres.length > 0 && (
            <button
              type="button"
              onClick={() => onChangeAlergenos([])}
              className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
            >
              Limpiar ({pres.length})
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ALERGENOS_OFICIALES.map((al) => {
            const activo = pres.includes(al.id);
            return (
              <button
                key={`al-${al.id}`}
                type="button"
                onClick={() => toggleAlergeno(al.id)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all cursor-pointer ${
                  activo
                    ? 'bg-rose-500/25 border-rose-400 text-rose-100 shadow-sm'
                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500'
                }`}
              >
                <span>{al.emoji}</span>
                <span>{al.nombre}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="pt-2 border-t border-slate-800/80">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-[11px] font-black uppercase text-amber-300 flex items-center gap-1.5">
            <span>◐</span> Posibles trazas (Cocina compartida)
          </span>
          {traz.length > 0 && (
            <button
              type="button"
              onClick={() => onChangeTrazas([])}
              className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
            >
              Limpiar ({traz.length})
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ALERGENOS_OFICIALES.map((al) => {
            const activo = traz.includes(al.id);
            return (
              <button
                key={`tr-${al.id}`}
                type="button"
                onClick={() => toggleTraza(al.id)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all cursor-pointer ${
                  activo
                    ? 'bg-amber-500/25 border-amber-400 text-amber-100 shadow-sm'
                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500'
                }`}
              >
                <span>{al.emoji}</span>
                <span>{al.nombre}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
