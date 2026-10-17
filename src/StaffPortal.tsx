import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { 
  Clock, 
  LogIn, 
  Coffee, 
  LogOut, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  Delete,
  ArrowLeft
} from 'lucide-react';

interface Empleado {
  id: string;
  nombre: string;
  apellidos: string;
  dni_nie: string;
  pin_acceso: string;
  rol: string;
}

export default function StaffPortal() {
  const [pin, setPin] = useState('');
  const [empleado, setEmpleado] = useState<Empleado | null>(null);
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [horaActual, setHoraActual] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setHoraActual(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleNumero = (num: string) => {
    if (pin.length < 6) {
      setPin((prev) => prev + num);
      setMensaje(null);
    }
  };

  const handleBorrar = () => {
    setPin((prev) => prev.slice(0, -1));
    setMensaje(null);
  };

  const verificarPin = async () => {
    if (pin.length < 4) {
      setMensaje({ tipo: 'error', texto: 'Introduce un PIN válido (mínimo 4 dígitos)' });
      return;
    }

    setLoading(true);
    setMensaje(null);

    try {
      const { data, error } = await supabase
        .from('empleados')
        .select('*')
        .eq('pin_acceso', pin)
        .eq('activo', true)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setMensaje({ tipo: 'error', texto: 'PIN incorrecto o empleado inactivo' });
        setPin('');
      } else {
        setEmpleado(data);
      }
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: 'Error de conexión: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  const registrarFichaje = async (tipo: 'entrada' | 'inicio_descanso' | 'fin_descanso' | 'salida') => {
    if (!empleado) return;

    setLoading(true);
    try {
      const { error } = await supabase.from('fichajes').insert([
        {
          empleado_id: empleado.id,
          tipo: tipo,
          timestamp_fichaje: new Date().toISOString()
        }
      ]);

      if (error) throw error;

      const titulos = {
        entrada: 'Entrada registrada',
        inicio_descanso: 'Inicio de descanso registrado',
        fin_descanso: 'Fin de descanso registrado',
        salida: 'Salida registrada'
      };

      setMensaje({
        tipo: 'ok',
        texto: `¡${titulos[tipo]} con éxito para ${empleado.nombre} a las ${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}!`
      });

      setTimeout(() => {
        setEmpleado(null);
        setPin('');
        setMensaje(null);
      }, 3500);

    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: 'No se pudo guardar el fichaje: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#06070a] text-slate-100 flex flex-col justify-between selection:bg-cyan-500 selection:text-black">
      <header className="border-b border-white/10 bg-[#08090d]/80 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-950/40 text-cyan-400">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-bold text-white text-base tracking-wide">
              NEXUS <span className="text-cyan-400">CONTROL DE JORNADA</span>
            </h1>
            <p className="text-[11px] text-slate-400">Portal de Registro Laboral · Chinales 45</p>
          </div>
        </div>

        <div className="text-right">
          <div className="text-xl sm:text-2xl font-mono font-bold text-cyan-400">
            {horaActual.toLocaleTimeString('es-ES')}
          </div>
          <div className="text-xs text-slate-400 capitalize">
            {horaActual.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })}
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#0c0d14] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl">
          {!empleado ? (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-lg font-bold text-white">Identificación de Empleado</h2>
                <p className="text-xs text-slate-400 mt-1">Introduce tu PIN de 4 dígitos para registrar la jornada</p>
              </div>

              <div className="flex justify-center gap-3 py-2">
                {[0, 1, 2, 3].map((idx) => (
                  <div
                    key={idx}
                    className={`h-4 w-4 rounded-full border transition-all ${
                      pin.length > idx
                        ? 'bg-cyan-400 border-cyan-300 shadow-[0_0_10px_rgba(0,242,254,0.5)]'
                        : 'border-white/20 bg-white/5'
                    }`}
                  />
                ))}
              </div>

              <div className="grid grid-cols-3 gap-3">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleNumero(num)}
                    className="h-14 rounded-2xl bg-white/[0.04] border border-white/5 text-xl font-bold text-white hover:bg-white/[0.1] active:scale-95 transition-all cursor-pointer"
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleBorrar}
                  className="h-14 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.08] active:scale-95 transition-all cursor-pointer"
                >
                  <Delete className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleNumero('0')}
                  className="h-14 rounded-2xl bg-white/[0.04] border border-white/5 text-xl font-bold text-white hover:bg-white/[0.1] active:scale-95 transition-all cursor-pointer"
                >
                  0
                </button>
                <button
                  type="button"
                  disabled={pin.length < 4 || loading}
                  onClick={verificarPin}
                  className="h-14 rounded-2xl bg-cyan-500 font-bold text-slate-950 hover:bg-cyan-400 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center shadow-[0_0_15px_rgba(0,242,254,0.3)]"
                >
                  {loading ? '...' : 'Entrar'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div>
                  <span className="text-xs text-cyan-400 font-semibold uppercase">Empleado verificado</span>
                  <h2 className="text-xl font-bold text-white mt-0.5">
                    {empleado.nombre} {empleado.apellidos}
                  </h2>
                  <span className="text-xs text-slate-400">DNI: {empleado.dni_nie}</span>
                </div>
                <button
                  onClick={() => {
                    setEmpleado(null);
                    setPin('');
                    setMensaje(null);
                  }}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10 cursor-pointer"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Salir
                </button>
              </div>

              <p className="text-xs text-center text-slate-300">Selecciona el tipo de registro:</p>

              <div className="grid grid-cols-2 gap-3">
                <button
                  disabled={loading}
                  onClick={() => registrarFichaje('entrada')}
                  className="flex flex-col items-center justify-center p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-900/50 active:scale-95 transition-all cursor-pointer shadow-lg"
                >
                  <LogIn className="h-6 w-6 mb-2" />
                  <span className="font-bold text-sm">Entrada</span>
                  <span className="text-[10px] text-emerald-300/70">Inicio jornada</span>
                </button>

                <button
                  disabled={loading}
                  onClick={() => registrarFichaje('salida')}
                  className="flex flex-col items-center justify-center p-4 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-rose-400 hover:bg-rose-900/50 active:scale-95 transition-all cursor-pointer shadow-lg"
                >
                  <LogOut className="h-6 w-6 mb-2" />
                  <span className="font-bold text-sm">Salida</span>
                  <span className="text-[10px] text-rose-300/70">Fin jornada</span>
                </button>

                <button
                  disabled={loading}
                  onClick={() => registrarFichaje('inicio_descanso')}
                  className="flex flex-col items-center justify-center p-4 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-amber-400 hover:bg-amber-900/50 active:scale-95 transition-all cursor-pointer shadow-lg"
                >
                  <Coffee className="h-6 w-6 mb-2" />
                  <span className="font-bold text-sm">Pausa / Café</span>
                  <span className="text-[10px] text-amber-300/70">Inicio descanso</span>
                </button>

                <button
                  disabled={loading}
                  onClick={() => registrarFichaje('fin_descanso')}
                  className="flex flex-col items-center justify-center p-4 rounded-2xl bg-sky-950/40 border border-sky-500/40 text-sky-400 hover:bg-sky-900/50 active:scale-95 transition-all cursor-pointer shadow-lg"
                >
                  <Clock className="h-6 w-6 mb-2" />
                  <span className="font-bold text-sm">Fin Pausa</span>
                  <span className="text-[10px] text-sky-300/70">Vuelta al puesto</span>
                </button>
              </div>
            </div>
          )}

          {mensaje && (
            <div
              className={`mt-5 p-3.5 rounded-xl border flex items-center gap-2.5 text-xs ${
                mensaje.tipo === 'ok'
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
              }`}
            >
              {mensaje.tipo === 'ok' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              <span>{mensaje.texto}</span>
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-white/5 py-4 text-center text-xs text-slate-500">
        NEXUS CORDOBA SL · Sistema conforme al Real Decreto-ley 8/2019 de Registro Horario
      </footer>
    </div>
  );
}