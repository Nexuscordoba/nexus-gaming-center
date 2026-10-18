import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { 
  Clock, 
  LogIn, 
  Coffee, 
  LogOut, 
  CheckCircle2, 
  AlertCircle, 
  Delete, 
  ArrowLeft, 
  FileSpreadsheet, 
  Filter, 
  Users, 
  FileText, 
  Palmtree, 
  HelpCircle, 
  KeyRound, 
  MapPin, 
  Phone 
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

interface Documento {
  id: string;
  titulo: string;
  tipo: string;
  periodo: string;
  archivo_url: string;
  fecha_subida: string;
}

interface Turno {
  id: string;
  dia_semana: string;
  hora_inicio: string;
  hora_fin: string;
  puesto: string;
}

interface Solicitud {
  id: string;
  empleado_id: string;
  tipo: string;
  fecha_inicio: string;
  fecha_fin: string;
  motivo: string;
  estado: 'pendiente' | 'aprobado' | 'rechazado';
  fecha_solicitud?: string;
  empleados?: {
    nombre: string;
    apellidos: string;
    dni_nie: string;
  };
}

interface ReservaEscape {
  id: string;
  modalidad: string;
  nombre_contacto: string;
  email_contacto: string;
  telefono_contacto: string;
  fecha_evento: string;
  hora_preferente: string;
  num_sesiones: number;
  tematica?: string;
  personas_por_sesion?: number;
  lugar_celebracion?: string;
  nombre_centro_educativo?: string;
  observaciones?: string;
  estado: string;
}

type TipoFichaje = 'entrada' | 'inicio_descanso' | 'fin_descanso' | 'salida';

export default function StaffPortal() {
  const [pin, setPin] = useState('');
  const [empleado, setEmpleado] = useState<Empleado | null>(null);
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [horaActual, setHoraActual] = useState(new Date());

  const [tabActiva, setTabActiva] = useState<'fichar' | 'horario' | 'permisos' | 'documentos' | 'salidas'>('fichar');
  const [ultimoEstado, setUltimoEstado] = useState<TipoFichaje | null>(null);
  const [loadingEstado, setLoadingEstado] = useState(false);
  const [fichajeAConfirmar, setFichajeAConfirmar] = useState<TipoFichaje | null>(null);

  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [reservasEscape, setReservasEscape] = useState<ReservaEscape[]>([]);

  // Formulario de permisos
  const [tipoPermiso, setTipoPermiso] = useState('vacaciones');
  const [fechaInicioPermiso, setFechaInicioPermiso] = useState('');
  const [fechaFinPermiso, setFechaFinPermiso] = useState('');
  const [motivoPermiso, setMotivoPermiso] = useState('');
  const [enviandoPermiso, setEnviandoPermiso] = useState(false);

  // Visor de administración
  const [vistaAdmin, setVistaAdmin] = useState(false);
  const [tabAdmin, setTabAdmin] = useState<'fichajes' | 'solicitudes' | 'escapes'>('fichajes');
  const [fichajes, setFichajes] = useState<RegistroFichaje[]>([]);
  const [filtroPeriodo, setFiltroPeriodo] = useState<'hoy' | 'semana' | 'mes'>('hoy');
  const [loadingFichajes, setLoadingFichajes] = useState(false);

  const [todasSolicitudes, setTodasSolicitudes] = useState<Solicitud[]>([]);
  const [loadingSolicitudes, setLoadingSolicitudes] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setHoraActual(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const volverAWebPrincipal = () => {
    if (window.location.hash) {
      window.location.hash = '';
    } else {
      window.location.href = 'https://nexusgamingcenter.es';
    }
  };

  const consultarUltimoFichaje = async (empleadoId: string) => {
    setLoadingEstado(true);
    try {
      const { data, error } = await supabase
        .from('fichajes')
        .select('tipo')
        .eq('empleado_id', empleadoId)
        .order('timestamp_fichaje', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setUltimoEstado(data ? (data.tipo as TipoFichaje) : null);
    } catch (err) {
      console.error('Error al consultar estado laboral:', err);
    } finally {
      setLoadingEstado(false);
    }
  };

  const cargarReservasEscape = async () => {
    const hoy = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from('reservas_escape_room')
      .select('*')
      .gte('fecha_evento', hoy)
      .order('fecha_evento', { ascending: true });

    if (data) {
      setReservasEscape(data);
    }
  };

  const cargarTodasSolicitudesAdmin = async () => {
    setLoadingSolicitudes(true);
    try {
      const { data, error } = await supabase
        .from('solicitudes_permisos')
        .select(`
          id,
          empleado_id,
          tipo,
          fecha_inicio,
          fecha_fin,
          motivo,
          estado,
          fecha_solicitud,
          empleados (
            nombre,
            apellidos,
            dni_nie
          )
        `)
        .order('fecha_solicitud', { ascending: false });

      if (error) throw error;
      setTodasSolicitudes((data as unknown as Solicitud[]) || []);
    } catch (err) {
      console.error('Error al cargar solicitudes de personal:', err);
    } finally {
      setLoadingSolicitudes(false);
    }
  };

  useEffect(() => {
    if (!empleado) return;

    consultarUltimoFichaje(empleado.id);
    cargarReservasEscape();

    const cargarDatosEmpleado = async () => {
      const { data: docs } = await supabase
        .from('empleado_documentos')
        .select('*')
        .eq('empleado_id', empleado.id)
        .order('fecha_subida', { ascending: false });
      if (docs) setDocumentos(docs);

      const { data: t } = await supabase
        .from('turnos_semanales')
        .select('*')
        .eq('empleado_id', empleado.id)
        .eq('activo', true);
      if (t) setTurnos(t);

      const { data: sol } = await supabase
        .from('solicitudes_permisos')
        .select('*')
        .eq('empleado_id', empleado.id)
        .order('fecha_solicitud', { ascending: false });
      if (sol) setSolicitudes(sol);
    };

    cargarDatosEmpleado();

    if (empleado.rol === 'admin') {
      cargarTodasSolicitudesAdmin();
    }
  }, [empleado]);

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
        setTabActiva('fichar');
      }
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: 'Error de conexión: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  const confirmarYRegistrarFichaje = async () => {
    if (!empleado || !fichajeAConfirmar) return;

    const tipo = fichajeAConfirmar;
    setFichajeAConfirmar(null);
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

      setUltimoEstado(tipo);

      const titulos = {
        entrada: 'Entrada registrada',
        inicio_descanso: 'Inicio de descanso registrado',
        fin_descanso: 'Fin de descanso registrado',
        salida: 'Salida registrada'
      };

      setMensaje({
        tipo: 'ok',
        texto: `¡${titulos[tipo]} confirmada a las ${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}!`
      });

      setTimeout(() => {
        setMensaje(null);
      }, 4000);

    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: 'No se pudo guardar el fichaje: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  const estaHabilitado = (tipo: TipoFichaje): boolean => {
    if (loading || loadingEstado) return false;

    if (!ultimoEstado || ultimoEstado === 'salida') {
      return tipo === 'entrada';
    }

    if (ultimoEstado === 'entrada' || ultimoEstado === 'fin_descanso') {
      return tipo === 'inicio_descanso' || tipo === 'salida';
    }

    if (ultimoEstado === 'inicio_descanso') {
      return tipo === 'fin_descanso';
    }

    return false;
  };

  const getTextoConfirmacion = (tipo: TipoFichaje) => {
    switch (tipo) {
      case 'entrada':
        return '¿Confirmas el inicio de tu jornada laboral?';
      case 'salida':
        return '¿Confirmas la salida y cierre de tu jornada?';
      case 'inicio_descanso':
        return '¿Confirmas el inicio de tu pausa / café?';
      case 'fin_descanso':
        return '¿Confirmas el fin del descanso y vuelta al puesto?';
    }
  };

  const solicitarPermiso = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empleado || !fechaInicioPermiso || !fechaFinPermiso) return;

    setEnviandoPermiso(true);
    try {
      const { data, error } = await supabase.from('solicitudes_permisos').insert([
        {
          empleado_id: empleado.id,
          tipo: tipoPermiso,
          fecha_inicio: fechaInicioPermiso,
          fecha_fin: fechaFinPermiso,
          motivo: motivoPermiso,
          estado: 'pendiente'
        }
      ]).select().single();

      if (error) throw error;

      setSolicitudes([data, ...solicitudes]);
      setFechaInicioPermiso('');
      setFechaFinPermiso('');
      setMotivoPermiso('');
      setMensaje({ tipo: 'ok', texto: 'Solicitud enviada para revisión por la empresa.' });

      if (empleado.rol === 'admin') {
        cargarTodasSolicitudesAdmin();
      }
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: 'Error al enviar la solicitud: ' + err.message });
    } finally {
      setEnviandoPermiso(false);
    }
  };

  const resolverSolicitud = async (id: string, nuevoEstado: 'aprobado' | 'rechazado') => {
    try {
      const { error } = await supabase
        .from('solicitudes_permisos')
        .update({ estado: nuevoEstado })
        .eq('id', id);

      if (error) throw error;

      setTodasSolicitudes((prev) =>
        prev.map((s) => (s.id === id ? { ...s, estado: nuevoEstado } : s))
      );

      setMensaje({
        tipo: 'ok',
        texto: `Solicitud ${nuevoEstado === 'aprobado' ? 'aprobada' : 'rechazada'} correctamente.`
      });

      setTimeout(() => setMensaje(null), 3000);
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: 'Error al actualizar: ' + err.message });
    }
  };

  const obtenerSolapamientos = (solicitudActual: Solicitud) => {
    const inicioA = new Date(solicitudActual.fecha_inicio).getTime();
    const finA = new Date(solicitudActual.fecha_fin).getTime();

    return todasSolicitudes.filter((s) => {
      if (s.id === solicitudActual.id || s.empleado_id === solicitudActual.empleado_id || s.estado === 'rechazado') {
        return false;
      }

      const inicioB = new Date(s.fecha_inicio).getTime();
      const finB = new Date(s.fecha_fin).getTime();

      return inicioA <= finB && finA >= inicioB;
    });
  };

  const cargarFichajes = async () => {
    setLoadingFichajes(true);
    try {
      let fechaInicio = new Date();
      fechaInicio.setHours(0, 0, 0, 0);

      if (filtroPeriodo === 'semana') {
        fechaInicio.setDate(fechaInicio.getDate() - 7);
      } else if (filtroPeriodo === 'mes') {
        fechaInicio.setDate(1);
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
    if (vistaAdmin && tabAdmin === 'fichajes') {
      cargarFichajes();
    }
    if (vistaAdmin && tabAdmin === 'solicitudes') {
      cargarTodasSolicitudesAdmin();
    }
    if (vistaAdmin && tabAdmin === 'escapes') {
      cargarReservasEscape();
    }
  }, [vistaAdmin, tabAdmin, filtroPeriodo]);

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

  const totalPendientes = todasSolicitudes.filter((s) => s.estado === 'pendiente').length;

  return (
    <div className="min-h-screen bg-[#06070a] text-slate-100 flex flex-col justify-between selection:bg-cyan-500 selection:text-black relative">
      {/* Cabecera unificada */}
      <header className="border-b border-white/10 bg-[#08090d]/80 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={volverAWebPrincipal}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs text-slate-300 hover:text-white transition-all cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Volver a la web principal</span>
          </button>
          <div className="hidden sm:block">
            <h1 className="font-bold text-white text-base tracking-wide flex items-center gap-2">
              NEXUS <span className="text-cyan-400">PORTAL DEL EQUIPO</span>
            </h1>
            <p className="text-[11px] text-slate-400">Gestión de Personal · Chinales 45</p>
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
          /* VISTA ADMINISTRACIÓN AVANZADA */
          <div className="w-full max-w-4xl bg-[#0c0d14] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
              <div>
                <span className="text-xs text-cyan-400 font-semibold uppercase tracking-wider">Panel de Control Directivo</span>
                <h2 className="text-2xl font-bold text-white">Supervisión General</h2>
              </div>
              <div className="flex items-center gap-2">
                {tabAdmin === 'fichajes' && (
                  <button
                    onClick={exportarCSV}
                    disabled={fichajes.length === 0}
                    className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 transition-all disabled:opacity-40 cursor-pointer"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    Descargar Excel/CSV
                  </button>
                )}
                <button
                  onClick={() => setVistaAdmin(false)}
                  className="flex items-center gap-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 text-xs text-slate-300 transition-all cursor-pointer"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Volver al Teclado
                </button>
              </div>
            </div>

            {/* Selector de módulo de administración */}
            <div className="flex flex-wrap gap-2 border-b border-white/10 pb-4">
              <button
                onClick={() => setTabAdmin('fichajes')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  tabAdmin === 'fichajes'
                    ? 'bg-cyan-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white bg-white/5'
                }`}
              >
                <Clock className="h-4 w-4" />
                Histórico Fichajes
              </button>

              <button
                onClick={() => setTabAdmin('solicitudes')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer relative ${
                  tabAdmin === 'solicitudes'
                    ? 'bg-cyan-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white bg-white/5'
                }`}
              >
                <Palmtree className="h-4 w-4" />
                Vacaciones y Permisos
                {totalPendientes > 0 && (
                  <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950 animate-pulse">
                    {totalPendientes} pendientes
                  </span>
                )}
              </button>

              <button
                onClick={() => setTabAdmin('escapes')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  tabAdmin === 'escapes'
                    ? 'bg-cyan-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white bg-white/5'
                }`}
              >
                <KeyRound className="h-4 w-4" />
                Salidas Escape Room ({reservasEscape.length})
              </button>
            </div>

            {/* TAB ADMIN 1: FICHAJES */}
            {tabAdmin === 'fichajes' && (
              <div className="space-y-4">
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
                        <tr><td colSpan={5} className="py-8 text-center text-slate-500">Cargando...</td></tr>
                      ) : fichajes.length === 0 ? (
                        <tr><td colSpan={5} className="py-8 text-center text-slate-500">No hay fichajes en este periodo.</td></tr>
                      ) : (
                        fichajes.map((f) => {
                          const fecha = new Date(f.timestamp_fichaje);
                          return (
                            <tr key={f.id} className="hover:bg-white/[0.02]">
                              <td className="py-3 px-4 font-semibold text-white">{f.empleados?.nombre} {f.empleados?.apellidos}</td>
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
            )}

            {/* TAB ADMIN 2: PERMISOS */}
            {tabAdmin === 'solicitudes' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Revisión de peticiones y control de plantilla</span>
                  <span>{todasSolicitudes.length} peticiones</span>
                </div>

                {loadingSolicitudes ? (
                  <div className="py-12 text-center text-xs text-slate-500">Cargando solicitudes...</div>
                ) : todasSolicitudes.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-500">No hay solicitudes registradas.</div>
                ) : (
                  <div className="space-y-3 max-h-[420px] overflow-y-auto">
                    {todasSolicitudes.map((sol) => {
                      const solapados = obtenerSolapamientos(sol);
                      return (
                        <div key={sol.id} className="p-4 rounded-2xl border border-white/10 bg-white/[0.02]">
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white text-sm">{sol.empleados?.nombre} {sol.empleados?.apellidos}</span>
                                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/30 text-cyan-300">
                                  {sol.tipo.replace('_', ' ')}
                                </span>
                              </div>
                              <div className="text-xs text-slate-300 mt-1">
                                📅 {new Date(sol.fecha_inicio).toLocaleDateString('es-ES')} al {new Date(sol.fecha_fin).toLocaleDateString('es-ES')}
                                {sol.motivo && <span className="text-slate-400 italic ml-2">«{sol.motivo}»</span>}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {sol.estado === 'pendiente' ? (
                                <>
                                  <button
                                    onClick={() => resolverSolicitud(sol.id, 'aprobado')}
                                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs"
                                  >
                                    Aprobar
                                  </button>
                                  <button
                                    onClick={() => resolverSolicitud(sol.id, 'rechazado')}
                                    className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs"
                                  >
                                    Rechazar
                                  </button>
                                </>
                              ) : (
                                <span className="text-xs font-bold uppercase px-3 py-1 rounded-xl border border-white/10 text-slate-300">
                                  {sol.estado}
                                </span>
                              )}
                            </div>
                          </div>

                          {solapados.length > 0 && (
                            <div className="mt-3 p-2 rounded-xl bg-amber-950/30 border border-amber-500/30 text-amber-300 text-xs">
                              ⚠️ Coincide con: {solapados.map(s => `${s.empleados?.nombre} (${s.estado})`).join(', ')}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB ADMIN 3: SALIDAS ESCAPE ROOM */}
            {tabAdmin === 'escapes' && (
              <div className="space-y-4">
                <div className="text-xs text-slate-400 flex justify-between">
                  <span>Próximas salidas y eventos confirmados</span>
                  <span>{reservasEscape.length} reservas programadas</span>
                </div>

                {reservasEscape.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-500">No hay reservas programadas próximamente.</div>
                ) : (
                  <div className="space-y-3 max-h-[420px] overflow-y-auto">
                    {reservasEscape.map((r) => (
                      <div key={r.id} className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                          <div>
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-cyan-950 border border-cyan-500/30 text-cyan-300">
                              {r.modalidad.toUpperCase()}
                            </span>
                            <h4 className="text-base font-bold text-white mt-1">
                              {r.nombre_contacto} {r.nombre_centro_educativo ? `(${r.nombre_centro_educativo})` : ''}
                            </h4>
                            <p className="text-xs text-slate-300">
                              📅 {new Date(r.fecha_evento).toLocaleDateString('es-ES')} · Hora: <strong>{r.hora_preferente}</strong> ({r.num_sesiones} sesión/es)
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <a
                              href={`tel:${r.telefono_contacto}`}
                              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-200 flex items-center gap-1.5"
                            >
                              <Phone className="h-3.5 w-3.5 text-cyan-400" />
                              {r.telefono_contacto}
                            </a>
                            {r.lugar_celebracion && (
                              <a
                                href={`https://maps.google.com/?q=${encodeURIComponent(r.lugar_celebracion)}`}
                                target="_blank"
                                rel="noreferrer"
                                className="px-3 py-1.5 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs flex items-center gap-1 hover:bg-cyan-400"
                              >
                                <MapPin className="h-3.5 w-3.5" />
                                GPS
                              </a>
                            )}
                          </div>
                        </div>

                        {r.lugar_celebracion && (
                          <div className="text-xs text-slate-400 flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                            <span>{r.lugar_celebracion}</span>
                          </div>
                        )}

                        {r.observaciones && (
                          <p className="text-[11px] text-slate-400 italic bg-black/40 p-2.5 rounded-xl border border-white/5">
                            {r.observaciones}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* PORTAL DEL EMPLEADO / TECLADO PIN */
          <div className="w-full max-w-xl bg-[#0c0d14] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl">
            {!empleado ? (
              /* PANTALLA 1: TECLADO PIN */
              <div className="space-y-6 max-w-md mx-auto">
                <div className="text-center">
                  <h2 className="text-lg font-bold text-white">Identificación de Empleado</h2>
                  <p className="text-xs text-slate-400 mt-1">Introduce tu PIN de 4 dígitos para acceder al portal</p>
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
              /* PANTALLA 2: VISTA DEL EMPLEADO */
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
                      setUltimoEstado(null);
                    }}
                    className="text-xs text-slate-400 hover:text-white flex items-center gap-1 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10 cursor-pointer"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" /> Salir
                  </button>
                </div>

                {/* Pestañas de trabajador (incluye Salidas Escape) */}
                <div className="grid grid-cols-5 gap-1 p-1 bg-white/[0.03] border border-white/5 rounded-2xl text-[11px] font-semibold">
                  <button
                    onClick={() => setTabActiva('fichar')}
                    className={`py-2 rounded-xl flex items-center justify-center gap-1 transition-all cursor-pointer ${
                      tabActiva === 'fichar' ? 'bg-cyan-500 text-slate-950 font-bold shadow-md' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Clock className="h-3.5 w-3.5" /> Fichar
                  </button>
                  <button
                    onClick={() => setTabActiva('horario')}
                    className={`py-2 rounded-xl flex items-center justify-center gap-1 transition-all cursor-pointer ${
                      tabActiva === 'horario' ? 'bg-cyan-500 text-slate-950 font-bold shadow-md' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Clock className="h-3.5 w-3.5" /> Horario
                  </button>
                  <button
                    onClick={() => setTabActiva('salidas')}
                    className={`py-2 rounded-xl flex items-center justify-center gap-1 transition-all cursor-pointer ${
                      tabActiva === 'salidas' ? 'bg-cyan-500 text-slate-950 font-bold shadow-md' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <KeyRound className="h-3.5 w-3.5" /> Salidas
                  </button>
                  <button
                    onClick={() => setTabActiva('permisos')}
                    className={`py-2 rounded-xl flex items-center justify-center gap-1 transition-all cursor-pointer ${
                      tabActiva === 'permisos' ? 'bg-cyan-500 text-slate-950 font-bold shadow-md' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Palmtree className="h-3.5 w-3.5" /> Permisos
                  </button>
                  <button
                    onClick={() => setTabActiva('documentos')}
                    className={`py-2 rounded-xl flex items-center justify-center gap-1 transition-all cursor-pointer ${
                      tabActiva === 'documentos' ? 'bg-cyan-500 text-slate-950 font-bold shadow-md' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <FileText className="h-3.5 w-3.5" /> Nóminas
                  </button>
                </div>

                {/* 1. Fichar */}
                {tabActiva === 'fichar' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-white/[0.02] border border-white/5 text-xs">
                      <span className="text-slate-400">Estado de tu turno:</span>
                      {loadingEstado ? (
                        <span className="text-slate-500">Consultando...</span>
                      ) : !ultimoEstado || ultimoEstado === 'salida' ? (
                        <span className="text-rose-400 font-bold flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse"></span>
                          Fuera de servicio
                        </span>
                      ) : ultimoEstado === 'inicio_descanso' ? (
                        <span className="text-amber-400 font-bold flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse"></span>
                          En descanso / pausa
                        </span>
                      ) : (
                        <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                          Jornada activa
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        disabled={!estaHabilitado('entrada')}
                        onClick={() => setFichajeAConfirmar('entrada')}
                        className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all ${
                          estaHabilitado('entrada')
                            ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-400 hover:bg-emerald-900/50 active:scale-95 shadow-lg cursor-pointer'
                            : 'bg-white/[0.01] border-white/5 text-slate-600 opacity-30 cursor-not-allowed'
                        }`}
                      >
                        <LogIn className="h-6 w-6 mb-2" />
                        <span className="font-bold text-sm">Entrada</span>
                        <span className="text-[10px]">Inicio jornada</span>
                      </button>

                      <button
                        type="button"
                        disabled={!estaHabilitado('salida')}
                        onClick={() => setFichajeAConfirmar('salida')}
                        className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all ${
                          estaHabilitado('salida')
                            ? 'bg-rose-950/40 border-rose-500/50 text-rose-400 hover:bg-rose-900/50 active:scale-95 shadow-lg cursor-pointer'
                            : 'bg-white/[0.01] border-white/5 text-slate-600 opacity-30 cursor-not-allowed'
                        }`}
                      >
                        <LogOut className="h-6 w-6 mb-2" />
                        <span className="font-bold text-sm">Salida</span>
                        <span className="text-[10px]">Fin jornada</span>
                      </button>

                      <button
                        type="button"
                        disabled={!estaHabilitado('inicio_descanso')}
                        onClick={() => setFichajeAConfirmar('inicio_descanso')}
                        className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all ${
                          estaHabilitado('inicio_descanso')
                            ? 'bg-amber-950/40 border-amber-500/50 text-amber-400 hover:bg-amber-900/50 active:scale-95 shadow-lg cursor-pointer'
                            : 'bg-white/[0.01] border-white/5 text-slate-600 opacity-30 cursor-not-allowed'
                        }`}
                      >
                        <Coffee className="h-6 w-6 mb-2" />
                        <span className="font-bold text-sm">Pausa / Café</span>
                        <span className="text-[10px]">Inicio descanso</span>
                      </button>

                      <button
                        type="button"
                        disabled={!estaHabilitado('fin_descanso')}
                        onClick={() => setFichajeAConfirmar('fin_descanso')}
                        className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all ${
                          estaHabilitado('fin_descanso')
                            ? 'bg-sky-950/40 border-sky-500/50 text-sky-400 hover:bg-sky-900/50 active:scale-95 shadow-lg cursor-pointer'
                            : 'bg-white/[0.01] border-white/5 text-slate-600 opacity-30 cursor-not-allowed'
                        }`}
                      >
                        <Clock className="h-6 w-6 mb-2" />
                        <span className="font-bold text-sm">Fin Pausa</span>
                        <span className="text-[10px]">Vuelta al puesto</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* 2. Horario */}
                {tabActiva === 'horario' && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-white">Mi Cuadrante y Turno Asignado</h3>
                    {turnos.length === 0 ? (
                      <p className="text-xs text-slate-500 py-6 text-center">No hay turnos asignados actualmente para tu perfil.</p>
                    ) : (
                      <div className="space-y-2">
                        {turnos.map((t) => (
                          <div key={t.id} className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs">
                            <div>
                              <span className="font-bold text-white block">{t.dia_semana}</span>
                              <span className="text-slate-400 text-[11px]">{t.puesto}</span>
                            </div>
                            <div className="font-mono text-cyan-400 font-bold bg-cyan-950/30 border border-cyan-500/20 px-3 py-1.5 rounded-lg">
                              {t.hora_inicio.slice(0, 5)} - {t.hora_fin.slice(0, 5)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 3. Salidas Escape Room */}
                {tabActiva === 'salidas' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-white">Próximas Salidas Escape</h3>
                      <span className="text-[11px] text-cyan-400">{reservasEscape.length} programadas</span>
                    </div>

                    {reservasEscape.length === 0 ? (
                      <p className="text-xs text-slate-500 text-center py-6">No hay salidas programadas para estos días.</p>
                    ) : (
                      <div className="space-y-3 max-h-72 overflow-y-auto">
                        {reservasEscape.map((r) => (
                          <div key={r.id} className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-2.5">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-cyan-950 border border-cyan-500/30 text-cyan-300">
                                  {r.modalidad.toUpperCase()}
                                </span>
                                <h4 className="font-bold text-white text-xs mt-1">{r.nombre_contacto}</h4>
                                <span className="text-[11px] text-slate-400 block">
                                  📅 {new Date(r.fecha_evento).toLocaleDateString('es-ES')} · <strong>{r.hora_preferente}</strong>
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <a
                                  href={`tel:${r.telefono_contacto}`}
                                  className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-cyan-400 flex items-center gap-1"
                                >
                                  <Phone className="h-3.5 w-3.5" />
                                  Llamar
                                </a>
                                {r.lugar_celebracion && (
                                  <a
                                    href={`https://maps.google.com/?q=${encodeURIComponent(r.lugar_celebracion)}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-2.5 py-1.5 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs flex items-center gap-1 hover:bg-cyan-400"
                                  >
                                    <MapPin className="h-3.5 w-3.5" />
                                    Maps
                                  </a>
                                )}
                              </div>
                            </div>

                            {r.lugar_celebracion && (
                              <div className="text-[11px] text-slate-300 flex items-center gap-1.5 bg-black/30 p-2 rounded-xl">
                                <MapPin className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                                <span className="truncate">{r.lugar_celebracion}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 4. Permisos */}
                {tabActiva === 'permisos' && (
                  <div className="space-y-4">
                    <form onSubmit={solicitarPermiso} className="space-y-3 bg-white/[0.02] p-4 rounded-2xl border border-white/5">
                      <span className="text-xs font-bold text-white block">Nueva Petición de Permiso</span>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <select
                          value={tipoPermiso}
                          onChange={(e) => setTipoPermiso(e.target.value)}
                          className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white"
                        >
                          <option value="vacaciones">Vacaciones</option>
                          <option value="asuntos_propios">Asuntos Propios</option>
                          <option value="medico">Cita Médica</option>
                          <option value="otro">Otro</option>
                        </select>
                        <input
                          type="text"
                          placeholder="Motivo breve"
                          value={motivoPermiso}
                          onChange={(e) => setMotivoPermiso(e.target.value)}
                          className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <input
                          type="date"
                          required
                          value={fechaInicioPermiso}
                          onChange={(e) => setFechaInicioPermiso(e.target.value)}
                          className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white"
                        />
                        <input
                          type="date"
                          required
                          value={fechaFinPermiso}
                          onChange={(e) => setFechaFinPermiso(e.target.value)}
                          className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={enviandoPermiso}
                        className="w-full py-2.5 rounded-xl bg-cyan-500 font-bold text-slate-950 text-xs hover:bg-cyan-400"
                      >
                        {enviandoPermiso ? 'Enviando...' : 'Enviar Solicitud'}
                      </button>
                    </form>
                  </div>
                )}

                {/* 5. Nóminas */}
                {tabActiva === 'documentos' && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-white">Nóminas y Contratos</h3>
                    {documentos.length === 0 ? (
                      <p className="text-xs text-slate-500 text-center py-6">No hay documentos cargados en tu expediente.</p>
                    ) : (
                      <div className="space-y-2">
                        {documentos.map((d) => (
                          <div key={d.id} className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs">
                            <span className="font-bold text-white">{d.titulo}</span>
                            <a
                              href={d.archivo_url}
                              target="_blank"
                              rel="noreferrer"
                              className="px-3 py-1.5 rounded-lg border border-white/10 text-cyan-400 font-semibold"
                            >
                              Descargar
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Enlace para Administrador */}
                {empleado.rol === 'admin' && (
                  <div className="pt-3 border-t border-white/10">
                    <button
                      onClick={() => setVistaAdmin(true)}
                      className="w-full py-2.5 rounded-xl border border-cyan-500/30 bg-cyan-950/30 hover:bg-cyan-900/40 text-cyan-400 text-xs font-bold flex items-center justify-center gap-2"
                    >
                      <Users className="h-4 w-4" />
                      Abrir Panel de Supervisión y Salidas
                    </button>
                  </div>
                )}
              </div>
            )}

            {mensaje && (
              <div
                className={`mt-5 p-3.5 rounded-xl border flex items-center gap-2.5 text-xs ${
                  mensaje.tipo === 'ok' ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300' : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
                }`}
              >
                {mensaje.tipo === 'ok' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                <span>{mensaje.texto}</span>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modal confirmación fichaje */}
      {fichajeAConfirmar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#0e1017] p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-cyan-400">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-950/50 border border-cyan-500/30">
                <HelpCircle className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-white text-base">Confirmar registro</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">{getTextoConfirmacion(fichajeAConfirmar)}</p>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setFichajeAConfirmar(null)}
                className="py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarYRegistrarFichaje}
                className="py-2.5 rounded-xl bg-cyan-500 text-xs text-slate-950 font-bold"
              >
                Sí, registrar
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="border-t border-white/5 py-4 text-center text-xs text-slate-500">
        NEXUS CORDOBA SL · Sistema conforme al Real Decreto-ley 8/2019 de Registro Horario
      </footer>
    </div>
  );
}