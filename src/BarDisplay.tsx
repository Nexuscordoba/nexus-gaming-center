import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { Coffee, CheckCircle2, Clock, ArrowLeft, CheckSquare, Square, Wine } from 'lucide-react';

interface ItemComanda {
  nombre: string;
  cantidad: number;
  comentarios?: string;
  listo?: boolean;
}

interface Comanda {
  id: string;
  ticket_number: string;
  mesa: string;
  created_at: string;
  items: ItemComanda[];
  estado: 'pendiente' | 'listo' | 'servido';
  camarero_nombre?: string;
}

interface ItemAgrupado extends ItemComanda {
  comandaId: string;
  itemIdx: number;
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

  const cargarComandas = async () => {
    const { data } = await supabase
      .from('comandas_cocina')
      .select('*')
      .eq('tipo_destino', 'barra')
      .in('estado', ['pendiente', 'listo'])
      .order('created_at', { ascending: true });

    if (data) {
      setComandasOriginales(data as Comanda[]);
      agruparPorMesa(data as Comanda[]);
    }
    setLoading(false);
  };

  const agruparPorMesa = (data: Comanda[]) => {
    const grupos: Record<string, MesaAgrupada> = {};

    data.forEach(comanda => {
      // Si la mesa no existe en el grupo, la creamos
      if (!grupos[comanda.mesa]) {
        grupos[comanda.mesa] = {
          mesa: comanda.mesa,
          created_at: comanda.created_at, // Guardamos la hora del primer pedido
          items: []
        };
      }
      
      // Añadimos todos los ítems de este ticket al grupo de la mesa
      comanda.items.forEach((it, idx) => {
        grupos[comanda.mesa].items.push({
          ...it,
          comandaId: comanda.id,
          itemIdx: idx
        });
      });
    });

    // Convertimos el diccionario a un array para poder pintarlo en pantalla
    setMesasAgrupadas(Object.values(grupos));
  };

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
      cargarComandas(); // Forzamos recarga visual para el reloj
    }, 10000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  const toggleItemBarra = async (comandaId: string, itemIdx: number) => {
    const comanda = comandasOriginales.find(c => c.id === comandaId);
    if (!comanda) return;

    const nuevosItems = [...comanda.items];
    nuevosItems[itemIdx] = { 
      ...nuevosItems[itemIdx], 
      listo: !nuevosItems[itemIdx].listo 
    };

    // Comprobamos si TODOS los elementos de ese ticket específico están listos
    const todosListos = nuevosItems.every(it => it.listo === true);
    
    // Si todos están listos, cerramos el ticket directamente en barra
    const nuevoEstado = todosListos ? 'servido' : 'pendiente';

    await supabase
      .from('comandas_cocina')
      .update({ items: nuevosItems, estado: nuevoEstado })
      .eq('id', comandaId);

    cargarComandas();
  };

  const archivarMesaCompleta = async (mesaNombre: string) => {
    // Buscamos todas las comandas de esta mesa que sigan pendientes
    const comandasDeMesa = comandasOriginales.filter(c => c.mesa === mesaNombre);
    
    const promesas = comandasDeMesa.map(c => 
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
      <header className="border-b border-white/10 pb-4 mb-6 flex items-center justify-between sticky top-0 bg-[#050609]/90 backdrop-blur-md z-30">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center">
            <Coffee className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-wide text-white">NEXUS KDS · PANTALLA DE BARRA</h1>
            <p className="text-xs text-slate-400">Chinales 45 · Comandas consolidadas por mesa</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs font-mono text-cyan-400 bg-cyan-950/40 px-3.5 py-1.5 rounded-xl border border-cyan-500/20 hidden sm:inline">
            {mesasAgrupadas.length} Mesas con bebidas
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
            <p className="text-slate-400 text-base font-semibold">Todo servido. No hay pedidos pendientes en barra.</p>
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
                        <span className={`text-xs font-black px-3 py-1 rounded-xl uppercase shadow-md ${
                          esUrgente ? 'bg-rose-500 text-white' : 'bg-cyan-500 text-slate-950'
                        }`}>
                          {mesaGrupo.mesa}
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold bg-white/5 px-2 py-0.5 rounded-md">
                          {mesaGrupo.items.length} Ítems
                        </span>
                      </div>
                      
                      <div className={`flex items-center gap-1.5 text-xs font-mono font-bold ${
                        esUrgente ? 'text-rose-400 animate-pulse' : 'text-slate-300'
                      }`}>
                        <Clock className="h-3.5 w-3.5" />
                        <span>{minutosTranscurridos} min</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {mesaGrupo.items.map((it, idx) => {
                        const esAvisoCocina = it.nombre.includes('🍲 LISTO PARA RECOGER');
                        
                        return (
                          <div
                            key={idx}
                            onClick={() => toggleItemBarra(it.comandaId, it.itemIdx)}
                            className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                              it.listo
                                ? 'bg-emerald-950/20 border-emerald-500/30 opacity-60'
                                : esAvisoCocina
                                ? 'bg-amber-950/40 border-amber-500/50 text-amber-300'
                                : 'bg-black/40 border-white/5 hover:border-cyan-500/50'
                            }`}
                          >
                            <div className="mt-0.5">
                              {it.listo ? (
                                <CheckSquare className="h-5 w-5 text-emerald-500" />
                              ) : (
                                <Square className={`h-5 w-5 ${esAvisoCocina ? 'text-amber-500' : 'text-slate-500'}`} />
                              )}
                            </div>
                            <div>
                              <span className={`font-bold text-sm block ${
                                it.listo ? 'text-emerald-400 line-through' : 'text-white'
                              }`}>
                                <span className={`${esAvisoCocina ? 'text-amber-500' : 'text-cyan-400'} font-mono mr-2`}>
                                  {it.cantidad}x
                                </span>
                                {it.nombre}
                              </span>
                              {it.comentarios && (
                                <p className={`text-[11px] italic mt-0.5 ${
                                  esAvisoCocina ? 'text-amber-200/70' : 'text-cyan-200/70'
                                }`}>
                                  {it.comentarios}
                                </p>
                              )}
                            </div>
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