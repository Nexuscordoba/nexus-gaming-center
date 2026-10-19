import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { ChefHat, CheckCircle2, Clock, Flame, Utensils, Bell, ArrowLeft } from 'lucide-react';

interface Comanda {
  id: string;
  ticket_number: string;
  mesa: string;
  created_at: string;
  items: Array<{
    nombre: string;
    variante: string;
    cantidad: number;
    comentarios: string;
    es_menu: boolean;
  }>;
  estado: 'pendiente' | 'listo' | 'servido';
}

export default function KitchenDisplay() {
  const [comandas, setComandas] = useState<Comanda[]>([]);
  const [loading, setLoading] = useState(true);

  const cargarComandas = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('comandas_cocina')
      .select('*')
      .in('estado', ['pendiente', 'listo'])
      .order('created_at', { ascending: true });

    if (data) {
      setComandas(data as Comanda[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    cargarComandas();

    // Suscripción en tiempo real con Supabase Realtime
    const channel = supabase
      .channel('realtime-comandas-kds')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comandas_cocina' },
        () => {
          cargarComandas();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const actualizarEstado = async (id: string, nuevoEstado: 'pendiente' | 'listo' | 'servido') => {
    await supabase
      .from('comandas_cocina')
      .update({ estado: nuevoEstado })
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
    <div className="min-h-screen bg-[#050609] text-slate-100 p-4 sm:p-6 flex flex-col justify-between selection:bg-cyan-500 selection:text-black">
      <header className="border-b border-white/10 pb-4 mb-6 flex items-center justify-between sticky top-0 bg-[#050609]/90 backdrop-blur-md z-30">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
            <ChefHat className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-wide text-white">NEXUS KDS · COCINA & BARRA</h1>
            <p className="text-xs text-slate-400">Polígono Chinales 45 · Comandas en vivo</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs font-mono text-cyan-400 bg-cyan-950/40 px-3.5 py-1.5 rounded-xl border border-cyan-500/20 hidden sm:inline">
            {comandas.filter(c => c.estado === 'pendiente').length} En cocina · {comandas.filter(c => c.estado === 'listo').length} Listos para servir
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
          <div className="text-center py-20 text-slate-500 text-sm">Sincronizando comandas...</div>
        ) : comandas.length === 0 ? (
          <div className="text-center py-24 space-y-3">
            <Utensils className="h-12 w-12 text-slate-600 mx-auto" />
            <p className="text-slate-400 text-base font-semibold">¡Todo al día! No hay comandas pendientes.</p>
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
                        <span className="text-xs font-black px-3 py-1 rounded-xl bg-cyan-500 text-slate-950 uppercase shadow-md">
                          {comanda.mesa}
                        </span>
                        <span className="text-xs text-slate-400 ml-2 font-mono">#{comanda.ticket_number}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-mono text-slate-300">
                        <Clock className="h-3.5 w-3.5 text-amber-400" />
                        <span>{minutosTranscurridos} min</span>
                      </div>
                    </div>

                    {/* Aviso visual si ya está listo para los camareros */}
                    {comanda.estado === 'listo' && (
                      <div className="p-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-bounce">
                        <Bell className="h-4 w-4 shrink-0 text-emerald-400" />
                        <span>¡PLATO LISTO PARA LLEVAR A MESA!</span>
                      </div>
                    )}

                    {/* Desglose de platos */}
                    <div className="space-y-3">
                      {comanda.items.map((it, idx) => (
                        <div key={idx} className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-white text-sm">
                              <span className="text-cyan-400 font-mono mr-2">{it.cantidad}x</span>
                              {it.nombre}
                            </span>
                            {it.es_menu && (
                              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                Menú
                              </span>
                            )}
                          </div>
                          {it.variante && <p className="text-xs text-slate-400">{it.variante}</p>}
                          {it.comentarios && (
                            <p className="text-xs text-rose-300 italic bg-rose-950/30 p-1.5 rounded-lg border border-rose-500/20 flex items-center gap-1">
                              <Flame className="h-3 w-3 shrink-0" /> {it.comentarios}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Botones de acción (Cocina -> Barra -> Cierre) */}
                  <div className="mt-5 pt-3 border-t border-white/10">
                    {comanda.estado === 'pendiente' ? (
                      <button
                        type="button"
                        onClick={() => actualizarEstado(comanda.id, 'listo')}
                        className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg transition-all"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Marcar como Listo (Avisar a Barra)
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => actualizarEstado(comanda.id, 'servido')}
                        className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg transition-all"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Servido / Entregado en Mesa
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <footer className="mt-8 border-t border-white/5 pt-4 text-center text-xs text-slate-500">
        NEXUS KDS · Sistema de Comandas en Vivo
      </footer>
    </div>
  );
}