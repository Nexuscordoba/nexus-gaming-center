import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { Coffee, CheckCircle2, Clock, ArrowLeft, CheckSquare, Square, Wine, ChefHat, Layers } from 'lucide-react';

interface ItemComanda {
  nombre: string;
  cantidad: number;
  comentarios?: string;
  listo?: boolean;
  destino?: string;
  categoria?: string;
}

interface Comanda {
  id: string;
  ticket_number: string;
  mesa: string;
  created_at: string;
  items: ItemComanda[];
  estado: 'pendiente' | 'en_preparacion' | 'listo' | 'servido';
  tipo_destino?: string;
  camarero_nombre?: string;
}

interface ItemAgrupado extends ItemComanda {
  comandaId: string;
  itemIdx: number;
  tipo_destino: 'barra' | 'cocina';
  ticket_number?: string;
}

interface MesaAgrupada {
  mesa: string;
  created_at: string; // La fecha más antigua para calcular la urgencia
  items: ItemAgrupado[];
}

export default function BarDisplay() {
  const [comandasOriginales, setComandasOriginales] = useState<Comanda[]>([]);
  const [mesasAgrupadas, setMesasAgrupadas] = useState<MesaAgrupada[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroVista, setFiltroVista] = useState<'general' | 'barra' | 'cocina'>('general');

  const resolverDestinoItem = (it: ItemComanda, comandaDestino?: string): 'barra' | 'cocina' => {
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
  };

  const cargarComandas = async () => {
    const { data } = await supabase
      .from('comandas_cocina')
      .select('*')
      .neq('tipo_destino', 'cuenta')
      .in('estado', ['pendiente', 'en_preparacion', 'listo'])
      .order('created_at', { ascending: true });

    if (data) {
      setComandasOriginales(data as Comanda[]);
    }
    setLoading(false);
  };

  const agruparPorMesa = (data: Comanda[], filtroActual: 'general' | 'barra' | 'cocina') => {
    const grupos: Record<string, MesaAgrupada> = {};

    data.forEach((comanda) => {
      if (!grupos[comanda.mesa]) {
        grupos[comanda.mesa] = {
          mesa: comanda.mesa,
          created_at: comanda.created_at,
          items: []
        };
      }

      if (Array.isArray(comanda.items)) {
        comanda.items.forEach((it, idx) => {
          const destItem = resolverDestinoItem(it, comanda.tipo_destino);
          if (filtroActual === 'barra' && destItem !== 'barra') return;
          if (filtroActual === 'cocina' && destItem !== 'cocina') return;

          grupos[comanda.mesa].items.push({
            ...it,
            comandaId: comanda.id,
            itemIdx: idx,
            tipo_destino: destItem,
            ticket_number: comanda.ticket_number
          });
        });
      }
    });

    setMesasAgrupadas(Object.values(grupos).filter((g) => g.items.length > 0));
  };

  useEffect(() => {
    agruparPorMesa(comandasOriginales, filtroVista);
  }, [comandasOriginales, filtroVista]);

  useEffect(() => {
    cargarComandas();

    const channel = supabase
      .channel('realtime-barra')
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
    }, 10000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  const toggleItemBarra = async (comandaId: string, itemIdx: number) => {
    const comanda = comandasOriginales.find((c) => c.id === comandaId);
    if (!comanda) return;

    const nuevosItems = [...comanda.items];
    nuevosItems[itemIdx] = {
      ...nuevosItems[itemIdx],
      listo: !nuevosItems[itemIdx].listo
    };

    const todosListos = nuevosItems.every((it) => it.listo === true);
    const nuevoEstado = todosListos ? 'servido' : 'pendiente';

    await supabase
      .from('comandas_cocina')
      .update({ items: nuevosItems, estado: nuevoEstado })
      .eq('id', comandaId);

    cargarComandas();
  };

  const archivarMesaCompleta = async (mesaNombre: string) => {
    const comandasDeMesa = comandasOriginales.filter((c) => c.mesa === mesaNombre);

    const promesas = comandasDeMesa.map((c) =>
      supabase
        .from('comandas_cocina')
        .update({ estado: 'servido' })
        .eq('id', c.id)
    );

    await Promise.all(promesas);
    cargarComandas();
  };

  const volverAWebPrincipal = () => {
    if (window.location.hash) {
      window.location.hash = '';
    } else {
      window.location.href = 'https://nexusgamingcenter.es';
    }
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {mesasAgrupadas.map((mesaGrupo, index) => {
              const minutosTranscurridos = Math.floor(
                (new Date().getTime() - new Date(mesaGrupo.created_at).getTime()) / 60000
              );
              const esUrgente = minutosTranscurridos >= 7;

              return (
                <div
                  key={index}
                  className={`rounded-3xl border p-5 flex flex-col justify-between transition-all ${
                    esUrgente
                      ? 'bg-rose-950/20 border-rose-500/50 shadow-lg shadow-rose-900/20'
                      : 'bg-[#0c0e17] border-cyan-500/30 shadow-[0_0_20px_rgba(0,242,254,0.05)]'
                  }`}
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-white/10">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-black px-3 py-1 rounded-xl uppercase shadow-md ${
                            esUrgente ? 'bg-rose-500 text-white' : 'bg-cyan-500 text-slate-950'
                          }`}
                        >
                          {mesaGrupo.mesa}
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold bg-white/5 px-2 py-0.5 rounded-md">
                          {mesaGrupo.items.length} Ítems
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

                    <div className="space-y-2">
                      {mesaGrupo.items.map((it, idx) => {
                        const esAvisoCocina = it.nombre.includes('🍲 LISTO PARA RECOGER');
                        const esItemCocina = it.tipo_destino === 'cocina';

                        return (
                          <div
                            key={idx}
                            onClick={() => toggleItemBarra(it.comandaId, it.itemIdx)}
                            className={`p-3 rounded-xl border flex items-start justify-between gap-3 cursor-pointer transition-all ${
                              it.listo
                                ? 'bg-emerald-950/20 border-emerald-500/30 opacity-60'
                                : esAvisoCocina
                                ? 'bg-amber-950/40 border-amber-500/50 text-amber-300'
                                : esItemCocina
                                ? 'bg-orange-950/25 border-orange-500/30 hover:border-orange-400'
                                : 'bg-black/40 border-white/5 hover:border-cyan-500/50'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5">
                                {it.listo ? (
                                  <CheckSquare className="h-5 w-5 text-emerald-500" />
                                ) : (
                                  <Square
                                    className={`h-5 w-5 ${
                                      esAvisoCocina || esItemCocina ? 'text-amber-500' : 'text-slate-500'
                                    }`}
                                  />
                                )}
                              </div>
                              <div>
                                <span
                                  className={`font-bold text-sm block ${
                                    it.listo ? 'text-emerald-400 line-through' : 'text-white'
                                  }`}
                                >
                                  <span
                                    className={`${
                                      esAvisoCocina || esItemCocina ? 'text-amber-400' : 'text-cyan-400'
                                    } font-mono mr-2`}
                                  >
                                    {it.cantidad}x
                                  </span>
                                  {it.nombre}
                                </span>
                                {it.comentarios && (
                                  <p
                                    className={`text-[11px] italic mt-0.5 ${
                                      esAvisoCocina || esItemCocina ? 'text-amber-200/70' : 'text-cyan-200/70'
                                    }`}
                                  >
                                    {it.comentarios}
                                  </p>
                                )}
                              </div>
                            </div>
                            <span
                              className={`shrink-0 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase border ${
                                esItemCocina
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                  : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                              }`}
                            >
                              {esItemCocina ? 'Cocina' : 'Barra'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-6 pt-3 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => archivarMesaCompleta(mesaGrupo.mesa)}
                      className="w-full py-3.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg transition-all"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Marcar todo entregado
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
