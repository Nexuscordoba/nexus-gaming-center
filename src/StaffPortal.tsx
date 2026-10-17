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
  ArrowLeft,
  FileSpreadsheet,
  Filter,
  Users
} from 'lucide-react';

interface Empleado {
  id: string;
  nombre: string;
  apellidos: string;
  dni_nie: string;
  pin_acceso: string;
  rol: string;
}

interface RegistroFichaje {
  id: string;
  empleado_id: string;
  tipo: 'entrada' | 'inicio_descanso' | 'fin_descanso' | 'salida';
  timestamp_fichaje: string;
  empleados?: {
    nombre: string;
    apellidos: string;
    dni_nie: string;
  };
}

export default function StaffPortal() {
  const [pin, setPin] = useState('');
  const [empleado, setEmpleado] = useState<Empleado | null>(null);
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [horaActual, setHoraActual] = useState(new Date());

  // Estados del visor de administración
  const [vistaAdmin, setVistaAdmin] = useState(false);
  const [fichajes, setFichajes] = useState<RegistroFichaje[]>([]);
  const [filtroPeriodo, setFiltroPeriodo] = useState<'hoy' | 'semana' | 'mes'>('hoy');
  const [loadingFichajes, setLoadingFichajes] = useState(false);

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

  // Cargar registros para el visor
  const cargarFichajes = async () => {
    setLoadingFichajes(true);
    try {
      let fechaInicio = new Date();
      fechaInicio.setHours(0, 0, 0, 0);

      if (filtroPeriodo === 'semana') {
        fechaInicio.setDate(fechaInicio.getDate() - 7);
      } else if (filtroPeriodo === 'mes') {
        fechaInicio.setDate(1); // Primer día del mes
      }

      const { data, error } = await supabase
        .from('fichajes')
        .select(`
          id,
          empleado_id,
          tipo,
          timestamp_fichaje,
          empleados (
            nombre,
            apellidos,
            dni_nie
          )
        `)
        .gte('timestamp_fichaje', fechaInicio.toISOString())
        .order('timestamp_fichaje', { ascending: false });

      if (error) throw error;
      setFichajes((data as unknown as RegistroFichaje[]) || []);
    } catch (err: any) {
      console.error('Error al cargar fichajes:', err);
    } finally {
      setLoadingFichajes(false);
    }
  };

  useEffect(() => {
    if (vistaAdmin) {
      cargarFichajes();
    }
  }, [vistaAdmin, filtroPeriodo]);

  // Descarga en formato CSV compatible con Excel
  const exportarCSV = () => {
    if (fichajes.length === 0) return;

    const cabeceras = ['Fecha', 'Hora', 'Empleado', 'DNI', 'Tipo de Registro'];
    const filas = fichajes.map((f) => {
      const fecha = new Date(f.timestamp_fichaje);
      return [
        fecha.toLocaleDateString('es-ES'),
        fecha.toLocaleTimeString('es-ES'),
        `"${f.empleados?.nombre || ''} ${f.empleados?.apellidos || ''}"`,
        f.empleados?.dni_nie || '',
        f.tipo
      ];
    });

    const contenidoCSV = [cabeceras.join(';'), ...filas.map((r) => r.join(';'))].join('\n');
    const blob = new Blob(['\uFEFF' + contenidoCSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `registro_jornada_nexus_${filtroPeriodo}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatearTipo = (tipo: string) => {
    switch (tipo) {
      case 'entrada':
        return <span className="text-emerald-400 font-bold bg-emerald-950/40 border border-emerald-500/20 px-2 py-0.5 rounded text-[11px]">Entrada</span>;
      case 'salida':
        return <span className="text-rose-400 font-bold bg-rose-950/40 border border-rose-500/20 px-2 py-0.5 rounded text-[11px]">Salida</span>;
      case 'inicio_descanso':
        return <span className="text-amber-400 font-bold bg-amber-950/40 border border-amber-500/20 px-2 py-0.5 rounded text-[11px]">Pausa / Café</span>;
      case 'fin_descanso':
        return <span className="text-sky-400 font-bold bg-sky-950/40 border border-sky-500/20 px-2 py-0.5 rounded text-[11px]">Fin Pausa</span>;
      default:
        return tipo;
    }
  };

  return (
    <div className="min-h-screen bg-[#06070a] text-slate-100 flex flex-col justify-between selection:bg-cyan-500 selection:text-black">
      {/* Cabecera */}
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

      {/* Contenido principal */}
      <main className="flex-1 flex items-center justify-center p-4">
        {vistaAdmin ? (
          /* PANTALLA: VISOR DE INFORMES Y AUDITORÍA */
          <div className="w-full max-w-4xl bg-[#0c0d14] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
              <div>
                <span className="text-xs text-cyan-400 font-semibold uppercase tracking-wider">Auditoría Laboral</span>
                <h2 className="text-2xl font-bold text-white">Registro Histórico de Fichajes</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={exportarCSV}
                  disabled={fichajes.length === 0}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 transition-all disabled:opacity-40 cursor-pointer"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Descargar Excel/CSV
                </button>
                <button
                  onClick={() => setVistaAdmin(false)}
                  className="flex items-center gap-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 text-xs text-slate-300 transition-all cursor-pointer"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Volver al Teclado
                </button>
              </div>
            </div>

            {/* Selector de periodo */}
            <div className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 text-slate-400">
                <Filter className="h-4 w-4 text-cyan-400" />
                <span>Periodo:</span>
                <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 ml-2">
                  <button
                    onClick={() => setFiltroPeriodo('hoy')}
                    className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                      filtroPeriodo === 'hoy' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Hoy
                  </button>
                  <button
                    onClick={() => setFiltroPeriodo('semana')}
                    className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                      filtroPeriodo === 'semana' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Últimos 7 días
                  </button>
                  <button
                    onClick={() => setFiltroPeriodo('mes')}
                    className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                      filtroPeriodo === 'mes' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Este mes
                  </button>
                </div>
              </div>

              <span className="text-slate-500">{fichajes.length} registros cargados</span>
            </div>

            {/* Tabla de registros */}
            <div className="border border-white/10 rounded-2xl overflow-hidden bg-black/30 max-h-[380px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-white/[0.03] text-slate-400 border-b border-white/10 uppercase tracking-wider font-semibold sticky top-0 backdrop-blur-md">
                  <tr>
                    <th className="py-3 px-4">Empleado</th>
                    <th className="py-3 px-4">DNI</th>
                    <th className="py-3 px-4">Fecha</th>
                    <th className="py-3 px-4">Hora</th>
                    <th className="py-3 px-4">Registro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300">
                  {loadingFichajes ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">
                        Cargando registros...
                      </td>
                    </tr>
                  ) : fichajes.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">
                        No hay fichajes registrados en este periodo.
                      </td>
                    </tr>
                  ) : (
                    fichajes.map((f) => {
                      const fecha = new Date(f.timestamp_fichaje);
                      return (
                        <tr key={f.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-3 px-4 font-semibold text-white">
                            {f.empleados?.nombre} {f.empleados?.apellidos}
                          </td>
                          <td className="py-3 px-4 text-slate-400">{f.empleados?.dni_nie}</td>
                          <td className="py-3 px-4">{fecha.toLocaleDateString('es-ES')}</td>
                          <td className="py-3 px-4 font-mono text-cyan-400 font-bold">
                            {fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </td>
                          <td className="py-3 px-4">{formatearTipo(f.tipo)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* TERMINAL HABITUAL (TECLADO O PANTALLA DE ACCIONES) */
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

                {empleado.rol === 'admin' && (
                  <div className="pt-3 border-t border-white/10">
                    <button
                      onClick={() => setVistaAdmin(true)}
                      className="w-full py-2.5 rounded-xl border border-cyan-500/30 bg-cyan-950/30 hover:bg-cyan-900/40 text-cyan-400 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <Users className="h-4 w-4" />
                      Abrir Visor e Informes de Empresa
                    </button>
                  </div>
                )}
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
        )}
      </main>

      <footer className="border-t border-white/5 py-4 text-center text-xs text-slate-500">
        NEXUS CORDOBA SL · Sistema conforme al Real Decreto-ley 8/2019 de Registro Horario
      </footer>
    </div>
  );
}