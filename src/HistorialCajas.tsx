import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { Wallet, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';

export interface RegistroCajaDiaria {
  id: number | string;
  fecha: string;
  created_at?: string;
  estado: 'abierta' | 'cerrada' | string;
  total_tarjeta: number;
  total_efectivo: number;
  efectivo_real: number;
  remanente_apertura: number;
  remanente_cierre?: number;
  efectivo_retirado?: number;
  descuadre: number;
}

interface HistorialCajasProps {
  refreshTrigger?: any;
}

export const formatearFechaCaja = (registro: RegistroCajaDiaria): string => {
  const rawTimestamp = registro.created_at || registro.fecha;
  if (!rawTimestamp) return '-';

  if (typeof rawTimestamp === 'string' && (rawTimestamp.includes('T') || rawTimestamp.includes(':'))) {
    const d = new Date(rawTimestamp);
    if (!isNaN(d.getTime())) {
      const dia = String(d.getDate()).padStart(2, '0');
      const mes = String(d.getMonth() + 1).padStart(2, '0');
      const anio = d.getFullYear();
      const horas = String(d.getHours()).padStart(2, '0');
      const minutos = String(d.getMinutes()).padStart(2, '0');
      return `${dia}/${mes}/${anio} - ${horas}:${minutos}h`;
    }
  }

  const soloFecha = String(registro.fecha || rawTimestamp).split('T')[0];
  const partes = soloFecha.split('-');
  if (partes.length === 3) {
    const [anio, mes, dia] = partes;
    return `${dia}/${mes}/${anio}`;
  }

  return String(rawTimestamp);
};

export const formatearEuros = (valor: number | string | null | undefined): string => {
  const num = Number(valor ?? 0);
  return `${(isNaN(num) ? 0 : num).toFixed(2)} €`;
};

export default function HistorialCajas({ refreshTrigger }: HistorialCajasProps) {
  const [historialCajas, setHistorialCajas] = useState<RegistroCajaDiaria[]>([]);
  const [cargando, setCargando] = useState<boolean>(false);
  const [paginaActual, setPaginaActual] = useState<number>(1);
  const filasPorPagina = 15;

  const obtenerHistorialCajas = async () => {
    setCargando(true);
    try {
      const { data, error } = await supabase
        .from('caja_diaria')
        .select('*')
        .order('fecha', { ascending: false })
        .order('id', { ascending: false });

      if (error) throw error;
      if (data) {
        setHistorialCajas(data as RegistroCajaDiaria[]);
      }
    } catch (err) {
      console.error('Error al obtener el historial de caja_diaria:', err);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    obtenerHistorialCajas();
  }, [refreshTrigger]);

  const totalPaginas = Math.max(1, Math.ceil(historialCajas.length / filasPorPagina));
  const indiceInicio = (paginaActual - 1) * filasPorPagina;
  const cajasPaginadas = historialCajas.slice(indiceInicio, indiceInicio + filasPorPagina);

  const renderDescuadre = (registro: RegistroCajaDiaria) => {
    const valorRaw = Number(registro.descuadre ?? 0);
    const valorRedondeado = Number(valorRaw.toFixed(2));

    if ( valorRedondeado === 0 ) {
      return (
        <span className="text-emerald-400 font-semibold">
          {formatearEuros(0)}
        </span>
      );
    }

    if (valorRedondeado < 0) {
      return (
        <span className="text-red-500 font-bold">
          {formatearEuros(valorRedondeado)}
        </span>
      );
    }

    return (
      <span className="text-amber-400 font-semibold">
        +{formatearEuros(valorRedondeado)}
      </span>
    );
  };

  return (
    <div className="p-6 rounded-3xl bg-[#0d0f17] border border-white/10 space-y-4 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div className="flex items-center gap-2.5 text-cyan-400">
          <Wallet className="h-5 w-5" />
          <div>
            <h3 className="font-black text-white text-sm uppercase tracking-wide">
              Historial de Cierres y Turnos de Caja
            </h3>
            <p className="text-[11px] text-slate-400">
              Registro histórico ordenado por fecha e identificador de turno más reciente ({historialCajas.length} registros)
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={obtenerHistorialCajas}
          disabled={cargando}
          className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-200 flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${cargando ? 'animate-spin text-cyan-400' : 'text-cyan-400'}`} />
          <span>Actualizar</span>
        </button>
      </div>

      {/* Contenedor con scroll vertical interno para no romper el diseño del backoffice */}
      <div className="overflow-x-auto max-h-[480px] overflow-y-auto rounded-2xl border border-white/5">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#141824] text-slate-400 uppercase sticky top-0 z-10 border-b border-white/10">
            <tr>
              <th className="p-3.5">Ref. Turno</th>
              <th className="p-3.5">Fecha</th>
              <th className="p-3.5">Estado</th>
              <th className="p-3.5 text-right">Ingresos Tarjeta</th>
              <th className="p-3.5 text-right">Efectivo Teórico</th>
              <th className="p-3.5 text-right">Efectivo Real Contado</th>
              <th className="p-3.5 text-right">Remanente (Fondo de caja)</th>
              <th className="p-3.5 text-right">Descuadre</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {cargando && historialCajas.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-500">
                  Cargando historial de cajas...
                </td>
              </tr>
            ) : cajasPaginadas.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-500">
                  No hay registros de caja en el historial todavía.
                </td>
              </tr>
            ) : (
              cajasPaginadas.map((caja) => {
                const esAbierta = String(caja.estado).toLowerCase() === 'abierta';
                const fondoRemanente =
                  esAbierta || caja.remanente_cierre === undefined || caja.remanente_cierre === null
                    ? caja.remanente_apertura
                    : caja.remanente_cierre;

                return (
                  <tr key={caja.id} className="hover:bg-white/[0.03] transition-colors">
                    <td className="p-3.5 font-mono font-black text-amber-400">#{caja.id}</td>
                    <td className="p-3.5 font-mono text-slate-200">{formatearFechaCaja(caja)}</td>
                    <td className="p-3.5">
                      <span
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${
                          esAbierta
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : 'bg-slate-500/15 text-slate-300 border-white/10'
                        }`}
                      >
                        {esAbierta ? 'Abierta' : 'Cerrada'}
                      </span>
                    </td>
                    <td className="p-3.5 text-right font-mono text-sky-400">
                      {formatearEuros(caja.total_tarjeta)}
                    </td>
                    <td className="p-3.5 text-right font-mono text-slate-200">
                      {formatearEuros(caja.total_efectivo)}
                    </td>
                    <td className="p-3.5 text-right font-mono font-bold text-white">
                      {formatearEuros(caja.efectivo_real)}
                    </td>
                    <td className="p-3.5 text-right font-mono text-slate-300">
                      {formatearEuros(fondoRemanente)}
                    </td>
                    <td className="p-3.5 text-right font-mono">
                      {renderDescuadre(caja)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación básica */}
      {historialCajas.length > filasPorPagina && (
        <div className="flex items-center justify-between pt-2 text-xs text-slate-400">
          <span>
            Mostrando {indiceInicio + 1} - {Math.min(indiceInicio + filasPorPagina, historialCajas.length)} de{' '}
            {historialCajas.length} cajas
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPaginaActual((p) => Math.max(1, p - 1))}
              disabled={paginaActual === 1}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white disabled:opacity-40 cursor-pointer flex items-center gap-1"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Anterior
            </button>
            <span className="font-mono font-bold text-white px-2">
              Página {paginaActual} / {totalPaginas}
            </span>
            <button
              type="button"
              onClick={() => setPaginaActual((p) => Math.min(totalPaginas, p + 1))}
              disabled={paginaActual === totalPaginas}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white disabled:opacity-40 cursor-pointer flex items-center gap-1"
            >
              Siguiente <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
