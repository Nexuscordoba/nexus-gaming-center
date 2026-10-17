import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { 
  KeyRound, 
  Sparkles, 
  PartyPopper, 
  Coffee, 
  School, 
  Skull, 
  Hourglass, 
  Compass, 
  Send, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';

interface SesionCafeteria {
  id: string;
  titulo: string;
  tematica: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  plazas_totales: number;
  plazas_ocupadas: number;
  precio_por_persona: number;
  activa: boolean;
}

export default function EscapeRooms() {
  const [modalidad, setModalidad] = useState<'cafeteria' | 'evento_privado' | 'colegio'>('evento_privado');

  const [sesionesCafeteria, setSesionesCafeteria] = useState<SesionCafeteria[]>([]);
  const [sesionSeleccionada, setSesionSeleccionada] = useState<string>('');

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [fechaEvento, setFechaEvento] = useState('');
  const [horaPreferente, setHoraPreferente] = useState('17:00');
  const [observaciones, setObservaciones] = useState('');

  const [tematica, setTematica] = useState<'terror' | 'edad_antigua' | 'contemporaneo'>('terror');
  const [rangoEdad, setRangoEdad] = useState<'ninos' | 'adultos'>('adultos');
  const [personasPorSesion, setPersonasPorSesion] = useState<number>(4);
  const [numSesiones, setNumSesiones] = useState<number>(1);
  const [lugarEvento, setLugarEvento] = useState('');

  const [nombreColegio, setNombreColegio] = useState('');
  const [cursoAlumnos, setCursoAlumnos] = useState('');
  const [totalAlumnos, setTotalAlumnos] = useState<number>(25);

  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  useEffect(() => {
    const cargarSesiones = async () => {
      const { data, error } = await supabase
        .from('escape_noches_cafeteria')
        .select('*')
        .eq('activa', true)
        .gte('fecha', new Date().toISOString().slice(0, 10))
        .order('fecha', { ascending: true });

      if (!error && data) {
        setSesionesCafeteria(data);
        if (data.length > 0) {
          setSesionSeleccionada(data[0].id);
        }
      }
    };
    cargarSesiones();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setMensaje(null);

    try {
      const payload: any = {
        modalidad,
        nombre_contacto: nombre,
        email_contacto: email,
        telefono_contacto: telefono,
        fecha_evento: modalidad === 'cafeteria' 
          ? sesionesCafeteria.find(s => s.id === sesionSeleccionada)?.fecha || fechaEvento 
          : fechaEvento,
        hora_preferente: horaPreferente,
        observaciones,
        estado: 'pendiente'
      };

      if (modalidad === 'evento_privado') {
        payload.tematica = tematica;
        payload.rango_edad = rangoEdad;
        payload.personas_por_sesion = personasPorSesion;
        payload.num_sesiones = numSesiones;
        payload.lugar_celebracion = lugarEvento || 'Local del cliente / Espacio reservado';
      } else if (modalidad === 'colegio') {
        payload.nombre_centro_educativo = nombreColegio;
        payload.curso_edad_alumnos = cursoAlumnos;
        payload.total_alumnos_estimado = totalAlumnos;
        payload.lugar_celebracion = lugarEvento || 'Instalaciones del centro educativo';
        payload.num_sesiones = Math.ceil(totalAlumnos / 6);
      } else if (modalidad === 'cafeteria') {
        const sesion = sesionesCafeteria.find(s => s.id === sesionSeleccionada);
        payload.observaciones = `Reserva Noche de Escape: ${sesion?.titulo || ''}. ${observaciones}`;
        payload.personas_por_sesion = personasPorSesion;
      }

      const { error } = await supabase.from('reservas_escape_room').insert([payload]);
      if (error) throw error;

      setMensaje({
        tipo: 'ok',
        texto: '¡Solicitud enviada con éxito! Nos pondremos en contacto contigo para coordinar la sesión.'
      });

      setNombre('');
      setEmail('');
      setTelefono('');
      setFechaEvento('');
      setObservaciones('');
      setLugarEvento('');
      setNombreColegio('');
      setCursoAlumnos('');
      setTotalAlumnos(25);
    } catch (err: any) {
      setMensaje({
        tipo: 'error',
        texto: 'Error al tramitar la reserva: ' + (err.message || 'Inténtalo de nuevo')
      });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section id="escaperooms" className="py-20 bg-[#08090e] border-t border-white/5 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-cyan-500/10 blur-[130px] pointer-events-none rounded-full" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-950/40 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-4">
            <KeyRound className="h-4 w-4" />
            Nexus Escape Lab
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            VIVE LA EXPERIENCIA <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400">ESCAPE ROOM</span>
          </h2>
          <p className="mt-4 text-sm sm:text-base text-slate-300">
            Acertijos, enigmas e inmersión total. Noches en cafetería, eventos privados y escape rooms en colegios.
          </p>
        </div>

        {/* Selector de Modalidad */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          <button
            type="button"
            onClick={() => setModalidad('evento_privado')}
            className={`p-5 rounded-2xl border text-left transition-all cursor-pointer ${
              modalidad === 'evento_privado'
                ? 'bg-cyan-950/40 border-cyan-400 shadow-[0_0_20px_rgba(0,242,254,0.2)]'
                : 'bg-white/[0.02] border-white/10 hover:border-white/20 hover:bg-white/[0.04]'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <PartyPopper className={`h-6 w-6 ${modalidad === 'evento_privado' ? 'text-cyan-400' : 'text-slate-400'}`} />
              <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white/5 text-slate-300">
                A Medida
              </span>
            </div>
            <h3 className="font-bold text-white text-base">Eventos Privados</h3>
            <p className="text-xs text-slate-400 mt-1">Cumpleaños, bodas, bautizos o celebraciones.</p>
          </button>

          <button
            type="button"
            onClick={() => setModalidad('cafeteria')}
            className={`p-5 rounded-2xl border text-left transition-all cursor-pointer ${
              modalidad === 'cafeteria'
                ? 'bg-cyan-950/40 border-cyan-400 shadow-[0_0_20px_rgba(0,242,254,0.2)]'
                : 'bg-white/[0.02] border-white/10 hover:border-white/20 hover:bg-white/[0.04]'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <Coffee className={`h-6 w-6 ${modalidad === 'cafeteria' ? 'text-cyan-400' : 'text-slate-400'}`} />
              <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white/5 text-slate-300">
                En Cafetería
              </span>
            </div>
            <h3 className="font-bold text-white text-base">Noches en Cafetería</h3>
            <p className="text-xs text-slate-400 mt-1">Fechas seleccionadas en Chinales 45.</p>
          </button>

          <button
            type="button"
            onClick={() => setModalidad('colegio')}
            className={`p-5 rounded-2xl border text-left transition-all cursor-pointer ${
              modalidad === 'colegio'
                ? 'bg-cyan-950/40 border-cyan-400 shadow-[0_0_20px_rgba(0,242,254,0.2)]'
                : 'bg-white/[0.02] border-white/10 hover:border-white/20 hover:bg-white/[0.04]'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <School className={`h-6 w-6 ${modalidad === 'colegio' ? 'text-cyan-400' : 'text-slate-400'}`} />
              <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white/5 text-slate-300">
                Colegios
              </span>
            </div>
            <h3 className="font-bold text-white text-base">Escape en tu Colegio</h3>
            <p className="text-xs text-slate-400 mt-1">Llevamos el juego completo con monitores al centro.</p>
          </button>
        </div>

        {/* Tarjeta del Formulario */}
        <div className="max-w-3xl mx-auto bg-[#0d0f17] border border-white/10 rounded-3xl p-6 sm:p-10 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="pb-4 border-b border-white/10">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-cyan-400" />
                {modalidad === 'evento_privado' && 'Configura tu Escape Room Privado'}
                {modalidad === 'cafeteria' && 'Reserva tu Pase en Cafetería'}
                {modalidad === 'colegio' && 'Escape Room para Centro Educativo'}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                {modalidad === 'evento_privado' && 'Sesiones de 1 hora para grupos de 3 a 6 jugadores.'}
                {modalidad === 'cafeteria' && 'Plazas limitadas por pase temático.'}
                {modalidad === 'colegio' && 'Propuesta didáctica e inmersiva adaptada por edades.'}
              </p>
            </div>

            {/* EVENTO PRIVADO */}
            {modalidad === 'evento_privado' && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-2">1. Temática:</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setTematica('terror')}
                      className={`p-3.5 rounded-xl border flex items-center gap-2 text-xs font-bold cursor-pointer ${
                        tematica === 'terror'
                          ? 'bg-rose-950/50 border-rose-500 text-rose-300'
                          : 'bg-white/[0.02] border-white/10 text-slate-400'
                      }`}
                    >
                      <Skull className="h-4 w-4" /> Terror y Misterio
                    </button>
                    <button
                      type="button"
                      onClick={() => setTematica('edad_antigua')}
                      className={`p-3.5 rounded-xl border flex items-center gap-2 text-xs font-bold cursor-pointer ${
                        tematica === 'edad_antigua'
                          ? 'bg-amber-950/50 border-amber-500 text-amber-300'
                          : 'bg-white/[0.02] border-white/10 text-slate-400'
                      }`}
                    >
                      <Hourglass className="h-4 w-4" /> Edad Antigua
                    </button>
                    <button
                      type="button"
                      onClick={() => setTematica('contemporaneo')}
                      className={`p-3.5 rounded-xl border flex items-center gap-2 text-xs font-bold cursor-pointer ${
                        tematica === 'contemporaneo'
                          ? 'bg-cyan-950/50 border-cyan-500 text-cyan-300'
                          : 'bg-white/[0.02] border-white/10 text-slate-400'
                      }`}
                    >
                      <Compass className="h-4 w-4" /> Contemporáneo
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-2">2. Rango de Edad:</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setRangoEdad('ninos')}
                      className={`p-3 rounded-xl border text-xs font-bold cursor-pointer ${
                        rangoEdad === 'ninos'
                          ? 'bg-cyan-500 text-slate-950'
                          : 'bg-white/[0.02] border-white/10 text-slate-400'
                      }`}
                    >
                      Niños / Infantil
                    </button>
                    <button
                      type="button"
                      onClick={() => setRangoEdad('adultos')}
                      className={`p-3 rounded-xl border text-xs font-bold cursor-pointer ${
                        rangoEdad === 'adultos'
                          ? 'bg-cyan-500 text-slate-950'
                          : 'bg-white/[0.02] border-white/10 text-slate-400'
                      }`}
                    >
                      Adultos
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Jugadores por Sesión (Mín. 3 - Máx. 6):
                    </label>
                    <div className="flex gap-2">
                      {[3, 4, 5, 6].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setPersonasPorSesion(num)}
                          className={`flex-1 py-2 rounded-xl border text-xs font-bold cursor-pointer ${
                            personasPorSesion === num
                              ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold'
                              : 'bg-white/[0.02] border-white/10 text-slate-300'
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Horas / Sesiones (1 h cada una):
                    </label>
                    <select
                      value={numSesiones}
                      onChange={(e) => setNumSesiones(Number(e.target.value))}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                    >
                      <option value={1}>1 Sesión (1 hora)</option>
                      <option value={2}>2 Sesiones consecutivas (2 horas)</option>
                      <option value={3}>3 Sesiones (3 horas)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Lugar de celebración (opcional):</label>
                  <input
                    type="text"
                    placeholder="Salón, domicilio o espacio del evento"
                    value={lugarEvento}
                    onChange={(e) => setLugarEvento(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>
            )}

            {/* CAFETERÍA */}
            {modalidad === 'cafeteria' && (
              <div className="space-y-4">
                <label className="text-xs font-semibold text-slate-300 block">Fechas programadas en Cafetería:</label>
                {sesionesCafeteria.length === 0 ? (
                  <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/30 text-amber-300 text-xs text-center">
                    No hay fechas abiertas actualmente. ¡Déjanos tus datos abajo y te avisamos de la próxima edición!
                  </div>
                ) : (
                  <div className="space-y-2">
                    {sesionesCafeteria.map((s) => (
                      <label
                        key={s.id}
                        className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer ${
                          sesionSeleccionada === s.id ? 'bg-cyan-950/50 border-cyan-400' : 'bg-white/[0.02] border-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="sesion"
                            checked={sesionSeleccionada === s.id}
                            onChange={() => setSesionSeleccionada(s.id)}
                            className="accent-cyan-400"
                          />
                          <span className="font-bold text-white text-xs">{s.titulo} ({new Date(s.fecha).toLocaleDateString('es-ES')})</span>
                        </div>
                        <span className="font-mono text-cyan-400 font-bold text-xs">{s.precio_por_persona} €</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* COLEGIOS */}
            {modalidad === 'colegio' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Centro Educativo:</label>
                    <input
                      type="text"
                      required
                      placeholder="Nombre del colegio / IES"
                      value={nombreColegio}
                      onChange={(e) => setNombreColegio(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Curso / Nivel:</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. 6º Primaria, 3º ESO"
                      value={cursoAlumnos}
                      onChange={(e) => setCursoAlumnos(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Alumnos Estimados:</label>
                    <input
                      type="number"
                      min={10}
                      max={300}
                      value={totalAlumnos}
                      onChange={(e) => setTotalAlumnos(Number(e.target.value))}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Espacio Disponible:</label>
                    <input
                      type="text"
                      placeholder="Ej. Gimnasio, biblioteca, aulas"
                      value={lugarEvento}
                      onChange={(e) => setLugarEvento(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* CONTACTO */}
            <div className="pt-4 border-t border-white/10 space-y-4">
              <span className="text-xs font-bold text-white block">Datos de Contacto</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  required
                  placeholder="Nombre *"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                />
                <input
                  type="tel"
                  required
                  placeholder="Teléfono *"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                />
                <input
                  type="email"
                  required
                  placeholder="Email *"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              {modalidad !== 'cafeteria' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Fecha deseada *</label>
                    <input
                      type="date"
                      required
                      value={fechaEvento}
                      onChange={(e) => setFechaEvento(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Hora estimada</label>
                    <input
                      type="time"
                      value={horaPreferente}
                      onChange={(e) => setHoraPreferente(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>
              )}

              <textarea
                rows={2}
                placeholder="Observaciones adicionales o detalles del evento..."
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={enviando}
              className="w-full py-3.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {enviando ? 'Enviando...' : 'Confirmar Reserva de Escape Room'}
            </button>

            {mensaje && (
              <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                mensaje.tipo === 'ok' ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300' : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
              }`}>
                {mensaje.tipo === 'ok' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                <span>{mensaje.texto}</span>
              </div>
            )}
          </form>
        </div>
      </div>
    </section>
  );
}