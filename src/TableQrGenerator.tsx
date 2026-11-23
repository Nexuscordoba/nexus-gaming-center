import { useState, useEffect, useMemo } from 'react';
import { QrCode, Printer, ArrowLeft, MapPin, Plus, Minus, Home, Sun, RefreshCw } from 'lucide-react';
import { supabase } from './supabase';

interface TableQrGeneratorProps {
  onBack: () => void;
}

interface MesaLocalRow {
  id: string | number;
  nombre?: string;
  numero?: number;
  zona: 'interior' | 'terraza';
  capacidad?: number;
  activa: boolean;
  orden?: number;
}

const extraerNumeroMesa = (m: MesaLocalRow): number => {
  if (typeof m.numero === 'number' && !Number.isNaN(m.numero)) return m.numero;
  const match = (m.nombre || '').match(/\d+/);
  if (match) return parseInt(match[0], 10);
  const idNum = Number(m.id);
  return Number.isNaN(idNum) ? 0 : idNum;
};

const obtenerNombreMesa = (m: MesaLocalRow): string => {
  if (m.nombre && m.nombre.trim()) return m.nombre.trim();
  const num = extraerNumeroMesa(m);
  return m.zona === 'terraza' ? `Terraza ${num}` : `Mesa ${num}`;
};

export default function TableQrGenerator({ onBack }: TableQrGeneratorProps) {
  const [mesas, setMesas] = useState<MesaLocalRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actualizandoZona, setActualizandoZona] = useState<'interior' | 'terraza' | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const cargarMesas = async () => {
    try {
      const { data, error } = await supabase
        .from('mesas_local')
        .select('*')
        .order('zona', { ascending: true })
        .order('id', { ascending: true });

      if (error) {
        console.error('Error cargando mesas_local en QR:', error);
        setErrorMsg('No se pudieron cargar las mesas desde Supabase.');
        return;
      }

      setMesas((data || []) as MesaLocalRow[]);
      setErrorMsg(null);
    } catch (err) {
      console.error('Excepción cargando mesas_local en QR:', err);
      setErrorMsg('Error de conexión al cargar las mesas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarMesas();

    const channel = supabase
      .channel('realtime-qr-mesas-local')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'mesas_local' },
        () => {
          cargarMesas();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const mesasInteriorActivas = useMemo(
    () =>
      mesas
        .filter((m) => (m.zona || 'interior') === 'interior' && m.activa !== false)
        .sort((a, b) => extraerNumeroMesa(a) - extraerNumeroMesa(b)),
    [mesas]
  );

  const mesasTerrazaActivas = useMemo(
    () =>
      mesas
        .filter((m) => m.zona === 'terraza' && m.activa !== false)
        .sort((a, b) => extraerNumeroMesa(a) - extraerNumeroMesa(b)),
    [mesas]
  );

  const ajustarZona = async (zona: 'interior' | 'terraza', delta: 1 | -1) => {
    if (actualizandoZona) return;
    setActualizandoZona(zona);
    setErrorMsg(null);

    try {
      const activasZona = zona === 'interior' ? mesasInteriorActivas : mesasTerrazaActivas;

      if (delta === 1) {
        const maxActivo = activasZona.reduce((max, m) => Math.max(max, extraerNumeroMesa(m)), 0);
        const siguienteNum = maxActivo + 1;

        const inactivasZona = mesas
          .filter((m) => (m.zona || 'interior') === zona && m.activa === false)
          .sort((a, b) => extraerNumeroMesa(a) - extraerNumeroMesa(b));

        const existenteParaReactivar =
          inactivasZona.find((m) => extraerNumeroMesa(m) === siguienteNum) ||
          inactivasZona.find((m) => extraerNumeroMesa(m) > maxActivo);

        if (existenteParaReactivar) {
          const { error } = await supabase
            .from('mesas_local')
            .update({ activa: true })
            .eq('id', existenteParaReactivar.id);
          if (error) throw error;
        } else {
          const nombreNuevo = zona === 'interior' ? `Mesa ${siguienteNum}` : `Terraza ${siguienteNum}`;
          const payload: Record<string, any> = {
            nombre: nombreNuevo,
            zona,
            capacidad: 4,
            activa: true
          };
          const muestra = mesas[0];
          if (muestra && 'numero' in muestra) payload.numero = siguienteNum;
          if (muestra && 'orden' in muestra) payload.orden = siguienteNum;

          const { error } = await supabase.from('mesas_local').insert([payload]);
          if (error) throw error;
        }
      } else {
        if (activasZona.length === 0) return;
        const ultimaMesa = activasZona[activasZona.length - 1];
        const { error } = await supabase
          .from('mesas_local')
          .update({ activa: false })
          .eq('id', ultimaMesa.id);
        if (error) throw error;
      }

      await cargarMesas();
    } catch (err: any) {
      console.error('Error ajustando mesas_local:', err);
      setErrorMsg(err?.message || 'Error al actualizar la mesa en Supabase.');
    } finally {
      setActualizandoZona(null);
    }
  };

  const imprimirQR = () => {
    window.print();
  };

  const renderTarjetaQR = (mesa: MesaLocalRow) => {
    const num = extraerNumeroMesa(mesa);
    const nombreMesa = obtenerNombreMesa(mesa);
    const esTerraza = mesa.zona === 'terraza';
    const urlMesa = esTerraza
      ? `https://nexusgamingcenter.es/#/terraza/${num}`
      : `https://nexusgamingcenter.es/#/mesa/${num}`;
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(urlMesa)}`;

    return (
      <div
        key={`${mesa.zona}-${mesa.id}`}
        className="bg-[#0d0f17] border border-white/10 rounded-3xl p-6 flex flex-col items-center justify-between text-center shadow-xl print:bg-white print:text-black print:border-black print:shadow-none print:p-4 break-inside-avoid"
      >
        <div className="space-y-1 mb-4">
          <span className="text-[10px] uppercase font-bold tracking-widest text-cyan-400 print:text-slate-600 block">
            CAFÉ BAR NEXUS
          </span>
          <h2 className="text-2xl font-black text-white print:text-black flex items-center justify-center gap-1.5">
            <MapPin className={`h-5 w-5 print:hidden ${esTerraza ? 'text-emerald-400' : 'text-amber-400'}`} />
            {nombreMesa.toUpperCase()}
          </h2>
        </div>

        <div className="bg-white p-3 rounded-2xl shadow-inner border border-white/10 print:border-black">
          <img
            src={qrApiUrl}
            alt={`QR ${nombreMesa}`}
            className="w-40 h-40 object-contain mx-auto"
          />
        </div>

        <div className="mt-4 space-y-1">
          <p className="text-[11px] text-slate-400 print:text-slate-700 font-medium">
            Escanea para ver la carta, pedir platos y pedir la cuenta
          </p>
          <span className="text-[9px] font-mono text-slate-500 print:text-slate-500 block truncate max-w-[200px] mx-auto">
            {urlMesa}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#050609] text-slate-100 p-6 flex flex-col justify-between selection:bg-cyan-500 selection:text-black">
      {/* Cabecera */}
      <header className="border-b border-white/10 pb-4 mb-8 flex flex-wrap items-center justify-between gap-4 sticky top-0 bg-[#050609]/90 backdrop-blur-md z-30 print:hidden">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center">
            <QrCode className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-wide text-white">NEXUS · GENERADOR DE QR PARA MESAS</h1>
            <p className="text-xs text-slate-400">Chinales 45 · Sincronizado en tiempo real con mesas_local</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Control Mesas Interior */}
          <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10">
            <Home className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-xs text-slate-300 font-medium">Mesas:</span>
            <button
              type="button"
              onClick={() => ajustarZona('interior', -1)}
              disabled={actualizandoZona !== null || mesasInteriorActivas.length === 0}
              className="h-6 w-6 rounded-lg bg-black/50 border border-white/15 hover:bg-white/10 disabled:opacity-40 flex items-center justify-center text-slate-200 cursor-pointer"
              title="Reducir última mesa interior"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="w-6 text-center text-xs font-black text-amber-400">
              {mesasInteriorActivas.length}
            </span>
            <button
              type="button"
              onClick={() => ajustarZona('interior', 1)}
              disabled={actualizandoZona !== null}
              className="h-6 w-6 rounded-lg bg-black/50 border border-white/15 hover:bg-white/10 disabled:opacity-40 flex items-center justify-center text-slate-200 cursor-pointer"
              title="Añadir nueva mesa interior"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Control Terraza */}
          <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10">
            <Sun className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-xs text-slate-300 font-medium">Terraza:</span>
            <button
              type="button"
              onClick={() => ajustarZona('terraza', -1)}
              disabled={actualizandoZona !== null || mesasTerrazaActivas.length === 0}
              className="h-6 w-6 rounded-lg bg-black/50 border border-white/15 hover:bg-white/10 disabled:opacity-40 flex items-center justify-center text-slate-200 cursor-pointer"
              title="Reducir última mesa de terraza"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="w-6 text-center text-xs font-black text-emerald-400">
              {mesasTerrazaActivas.length}
            </span>
            <button
              type="button"
              onClick={() => ajustarZona('terraza', 1)}
              disabled={actualizandoZona !== null}
              className="h-6 w-6 rounded-lg bg-black/50 border border-white/15 hover:bg-white/10 disabled:opacity-40 flex items-center justify-center text-slate-200 cursor-pointer"
              title="Añadir nueva mesa de terraza"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={imprimirQR}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-all cursor-pointer shadow-lg"
          >
            <Printer className="h-4 w-4" />
            <span>Imprimir Carteles QR</span>
          </button>

          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs text-slate-300 hover:text-white transition-all cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Volver</span>
          </button>
        </div>
      </header>

      {/* Cuadrícula de QRs separada por Mesas y Terraza */}
      <main className="flex-1 max-w-6xl mx-auto w-full space-y-10">
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between print:hidden">
            <span>{errorMsg}</span>
            <button
              type="button"
              onClick={cargarMesas}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 font-bold cursor-pointer"
            >
              <RefreshCw className="h-3 w-3" /> Reintentar
            </button>
          </div>
        )}

        {loading ? (
          <div className="text-center py-20 text-slate-400 text-sm">
            Cargando mesas activas desde Supabase...
          </div>
        ) : (
          <>
            {/* Sección Mesas (Interior) */}
            <section className="space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-2 print:border-black/20">
                <div className="flex items-center gap-2">
                  <Home className="h-5 w-5 text-amber-400 print:text-black" />
                  <h2 className="text-lg font-black tracking-wide text-white print:text-black">
                    Mesas
                  </h2>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold print:hidden">
                    {mesasInteriorActivas.length} activas
                  </span>
                </div>
              </div>

              {mesasInteriorActivas.length === 0 ? (
                <p className="text-xs text-slate-500 py-4">No hay mesas interiores activas.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 print:grid-cols-2 print:gap-4">
                  {mesasInteriorActivas.map(renderTarjetaQR)}
                </div>
              )}
            </section>

            {/* Sección Terraza */}
            <section className="space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-2 print:border-black/20">
                <div className="flex items-center gap-2">
                  <Sun className="h-5 w-5 text-emerald-400 print:text-black" />
                  <h2 className="text-lg font-black tracking-wide text-white print:text-black">
                    Terraza
                  </h2>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold print:hidden">
                    {mesasTerrazaActivas.length} activas
                  </span>
                </div>
              </div>

              {mesasTerrazaActivas.length === 0 ? (
                <p className="text-xs text-slate-500 py-4">No hay mesas de terraza activas.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 print:grid-cols-2 print:gap-4">
                  {mesasTerrazaActivas.map(renderTarjetaQR)}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      <footer className="mt-12 border-t border-white/5 pt-4 text-center text-xs text-slate-500 print:hidden">
        CAFÉ BAR NEXUS · Chinales 45 · Generador automático de QRs sincronizado con mesas_local
      </footer>
    </div>
  );
}
