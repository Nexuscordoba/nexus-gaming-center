import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from './supabase';
import {
  ChefHat,
  CheckCircle2,
  Clock,
  Flame,
  Utensils,
  ArrowLeft,
  CheckSquare,
  Square,
  RotateCcw,
  Layers
} from 'lucide-react';

interface ItemComanda {
  id?: string | number;
  producto_id?: number;
  nombre: string;
  cantidad: number;
  comentarios?: string;
  es_menu?: boolean;
  listo?: boolean;
  entregado?: boolean;
  estado_cocina?: 'pendiente' | 'en_preparacion' | 'listo' | 'servido';
  destino?: string;
  categoria?: string;
}

interface Comanda {
  id: string;
  ticket_number: string;
  mesa: string;
  created_at: string;
  items: ItemComanda[];
  estado: 'pendiente' | 'listo' | 'servido';
  tipo_destino: string;
}

interface GrupoPlatoConHijos {
  padre: ItemComanda;
  padreIdx: number;
  hijos: Array<{ item: ItemComanda; idx: number }>;
}

const obtenerIconoLote = (nombre: string): string => {
  const n = nombre.toLowerCase();
  if (n.includes('hamburguesa') || n.includes('burger')) return '🍔';
  if (n.includes('patata') || n.includes('brava') || n.includes('frita')) return '🍟';
  if (n.includes('bocadillo') || n.includes('campero') || n.includes('flauta') || n.includes('sandwich')) return '🥖';
  if (n.includes('tostada') || n.includes('mollete') || n.includes('croissant')) return '🥐';
  if (n.includes('ensalada')) return '🥗';
  if (n.includes('pizza')) return '🍕';
  if (n.includes('croqueta') || n.includes('racion') || n.includes('ración') || n.includes('tapa')) return '🍲';
  if (n.includes('postre') || n.includes('tarta') || n.includes('gofre') || n.includes('tortita')) return '🍰';
  return '🍳';
};

export default function KitchenDisplay() {
  const [comandas, setComandas] = useState<Comanda[]>([]);
  const [loading, setLoading] = useState(true);
  const [procesandoKey, setProcesandoKey] = useState<string | null>(null);
  const [ahoraMs, setAhoraMs] = useState<number>(() => Date.now());

  const comandasPreviasIdsRef = useRef<Set<string>>(new Set());
  const audioInicializadoRef = useRef<boolean>(false);

  // Sintetizador de campana de cocina mediante Web Audio API (sin archivos externos)
  const reproducirCampanaCocina = useCallback(() => {
    try {
      const AudioCtx =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      // Golpe metálico de campana de pase de cocina (dos parciales inarmónicos + fundamental aguda)
      const frecuencias = [1046.5, 1567.98, 2093.0];
      frecuencias.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = i === 0 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(i === 0 ? 0.18 : 0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.65);
      });

      setTimeout(() => {
        ctx.close().catch(() => {});
      }, 750);
    } catch (err) {
      console.warn('AudioContext no disponible en KDS Cocina:', err);
    }
  }, []);

  const esItemCocina = useCallback((it: ItemComanda, tipoDestinoComanda?: string): boolean => {
    const destItem = String(it.destino || tipoDestinoComanda || '').trim().toLowerCase();
    const catItem = String(it.categoria || '').trim().toLowerCase();
    if (destItem === 'cocina') return true;
    if (
      !it.destino &&
      (catItem.includes('cocina') ||
        catItem.includes('tapa') ||
        catItem.includes('comida') ||
        catItem.includes('bocadillo') ||
        catItem.includes('hamburguesa') ||
        catItem.includes('racion') ||
        catItem.includes('ración') ||
        catItem.includes('plato'))
    ) {
      return true;
    }
    return false;
  }, []);

  const cargarComandas = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('comandas_cocina')
        .select('*')
        .neq('tipo_destino', 'cuenta')
        .in('estado', ['pendiente', 'listo'])
        .order('created_at', { ascending: true });

      if (!error && data) {
        const filtradasCocina = (data as Comanda[]).filter((c) => {
          const tieneItemsCocina =
            String(c.tipo_destino || '').trim().toLowerCase() === 'cocina' ||
            (Array.isArray(c.items) && c.items.some((it) => esItemCocina(it, c.tipo_destino)));

          if (!tieneItemsCocina) return false;

          // Mantener visible mientras exista al menos un plato de cocina que no haya sido entregado por el camarero
          const itemsReales = Array.isArray(c.items) ? c.items : [];
          const todosEntregados =
            itemsReales.length > 0 &&
            itemsReales.every((it) => Boolean(it.entregado) || it.estado_cocina === 'servido');

          return !todosEntregados;
        });

        const idsActuales = new Set<string>(filtradasCocina.map((c) => String(c.id)));
        let hayNuevaComanda = false;
        if (audioInicializadoRef.current) {
          idsActuales.forEach((id) => {
            if (!comandasPreviasIdsRef.current.has(id)) {
              hayNuevaComanda = true;
            }
          });
        }
        comandasPreviasIdsRef.current = idsActuales;
        if (!audioInicializadoRef.current) {
          audioInicializadoRef.current = true;
        } else if (hayNuevaComanda) {
          reproducirCampanaCocina();
        }

        setComandas(filtradasCocina);
      }
    } catch (err) {
      console.error('Error al cargar comandas en Cocina:', err);
    } finally {
      setLoading(false);
    }
  }, [esItemCocina, reproducirCampanaCocina]);

  useEffect(() => {
    cargarComandas();

    const channel = supabase
      .channel('realtime-cocina-kds-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comandas_cocina' },
        () => {
          cargarComandas();
        }
      )
      .subscribe();

    const interval = setInterval(() => {
      cargarComandas();
    }, 5000);

    const clockInterval = setInterval(() => {
      setAhoraMs(Date.now());
    }, 10000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
      clearInterval(clockInterval);
    };
  }, [cargarComandas]);

  // Paso 1: Marcar o desmarcar un plato (y sus modificadores ├─ asociados) como "Listo"
  const marcarPlatoListo = async (
    comandaId: string,
    itemIdx: number,
    platoUid: string,
    indicesHijos: number[] = []
  ) => {
    if (procesandoKey === platoUid) return;
    setProcesandoKey(platoUid);

    try {
      const comandaActual = comandas.find((c) => String(c.id) === String(comandaId));
      if (!comandaActual || !Array.isArray(comandaActual.items) || !comandaActual.items[itemIdx]) {
        return;
      }

      const itemObjetivo = comandaActual.items[itemIdx];
      const estaListoAhora = Boolean(itemObjetivo.listo || itemObjetivo.estado_cocina === 'listo');
      const nuevoEstadoListo = !estaListoAhora;
      const indicesAActualizar = new Set<number>([itemIdx, ...indicesHijos]);

      const nuevosItems = comandaActual.items.map((item, idx) => {
        if (!indicesAActualizar.has(idx)) return { ...item };
        return {
          ...item,
          listo: nuevoEstadoListo,
          estado_cocina: (nuevoEstadoListo ? 'listo' : 'pendiente') as ItemComanda['estado_cocina'],
          entregado: nuevoEstadoListo ? Boolean(item.entregado) : false
        };
      });

      const todosListosEnCocina = nuevosItems.every((it) =>
        Boolean(it.listo || it.estado_cocina === 'listo' || it.entregado || it.estado_cocina === 'servido')
      );
      const nuevoEstadoComanda: Comanda['estado'] = todosListosEnCocina ? 'listo' : 'pendiente';

      setComandas((prev) =>
        prev.map((c) =>
          String(c.id) === String(comandaId)
            ? { ...c, items: nuevosItems, estado: nuevoEstadoComanda }
            : c
        )
      );

      const { error } = await supabase
        .from('comandas_cocina')
        .update({
          items: nuevosItems,
          estado: nuevoEstadoComanda
        })
        .eq('id', comandaId);

      if (error) {
        console.error('Error al actualizar estado del plato en cocina:', error);
      }

      await cargarComandas();
    } finally {
      setProcesandoKey(null);
    }
  };

  // Paso 2: Marcar toda la comanda como lista, o revertirla a pendiente si ya estaba lista ("Deshacer / Revertir")
  const alternarTodaComandaLista = async (comandaId: string, revertirAPendiente: boolean) => {
    const lockId = `all_${comandaId}`;
    if (procesandoKey === lockId) return;
    setProcesandoKey(lockId);

    try {
      const comandaActual = comandas.find((c) => String(c.id) === String(comandaId));
      if (!comandaActual || !Array.isArray(comandaActual.items)) return;

      const nuevoEstadoItem: ItemComanda['estado_cocina'] = revertirAPendiente ? 'pendiente' : 'listo';
      const nuevoEstadoComanda: Comanda['estado'] = revertirAPendiente ? 'pendiente' : 'listo';

      const nuevosItems: ItemComanda[] = comandaActual.items.map((item) => {
        if (Boolean(item.entregado) || item.estado_cocina === 'servido') {
          return { ...item };
        }
        return {
          ...item,
          listo: !revertirAPendiente,
          estado_cocina: nuevoEstadoItem,
          entregado: false
        };
      });

      setComandas((prev) =>
        prev.map((c) =>
          String(c.id) === String(comandaId)
            ? { ...c, items: nuevosItems, estado: nuevoEstadoComanda }
            : c
        )
      );

      const { error } = await supabase
        .from('comandas_cocina')
        .update({
          items: nuevosItems,
          estado: nuevoEstadoComanda
        })
        .eq('id', comandaId);

      if (error) {
        console.error('Error al actualizar comanda completa en cocina:', error);
      }

      await cargarComandas();
    } finally {
      setProcesandoKey(null);
    }
  };

  // Totalizador de Producción por Lotes (All-Day Counter) de platos pendientes (!it.listo)
  const lotesPendientes = useMemo(() => {
    const mapa = new Map<string, number>();
    comandas.forEach((comanda) => {
      (comanda.items || []).forEach((it) => {
        const nombreLimpio = String(it.nombre || '').trim();
        if (!nombreLimpio || nombreLimpio.startsWith('🍲 LISTO PARA RECOGER:') || nombreLimpio.includes('├─')) {
          return;
        }
        if (!esItemCocina(it, comanda.tipo_destino)) return;
        const estaListoOEntregado = Boolean(
          it.listo || it.estado_cocina === 'listo' || it.entregado || it.estado_cocina === 'servido'
        );
        if (estaListoOEntregado) return;

        const cant = Number(it.cantidad) || 1;
        mapa.set(nombreLimpio, (mapa.get(nombreLimpio) || 0) + cant);
      });
    });

    return Array.from(mapa.entries())
      .map(([nombre, total]) => ({ nombre, total, icono: obtenerIconoLote(nombre) }))
      .sort((a, b) => b.total - a.total);
  }, [comandas, esItemCocina]);

  // Auto-ordenar: primero las comandas con platos pendientes (más antiguas arriba), y al final las ya listas
  const comandasOrdenadas = useMemo(() => {
    return [...comandas].sort((a, b) => {
      const aTodosListos =
        Array.isArray(a.items) &&
        a.items.length > 0 &&
        a.items.every((it) => Boolean(it.listo || it.estado_cocina === 'listo' || it.entregado || it.estado_cocina === 'servido'));
      const bTodosListos =
        Array.isArray(b.items) &&
        b.items.length > 0 &&
        b.items.every((it) => Boolean(it.listo || it.estado_cocina === 'listo' || it.entregado || it.estado_cocina === 'servido'));

      if (aTodosListos !== bTodosListos) {
        return aTodosListos ? 1 : -1;
      }
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }, [comandas]);

  const agruparItemsConModificadores = (items: ItemComanda[]): GrupoPlatoConHijos[] => {
    const grupos: GrupoPlatoConHijos[] = [];
    items.forEach((it, idx) => {
      const nombre = String(it.nombre || '');
      if (nombre.startsWith('🍲 LISTO PARA RECOGER:')) return;
      if (Boolean(it.entregado || it.estado_cocina === 'servido')) return;

      if (nombre.includes('├─') && grupos.length > 0) {
        grupos[grupos.length - 1].hijos.push({ item: it, idx });
      } else {
        grupos.push({ padre: it, padreIdx: idx, hijos: [] });
      }
    });
    return grupos;
  };

  const volverAWebPrincipal = () => {
    if (window.location.hash) {
      window.location.hash = '';
    } else {
      window.location.href = 'https://nexusgamingcenter.es';
    }
  };

  return (
    <div className="min-h-screen bg-[#050609] text-slate-100 p-4 sm:p-6 flex flex-col justify-between selection:bg-amber-500 selection:text-black">
      <header className="border-b border-white/10 pb-4 mb-4 flex items-center justify-between sticky top-0 bg-[#050609]/95 backdrop-blur-md z-30">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
            <ChefHat className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-wide text-white">NEXUS KDS · PANTALLA DE COCINA</h1>
            <p className="text-xs text-slate-400">Chinales 45 · Selección táctil rápida y control de lotes en tiempo real</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs font-mono text-amber-400 bg-amber-950/40 px-3.5 py-1.5 rounded-xl border border-amber-500/20 hidden sm:inline">
            {comandas.filter((c) => c.estado === 'pendiente').length} Comanda(s) en fuego
          </span>

          <button
            type="button"
            onClick={volverAWebPrincipal}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs text-slate-300 hover:text-white transition-all cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Volver a la web</span>
          </button>
        </div>
      </header>

      {/* 1. BARRA SUPERIOR DE TOTALIZADOR DE PRODUCCIÓN POR LOTES (ALL-DAY COUNTER) */}
      {lotesPendientes.length > 0 && (
        <section className="mb-6 p-3.5 rounded-2xl bg-[#0b0d14] border border-amber-500/30 shadow-lg">
          <div className="flex items-center gap-2 mb-2.5 text-[11px] font-black uppercase tracking-wider text-amber-400">
            <Layers className="h-4 w-4" />
            <span>Totalizador en Fuego (Producción por Lotes Pendientes)</span>
          </div>
          <div className="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-none flex-wrap">
            {lotesPendientes.map((lote) => (
              <div
                key={lote.nombre}
                className="px-3.5 py-2 rounded-xl bg-amber-500/15 border border-amber-500/40 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shrink-0 shadow-sm"
              >
                <span>{lote.icono}</span>
                <span className="text-slate-100">{lote.nombre}:</span>
                <span className="px-2 py-0.5 rounded-lg bg-amber-500 text-slate-950 font-mono font-black text-sm">
                  {lote.total}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <main className="flex-1">
        {loading ? (
          <div className="text-center py-20 text-slate-500 text-sm">Sincronizando cocina...</div>
        ) : comandasOrdenadas.length === 0 ? (
          <div className="text-center py-24 space-y-3">
            <Utensils className="h-12 w-12 text-slate-600 mx-auto" />
            <p className="text-slate-400 text-base font-semibold">¡Todo al día! No hay platos pendientes en cocina.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {comandasOrdenadas.map((comanda) => {
              const minutosTranscurridos = Math.max(
                0,
                Math.floor((ahoraMs - new Date(comanda.created_at).getTime()) / 60000)
              );
              const todosPlatosListos =
                Array.isArray(comanda.items) &&
                comanda.items.length > 0 &&
                comanda.items.every((it) =>
                  Boolean(it.listo || it.estado_cocina === 'listo' || it.entregado || it.estado_cocina === 'servido')
                );

              // Semáforo SLA en 3 fases: 0-6 min (En tiempo), 7-11 min (Preventivo), +12 min (Crítico)
              const faseSla: 'en_tiempo' | 'preventivo' | 'critico' =
                minutosTranscurridos >= 12
                  ? 'critico'
                  : minutosTranscurridos >= 7
                  ? 'preventivo'
                  : 'en_tiempo';

              const porcentajeBarraSla = Math.min(100, Math.round((minutosTranscurridos / 12) * 100));

              const clasesTarjeta = todosPlatosListos
                ? 'bg-emerald-950/20 border-emerald-500/40 opacity-75 hover:opacity-100'
                : faseSla === 'critico'
                ? 'bg-rose-950/35 border-rose-500/80 shadow-[0_0_25px_rgba(244,63,94,0.2)] animate-pulse'
                : faseSla === 'preventivo'
                ? 'bg-amber-950/35 border-amber-500/70 shadow-[0_0_20px_rgba(245,158,11,0.15)]'
                : 'bg-[#0c0e17] border-white/10';

              const gruposPlatos = agruparItemsConModificadores(comanda.items || []);

              return (
                <div
                  key={comanda.id}
                  className={`rounded-3xl border overflow-hidden flex flex-col justify-between transition-all ${clasesTarjeta}`}
                >
                  {/* Barra de progreso superior SLA */}
                  <div className="w-full h-1.5 bg-white/5 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        todosPlatosListos
                          ? 'bg-emerald-500 w-full'
                          : faseSla === 'critico'
                          ? 'bg-rose-500'
                          : faseSla === 'preventivo'
                          ? 'bg-amber-400'
                          : 'bg-emerald-400'
                      }`}
                      style={{ width: `${todosPlatosListos ? 100 : Math.max(10, porcentajeBarraSla)}%` }}
                    />
                  </div>

                  <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-white/10 gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-xs font-black px-3 py-1 rounded-xl uppercase shadow-md ${
                              todosPlatosListos
                                ? 'bg-emerald-500 text-slate-950'
                                : faseSla === 'critico'
                                ? 'bg-rose-500 text-white'
                                : 'bg-amber-500 text-slate-950'
                            }`}
                          >
                            {comanda.mesa}
                          </span>
                          <span className="text-xs text-slate-400 font-mono">#{comanda.ticket_number}</span>
                          {todosPlatosListos && (
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                              ✓ Listo en Barra
                            </span>
                          )}
                        </div>

                        <div
                          className={`flex items-center gap-1.5 text-xs font-mono font-bold px-2.5 py-1 rounded-xl border ${
                            todosPlatosListos
                              ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                              : faseSla === 'critico'
                              ? 'bg-rose-500/25 border-rose-500/60 text-rose-300'
                              : faseSla === 'preventivo'
                              ? 'bg-amber-500/25 border-amber-500/50 text-amber-300'
                              : 'bg-white/5 border-white/10 text-slate-300'
                          }`}
                        >
                          <Clock className="h-3.5 w-3.5" />
                          <span>{minutosTranscurridos} min</span>
                        </div>
                      </div>

                      {/* Lista de platos 100% táctiles con modificadores de combo indentados */}
                      <div className="space-y-2.5">
                        {gruposPlatos.map(({ padre, padreIdx, hijos }) => {
                          const platoUid = `${comanda.id}_item_${padre.id ?? padre.producto_id ?? padreIdx}_${padreIdx}`;
                          const estaListo = Boolean(padre.listo || padre.estado_cocina === 'listo');
                          const indicesHijos = hijos.map((h) => h.idx);

                          return (
                            <button
                              key={platoUid}
                              type="button"
                              disabled={procesandoKey === platoUid}
                              onClick={() => marcarPlatoListo(comanda.id, padreIdx, platoUid, indicesHijos)}
                              className={`w-full text-left p-4 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-3 active:scale-[0.99] ${
                                estaListo
                                  ? 'bg-emerald-950/50 border-emerald-500/70 text-emerald-200'
                                  : 'bg-black/60 border-white/15 hover:border-amber-400 text-white shadow-md'
                              }`}
                            >
                              <div className="flex items-start gap-3 min-w-0 flex-1">
                                <div className="mt-0.5 shrink-0">
                                  {estaListo ? (
                                    <CheckSquare className="h-6 w-6 text-emerald-400" />
                                  ) : (
                                    <Square className="h-6 w-6 text-amber-400" />
                                  )}
                                </div>
                                <div className="space-y-1.5 min-w-0 flex-1">
                                  <span
                                    className={`font-black text-base sm:text-lg block break-words leading-snug ${
                                      estaListo ? 'line-through text-emerald-300/90' : 'text-white'
                                    }`}
                                  >
                                    <span className="text-amber-400 font-mono mr-2">{padre.cantidad}x</span>
                                    {padre.nombre}
                                  </span>

                                  {hijos.length > 0 && (
                                    <div className="pl-3 border-l-2 border-amber-500/40 space-y-1 mt-1">
                                      {hijos.map(({ item: hijo, idx: hIdx }) => (
                                        <span
                                          key={`${platoUid}_hijo_${hIdx}`}
                                          className={`block text-xs font-bold ${
                                            estaListo ? 'text-emerald-300/75' : 'text-amber-200'
                                          }`}
                                        >
                                          {hijo.nombre}
                                        </span>
                                      ))}
                                    </div>
                                  )}

                                  {padre.comentarios && (
                                    <p className="text-xs text-rose-300 font-semibold italic flex items-center gap-1 pt-0.5">
                                      <Flame className="h-3.5 w-3.5 shrink-0 text-rose-400" /> {padre.comentarios}
                                    </p>
                                  )}
                                </div>
                              </div>

                              <span
                                className={`shrink-0 text-[10px] font-black uppercase px-2.5 py-1 rounded-xl border ${
                                  estaListo
                                    ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                                    : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                }`}
                              >
                                {estaListo ? 'Listo' : 'Pendiente'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-white/10">
                      <button
                        type="button"
                        disabled={procesandoKey === `all_${comanda.id}`}
                        onClick={() => alternarTodaComandaLista(comanda.id, todosPlatosListos)}
                        className={`w-full py-3.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer active:scale-95 disabled:opacity-50 ${
                          todosPlatosListos
                            ? 'bg-slate-800 hover:bg-rose-950/60 border border-emerald-500/40 hover:border-rose-500/50 text-emerald-300 hover:text-rose-200'
                            : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                        }`}
                      >
                        {todosPlatosListos ? (
                          <>
                            <RotateCcw className="h-4 w-4" />
                            <span>↩️ Revertir a Pendiente</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-4 w-4" />
                            <span>Marcar Todo Listo para Servir</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <footer className="mt-8 border-t border-white/5 pt-4 text-center text-xs text-slate-500">
        NEXUS KDS · Módulo de Cocina sincronizado en tiempo real con Barra
      </footer>
    </div>
  );
}
