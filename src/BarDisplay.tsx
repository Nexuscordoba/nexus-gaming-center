import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { Coffee, CheckCircle2, Clock, ArrowLeft, ReceiptText } from 'lucide-react';

interface ComandaBarra {
  id: string;
  ticket_number: string;
  mesa: string;
  created_at: string;
  items: Array<{
    nombre: string;
    cantidad: number;
    comentarios: string;
  }>;
  estado: 'pendiente' | 'listo' | 'servido';
  tipo_destino: string;
}

export default function BarDisplay() {
  const [comandas, setComandas] = useState<ComandaBarra[]>([]);
  const [loading, setLoading] = useState(true);

  const cargarComandas = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('comandas_cocina')
      .select('*')
      .in('tipo_destino', ['barra', 'cuenta'])
      .in('estado', ['pendiente', 'listo'])
      .order('created_at', { ascending: true });

    if (data) {
      setComandas(data as ComandaBarra[]);
    }
    setLoading(false);
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
          <div className="h-12 w-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center">
            <Coffee className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-wide text-white">NEXUS KDS · PANTALLA DE BARRA</h1>
            <p className="text-xs text-slate-400">Bebidas, cafés y avisos de cuentas de clientes</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs font-mono text-cyan-400 bg-cyan-950/40 px-3.5 py-1.5 rounded-xl border border-cyan-500/20 hidden sm:inline">
            {comandas.filter(c => c.estado === 'pendiente').length} Avisos pendientes
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
        ) : comandas.length === 0 ? (
          <div className="text-center py-24 space-y-3">
            <Coffee className="h-12 w-12 text-slate-600 mx-auto" />
            <p className="text-slate-400 text-base font-semibold">¡Todo tranquilo! No hay peticiones en barra.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {comandas.map((comanda) => {
              const esCuenta = comanda.tipo_destino === 'cuenta';
              const minutosTranscurridos = Math.floor(
                (new Date().getTime() - new Date(comanda.created_at).getTime()) / 60000
              );

              return (
                <div
                  key={comanda.id}
                  className={`rounded-3xl border p-5 flex flex-col justify-between transition-all ${
                    esCuenta
                      ? 'bg-rose-950/40 border-rose-500/70 shadow-[0_0_30px_rgba(244,63,94,0.2)] animate-pulse'
                      : comanda.estado === 'listo'
                      ? 'bg-emerald-950/40 border-emerald-500/60'
                      : 'bg-[#0c0e17] border-white/10'
                  }`}
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-white/10">
                      <div>
                        <span className={`text-xs font-black px-3 py-1 rounded-xl uppercase shadow-md ${
                          esCuenta ? 'bg-rose-500 text-slate-950' : 'bg-cyan-500 text-slate-950'
                        }`}>
                          {comanda.mesa}
                        </span>
                        <span className="text-xs text-slate-400 ml-2 font-mono">#{comanda.ticket_number}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-mono text-slate-300">
                        <Clock className="h-3.5 w-3.5 text-cyan-400" />
                        <span>{minutosTranscurridos} min</span>
                      </div>
                    </div>

                    {esCuenta && (
                      <div className="p-3.5 rounded-2xl bg-rose-500/20 border border-rose-500/50 text-rose-300 text-xs font-bold flex items-center gap-2">
                        <ReceiptText className="h-5 w-5 shrink-0 text-rose-400 animate-bounce" />
                        <span>¡EL CLIENTE PIDE LA CUENTA EN MESA!</span>
                      </div>
                    )}

                    <div className="space-y-3">
                      {comanda.items.map((it, idx) => (
                        <div key={idx} className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-white text-sm">
                              <span className="text-cyan-400 font-mono mr-2">{it.cantidad}x</span>
                              {it.nombre}
                            </span>
                          </div>
                          {it.comentarios && <p className="text-xs text-slate-400 italic">{it.comentarios}</p>}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => actualizarEstado(comanda.id, 'servido')}
                      className="w-full py-3.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg transition-all"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {esCuenta ? 'Cuenta Atendida / Cobrada' : 'Bebida Lista / Servida'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <footer className="mt-8 border-t border-white/5 pt-4 text-center text-xs text-slate-500">
        NEXUS KDS · Módulo de Barra y Cuentas
      </footer>
    </div>
  );
}