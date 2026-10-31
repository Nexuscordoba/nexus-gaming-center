import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import {
  Coffee,
  CheckCircle2,
  Clock,
  ArrowLeft,
  Square,
  Wine,
  ChefHat,
  Layers,
  Lock
} from 'lucide-react';

interface ItemComanda {
  id?: string | number;
  producto_id?: number;
  nombre: string;
  cantidad: number;
  comentarios?: string;
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
  tipo_destino?: string;
  camarero_nombre?: string;
}

interface ItemAgrupado extends ItemComanda {
  comandaId: string;
  itemIdx: number;
  platoUid: string;
  tipo_destino: 'barra' | 'cocina';
  comandaEstado: Comanda['estado'];
  listoEnCocina: boolean;
  entregadoEnBarra: boolean;
  ticket_number?: string;
}

interface MesaAgrupada {
  mesa: string;
  created_at: string; // La fecha más antigua para calcular la urgencia
  items: ItemAgrupado[];
  itemsBarra: ItemAgrupado[];
  itemsCocina: ItemAgrupado[];
}

export default function BarDisplay() {
  const [comandasOriginales, setComandasOriginales] = useState<Comanda[]>([]);
  const [mesasAgrupadas, setMesasAgrupadas] = useState<MesaAgrupada[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroVista, setFiltroVista] = useState<'general' | 'barra' | 'cocina'>('general');
  const [procesandoKey, setProcesandoKey] = useState<string | null>(null);

  const resolverDestinoItem = useCallback((it: ItemComanda, comandaDestino?: string): 'barra' | 'cocina' => {
    const destRaw = String(it.destino || comandaDestino || 'barra').trim().toLowerCase();
    const catRaw = String(it.categoria || '').trim().toLowerCase();
    if (destRaw === 'cocina') return 'cocina';
    if (
      !it.destino &&
      !comandaDestino &&
      (catRaw.includes('cocina') ||
        catRaw.includes('tapa') ||
        catRaw.includes('comida') ||
        catRaw.includes('bocadillo') ||
        catRaw.includes('hamburguesa') ||
        catRaw.includes('racion') ||
        catRaw.includes('ración') ||
        catRaw.includes('plato'))
    ) {
      return 'cocina';
    }
    return 'barra';
  }, []);

  const cargarComandas = useCallback(async () => {
    const { data, error } = await supabase
      .from('comandas_cocina')
      .select('*')
      .neq('tipo_destino', 'cuenta')
      .in('estado', ['pendiente', 'listo'])
      .order('created_at', { ascending: true });

    if (!error && data) {
      setComandasOriginales(data as Comanda[]);
    }
    setLoading(false);
  }, []);

  const agruparPorMesa = useCallback(
    (data: Comanda[], filtroActual: 'general' | 'barra' | 'cocina') => {
      const grupos: Record<string, MesaAgrupada> = {};

      data.forEach((comanda) => {
        if (!grupos[comanda.mesa]) {
          grupos[comanda.mesa] = {
            mesa: comanda.mesa,
            created_at: comanda.created_at,
            items: [],
            itemsBarra: [],
            itemsCocina: []
          };
        }

        if (Array.isArray(comanda.items)) {
          comanda.items.forEach((it, idx) => {
            if (String(it.nombre || '').startsWith('🍲 LISTO PARA RECOGER:')) {
              return;
            }

            const destItem = resolverDestinoItem(it, comanda.tipo_destino);
            if (filtroActual === 'barra' && destItem !== 'barra') return;
            if (filtroActual === 'cocina' && destItem !== 'cocina') return;

            const esCocina = destItem === 'cocina';
            const listoEnCocina = esCocina
              ? Boolean(it.listo || it.estado_cocina === 'listo' || comanda.estado === 'listo')
              : true;
            const entregadoEnBarra = esCocina
              ? Boolean(it.entregado || it.estado_cocina === 'servido')
              : Boolean(it.entregado ?? it.listo);

            // Solo desaparece definitivamente del KDS cuando el camarero lo ha marcado como entregado
            if (entregadoEnBarra) {
              return;
            }

            const platoUid = `${comanda.id}_item_${it.id ?? it.producto_id ?? idx}_${idx}`;

            const itemConstruido: ItemAgrupado = {
              ...it,
              comandaId: comanda.id,
              itemIdx: idx,
              platoUid,
              tipo_destino: destItem,
              comandaEstado: comanda.estado,
              listoEnCocina,
              entregadoEnBarra,
              ticket_number: comanda.ticket_number
            };

            grupos[comanda.mesa].items.push(itemConstruido);
            if (esCocina) {
              grupos[comanda.mesa].itemsCocina.push(itemConstruido);
            } else {
              grupos[comanda.mesa].itemsBarra.push(itemConstruido);
            }
          });
        }
      });

      setMesasAgrupadas(Object.values(grupos).filter((g) => g.items.length > 0));
    },
    [resolverDestinoItem]
  );

  useEffect(() => {
    agruparPorMesa(comandasOriginales, filtroVista);
  }, [comandasOriginales, filtroVista, agruparPorMesa]);

  useEffect(() => {
    cargarComandas();

    const channel = supabase
      .channel('realtime-barra-kds-sync')
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
    }, 6000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [cargarComandas]);

  // Paso 2: Marcar ítem como entregado al cliente en la mesa (solo permitido si Barra o si Cocina ya está "Listo para servir")
  const entregarItemBarra = async (item: ItemAgrupado) => {
    if (item.tipo_destino === 'cocina' && !item.listoEnCocina) {
      return;
    }
    if (procesandoKey === item.platoUid) return;
    setProcesandoKey(item.platoUid);

    try {
      const comanda = comandasOriginales.find((c) => String(c.id) === String(item.comandaId));
      if (!comanda || !Array.isArray(comanda.items)) return;

      const nuevosItems: ItemComanda[] = comanda.items.map((it, idx) => {
        if (idx !== item.itemIdx) return { ...it };
        return {
          ...it,
          listo: true,
          entregado: true,
          estado_cocina: 'servido'
        };
      });

      const todosEntregados = nuevosItems.every((it) => {
        const dest = resolverDestinoItem(it, comanda.tipo_destino);
        return dest === 'cocina'
          ? Boolean(it.entregado || it.estado_cocina === 'servido')
          : Boolean(it.entregado ?? it.listo);
      });

      const todosListosEnCocina = nuevosItems.every((it) =>
        Boolean(it.listo || it.estado_cocina === 'listo' || it.estado_cocina === 'servido')
      );

      const nuevoEstado: Comanda['estado'] = todosEntregados
        ? 'servido'
        : todosListosEnCocina
        ? 'listo'
        : 'pendiente';

      // Actualización optimista en React
      setComandasOriginales((prev) =>
        prev
          .map((c) =>
            String(c.id) === String(item.comandaId)
              ? { ...c, items: nuevosItems, estado: nuevoEstado }
              : c
          )
          .filter((c) => c.estado !== 'servido')
      );

      await supabase
        .from('comandas_cocina')
        .update({ items: nuevosItems, estado: nuevoEstado })
        .eq('id', item.comandaId);

      await cargarComandas();
    } finally {
      setProcesandoKey(null);
    }
  };

  const archivarMesaCompleta = async (mesaGrupo: MesaAgrupada) => {
    const comandasDeMesa = comandasOriginales.filter((c) => c.mesa === mesaGrupo.mesa);

    const promesas = comandasDeMesa.map((c) => {
      const nuevosItems: ItemComanda[] = (c.items || []).map((it) => {
        const dest = resolverDestinoItem(it, c.tipo_destino);
        const listoCocina =
          dest === 'cocina'
            ? Boolean(it.listo || it.estado_cocina === 'listo' || c.estado === 'listo')
            : true;

        if (dest === 'cocina' && !listoCocina) {
          // Mantener intactos los platos que siguen en cocina pendientes
          return { ...it };
        }
        return {
          ...it,
          listo: true,
          entregado: true,
          estado_cocina: 'servido'
        };
      });

      const todosEntregados = nuevosItems.every((it) => {
        const dest = resolverDestinoItem(it, c.tipo_destino);
        return dest === 'cocina'
          ? Boolean(it.entregado || it.estado_cocina === 'servido')
          : Boolean(it.entregado ?? it.listo);
      });

      return supabase
        .from('comandas_cocina')
        .update({
          items: nuevosItems,
          estado: todosEntregados ? 'servido' : c.estado
        })
        .eq('id', c.id);
    });

    await Promise.all(promesas);
    await cargarComandas();
  };

  const volverAWebPrincipal = () => {
    if (window.location.hash) {
      window.location.hash = '';
    } else {
      window.location.href = 'https://nexusgamingcenter.es';
    }
  };

  const renderItemRow = (it: ItemAgrupado) => {
    const esCocina = it.tipo_destino === 'cocina';
    const bloqueadoPorCocina = esCocina && !it.listoEnCocina;
    const listoParaServirCocina = esCocina && it.listoEnCocina;

    return (
      <button
        key={it.platoUid}
        type="button"
        disabled={bloqueadoPorCocina || procesandoKey === it.platoUid}
        onClick={() => entregarItemBarra(it)}
        className={`w-full text-left p-3 rounded-xl border flex items-start justify-between gap-3 transition-all ${
          bloqueadoPorCocina
            ? 'bg-slate-900/60 border-slate-800 text-slate-500 opacity-65 cursor-not-allowed select-none'
            : listoParaServirCocina
            ? 'bg-emerald-950/35 border-emerald-500/60 hover:border-emerald-400 hover:bg-emerald-950/50 cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.15)]'
            : 'bg-black/40 border-white/10 hover:border-cyan-500/50 cursor-pointer'
        }`}
      >
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="mt-0.5 shrink-0">
            {bloqueadoPorCocina ? (
              <Lock className="h-4 w-4 text-slate-500" />
            ) : (
              <Square
                className={`h-5 w-5 ${
                  listoParaServirCocina ? 'text-emerald-400' : 'text-cyan-400'
                }`}
              />
            )}
          </div>
          <div className="min-w-0">
            <span
              className={`font-bold text-sm block break-words ${
                bloqueadoPorCocina
                  ? 'text-slate-400'
                  : listoParaServirCocina
                  ? 'text-emerald-200'
                  : 'text-white'
              }`}
            >
              <span
                className={`font-mono mr-1.5 ${
                  bloqueadoPorCocina
                    ? 'text-slate-500'
                    : listoParaServirCocina
                    ? 'text-emerald-400'
                    : 'text-cyan-400'
                }`}
              >
                {it.cantidad}x
              </span>
              {it.nombre}
            </span>
            {it.comentarios && (
              <p
                className={`text-[11px] italic mt-0.5 ${
                  bloqueadoPorCocina
                    ? 'text-slate-500'
                    : listoParaServirCocina
                    ? 'text-emerald-300/80'
                    : 'text-cyan-200/70'
                }`}
              >
                {it.comentarios}
              </p>
            )}
          </div>
        </div>

        <div className="shrink-0 flex flex-col items-end gap-1">
          {esCocina ? (
            bloqueadoPorCocina ? (
              <span className="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase bg-slate-800 text-slate-400 border border-slate-700 whitespace-nowrap">
                Esperando a cocina
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase bg-emerald-500 text-slate-950 shadow-md flex items-center gap-1 whitespace-nowrap">
                <CheckCircle2 className="h-3 w-3" />
                Listo para servir
              </span>
            )
          ) : (
            <span className="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 whitespace-nowrap">
              Servir Barra
            </span>
          )}
        </div>
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-[#050609] text-slate-100 p-4 sm:p-6 flex flex-col justify-between selection:bg-cyan-500 selection:text-black">
      <header className="border-b border-white/10 pb-4 mb-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 sticky top-0 bg-[#050609]/90 backdrop-blur-md z-30">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center">
            <Coffee className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-wide text-white">NEXUS KDS · PANTALLA DE BARRA</h1>
            <p className="text-xs text-slate-400">Chinales 45 · Comandas consolidadas por mesa (Barra & Cocina)</p>
          </div>
        </div>

        {/* Selector de pestaña / vista: Vista General, Solo Barra, Solo Cocina */}
        <div className="flex items-center gap-1.5 bg-white/5 p-1 rounded-2xl border border-white/10 flex-wrap">
          <button
            type="button"
            onClick={() => setFiltroVista('general')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
              filtroVista === 'general'
                ? 'bg-cyan-500 text-slate-950 shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Vista General</span>
          </button>
          <button
            type="button"
            onClick={() => setFiltroVista('barra')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
              filtroVista === 'barra'
                ? 'bg-cyan-500 text-slate-950 shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Coffee className="h-3.5 w-3.5" />
            <span>Solo Barra</span>
          </button>
          <button
            type="button"
            onClick={() => setFiltroVista('cocina')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
              filtroVista === 'cocina'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <ChefHat className="h-3.5 w-3.5" />
            <span>Solo Cocina</span>
          </button>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs font-mono text-cyan-400 bg-cyan-950/40 px-3.5 py-1.5 rounded-xl border border-cyan-500/20 hidden sm:inline">
            {mesasAgrupadas.length} Mesa(s) activas
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

      <main className="flex-1">
        {loading ? (
          <div className="text-center py-20 text-slate-500 text-sm">Sincronizando barra...</div>
        ) : mesasAgrupadas.length === 0 ? (
          <div className="text-center py-24 space-y-3">
            <Wine className="h-12 w-12 text-slate-600 mx-auto" />
            <p className="text-slate-400 text-base font-semibold">
              Todo servido. No hay pedidos pendientes en esta vista.
            </p>
          </div>
        ) : (
          <div
            className={`grid gap-6 ${
              filtroVista === 'general'
                ? 'grid-cols-1 xl:grid-cols-2'
                : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
            }`}
          >
            {mesasAgrupadas.map((mesaGrupo) => {
              const minutosTranscurridos = Math.floor(
                (new Date().getTime() - new Date(mesaGrupo.created_at).getTime()) / 60000
              );
              const esUrgente = minutosTranscurridos >= 7;
              const hayCocinaBloqueada = mesaGrupo.itemsCocina.some((it) => !it.listoEnCocina);
              const hayItemsDisponiblesParaServir =
                mesaGrupo.itemsBarra.length > 0 || mesaGrupo.itemsCocina.some((it) => it.listoEnCocina);

              return (
                <div
                  key={mesaGrupo.mesa}
                  className={`rounded-3xl border p-5 flex flex-col justify-between transition-all ${
                    esUrgente
                      ? 'bg-rose-950/20 border-rose-500/50 shadow-lg shadow-rose-900/20'
                      : 'bg-[#0c0e17] border-cyan-500/30 shadow-[0_0_20px_rgba(0,242,254,0.05)]'
                  }`}
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-white/10">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-xs font-black px-3 py-1 rounded-xl uppercase shadow-md ${
                            esUrgente ? 'bg-rose-500 text-white' : 'bg-cyan-500 text-slate-950'
                          }`}
                        >
                          {mesaGrupo.mesa}
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold bg-white/5 px-2 py-0.5 rounded-md">
                          {mesaGrupo.items.length} Ítems pendientes
                        </span>
                      </div>

                      <div
                        className={`flex items-center gap-1.5 text-xs font-mono font-bold ${
                          esUrgente ? 'text-rose-400 animate-pulse' : 'text-slate-300'
                        }`}
                      >
                        <Clock className="h-3.5 w-3.5" />
                        <span>{minutosTranscurridos} min</span>
                      </div>
                    </div>

                    {filtroVista === 'general' ? (
                      /* Vista Dividida (Split-Screen) dentro de la tarjeta de comanda */
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Sección Izquierda: Barra / Bebidas */}
                        <div className="rounded-2xl bg-cyan-950/10 border border-cyan-500/20 p-3.5 flex flex-col gap-2.5">
                          <div className="flex items-center justify-between pb-2 border-b border-cyan-500/20">
                            <div className="flex items-center gap-2 text-cyan-400 font-black text-xs uppercase tracking-wider">
                              <Coffee className="h-4 w-4" />
                              <span>Barra / Bebidas</span>
                            </div>
                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-cyan-500/15 text-cyan-300">
                              {mesaGrupo.itemsBarra.length}
                            </span>
                          </div>

                          {mesaGrupo.itemsBarra.length === 0 ? (
                            <div className="py-6 text-center text-xs text-slate-500 italic">
                              Sin bebidas pendientes
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {mesaGrupo.itemsBarra.map((it) => renderItemRow(it))}
                            </div>
                          )}
                        </div>

                        {/* Sección Derecha: Cocina / Platos */}
                        <div className="rounded-2xl bg-amber-950/10 border border-amber-500/20 p-3.5 flex flex-col gap-2.5">
                          <div className="flex items-center justify-between pb-2 border-b border-amber-500/20">
                            <div className="flex items-center gap-2 text-amber-400 font-black text-xs uppercase tracking-wider">
                              <ChefHat className="h-4 w-4" />
                              <span>Cocina / Platos</span>
                            </div>
                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300">
                              {mesaGrupo.itemsCocina.length}
                            </span>
                          </div>

                          {mesaGrupo.itemsCocina.length === 0 ? (
                            <div className="py-6 text-center text-xs text-slate-500 italic">
                              Sin platos pendientes
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {mesaGrupo.itemsCocina.map((it) => renderItemRow(it))}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* Vista individual para pestañas Solo Barra o Solo Cocina */
                      <div className="space-y-2">
                        {mesaGrupo.items.map((it) => renderItemRow(it))}
                      </div>
                    )}
                  </div>

                  <div className="mt-6 pt-3 border-t border-white/10">
                    <button
                      type="button"
                      disabled={!hayItemsDisponiblesParaServir}
                      onClick={() => archivarMesaCompleta(mesaGrupo)}
                      className={`w-full py-3.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all ${
                        !hayItemsDisponiblesParaServir
                          ? 'bg-slate-900 border border-slate-800 text-slate-500 opacity-60 cursor-not-allowed'
                          : hayCocinaBloqueada
                          ? 'bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 cursor-pointer'
                          : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 cursor-pointer'
                      }`}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {!hayItemsDisponiblesParaServir
                        ? 'Esperando a cocina para poder servir'
                        : hayCocinaBloqueada
                        ? 'Entregar disponibles (Cocina aún en preparación)'
                        : 'Marcar todo entregado en mesa'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <footer className="mt-8 border-t border-white/5 pt-4 text-center text-xs text-slate-500">
        NEXUS KDS · Módulo de Cafetería & Barra Consolidado
      </footer>
    </div>
  );
}
