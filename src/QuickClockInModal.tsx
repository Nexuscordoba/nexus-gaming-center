import React, { useState } from 'react';
import { supabase } from './supabase';
import { Clock, X, CheckCircle2, AlertTriangle, Coffee, Play, LogIn, LogOut, Delete } from 'lucide-react';

interface QuickClockInModalProps {
  isOpen: boolean;
  onClose: () => void;
  pantallaOrigen?: 'camarero' | 'cocina' | 'general';
}

type TipoFichaje = 'entrada' | 'inicio_descanso' | 'fin_descanso' | 'salida';

export const QuickClockInModal: React.FC<QuickClockInModalProps> = ({
  isOpen,
  onClose,
  pantallaOrigen = 'general'
}) => {
  const [pin, setPin] = useState('');
  const [empleadoVerificado, setEmpleadoVerificado] = useState<any | null>(null);
  const [ultimoFichaje, setUltimoFichaje] = useState<any | null>(null);
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error' | 'info'; texto: string } | null>(null);

  if (!isOpen) return null;

  const handleDigito = async (digito: string) => {
    if (pin.length >= 4) return;
    const nuevoPin = pin + digito;
    setPin(nuevoPin);
    setMensaje(null);

    if (nuevoPin.length === 4) {
      verificarPinEmpleado(nuevoPin);
    }
  };

  const handleBorrar = () => {
    setPin((prev) => prev.slice(0, -1));
    setMensaje(null);
  };

  const verificarPinEmpleado = async (pinAProbar: string) => {
    setCargando(true);
    try {
      const { data, error } = await supabase
        .from('empleados')
        .select('*')
        .or(`pin_acceso.eq.${pinAProbar},codigo_pin.eq.${pinAProbar}`)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setMensaje({ tipo: 'error', texto: 'PIN incorrecto. Inténtalo de nuevo.' });
        setPin('');
        setCargando(false);
        return;
      }

      if (data.activo === false) {
        setMensaje({
          tipo: 'error',
          texto: `Empleado ${data.nombre} inactivo. Fichaje no permitido por la empresa.`
        });
        setPin('');
        setCargando(false);
        return;
      }

      setEmpleadoVerificado(data);

      // Cargar último fichaje
      const { data: ultData } = await supabase
        .from('fichajes')
        .select('*')
        .eq('empleado_id', data.id)
        .order('timestamp_fichaje', { ascending: false })
        .limit(1)
        .maybeSingle();

      setUltimoFichaje(ultData || null);
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: 'Error al verificar: ' + err.message });
      setPin('');
    } finally {
      setCargando(false);
    }
  };

  const registrarFichaje = async (tipo: TipoFichaje) => {
    if (!empleadoVerificado) return;
    setCargando(true);
    setMensaje(null);

    try {
      const now = new Date().toISOString();
      const { error } = await supabase.from('fichajes').insert([
        {
          empleado_id: empleadoVerificado.id,
          tipo,
          timestamp_fichaje: now,
          notas: `Fichaje rápido desde pantalla ${pantallaOrigen}`
        }
      ]);

      if (error) throw error;

      const tipoNombres: Record<TipoFichaje, string> = {
        entrada: 'Entrada al turno',
        inicio_descanso: 'Inicio de Pausa / Café',
        fin_descanso: 'Fin de Pausa / Regreso al turno',
        salida: 'Salida del turno'
      };

      setMensaje({
        tipo: 'ok',
        texto: `¡${tipoNombres[tipo]} registrada para ${empleadoVerificado.nombre} a las ${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}!`
      });

      // Reset y auto-cierre
      setTimeout(() => {
        handleReset();
        onClose();
      }, 1800);
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: 'Error al registrar fichaje: ' + err.message });
    } finally {
      setCargando(false);
    }
  };

  const handleReset = () => {
    setPin('');
    setEmpleadoVerificado(null);
    setUltimoFichaje(null);
    setMensaje(null);
  };

  const getEtiquetaUltimoEstado = () => {
    if (!ultimoFichaje) return 'Sin registros previos hoy';
    const hora = new Date(ultimoFichaje.timestamp_fichaje).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });
    switch (ultimoFichaje.tipo) {
      case 'entrada':
        return `🟢 En turno (Entrada: ${hora})`;
      case 'inicio_descanso':
        return `☕ En pausa / descanso (${hora})`;
      case 'fin_descanso':
        return `🟢 En turno tras pausa (${hora})`;
      case 'salida':
        return `🔴 Turno finalizado (Salida: ${hora})`;
      default:
        return `${ultimoFichaje.tipo} (${hora})`;
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in">
      <div className="w-full max-w-sm rounded-3xl border border-cyan-500/40 bg-[#0c0f17] p-6 shadow-2xl relative">
        {/* Cabecera */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">Control Horario Rápido</h3>
              <p className="text-[10px] text-slate-400">Personal de {pantallaOrigen}</p>
            </div>
          </div>
          <button
            onClick={() => {
              handleReset();
              onClose();
            }}
            className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mensaje de estado / feedback */}
        {mensaje && (
          <div
            className={`my-3 p-3 rounded-xl text-xs font-bold flex items-center gap-2 animate-slide-up ${
              mensaje.tipo === 'ok'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : mensaje.tipo === 'error'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
            }`}
          >
            {mensaje.tipo === 'ok' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0" />
            )}
            <span>{mensaje.texto}</span>
          </div>
        )}

        {/* PASO 1: Teclado PIN si no verificado */}
        {!empleadoVerificado ? (
          <div className="mt-4 space-y-4">
            <div className="text-center">
              <p className="text-xs text-slate-300 font-medium mb-3">Introduce tu PIN de 4 dígitos</p>
              <div className="flex justify-center gap-3">
                {[0, 1, 2, 3].map((idx) => (
                  <div
                    key={idx}
                    className={`h-11 w-11 rounded-2xl border flex items-center justify-center text-lg font-black transition-all ${
                      pin.length > idx
                        ? 'border-cyan-400 bg-cyan-950/60 text-cyan-300 shadow-[0_0_15px_rgba(0,242,254,0.3)]'
                        : 'border-white/15 bg-black/40 text-transparent'
                    }`}
                  >
                    {pin.length > idx ? '●' : ''}
                  </div>
                ))}
              </div>
            </div>

            {/* Teclado numérico */}
            <div className="grid grid-cols-3 gap-2 pt-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  type="button"
                  disabled={cargando}
                  onClick={() => handleDigito(String(num))}
                  className="h-12 rounded-xl bg-white/5 hover:bg-cyan-500/20 active:bg-cyan-500/30 border border-white/10 hover:border-cyan-500/40 text-base font-bold text-white transition-all cursor-pointer flex items-center justify-center"
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                onClick={handleReset}
                className="h-12 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-400 transition-all cursor-pointer flex items-center justify-center uppercase"
              >
                Limpiar
              </button>
              <button
                type="button"
                disabled={cargando}
                onClick={() => handleDigito('0')}
                className="h-12 rounded-xl bg-white/5 hover:bg-cyan-500/20 active:bg-cyan-500/30 border border-white/10 hover:border-cyan-500/40 text-base font-bold text-white transition-all cursor-pointer flex items-center justify-center"
              >
                0
              </button>
              <button
                type="button"
                disabled={cargando || pin.length === 0}
                onClick={handleBorrar}
                className="h-12 rounded-xl bg-white/5 hover:bg-rose-500/20 border border-white/10 text-slate-300 hover:text-rose-300 transition-all cursor-pointer flex items-center justify-center"
              >
                <Delete className="h-5 w-5" />
              </button>
            </div>
          </div>
        ) : (
          /* PASO 2: Opciones de fichaje del empleado verificado */
          <div className="mt-4 space-y-4 animate-slide-up">
            <div className="bg-slate-900/80 border border-cyan-500/30 rounded-2xl p-3.5 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-cyan-400 uppercase font-black tracking-wider">Empleado Identificado</p>
                <h4 className="text-sm font-black text-white">{empleadoVerificado.nombre} {empleadoVerificado.apellidos || ''}</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">{getEtiquetaUltimoEstado()}</p>
              </div>
              <button
                onClick={handleReset}
                className="text-[10px] uppercase font-bold text-slate-400 hover:text-white px-2 py-1 rounded bg-white/5 border border-white/10 cursor-pointer"
              >
                Cambiar
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={cargando}
                onClick={() => registrarFichaje('entrada')}
                className="p-3 rounded-2xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 font-bold text-xs flex flex-col items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                <LogIn className="h-5 w-5 text-emerald-400" />
                <span>Entrada</span>
              </button>

              <button
                type="button"
                disabled={cargando}
                onClick={() => registrarFichaje('salida')}
                className="p-3 rounded-2xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-300 font-bold text-xs flex flex-col items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                <LogOut className="h-5 w-5 text-rose-400" />
                <span>Salida</span>
              </button>

              <button
                type="button"
                disabled={cargando}
                onClick={() => registrarFichaje('inicio_descanso')}
                className="p-3 rounded-2xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 font-bold text-xs flex flex-col items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                <Coffee className="h-5 w-5 text-amber-400" />
                <span>Pausa / Café</span>
              </button>

              <button
                type="button"
                disabled={cargando}
                onClick={() => registrarFichaje('fin_descanso')}
                className="p-3 rounded-2xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 font-bold text-xs flex flex-col items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                <Play className="h-5 w-5 text-cyan-400" />
                <span>Fin Pausa</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuickClockInModal;
