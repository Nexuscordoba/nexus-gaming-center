import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { ChefHat, CheckCircle2, Clock, Flame, Utensils, ArrowLeft } from 'lucide-react';

interface ItemComanda {
  id?: string;
  nombre: string;
  cantidad: number;
  comentarios?: string;
  es_menu?: boolean;
  listo?: boolean;
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

export default function KitchenDisplay() {
  const [comandas, setComandas] = useState<Comanda[]>([]);
  const [loading, setLoading] = useState(true);

  const cargarComandas = async () => {
    const { data } = await supabase
      .from('comandas_cocina')
      .select('*')
      .eq('tipo_destino', 'cocina')
      .in('estado', ['pendiente', 'listo'])
      .order('created_at', { ascending: true });

    if (data) {
      setComandas(data as Comanda[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    cargarComandas();

    const channel = supabase
      .channel('realtime-cocina')
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
    }, 8000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  const toggleItemListo = async (comandaId: string, indexItem: number) => {
    const comandaActual = comandas.find(c => c.id === comandaId);
    if (!comandaActual) return;

    const nuevosItems = [...comandaActual.items];
    nuevosItems[indexItem].listo = !nuevosItems[indexItem].listo;

    const todosListos = nuevosItems.every(it => it.listo);
    const nuevoEstadoComanda = todosListos ? 'listo' : 'pendiente';

    await supabase
      .from('comandas_cocina')
      .update({ items: nuevosItems, estado: nuevoEstadoComanda })
      .eq('id', comandaId);

    // Notificar a barra de forma directa que hay un plato listo para servir
    if (nuevosItems[indexItem].listo) {
      await supabase.from('comandas_cocina').insert([{
        ticket_number: comandaActual.ticket_number,
        mesa: comandaActual.mesa,
        tipo_destino: 'barra',
        estado: 'pendiente',
        items: [{ 
          nombre: `🍲 LISTO EN COCINA: ${nuevosItems[indexItem].nombre}`, 
          cantidad: nuevosItems[indexItem].cantidad, 
          comentarios: 'Retirar de cocina y servir en mesa' 
        }]
      }]);
    }

    cargarComandas();
  };

  const archivarComanda = async (id: string) => {
    await supabase
      .from('comandas_cocina')
      .update({ estado: 'servido' })
      .eq('id', id);

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
    <div className="min-h-screen bg-[#050609] text-slate-100 p-4 sm:p-6 flex flex-col justify-between selection:bg-amber-500 selection:text-black">
      <header className="border-b border-white/10 pb-4 mb-6 flex items-center justify-between sticky top-0 bg-[#050609]/90 backdrop-blur-md z-30">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
            <ChefHat className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-wide text-white">NEXUS KDS · PANTALLA DE COCINA</h1>
            <p className="text-xs text-slate-400">Chinales 45 · Selección individual por plato</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs font-mono text-amber-400 bg-amber-950/40 px-3.5 py-1.5 rounded-xl border border-amber-500/20 hidden sm:inline">
            {comandas.filter(c => c.estado === 'pendiente').length} Comandas pendientes
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
          <div className="text-center py-20 text-slate-500 text-sm">Sincronizando cocina...</div>
        ) : comandas.length === 0 ? (
          <div className="text-center py-24 space-y-3">
            <Utensils className="h-12 w-12 text-slate-600 mx-auto" />
            <p className="text-slate-400 text-base font-semibold">¡Todo al día! No hay platos pendientes en cocina.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {comandas.map((comanda) => {
              const minutosTranscurridos = Math.floor(
                (new Date().getTime() - new Date(comanda.created_at).getTime()) / 60000
              );
              const esUrgente = minutosTranscurridos >= 12 && comanda.estado === 'pendiente';

              return (
                <div
                  key={comanda.id}
                  className={`rounded-3xl border p-5 flex flex-col justify-between transition-all ${
                    comanda.estado === 'listo'
                      ? 'bg-emerald-950/40 border-emerald-500/60 shadow-[0_0_30px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/50'
                      : esUrgente
                      ? 'bg-rose-950/30 border-rose-500/60 shadow-[0_0_25px_rgba(244,63,94,0.15)] animate-pulse'
                      : 'bg-[#0c0e17] border-white/10'
                  }`}
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-white/10">
                      <div>
                        <span className="text-xs font-black px-3 py-1 rounded-xl bg-amber-500 text-slate-950 uppercase shadow-md">
                          {comanda.mesa}
                        </span>
                        <span className="text-xs text-slate-400 ml-2 font-mono">#{comanda.ticket_number}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-mono text-slate-300">
                        <Clock className="h-3.5 w-3.5 text-amber-400" />
                        <span>{minutosTranscurridos} min</span>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-400 italic">
                      Haz clic en un plato para marcarlo como listo individualmente:
                    </p>

                    <div className="space-y-2.5">
                      {comanda.items.map((it, idx) => (
                        <div
                          key={idx}
                          onClick={() => toggleItemListo(comanda.id, idx)}
                          className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                            it.listo
                              ? 'bg-emerald-900/40 border-emerald-500/60 text-emerald-200 line-through opacity-75'
                              : 'bg-black/40 border-white/10 hover:border-amber-500/50 text-white'
                          }`}
                        >
                          <div className="space-y-0.5">
                            <span className="font-bold text-sm">
                              <span className="text-amber-400 font-mono mr-2">{it.cantidad}x</span>
                              {it.nombre}
                            </span>
                            {it.comentarios && (
                              <p className="text-xs text-rose-300 italic flex items-center gap-1">
                                <Flame className="h-3 w-3 shrink-0" /> {it.comentarios}
                              </p>
                            )}
                          </div>
                          <div className="shrink-0">
                            {it.listo ? (
                              <span className="text-xs bg-emerald-500 text-slate-950 font-bold px-2.5 py-1 rounded-xl flex items-center gap-1">
                                <CheckCircle2 className="h-3.5 w-3.5" /> Listo
                              </span>
                            ) : (
                              <span className="text-[10px] bg-white/10 text-slate-300 px-2.5 py-1 rounded-xl border border-white/10">
                                Marcar listo
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => archivarComanda(comanda.id)}
                      className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg transition-all"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Archivar / Todo Entregado en Mesa
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <footer className="mt-8 border-t border-white/5 pt-4 text-center text-xs text-slate-500">
        NEXUS KDS · Módulo de Cocina con Selección Individual
      </footer>
    </div>
  );
}