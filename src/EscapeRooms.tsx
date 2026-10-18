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
  CheckCircle2, 
  AlertCircle, 
  MapPin, 
  Calendar as CalendarIcon, 
  Image as ImageIcon, 
  Check, 
  Search, 
  ArrowDown, 
  ChevronLeft, 
  ChevronRight, 
  Send 
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
  const [modalidad, setModalidad] = useState<'cafeteria' | 'evento_privado' | 'colegio'>('cafeteria');

  const [sesionesCafeteria, setSesionesCafeteria] = useState<SesionCafeteria[]>([]);
  const [sesionSeleccionada, setSesionSeleccionada] = useState<string>('');
  const [incluyeConsumicion, setIncluyeConsumicion] = useState(false);

  // Formulario Común
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [fechaEvento, setFechaEvento] = useState('');
  const [horaPreferente, setHoraPreferente] = useState('17:00');
  const [observaciones, setObservaciones] = useState('');

  // Fechas ya ocupadas
  const [fechasOcupadas, setFechasOcupadas] = useState<string[]>([]);
  const [mesActual, setMesActual] = useState(new Date());

  // Dirección desglosada
  const [calleNombre, setCalleNombre] = useState('');
  const [numeroPortal, setNumeroPortal] = useState('');
  const [pisoPuerta, setPisoPuerta] = useState('');
  const [codigoPostal, setCodigoPostal] = useState('14005');
  const [direccionVerificada, setDireccionVerificada] = useState(false);
  const [sugerenciasDir, setSugerenciasDir] = useState<string[]>([]);
  const [buscandoDir, setBuscandoDir] = useState(false);

  // Formulario Evento Privado
  const [tematica, setTematica] = useState<'terror' | 'edad_antigua' | 'contemporaneo'>('terror');
  const [rangoEdad, setRangoEdad] = useState<'ninos' | 'adultos'>('adultos');
  const [personasPorSesion, setPersonasPorSesion] = useState<number>(4);
  const [numSesiones, setNumSesiones] = useState<number>(1);

  // Formulario Colegios
  const [nombreColegio, setNombreColegio] = useState('');
  const [cursoAlumnos, setCursoAlumnos] = useState('');
  const [totalAlumnos, setTotalAlumnos] = useState<number>(60);

  // Galería de fotos
  const [filtroFoto, setFiltroFoto] = useState<'todas' | 'terror' | 'eventos' | 'colegios'>('todas');

  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const formatFechaLocal = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const cargarFechasOcupadas = async () => {
    const hoy = formatFechaLocal(new Date());
    const { data } = await supabase
      .from('reservas_escape_room')
      .select('fecha_evento')
      .in('estado', ['confirmada', 'pendiente', 'pagada'])
      .gte('fecha_evento', hoy);

    if (data) {
      setFechasOcupadas(data.map((r) => r.fecha_evento));
    }
  };

  useEffect(() => {
    cargarFechasOcupadas();

    const cargarSesiones = async () => {
      const hoy = formatFechaLocal(new Date());
      const { data, error } = await supabase
        .from('escape_noches_cafeteria')
        .select('*')
        .eq('activa', true)
        .gte('fecha', hoy)
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

  const seleccionarModalidadConScroll = (mod: 'cafeteria' | 'evento_privado' | 'colegio') => {
    setModalidad(mod);
    const formulario = document.getElementById('formulario-escape');
    if (formulario) {
      formulario.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  useEffect(() => {
    if (calleNombre.trim().length < 3 || direccionVerificada) {
      setSugerenciasDir([]);
      return;
    }

    const timer = setTimeout(async () => {
      setBuscandoDir(true);
      try {
        const res = await fetch(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(calleNombre)}&lat=37.8882&lon=-4.7794&limit=5`
        );
        const data = await res.json();
        if (data && data.features) {
          const resultados = data.features
            .filter((f: any) => {
              const city = (f.properties.city || f.properties.county || '').toLowerCase();
              return city.includes('córdoba') || city.includes('cordoba') || f.properties.postcode?.startsWith('14');
            })
            .map((f: any) => {
              const p = f.properties;
              return `${p.street || p.name || ''}, ${p.postcode || '14000'} Córdoba`.trim();
            });
          setSugerenciasDir(resultados.length > 0 ? Array.from(new Set(resultados)) : [`${calleNombre}, Córdoba`]);
        }
      } catch (err) {
        console.warn('Error al buscar calles:', err);
      } finally {
        setBuscandoDir(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [calleNombre, direccionVerificada]);

  const seleccionarDireccion = (dir: string) => {
    const partes = dir.split(',');
    setCalleNombre(partes[0].trim());
    if (partes[1]) {
      const matchCP = partes[1].match(/\b14\d{3}\b/);
      if (matchCP) setCodigoPostal(matchCP[0]);
    }
    setSugerenciasDir([]);
    setDireccionVerificada(true);
  };

  const calcularPrecioEstimado = (): number => {
    if (modalidad === 'cafeteria') {
      const precioBase = incluyeConsumicion ? 15 : 12;
      return personasPorSesion * precioBase;
    }
    if (modalidad === 'evento_privado') {
      if (numSesiones === 1) return 75;
      if (numSesiones === 2) return 130;
      if (numSesiones === 3) return 180;
      return 180 + (numSesiones - 3) * 50;
    }
    if (modalidad === 'colegio') {
      return 390;
    }
    return 0;
  };

  const esFechaOcupada = (fecha: string): boolean => {
    return fechasOcupadas.includes(fecha);
  };

  const diasEnMes = (mes: Date) => {
    const year = mes.getFullYear();
    const month = mes.getMonth();
    const primerDia = new Date(year, month, 1).getDay();
    const ajustePrimerDia = primerDia === 0 ? 6 : primerDia - 1;
    const totalDias = new Date(year, month + 1, 0).getDate();

    const dias = [];
    for (let i = 0; i < ajustePrimerDia; i++) {
      dias.push(null);
    }
    for (let d = 1; d <= totalDias; d++) {
      dias.push(new Date(year, month, d));
    }
    return dias;
  };

  const cambiarMes = (offset: number) => {
    const nuevo = new Date(mesActual.getFullYear(), mesActual.getMonth() + offset, 1);
    setMesActual(nuevo);
  };

  // Validación estricta de formulario
  const datosContactoCompletos = 
    nombre.trim().length >= 3 && 
    telefono.trim().length >= 9 && 
    email.trim().includes('@') && 
    email.trim().includes('.');

  const direccionCompleta = 
    calleNombre.trim().length >= 3 && 
    numeroPortal.trim().length >= 1 && 
    codigoPostal.trim().length === 5;

  const datosColegioCompletos = 
    nombreColegio.trim().length >= 3 && 
    cursoAlumnos.trim().length >= 2;

  const esFormularioValido = (): boolean => {
    if (!datosContactoCompletos) return false;

    if (modalidad === 'cafeteria') {
      return sesionesCafeteria.length > 0 && !!sesionSeleccionada;
    }

    if (modalidad === 'evento_privado') {
      return !!fechaEvento && !esFechaOcupada(fechaEvento) && direccionCompleta;
    }

    if (modalidad === 'colegio') {
      return !!fechaEvento && !esFechaOcupada(fechaEvento) && direccionCompleta && datosColegioCompletos;
    }

    return false;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!esFormularioValido()) {
      setMensaje({
        tipo: 'error',
        texto: 'Por favor, completa todos los datos obligatorios de contacto, dirección y fecha antes de confirmar.'
      });
      return;
    }

    setEnviando(true);
    setMensaje(null);

    const precioFinal = calcularPrecioEstimado();
    const fechaFinal = modalidad === 'cafeteria'
      ? sesionesCafeteria.find(s => s.id === sesionSeleccionada)?.fecha || fechaEvento
      : fechaEvento;

    let lugarFinal = 'Nexus Cafetería (Chinales 45, Córdoba)';
    if (modalidad !== 'cafeteria') {
      const detallesPuerta = pisoPuerta ? `, ${pisoPuerta}` : '';
      lugarFinal = `${calleNombre}, Nº ${numeroPortal}${detallesPuerta}, CP ${codigoPostal}, Córdoba`;
    }

    try {
      const payload: any = {
        modalidad,
        nombre_contacto: nombre.trim(),
        email_contacto: email.trim(),
        telefono_contacto: telefono.trim(),
        fecha_evento: fechaFinal,
        hora_preferente: horaPreferente,
        observaciones: `Precio confirmado: ${precioFinal} €. ${observaciones}`,
        estado: 'confirmada',
        lugar_celebracion: lugarFinal
      };

      if (modalidad === 'evento_privado') {
        payload.tematica = tematica;
        payload.rango_edad = rangoEdad;
        payload.personas_por_sesion = personasPorSesion;
        payload.num_sesiones = numSesiones;
      } else if (modalidad === 'colegio') {
        payload.nombre_centro_educativo = nombreColegio.trim();
        payload.curso_edad_alumnos = cursoAlumnos.trim();
        payload.total_alumnos_estimado = totalAlumnos;
        payload.num_sesiones = 7;
      } else if (modalidad === 'cafeteria') {
        const sesion = sesionesCafeteria.find(s => s.id === sesionSeleccionada);
        payload.observaciones = `Noche de Escape en Cafetería: ${sesion?.titulo || ''} (${incluyeConsumicion ? 'Con consumición/tapa' : 'Solo juego'}). ${observaciones}`;
        payload.personas_por_sesion = personasPorSesion;
      }

      const { error: dbError } = await supabase
        .from('reservas_escape_room')
        .insert([payload]);

      if (dbError) throw dbError;

      try {
        await fetch('/api/send-confirmation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email.trim(),
            nombre: nombre.trim(),
            telefono: telefono.trim(),
            modalidad,
            fechaEvento: fechaFinal,
            horaPreferente,
            tematica: modalidad === 'evento_privado' ? tematica : null,
            numSesiones: modalidad === 'colegio' ? 7 : numSesiones,
            personas: personasPorSesion,
            precioEstimado: precioFinal,
            lugar: lugarFinal,
            observaciones
          })
        });
      } catch (mailErr) {
        console.warn('Aviso email:', mailErr);
      }

      setMensaje({
        tipo: 'ok',
        texto: `¡Reserva confirmada con éxito (${precioFinal} €)! Se ha registrado en el sistema y enviado el correo de confirmación.`
      });

      setFechasOcupadas((prev) => [...prev, fechaFinal]);

      setNombre('');
      setEmail('');
      setTelefono('');
      setFechaEvento('');
      setCalleNombre('');
      setNumeroPortal('');
      setPisoPuerta('');
      setDireccionVerificada(false);
      setObservaciones('');
      setNombreColegio('');
      setCursoAlumnos('');
    } catch (err: any) {
      setMensaje({
        tipo: 'error',
        texto: 'Error al tramitar la reserva: ' + (err.message || 'Inténtalo de nuevo')
      });
    } finally {
      setEnviando(false);
    }
  };

  const imagenesGaleria = [
    {
      url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
      titulo: 'Cripta & Enigmas Arcanos',
      categoria: 'terror',
      desc: 'Misterio y cerraduras ocultas'
    },
    {
      url: 'https://images.unsplash.com/photo-1577495508048-b635879837f1?auto=format&fit=crop&w=800&q=80',
      titulo: 'Cofres y Criptogramas',
      categoria: 'eventos',
      desc: 'Resolución en equipo para cumpleaños'
    },
    {
      url: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=800&q=80',
      titulo: 'Escape Didáctico Escolar',
      categoria: 'colegios',
      desc: 'Alumnos cooperando en dinámicas de lógica'
    },
    {
      url: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=800&q=80',
      titulo: 'Noches en Cafetería Nexus',
      categoria: 'eventos',
      desc: 'Pases temáticos con amigos en Chinales 45'
    },
    {
      url: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=800&q=80',
      titulo: 'Jornadas en Institutos y Colegios',
      categoria: 'colegios',
      desc: '7 horas de juego rotativo por cursos'
    },
    {
      url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=800&q=80',
      titulo: 'Mundo Clásico & Arqueología',
      categoria: 'terror',
      desc: 'Jeroglíficos, candados numéricos y reliquias'
    }
  ];

  const fotosFiltradas = filtroFoto === 'todas' 
    ? imagenesGaleria 
    : imagenesGaleria.filter(f => f.categoria === filtroFoto);

  const hoyISO = formatFechaLocal(new Date());
  const diasCalendario = diasEnMes(mesActual);
  const nombresMeses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  return (
    <section id="escaperooms" className="py-20 bg-[#08090e] border-t border-white/5 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-cyan-500/10 blur-[140px] pointer-events-none rounded-full" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-950/40 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-4">
            <KeyRound className="h-4 w-4" />
            Nexus Escape Lab · Córdoba
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            VIVE LA EXPERIENCIA <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400">ESCAPE ROOM</span>
          </h2>
          <p className="mt-4 text-sm sm:text-base text-slate-300">
            Reserva directa sin esperas. Consulta el calendario en tiempo real y asegura tu fecha en Córdoba capital.
          </p>
        </div>

        {/* 1. TARIFAS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          <div 
            onClick={() => seleccionarModalidadConScroll('cafeteria')}
            className={`p-6 rounded-3xl border flex flex-col justify-between transition-all cursor-pointer group hover:scale-[1.02] ${
              modalidad === 'cafeteria'
                ? 'bg-cyan-950/40 border-cyan-400 shadow-[0_0_25px_rgba(0,242,254,0.2)]'
                : 'bg-[#0d0f17] border-white/10 hover:border-white/30'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs uppercase font-bold text-cyan-400 tracking-wider">En Nuestro Local</span>
                <Coffee className="h-5 w-5 text-cyan-400" />
              </div>
              <h3 className="text-xl font-bold text-white mt-1">Noches en Cafetería</h3>
              <p className="text-xs text-slate-400 mt-2">Fechas programadas en Chinales 45. Grupos de 3 a 6 jugadores.</p>
              <div className="mt-4 mb-6">
                <span className="text-3xl font-black text-white">12 €</span>
                <span className="text-xs text-slate-400"> / persona (15 € con consumición y tapa)</span>
              </div>
            </div>
            <div>
              <ul className="text-xs text-slate-300 space-y-2 border-t border-white/5 pt-4 mb-4">
                <li className="flex items-center gap-2">✓ 60 minutos de pura tensión</li>
                <li className="flex items-center gap-2">✓ Game Master en directo</li>
                <li className="flex items-center gap-2">✓ Ambiente tematizado en cafetería</li>
              </ul>
              <div className="flex items-center justify-between text-xs font-bold text-cyan-400 group-hover:translate-y-0.5 transition-transform">
                <span>Configurar en Cafetería</span>
                <ArrowDown className="h-4 w-4" />
              </div>
            </div>
          </div>

          <div 
            onClick={() => seleccionarModalidadConScroll('evento_privado')}
            className={`p-6 rounded-3xl border flex flex-col justify-between transition-all cursor-pointer group hover:scale-[1.02] relative ${
              modalidad === 'evento_privado'
                ? 'bg-cyan-950/40 border-cyan-400 shadow-[0_0_30px_rgba(0,242,254,0.25)]'
                : 'bg-gradient-to-b from-cyan-950/20 to-[#0d0f17] border-cyan-500/30 hover:border-cyan-400'
            }`}
          >
            <div className="absolute -top-3 right-6 bg-cyan-500 text-slate-950 text-[10px] uppercase font-black px-3 py-1 rounded-full shadow-md">
              1 al día
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs uppercase font-bold text-cyan-400 tracking-wider">A Domicilio / Local</span>
                <PartyPopper className="h-5 w-5 text-cyan-400" />
              </div>
              <h3 className="text-xl font-bold text-white mt-1">Eventos Privados</h3>
              <p className="text-xs text-slate-400 mt-2">Cumpleaños, bodas y fiestas. Servicio exclusivo en Córdoba capital.</p>
              <div className="mt-4 mb-6">
                <span className="text-3xl font-black text-cyan-400">Desde 75 €</span>
                <span className="text-xs text-slate-400"> / sesión de 1 hora (3 a 6 pers.)</span>
                <span className="block text-[11px] text-emerald-400 font-semibold mt-1">2 horas: 130 € · 3 horas: 180 €</span>
              </div>
            </div>
            <div>
              <ul className="text-xs text-slate-300 space-y-2 border-t border-white/5 pt-4 mb-4">
                <li className="flex items-center gap-2">✓ Monitor exclusivo + Desplazamiento</li>
                <li className="flex items-center gap-2">✓ Material completo y atrezzo</li>
                <li className="flex items-center gap-2">✓ Reserva directa confirmada</li>
              </ul>
              <div className="flex items-center justify-between text-xs font-bold text-cyan-400 group-hover:translate-y-0.5 transition-transform">
                <span>Configurar Evento Privado</span>
                <ArrowDown className="h-4 w-4" />
              </div>
            </div>
          </div>

          <div 
            onClick={() => seleccionarModalidadConScroll('colegio')}
            className={`p-6 rounded-3xl border flex flex-col justify-between transition-all cursor-pointer group hover:scale-[1.02] ${
              modalidad === 'colegio'
                ? 'bg-cyan-950/40 border-cyan-400 shadow-[0_0_25px_rgba(0,242,254,0.2)]'
                : 'bg-[#0d0f17] border-white/10 hover:border-white/30'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs uppercase font-bold text-cyan-400 tracking-wider">Centros Escolares</span>
                <School className="h-5 w-5 text-cyan-400" />
              </div>
              <h3 className="text-xl font-bold text-white mt-1">Escape en tu Colegio</h3>
              <p className="text-xs text-slate-400 mt-2">Propuesta didáctica para semanas culturales, fin de curso o extraescolares.</p>
              <div className="mt-4 mb-6">
                <span className="text-3xl font-black text-white">390 €</span>
                <span className="text-xs text-slate-400"> / Jornada completa (7 horas)</span>
              </div>
            </div>
            <div>
              <ul className="text-xs text-slate-300 space-y-2 border-t border-white/5 pt-4 mb-4">
                <li className="flex items-center gap-2">✓ 7 horas de monitoraje in situ</li>
                <li className="flex items-center gap-2">✓ Rotación de múltiples clases y cursos</li>
                <li className="flex items-center gap-2">✓ Enigmas curriculares y de lógica</li>
              </ul>
              <div className="flex items-center justify-between text-xs font-bold text-cyan-400 group-hover:translate-y-0.5 transition-transform">
                <span>Configurar Escape Escolar</span>
                <ArrowDown className="h-4 w-4" />
              </div>
            </div>
          </div>
        </div>

        {/* Galería Visual */}
        <div className="mb-16">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
            <div>
              <div className="inline-flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider mb-1">
                <ImageIcon className="h-4 w-4" />
                Galería Visual
              </div>
              <h3 className="text-2xl font-bold text-white">Así se viven nuestras experiencias</h3>
            </div>

            <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 text-xs">
              <button
                type="button"
                onClick={() => setFiltroFoto('todas')}
                className={`px-3 py-1.5 rounded-xl transition-colors cursor-pointer ${
                  filtroFoto === 'todas' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Todas
              </button>
              <button
                type="button"
                onClick={() => setFiltroFoto('terror')}
                className={`px-3 py-1.5 rounded-xl transition-colors cursor-pointer ${
                  filtroFoto === 'terror' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Terror & Clásico
              </button>
              <button
                type="button"
                onClick={() => setFiltroFoto('eventos')}
                className={`px-3 py-1.5 rounded-xl transition-colors cursor-pointer ${
                  filtroFoto === 'eventos' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Eventos
              </button>
              <button
                type="button"
                onClick={() => setFiltroFoto('colegios')}
                className={`px-3 py-1.5 rounded-xl transition-colors cursor-pointer ${
                  filtroFoto === 'colegios' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Colegios
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {fotosFiltradas.map((img, idx) => (
              <div
                key={idx}
                className="group relative h-64 rounded-2xl overflow-hidden border border-white/10 bg-black/40"
              >
                <img
                  src={img.url}
                  alt={img.titulo}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent flex flex-col justify-end p-4">
                  <span className="text-white font-bold text-sm">{img.titulo}</span>
                  <span className="text-slate-400 text-xs">{img.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 2. SELECTOR DE MODALIDAD DEL FORMULARIO */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <button
            type="button"
            onClick={() => setModalidad('cafeteria')}
            className={`p-5 rounded-2xl border text-left transition-all cursor-pointer ${
              modalidad === 'cafeteria'
                ? 'bg-cyan-950/50 border-cyan-400 shadow-[0_0_20px_rgba(0,242,254,0.2)]'
                : 'bg-white/[0.02] border-white/10 hover:border-white/20 hover:bg-white/[0.04]'
            }`}
          >
            <Coffee className={`h-6 w-6 mb-2 ${modalidad === 'cafeteria' ? 'text-cyan-400' : 'text-slate-400'}`} />
            <h4 className="font-bold text-white text-base">Noches en Cafetería</h4>
            <span className="text-xs text-cyan-400 font-semibold block mt-1">Chinales 45</span>
            <p className="text-xs text-slate-400 mt-1">12 € / pers (15 € con consumición y tapa).</p>
          </button>

          <button
            type="button"
            onClick={() => setModalidad('evento_privado')}
            className={`p-5 rounded-2xl border text-left transition-all cursor-pointer ${
              modalidad === 'evento_privado'
                ? 'bg-cyan-950/50 border-cyan-400 shadow-[0_0_20px_rgba(0,242,254,0.2)]'
                : 'bg-white/[0.02] border-white/10 hover:border-white/20 hover:bg-white/[0.04]'
            }`}
          >
            <PartyPopper className={`h-6 w-6 mb-2 ${modalidad === 'evento_privado' ? 'text-cyan-400' : 'text-slate-400'}`} />
            <h4 className="font-bold text-white text-base">Eventos Privados</h4>
            <span className="text-xs text-cyan-400 font-semibold block mt-1">Exclusivo Córdoba Capital</span>
            <p className="text-xs text-slate-400 mt-1">Cumpleaños, bodas o celebraciones particulares.</p>
          </button>

          <button
            type="button"
            onClick={() => setModalidad('colegio')}
            className={`p-5 rounded-2xl border text-left transition-all cursor-pointer ${
              modalidad === 'colegio'
                ? 'bg-cyan-950/50 border-cyan-400 shadow-[0_0_20px_rgba(0,242,254,0.2)]'
                : 'bg-white/[0.02] border-white/10 hover:border-white/20 hover:bg-white/[0.04]'
            }`}
          >
            <School className={`h-6 w-6 mb-2 ${modalidad === 'colegio' ? 'text-cyan-400' : 'text-slate-400'}`} />
            <h4 className="font-bold text-white text-base">Escape en tu Colegio</h4>
            <span className="text-xs text-cyan-400 font-semibold block mt-1">Jornada 7h · 390 €</span>
            <p className="text-xs text-slate-400 mt-1">Córdoba capital y centros educativos.</p>
          </button>
        </div>

        {/* Formulario de Reserva */}
        <div id="formulario-escape" className="max-w-3xl mx-auto bg-[#0d0f17] border border-white/10 rounded-3xl p-6 sm:p-10 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-white/10 gap-2">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-cyan-400" />
                  {modalidad === 'cafeteria' && 'Reserva tu Pase en Cafetería Nexus'}
                  {modalidad === 'evento_privado' && 'Configura y Confirma tu Escape Room Privado'}
                  {modalidad === 'colegio' && 'Reserva Directa de Jornada Escolar (7h)'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {modalidad === 'cafeteria' && 'Plazas limitadas por pase. Opcional con consumición y tapa.'}
                  {modalidad === 'evento_privado' && 'Monitores a domicilio en Córdoba capital. Máximo 1 evento privado por día.'}
                  {modalidad === 'colegio' && 'Desplazamiento con material y monitores para toda la jornada escolar.'}
                </p>
              </div>

              <div className="bg-cyan-950/60 border border-cyan-500/40 px-3.5 py-1.5 rounded-2xl text-right">
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Precio Confirmado</span>
                <span className="text-xl font-black text-cyan-300 font-mono">
                  {calcularPrecioEstimado()} €
                </span>
              </div>
            </div>

            {/* SELECCIÓN CAFETERÍA */}
            {modalidad === 'cafeteria' && (
              <div className="space-y-4">
                <label className="text-xs font-semibold text-slate-300 block">Fechas programadas en Cafetería:</label>
                {sesionesCafeteria.length === 0 ? (
                  <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/30 text-amber-300 text-xs text-center">
                    No hay fechas abiertas actualmente. ¡Déjanos tus datos abajo y te avisamos del próximo pase!
                  </div>
                ) : (
                  <div className="space-y-2">
                    {sesionesCafeteria.map((s) => (
                      <label
                        key={s.id}
                        className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer ${
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
                          <span className="font-bold text-white text-xs">{s.titulo} ({new Date(s.fecha + 'T00:00:00').toLocaleDateString('es-ES')})</span>
                        </div>
                        <span className="font-mono text-cyan-400 font-bold text-xs">{s.precio_por_persona} € / pers</span>
                      </label>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Asistentes (Mín. 3 - Máx. 6):
                    </label>
                    <div className="flex gap-2">
                      {[3, 4, 5, 6].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setPersonasPorSesion(num)}
                          className={`flex-1 py-2 rounded-xl border text-xs font-bold cursor-pointer ${
                            personasPorSesion === num
                              ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                              : 'bg-white/[0.02] border-white/10 text-slate-300'
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-5">
                    <input
                      type="checkbox"
                      id="consumicion"
                      checked={incluyeConsumicion}
                      onChange={(e) => setIncluyeConsumicion(e.target.checked)}
                      className="accent-cyan-400 h-4 w-4 rounded"
                    />
                    <label htmlFor="consumicion" className="text-xs text-slate-300 cursor-pointer">
                      Añadir consumición + tapa especial (+3 € / pers)
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* SELECCIÓN EVENTOS PRIVADOS */}
            {modalidad === 'evento_privado' && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-2">1. Temática del Escape:</label>
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
                      Niños / Infantil (Adaptado)
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
                      Adultos (Dificultad estándar)
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
                      Horas / Sesiones:
                    </label>
                    <select
                      value={numSesiones}
                      onChange={(e) => setNumSesiones(Number(e.target.value))}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                    >
                      <option value={1}>1 hora (1 grupo · 75 €)</option>
                      <option value={2}>2 horas consecutivas (130 € · Ahorras 20 €)</option>
                      <option value={3}>3 horas (180 € · Ideal cumpleaños)</option>
                      <option value={4}>4 horas (230 €)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* SELECCIÓN COLEGIOS */}
            {modalidad === 'colegio' && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-cyan-950/30 border border-cyan-500/30 text-xs text-cyan-300 flex items-center justify-between">
                  <span>Jornada Completa Escolar (7 horas presenciales con monitor y desplazamiento)</span>
                  <span className="font-mono font-bold text-white text-sm">390 €</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Centro Educativo (Colegio / IES) *:</label>
                    <input
                      type="text"
                      required
                      placeholder="Nombre del centro"
                      value={nombreColegio}
                      onChange={(e) => setNombreColegio(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Cursos y Alumnos Estimados *:</label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        required
                        placeholder="Ej. 5º y 6º Primaria"
                        value={cursoAlumnos}
                        onChange={(e) => setCursoAlumnos(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                      />
                      <input
                        type="number"
                        min={10}
                        max={400}
                        placeholder="Total alumnos"
                        value={totalAlumnos}
                        onChange={(e) => setTotalAlumnos(Number(e.target.value))}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* DIRECCIÓN DESGLOSADA EN CÓRDOBA CAPITAL */}
            {modalidad !== 'cafeteria' && (
              <div className="space-y-3 pt-2">
                <label className="text-xs font-semibold text-slate-300 block">
                  Ubicación exacta en Córdoba capital *:
                </label>
                
                {/* Calle con buscador predictivo */}
                <div className="relative">
                  <div className="relative">
                    <MapPin className="h-4 w-4 text-cyan-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      placeholder="Nombre de la calle o avenida (ej. Calle Escritora Carmen Laforet)..."
                      value={calleNombre}
                      onChange={(e) => {
                        setCalleNombre(e.target.value);
                        setDireccionVerificada(false);
                      }}
                      className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white"
                    />
                  </div>

                  {buscandoDir && (
                    <span className="text-[10px] text-cyan-400 mt-1 block animate-pulse">
                      Buscando calle en Córdoba...
                    </span>
                  )}

                  {sugerenciasDir.length > 0 && (
                    <div className="absolute left-0 right-0 top-12 z-30 bg-[#0c0e17] border border-cyan-500/40 rounded-xl shadow-2xl overflow-hidden divide-y divide-white/5">
                      {sugerenciasDir.map((sug, i) => (
                        <div
                          key={i}
                          onClick={() => seleccionarDireccion(sug)}
                          className="px-3 py-2.5 text-xs text-slate-200 hover:bg-cyan-950/70 hover:text-cyan-300 cursor-pointer flex items-center gap-2"
                        >
                          <Search className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                          <span className="truncate">{sug}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Campos desglosados: Número, Puerta/Bloque y Código Postal */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Nº / Portal *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. 14, Bloque 2"
                      value={numeroPortal}
                      onChange={(e) => setNumeroPortal(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Piso / Puerta / Detalles</label>
                    <input
                      type="text"
                      placeholder="Ej. 2º B, Urbanización..."
                      value={pisoPuerta}
                      onChange={(e) => setPisoPuerta(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">C.P. (Córdoba) *</label>
                    <input
                      type="text"
                      required
                      placeholder="14005"
                      value={codigoPostal}
                      onChange={(e) => setCodigoPostal(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono text-center"
                    />
                  </div>
                </div>

                {direccionVerificada && (
                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 mt-1">
                    <Check className="h-3.5 w-3.5" />
                    <span>Calle localizada en Córdoba capital</span>
                  </div>
                )}
              </div>
            )}

            {/* CALENDARIO VISUAL DE DISPONIBILIDAD */}
            {modalidad !== 'cafeteria' && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <CalendarIcon className="h-4 w-4 text-cyan-400" />
                    Selecciona Fecha en el Calendario * (1 escape privado por día):
                  </label>
                  <div className="flex items-center gap-3 text-[10px]">
                    <span className="flex items-center gap-1 text-emerald-400">
                      <span className="h-2 w-2 rounded-full bg-emerald-400"></span> Libre
                    </span>
                    <span className="flex items-center gap-1 text-rose-400">
                      <span className="h-2 w-2 rounded-full bg-rose-400"></span> Ocupado
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-black/40 border border-white/10">
                  <div className="flex items-center justify-between mb-3 text-xs font-bold text-white">
                    <span>{nombresMeses[mesActual.getMonth()]} {mesActual.getFullYear()}</span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => cambiarMes(-1)}
                        className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 cursor-pointer"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => cambiarMes(1)}
                        className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 cursor-pointer"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-slate-500 font-bold mb-2">
                    <span>L</span><span>M</span><span>X</span><span>J</span><span>V</span><span>S</span><span>D</span>
                  </div>

                  <div className="grid grid-cols-7 gap-1">
                    {diasCalendario.map((dia, idx) => {
                      if (!dia) {
                        return <div key={`empty-${idx}`} className="h-9" />;
                      }

                      const fechaISO = formatFechaLocal(dia);
                      const esPasado = fechaISO < hoyISO;
                      const ocupado = esFechaOcupada(fechaISO);
                      const seleccionado = fechaEvento === fechaISO;

                      return (
                        <button
                          key={fechaISO}
                          type="button"
                          disabled={esPasado || ocupado}
                          onClick={() => setFechaEvento(fechaISO)}
                          className={`h-9 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center cursor-pointer ${
                            seleccionado
                              ? 'bg-cyan-500 text-slate-950 font-black shadow-[0_0_15px_rgba(0,242,254,0.4)] scale-105'
                              : ocupado
                              ? 'bg-rose-950/40 text-rose-500/40 border border-rose-500/20 cursor-not-allowed line-through'
                              : esPasado
                              ? 'text-slate-700 cursor-not-allowed'
                              : 'bg-white/[0.03] text-slate-200 hover:bg-emerald-950/60 hover:text-emerald-300 hover:border-emerald-500/40 border border-white/5'
                          }`}
                        >
                          <span>{dia.getDate()}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                    <div>
                      {fechaEvento ? (
                        <span className="text-emerald-400 font-semibold">
                          ✓ Día seleccionado: {new Date(fechaEvento + 'T00:00:00').toLocaleDateString('es-ES')}
                        </span>
                      ) : (
                        <span className="text-amber-400 font-medium">⚠️ Por favor, pulsa un día libre en el calendario</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">Hora de inicio:</span>
                      <input
                        type="time"
                        value={horaPreferente}
                        onChange={(e) => setHoraPreferente(e.target.value)}
                        className="bg-black/40 border border-white/10 rounded-xl px-2.5 py-1 text-white font-mono text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* DATOS DE CONTACTO */}
            <div className="pt-4 border-t border-white/10 space-y-4">
              <span className="text-xs font-bold text-white block">Datos de Contacto del Responsable *</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <input
                    type="text"
                    required
                    placeholder="Nombre y Apellidos *"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                  />
                  {nombre.trim().length > 0 && nombre.trim().length < 3 && (
                    <span className="text-[10px] text-amber-400 block mt-0.5">Mínimo 3 caracteres</span>
                  )}
                </div>
                <div>
                  <input
                    type="tel"
                    required
                    placeholder="Teléfono Móvil (9 dígitos) *"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                  />
                  {telefono.trim().length > 0 && telefono.trim().length < 9 && (
                    <span className="text-[10px] text-amber-400 block mt-0.5">Mínimo 9 dígitos</span>
                  )}
                </div>
                <div>
                  <input
                    type="email"
                    required
                    placeholder="Correo Electrónico *"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                  />
                  {email.trim().length > 0 && (!email.includes('@') || !email.includes('.')) && (
                    <span className="text-[10px] text-amber-400 block mt-0.5">Introduce un email válido</span>
                  )}
                </div>
              </div>

              <textarea
                rows={2}
                placeholder="Observaciones adicionales (si es sorpresa, acceso al recinto, detalles de la celebración)..."
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white resize-none"
              />
            </div>

            {/* Aviso dinámico si faltan campos por rellenar */}
            {!esFormularioValido() && (
              <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/20 text-amber-300 text-[11px] flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
                <span>
                  Para habilitar la reserva, completa: 
                  {!datosContactoCompletos && ' Datos de contacto (Nombre, Teléfono de 9 dígitos y Email) ·'}
                  {modalidad !== 'cafeteria' && !direccionCompleta && ' Dirección completa (Calle, Nº y CP) ·'}
                  {modalidad !== 'cafeteria' && !fechaEvento && ' Selección de día en el calendario ·'}
                  {modalidad === 'colegio' && !datosColegioCompletos && ' Datos del Centro Educativo'}
                </span>
              </div>
            )}

            {/* Botón con bloqueo estricto */}
            <button
              type="submit"
              disabled={enviando || !esFormularioValido()}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,242,254,0.3)] disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <Send className="h-4 w-4" />
              {enviando 
                ? 'Confirmando reserva en el sistema...' 
                : `Confirmar Reserva Directa · ${calcularPrecioEstimado()} €`}
            </button>

            {mensaje && (
              <div className={`p-3.5 rounded-xl border text-xs flex items-center gap-2.5 ${
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