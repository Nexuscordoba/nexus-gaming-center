import { useState, useEffect } from 'react';
import { 
  Coffee, 
  UtensilsCrossed, 
  Clock, 
  MapPin, 
  Calendar, 
  Tag, 
  ArrowRight, 
  FileText, 
  Shield, 
  Lock, 
  X, 
  Gamepad2, 
  CheckCircle2, 
  Phone, 
  ArrowLeft, 
  KeyRound,
  TrendingUp
} from 'lucide-react';
import StaffPortal from './StaffPortal';
import EscapeRooms from './EscapeRooms';
import LoyverseDashboard from './LoyverseDashboard';

export default function App() {
  const [currentView, setCurrentView] = useState<'home' | 'bar'>('home');
  const [subdomainRoute, setSubdomainRoute] = useState<'main' | 'staff' | 'escape' | 'ventas'>('main');
  const [menuModalOpen, setMenuModalOpen] = useState(false);

  useEffect(() => {
    const handleRouting = () => {
      const hostname = window.location.hostname.toLowerCase();
      const hash = window.location.hash.toLowerCase();

      if (hostname.startsWith('equipo.')) {
        setSubdomainRoute('staff');
        return;
      } else if (hostname.startsWith('escape.')) {
        setSubdomainRoute('escape');
        return;
      } else if (hostname.startsWith('ventas.') || hostname.startsWith('tpv.')) {
        setSubdomainRoute('ventas');
        return;
      } else {
        setSubdomainRoute('main');
      }

      if (hash === '#bar' || hash === '#/bar') {
        setCurrentView('bar');
        window.scrollTo(0, 0);
      } else if (hash === '#staff' || hash === '#equipo') {
        setSubdomainRoute('staff');
      } else if (hash === '#escape' || hash === '#escaperooms') {
        setSubdomainRoute('escape');
      } else if (hash === '#ventas' || hash === '#tpv') {
        setSubdomainRoute('ventas');
      } else {
        setCurrentView('home');
      }
    };

    handleRouting();
    window.addEventListener('hashchange', handleRouting);
    return () => window.removeEventListener('hashchange', handleRouting);
  }, []);

  const navigateTo = (view: 'home' | 'bar') => {
    window.location.hash = view === 'bar' ? 'bar' : '';
    setCurrentView(view);
    window.scrollTo(0, 0);
  };

  // Subdominio equipo.nexusgamingcenter.es
  if (subdomainRoute === 'staff') {
    return <StaffPortal />;
  }

  // Subdominio escape.nexusgamingcenter.es
  if (subdomainRoute === 'escape') {
    return (
      <div className="min-h-screen bg-[#08090d] text-slate-200 font-sans flex flex-col justify-between">
        <header className="border-b border-white/[0.06] bg-[#06070a]/90 backdrop-blur px-6 py-4 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-950/40 text-cyan-400">
              <KeyRound className="h-5 w-5" />
            </div>
            <span className="font-bold text-white tracking-wider text-base">
              NEXUS <span className="text-cyan-400">ESCAPE LAB</span>
            </span>
          </div>

          <a
            href="https://nexusgamingcenter.es"
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs text-slate-300 hover:text-white transition-all cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Volver a la web principal</span>
          </a>
        </header>

        <main className="flex-1">
          <EscapeRooms />
        </main>

        <footer className="border-t border-white/[0.06] bg-[#050608] text-slate-500 text-xs py-6 text-center">
          NEXUS CORDOBA SL · NIF: B93887990 · Polígono Chinales 45, Córdoba
        </footer>
      </div>
    );
  }

  // Subdominio ventas.nexusgamingcenter.es
  if (subdomainRoute === 'ventas') {
    return <LoyverseDashboard />;
  }

  return (
    <div className="min-h-screen bg-[#08090d] text-slate-200 font-sans selection:bg-cyan-500 selection:text-black flex flex-col justify-between">
      {/* Barra de navegación superior */}
      <header className="border-b border-white/[0.06] bg-[#06070a]/90 backdrop-blur sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <div 
            onClick={() => navigateTo('home')}
            className="flex items-center gap-3 cursor-pointer"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-950/40 text-cyan-400 shadow-[0_0_15px_rgba(0,242,254,0.15)]">
              <Gamepad2 className="h-5 w-5" />
            </div>
            <span className="font-bold text-white tracking-wider text-base">
              NEXUS <span className="text-cyan-400">GAMING CENTER</span>
            </span>
          </div>

          <nav className="flex items-center gap-4 sm:gap-6 text-sm">
            {currentView === 'bar' ? (
              <button
                onClick={() => navigateTo('home')}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs text-slate-300 hover:text-white transition-all cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Volver a la web principal</span>
              </button>
            ) : (
              <>
                <button 
                  onClick={() => navigateTo('bar')} 
                  className="text-amber-400 font-semibold hover:text-amber-300 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Coffee className="h-4 w-4" /> Cafetería & Menú
                </button>
                <a 
                  href="https://escape.nexusgamingcenter.es" 
                  className="text-cyan-400 font-semibold hover:text-cyan-300 transition-colors flex items-center gap-1.5"
                >
                  <KeyRound className="h-4 w-4" /> Escape Rooms
                </a>
                <a href="#eventos-tarde" className="hidden sm:inline hover:text-cyan-400 transition-colors">
                  Eventos
                </a>
                <a href="#ubicacion" className="hidden sm:inline hover:text-cyan-400 transition-colors">
                  Contacto
                </a>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* CONTENIDO SEGÚN LA VISTA SELECCIONADA */}
      {currentView === 'bar' ? (
        /* VISTA EXCLUSIVA DE LA CAFETERÍA (/bar) */
        <main className="flex-grow">
          {/* Hero de Cafetería */}
          <section className="relative overflow-hidden py-16 sm:py-24 border-b border-white/[0.06]">
            <div className="absolute inset-0 z-0">
              <img
                src="https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=2000&q=80"
                alt="Cafetería Nexus Bar"
                className="w-full h-full object-cover object-center opacity-40"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#08090d] via-[#08090d]/80 to-[#08090d]/60" />
            </div>

            <div className="max-w-4xl mx-auto px-5 text-center relative z-10">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-950/80 backdrop-blur-md px-4 py-1.5 text-xs text-amber-300 mb-6">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Lunes a Viernes de 7:00 a 17:00 · Polígono Chinales</span>
              </div>

              <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight uppercase">
                Nexus <span className="text-amber-400">Bar & Coffee</span>
              </h1>
              <p className="mt-4 text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
                Desayunos tradicionales y especiales desde primera hora de la mañana y menú del día casero para tu jornada de trabajo.
              </p>

              <div className="mt-8 flex justify-center">
                <button
                  onClick={() => setMenuModalOpen(true)}
                  className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-8 py-3.5 text-slate-950 text-sm font-bold uppercase tracking-wider shadow-[0_0_25px_rgba(245,158,11,0.35)] hover:opacity-95 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <FileText className="h-4 w-4" />
                  Ver Carta y Sugerencias
                </button>
              </div>
            </div>
          </section>

          {/* Bloque Desayunos y Menú */}
          <section className="max-w-6xl mx-auto px-5 py-16">
            <div className="grid gap-8 md:grid-cols-2">
              {/* Tarjeta Desayunos */}
              <div className="rounded-2xl border border-white/10 bg-[#0c0d14]/90 p-8 shadow-xl">
                <div className="h-12 w-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-6">
                  <Coffee className="h-6 w-6" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-3">Desayunos desde las 7:00 h</h2>
                <p className="text-sm text-slate-400 leading-relaxed mb-6">
                  Variedad de panes rústicos e integrales, aceite de oliva virgen extra, tomate natural, jamón y café de especialidad.
                </p>
                <div className="space-y-3 text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-amber-400" />
                    <span>Café recién molido y opciones de leche vegetal</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-amber-400" />
                    <span>Tostadas completas, medias y bollería seleccionada</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-amber-400" />
                    <span>Rapidez de servicio pensada para trabajadores de Chinales</span>
                  </div>
                </div>
              </div>

              {/* Tarjeta Menú del Día */}
              <div className="rounded-2xl border border-white/10 bg-[#0c0d14]/90 p-8 shadow-xl">
                <div className="h-12 w-12 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center mb-6">
                  <UtensilsCrossed className="h-6 w-6" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-3">Menú del Día Casero</h2>
                <p className="text-sm text-slate-400 leading-relaxed mb-6">
                  Cocina tradicional y platos equilibrados preparados cada día. Incluye primer plato, segundo plato, pan, bebida y postre o café.
                </p>
                <div className="space-y-3 text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-orange-400" />
                    <span>Platos caseros de temporada renovados semanalmente</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-orange-400" />
                    <span>Comedor climatizado y cómodo para desconectar al mediodía</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-orange-400" />
                    <span>Posibilidad de encargar para llevar</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Promociones */}
            <div className="mt-12 rounded-2xl border border-amber-500/20 bg-amber-950/10 p-8">
              <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2 text-amber-400">
                <Tag className="h-5 w-5" /> Promociones Activas en Cafetería
              </h3>
              <div className="grid gap-6 sm:grid-cols-3">
                <div className="p-4 rounded-xl bg-black/40 border border-white/5">
                  <span className="font-bold text-white block text-sm">Bono Menú Semanal</span>
                  <p className="text-xs text-slate-400 mt-1">
                    Precio especial por día abonando el bono de 5 comidas de lunes a viernes.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-black/40 border border-white/5">
                  <span className="font-bold text-white block text-sm">Combo Desayuno</span>
                  <p className="text-xs text-slate-400 mt-1">
                    Café + tostada completa con precio cerrado de 7:00 a 11:30 h.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-black/40 border border-white/5">
                  <span className="font-bold text-white block text-sm">Pack Empresas</span>
                  <p className="text-xs text-slate-400 mt-1">
                    Descuento para grupos y compañeros de empresa reservando con antelación.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </main>
      ) : (
        /* VISTA PRINCIPAL / PORTAL GENERAL */
        <main className="flex-grow">
          {/* Hero General con imagen gaming */}
          <section className="relative overflow-hidden py-24 sm:py-32 border-b border-white/[0.06]">
            <div className="absolute inset-0 z-0">
              <img
                src="https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=2000&q=80"
                alt="Ambiente Gaming y Competición"
                className="w-full h-full object-cover object-center opacity-60 scale-105 transition-transform duration-1000 ease-out"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#08090d] via-[#08090d]/60 to-[#08090d]/40" />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-950/20 via-transparent to-transparent pointer-events-none" />
            </div>

            <div className="max-w-4xl mx-auto px-5 text-center relative z-10">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-950/80 backdrop-blur-md px-4 py-1.5 text-xs text-cyan-300 mb-6 shadow-[0_0_20px_rgba(0,242,254,0.2)]">
                <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                El nuevo punto de encuentro en Córdoba
              </div>

              <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight leading-tight uppercase drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]">
                El nexo donde confluyen <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-500">el juego y la comunidad</span>
              </h1>

              <p className="mt-6 text-base sm:text-lg text-slate-200 max-w-2xl mx-auto leading-relaxed drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
                Cafetería de especialidad y menús caseros por las mañanas, torneos oficiales de cartas coleccionables y ocio gaming por las tardes.
              </p>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-xs font-semibold uppercase tracking-wider">
                <button
                  onClick={() => navigateTo('bar')}
                  className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3 text-slate-950 font-bold shadow-[0_0_25px_rgba(245,158,11,0.35)] hover:opacity-95 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Coffee className="h-4 w-4" />
                  Ir a Cafetería & Menús
                </button>
                <a
                  href="https://escape.nexusgamingcenter.es"
                  className="rounded-xl bg-cyan-950/70 border border-cyan-500/40 text-cyan-300 px-6 py-3 font-bold hover:bg-cyan-900/60 transition-all flex items-center gap-2"
                >
                  <KeyRound className="h-4 w-4" />
                  Escape Rooms
                </a>
                <a
                  href="#eventos-tarde"
                  className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-3 text-slate-950 font-bold shadow-[0_0_25px_rgba(0,242,254,0.4)] hover:opacity-95 transition-all"
                >
                  Eventos de Tarde
                </a>
              </div>
            </div>
          </section>

          {/* Tres Pilares Centrales */}
          <section className="max-w-6xl mx-auto px-5 py-16 space-y-12">
            <div className="grid gap-6 md:grid-cols-3">
              {/* Tarjeta 1: Acceso a la Cafetería */}
              <div 
                onClick={() => navigateTo('bar')}
                className="rounded-2xl border border-white/10 bg-[#0c0d14]/80 backdrop-blur p-6 flex flex-col justify-between hover:border-amber-400/50 transition-all group shadow-lg cursor-pointer"
              >
                <div>
                  <div className="h-12 w-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                    <Coffee className="h-6 w-6" />
                  </div>
                  <h2 className="text-xl font-bold text-white mb-2">Nexus Bar & Coffee</h2>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    Lunes a viernes de 7:00 a 17:00 h. Desayunos variados, menú casero del día y promociones semanales.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center justify-between text-xs font-semibold text-amber-400">
                  <span>Entrar a la Cafetería</span>
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

              {/* Tarjeta 2: Eventos & TCG */}
              <div className="rounded-2xl border border-cyan-500/40 bg-gradient-to-b from-cyan-950/30 to-[#0c0d14]/90 backdrop-blur p-6 flex flex-col justify-between hover:border-cyan-400 transition-all group relative overflow-hidden shadow-[0_0_30px_rgba(0,242,254,0.1)]">
                <div>
                  <div className="h-12 w-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                    <Calendar className="h-6 w-6" />
                  </div>
                  <span className="text-[10px] font-bold tracking-wider uppercase text-cyan-400 bg-cyan-950/80 border border-cyan-500/30 px-2 py-0.5 rounded mb-2 inline-block">
                    Próximos Torneos
                  </span>
                  <h2 className="text-xl font-bold text-white mb-2">Eventos & Competición</h2>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    Torneos oficiales de Pokémon TCG, Magic: The Gathering, tardes de juegos de mesa y grandes eventos presenciales.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-cyan-500/20">
                  <a
                    href="https://entradas.cordobacardshow.com"
                    target="_blank"
                    rel="noreferrer"
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 py-2.5 text-xs font-bold text-slate-950 uppercase tracking-wider hover:opacity-90 transition-opacity shadow-[0_0_20px_rgba(0,242,254,0.25)]"
                  >
                    Venta de Entradas
                    <ArrowRight className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>

              {/* Tarjeta 3: Gaming Zone */}
              <div className="rounded-2xl border border-white/10 bg-[#0c0d14]/80 backdrop-blur p-6 flex flex-col justify-between hover:border-purple-400/40 transition-all group shadow-lg">
                <div>
                  <div className="h-12 w-12 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                    <Gamepad2 className="h-6 w-6" />
                  </div>
                  <h2 className="text-xl font-bold text-white mb-2">Zona Gaming & Free Play</h2>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    Mesas acondicionadas para partidas de cartas, torneos locales y espacio libre para compartir con la comunidad.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center justify-between text-xs font-semibold text-purple-400">
                  <span>Espacio abierto</span>
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>
          </section>

          {/* Bloque Eventos de Tarde */}
          <section id="eventos-tarde" className="max-w-6xl mx-auto px-5 pb-16">
            <div className="rounded-2xl border border-cyan-500/40 bg-gradient-to-b from-cyan-950/20 via-[#0c0d14]/80 to-[#08090d] p-8 sm:p-10">
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 mb-8 pb-6 border-b border-cyan-500/20">
                <div>
                  <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-widest">
                    Actividades de Tarde
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-bold text-white mt-1">Agenda & Torneos Vespertinos</h2>
                </div>
                <a
                  href="https://entradas.cordobacardshow.com"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-xl bg-cyan-500 px-5 py-2.5 text-xs font-bold text-slate-950 uppercase tracking-wider hover:bg-cyan-400 transition-colors"
                >
                  Entradas Disponibles <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="p-5 rounded-xl border border-white/10 bg-black/40">
                  <h3 className="font-bold text-white text-base mb-1">Córdoba Card Show II</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Gran cita de coleccionismo y torneos competitivos oficiales en Córdoba con venta directa en la plataforma.
                  </p>
                </div>
                <div className="p-5 rounded-xl border border-white/10 bg-black/40">
                  <h3 className="font-bold text-white text-base mb-1">Propón o reserva tu actividad</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Escríbenos a <span className="text-cyan-400">nexuscordoba26@gmail.com</span> para organizar demostraciones o torneos por las tardes.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </main>
      )}

      {/* SECCIÓN DE CONTACTO & UBICACIÓN (COMÚN) */}
      <section id="ubicacion" className="max-w-6xl mx-auto px-5 pb-12 w-full">
        <div className="rounded-2xl border border-white/10 bg-[#0c0d14]/80 p-8 shadow-xl">
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Dónde Encontrarnos</span>
              <h3 className="text-xl sm:text-2xl font-bold text-white mt-1 mb-4">Ven a conocernos en Chinales</h3>
              
              <div className="space-y-4 text-sm text-slate-300">
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-cyan-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-white block">Avenida principal de Chinales 45</span>
                    <span className="text-slate-400">14007 Córdoba, España</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-white block">Horario Cafetería:</span>
                    <span className="text-slate-400 block">Lunes a Viernes: 7:00 a 17:00 h</span>
                    <span className="text-cyan-400 text-xs block mt-1">Tardes y fines de semana según calendario de eventos</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-center md:items-end md:border-l md:border-white/[0.06] md:pl-8">
              <span className="text-xs text-slate-400 mb-1">Contacto y reservas:</span>
              <a
                href="mailto:nexuscordoba26@gmail.com"
                className="text-base font-semibold text-cyan-400 hover:text-cyan-300 hover:underline transition-colors block mb-4"
              >
                nexuscordoba26@gmail.com
              </a>
              <div className="flex items-center gap-2 text-xs text-slate-400 bg-white/[0.03] px-4 py-2.5 rounded-xl border border-white/10">
                <Phone className="h-4 w-4 text-cyan-400" />
                <span>Atención directa en barra</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Modal Informativo de Carta */}
      {menuModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4"
          onClick={() => setMenuModalOpen(false)}
        >
          <div 
            className="w-full max-w-lg rounded-2xl border border-amber-500/30 bg-[#0c0d14] p-6 sm:p-8 shadow-2xl animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2.5 text-amber-400">
                <FileText className="h-5 w-5" />
                <h3 className="font-bold text-white text-lg">Carta Nexus Bar & Coffee</h3>
              </div>
              <button 
                onClick={() => setMenuModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 space-y-4 text-sm text-slate-300 leading-relaxed">
              <p>
                Estamos ultimando la carta completa con los precios y variedades de desayunos, menú del día y meriendas.
              </p>
              <div className="rounded-xl border border-amber-500/20 bg-amber-950/20 p-4 text-xs text-amber-200/90 space-y-2">
                <p className="font-semibold text-amber-300">🍽️ Disponible a diario en barra:</p>
                <p>• Desayunos completos desde las 7:00 h.</p>
                <p>• Menú del día casero de lunes a viernes.</p>
                <p>• Bonos semanales para trabajadores del polígono.</p>
              </div>
              <p className="text-xs text-slate-400">
                Próximamente podrás consultar y descargar la carta interactiva con código QR desde las mesas.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-white/10 flex justify-end">
              <button 
                onClick={() => setMenuModalOpen(false)}
                className="rounded-xl bg-amber-500 px-5 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pie de página */}
      <footer className="border-t border-white/[0.06] bg-[#050608] text-slate-500 text-xs py-8">
        <div className="max-w-6xl mx-auto px-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} NEXUS CORDOBA SL. NIF: B93887990. Todos los derechos reservados.</p>
          <div className="flex items-center gap-4 text-slate-400">
            <span className="flex items-center gap-1">
              <Shield className="h-3.5 w-3.5" /> Empresa registrada
            </span>
            <span>·</span>
            <a 
              href="https://ventas.nexusgamingcenter.es" 
              className="flex items-center gap-1 hover:text-cyan-400 transition-colors"
            >
              <TrendingUp className="h-3 w-3" /> Panel Finanzas & TPV
            </a>
            <span>·</span>
            <a 
              href="https://equipo.nexusgamingcenter.es" 
              className="flex items-center gap-1 hover:text-cyan-400 transition-colors"
            >
              <Lock className="h-3 w-3" /> Acceso Staff
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}