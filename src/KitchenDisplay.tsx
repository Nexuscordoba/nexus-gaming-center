import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import { ChefHat, CheckCircle2, Clock, Flame, Utensils, ArrowLeft, CheckSquare, Square } from 'lucide-react';

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

export default function KitchenDisplay() {
  const [comandas, setComandas] = useState<Comanda[]>([]);
  const [loading, setLoading] = useState(true);
  const [procesandoKey, setProcesandoKey] = useState<string | null>(null);

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
      setComandas(filtradasCocina);
    }
    setLoading(false);
  }, [esItemCocina]);

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

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [cargarComandas]);

  // Paso 1: Marcar o desmarcar un plato individualmente como "Listo" sin hacer desaparecer la comanda
  const marcarPlatoListo = async (comandaId: string, itemIdx: number, platoUid: string) => {
    if (procesandoKey === platoUid) return;
    setProcesandoKey(platoUid);

    try {
      const comandaActual = comandas.find((c) => String(c.id) === String(comandaId));
      if (!comandaActual || !Array.isArray(comandaActual.items) || !comandaActual.items[itemIdx]) {
        return;
      }

      const nuevosItems = comandaActual.items.map((item, idx) => {
        if (idx !== itemIdx) return { ...item };
        const estaListoAhora = Boolean(item.listo || item.estado_cocina === 'listo');
        const nuevoEstadoListo = !estaListoAhora;
        return {
          ...item,
          listo: nuevoEstadoListo,
          estado_cocina: (nuevoEstadoListo ? 'listo' : 'pendiente') as ItemComanda['estado_cocina'],
          entregado: nuevoEstadoListo ? Boolean(item.entregado) : false
        };
      });

      const todosListosEnCocina = nuevosItems.every((it) =>
        Boolean(it.listo || it.estado_cocina === 'listo')
      );
      // Importante: nunca pasar a 'servido' desde cocina; 'listo' mantiene el plato visible y lo habilita en Barra
      const nuevoEstadoComanda: Comanda['estado'] = todosListosEnCocina ? 'listo' : 'pendiente';

      // Actualización optimista del estado en React para respuesta visual inmediata
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

  // Paso 2: "Marcar todo listo" en cocina pone todos los platos en estado 'listo' para Barra (sin archivarlos como 'servido')
  const marcarTodaComandaLista = async (comandaId: string) => {
    const lockId = `all_${comandaId}`;
    if (procesandoKey === lockId) return;
    setProcesandoKey(lockId);

    try {
      const comandaActual = comandas.find((c) => String(c.id) === String(comandaId));
      if (!comandaActual || !Array.isArray(comandaActual.items)) return;

      const nuevosItems: ItemComanda[] = comandaActual.items.map((item) => ({
        ...item,
        listo: true,
        estado_cocina: 'listo',
        entregado: Boolean(item.entregado)
      }));

      setComandas((prev) =>
        prev.map((c) =>
          String(c.id) === String(comandaId)
            ? { ...c, items: nuevosItems, estado: 'listo' }
            : c
        )
      );

      const { error } = await supabase
        .from('comandas_cocina')
        .update({
          items: nuevosItems,
          estado: 'listo'
        })
        .eq('id', comandaId);

      if (error) {
        console.error('Error al marcar toda la comanda como lista:', error);
      }

      await cargarComandas();
    } finally {
      setProcesandoKey(null);
    }
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
            <p className="text-xs text-slate-400">Chinales 45 · Selección individual por plato hacia Barra</p>
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
              const todosPlatosListos =
                Array.isArray(comanda.items) &&
                comanda.items.length > 0 &&
                comanda.items.every((it) => Boolean(it.listo || it.estado_cocina === 'listo'));
              const esUrgente = minutosTranscurridos >= 12 && !todosPlatosListos;

              return (
                <div
                  key={comanda.id}
                  className={`rounded-3xl border p-5 flex flex-col justify-between transition-all ${
                    todosPlatosListos
                      ? 'bg-emerald-950/30 border-emerald-500/60 shadow-[0_0_30px_rgba(16,185,129,0.12)] ring-1 ring-emerald-500/40'
                      : esUrgente
                      ? 'bg-rose-950/30 border-rose-500/60 shadow-[0_0_25px_rgba(244,63,94,0.15)]'
                      : 'bg-[#0c0e17] border-white/10'
                  }`}
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-white/10">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black px-3 py-1 rounded-xl bg-amber-500 text-slate-950 uppercase shadow-md">
                          {comanda.mesa}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">#{comanda.ticket_number}</span>
                        {todosPlatosListos && (
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            Listo en Barra
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-mono text-slate-300">
                        <Clock className="h-3.5 w-3.5 text-amber-400" />
                        <span>{minutosTranscurridos} min</span>
                      </div>
                    </div>

                    <p className="text-[11px] text-cyan-400 font-medium">
                      💡 Pulsa sobre cada plato para marcarlo como <strong>Listo para servir</strong> en Barra:
                    </p>

                    <div className="space-y-2.5">
                      {(comanda.items || []).map((it, idx) => {
                        const platoUid = `${comanda.id}_item_${it.id ?? it.producto_id ?? idx}_${idx}`;
                        const estaListo = Boolean(it.listo || it.estado_cocina === 'listo');
                        const estaEntregado = Boolean(it.entregado || it.estado_cocina === 'servido');

                        if (estaEntregado) return null;

                        return (
                          <div
                            key={platoUid}
                            onClick={() => marcarPlatoListo(comanda.id, idx, platoUid)}
                            className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                              estaListo
                                ? 'bg-emerald-950/60 border-emerald-500/80 text-emerald-200'
                                : 'bg-black/50 border-white/15 hover:border-amber-400 text-white shadow-md'
                            }`}
                          >
                            <div className="flex items-start gap-2.5 min-w-0">
                              <div className="mt-0.5 shrink-0">
                                {estaListo ? (
                                  <CheckSquare className="h-5 w-5 text-emerald-400" />
                                ) : (
                                  <Square className="h-5 w-5 text-amber-400" />
                                )}
                              </div>
                              <div className="space-y-0.5 min-w-0">
                                <span className={`font-bold text-sm block break-words ${estaListo ? 'text-emerald-300' : 'text-white'}`}>
                                  <span className="text-amber-400 font-mono mr-2">{it.cantidad}x</span>
                                  {it.nombre}
                                </span>
                                {it.comentarios && (
                                  <p className="text-xs text-rose-300 italic flex items-center gap-1">
                                    <Flame className="h-3 w-3 shrink-0" /> {it.comentarios}
                                  </p>
                                )}
                              </div>
                            </div>

                            <button
                              type="button"
                              disabled={procesandoKey === platoUid}
                              onClick={(e) => {
                                e.stopPropagation();
                                marcarPlatoListo(comanda.id, idx, platoUid);
                              }}
                              className={`shrink-0 text-xs font-black px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer ${
                                estaListo
                                  ? 'bg-emerald-500 text-slate-950 shadow-md hover:bg-emerald-400'
                                  : 'bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/40'
                              }`}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              <span>{estaListo ? 'Listo para servir' : 'Marcar Listo'}</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-6 pt-3 border-t border-white/10">
                    <button
                      type="button"
                      disabled={todosPlatosListos || procesandoKey === `all_${comanda.id}`}
                      onClick={() => marcarTodaComandaLista(comanda.id)}
                      className={`w-full py-3.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all ${
                        todosPlatosListos
                          ? 'bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 cursor-default'
                          : 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer'
                      }`}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {todosPlatosListos
                        ? 'Todo Listo · Esperando entrega en Barra'
                        : 'Marcar Todo Listo para Servir'}
                    </button>
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
