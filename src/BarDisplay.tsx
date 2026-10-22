import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { Coffee, CheckCircle2, Clock, ArrowLeft, ReceiptText, User, ChefHat, Flame, Utensils } from 'lucide-react';

interface ItemComanda {
  nombre: string;
  cantidad: number;
  comentarios?: string;
  listo?: boolean; // Para leer el estado individual que marca la cocina
}

interface Comanda {
  id: string;
  ticket_number: string;
  mesa: string;
  created_at: string;
  camarero_nombre?: string;
  items: ItemComanda[];
  estado: 'pendiente' | 'listo' | 'servido';
  tipo_destino: string;
}

export default function BarDisplay() {
  const [comandas, setComandas] = useState<Comanda[]>([]);
  const [loading, setLoading] = useState(true);

  const cargarComandas = async () => {
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

    const channel = supabase
      .channel('realtime-barra-dividida')
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

  // Separar las comandas en las dos columnas
  const comandasBarra = comandas.filter(c => ['barra', 'cuenta'].includes(c.tipo_destino));
  // Mostramos en cocina solo lo que está pendiente de terminar. Lo que está 'listo' ya saltó como aviso a la barra.
  const comandasCocina = comandas.filter(c => c.tipo_destino === 'cocina' && c.estado === 'pendiente');

  return (
    <div className="min-h-screen bg-[#050609] text-slate-100 p-4 sm:p-6 flex flex-col justify-between selection:bg-cyan-500 selection:text-black">
      
      {/* CABECERA */}
      <header className="border-b border-white/10 pb-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 sticky top-0 bg-[#050609]/90 backdrop-blur-md z-30">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center">
            <Coffee className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-wide text-white">NEXUS KDS · SALA Y BARRA</h1>
            <p className="text-xs text-slate-400">Panel de control de servicio para camareros</p>
          </div>
        </div>

        <div className="flex items-center gap-4 flex-wrap justify-center">
          <div className="flex gap-2">
            <span className="text-[10px] sm:text-xs font-bold uppercase text-cyan-400 bg-cyan-950/40 px-3 py-1.5 rounded-xl border border-cyan-500/20">
              {comandasBarra.length} En Barra
            </span>
            <span className="text-[10px] sm:text-xs font-bold uppercase text-amber-400 bg-amber-950/40 px-3 py-1.5 rounded-xl border border-amber-500/20">
              {comandasCocina.length} En Cocina
            </span>
          </div>

          <button
            type="button"
            onClick={volverAWebPrincipal}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs text-slate-300 hover:text-white transition-all cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Volver a la web</span>
          </button>
        </div>
      </header>

      {/* PANEL DIVIDIDO EN DOS COLUMNAS */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
        
        {/* ========================================= */}
        {/* COLUMNA 1: PENDIENTE DE SERVIR (BARRA) */}
        {/* ========================================= */}
        <section className="space-y-5">
          <div className="flex items-center gap-3 pb-3 border-b border-cyan-500/30">
            <Coffee className="h-5 w-5 text-cyan-400" />
            <h2 className="text-lg font-black text-white uppercase tracking-wide">Pendiente de Servir</h2>
          </div>

          {loading ? (
            <div className="text-center py-10 text-slate-500 text-sm">Sincronizando barra...</div>
          ) : comandasBarra.length === 0 ? (
            <div className="text-center py-16 space-y-3 bg-[#0d0f17] rounded-3xl border border-white/5">
              <CheckCircle2 className="h-10 w-10 text-emerald-500/50 mx-auto" />
              <p className="text-slate-400 text-sm font-semibold">Todo servido. Barra limpia.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4">
              {comandasBarra.map((comanda) => {
                const esCuenta = comanda.tipo_destino === 'cuenta';
                const minutosTranscurridos = Math.floor((new Date().getTime() - new Date(comanda.created_at).getTime()) / 60000);

                return (
                  <div key={comanda.id} className={`rounded-3xl border p-4 flex flex-col justify-between transition-all ${
                    esCuenta ? 'bg-rose-950/40 border-rose-500/70 shadow-[0_0_20px_rgba(244,63,94,0.15)] animate-pulse' : 'bg-[#0c0e17] border-cyan-500/40 shadow-lg'
                  }`}>
                    <div className="space-y-4">
                      <div className="flex items-start justify-between pb-3 border-b border-white/10">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-black px-2.5 py-1 rounded-lg uppercase shadow ${esCuenta ? 'bg-rose-500 text-slate-950' : 'bg-cyan-500 text-slate-950'}`}>
                              {comanda.mesa}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">#{comanda.ticket_number}</span>
                          </div>
                          <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 bg-white/5 px-2 py-0.5 rounded-lg w-max border border-white/10">
                            <User className="h-3 w-3 text-cyan-400" />
                            {comanda.camarero_nombre || 'Autopedido QR'}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs font-mono text-slate-300">
                          <Clock className="h-3.5 w-3.5 text-cyan-400" />
                          <span>{minutosTranscurridos} min</span>
                        </div>
                      </div>

                      {esCuenta && (
                        <div className="p-3 rounded-2xl bg-rose-500/20 border border-rose-500/50 text-rose-300 text-xs font-bold flex items-center gap-2">
                          <ReceiptText className="h-4 w-4 shrink-0 text-rose-400 animate-bounce" />
                          <span>¡PIDE LA CUENTA!</span>
                        </div>
                      )}

                      <div className="space-y-2">
                        {comanda.items.map((it, idx) => (
                          <div key={idx} className="p-2.5 rounded-xl bg-black/40 border border-white/5 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-white text-xs">
                                <span className="text-cyan-400 font-mono mr-1.5">{it.cantidad}x</span>{it.nombre}
                              </span>
                            </div>
                            {it.comentarios && <p className="text-[10px] text-slate-400 italic">{it.comentarios}</p>}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/10">
                      <button onClick={() => actualizarEstado(comanda.id, 'servido')} className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow transition-all">
                        <CheckCircle2 className="h-4 w-4" /> {esCuenta ? 'Cobrada' : 'Servido'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ========================================= */}
        {/* COLUMNA 2: EN PREPARACIÓN (COCINA) */}
        {/* ========================================= */}
        <section className="space-y-5">
          <div className="flex items-center gap-3 pb-3 border-b border-amber-500/30">
            <ChefHat className="h-5 w-5 text-amber-400" />
            <h2 className="text-lg font-black text-white uppercase tracking-wide">En Preparación (Cocina)</h2>
          </div>

          {loading ? (
            <div className="text-center py-10 text-slate-500 text-sm">Consultando cocina...</div>
          ) : comandasCocina.length === 0 ? (
            <div className="text-center py-16 space-y-3 bg-[#0d0f17] rounded-3xl border border-white/5">
              <Utensils className="h-10 w-10 text-amber-500/30 mx-auto" />
              <p className="text-slate-400 text-sm font-semibold">No hay platos pendientes en cocina.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4 opacity-90">
              {comandasCocina.map((comanda) => {
                const minutosTranscurridos = Math.floor((new Date().getTime() - new Date(comanda.created_at).getTime()) / 60000);

                return (
                  <div key={comanda.id} className="rounded-3xl border border-amber-500/20 bg-[#0c0e17] p-4 flex flex-col justify-between shadow-lg">
                    <div className="space-y-4">
                      <div className="flex items-start justify-between pb-3 border-b border-white/10">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black px-2.5 py-1 rounded-lg uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30">
                              {comanda.mesa}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">#{comanda.ticket_number}</span>
                          </div>
                          <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 bg-white/5 px-2 py-0.5 rounded-lg w-max border border-white/10">
                            <User className="h-3 w-3 text-amber-400" />
                            {comanda.camarero_nombre || 'Autopedido QR'}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400">
                          <Clock className="h-3.5 w-3.5 text-amber-400" />
                          <span>{minutosTranscurridos} min</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {comanda.items.map((it, idx) => (
                          <div key={idx} className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 ${
                            it.listo ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200/70 line-through' : 'bg-black/40 border-white/5 text-white'
                          }`}>
                            <div className="space-y-0.5">
                              <span className="font-bold text-xs">
                                <span className="text-amber-400 font-mono mr-1.5">{it.cantidad}x</span>{it.nombre}
                              </span>
                              {it.comentarios && (
                                <p className="text-[9px] text-rose-300 italic flex items-center gap-1">
                                  <Flame className="h-2.5 w-2.5 shrink-0" /> {it.comentarios}
                                </p>
                              )}
                            </div>
                            {it.listo && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/10 text-center">
                      <span className="text-[10px] uppercase font-bold text-amber-500/70 tracking-widest flex items-center justify-center gap-1">
                        <ChefHat className="h-3 w-3" /> Marchando en cocina...
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

      </main>

      <footer className="mt-8 border-t border-white/5 pt-4 text-center text-xs text-slate-500">
        NEXUS KDS · Módulo de Control de Sala Integrado
      </footer>
    </div>
  );
}