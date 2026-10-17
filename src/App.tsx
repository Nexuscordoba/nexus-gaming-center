import { useState, useEffect } from 'react';
import { 
  Gamepad2, 
  Coffee, 
  Trophy, 
  Sparkles, 
  MapPin, 
  Menu, 
  X, 
  ArrowRight,
  ShieldCheck,
  KeyRound,
  Clock,
  UtensilsCrossed,
  Tag,
  Wifi,
  Zap,
  Calendar
} from 'lucide-react';
import StaffPortal from './StaffPortal';
import EscapeRooms from './EscapeRooms';

export default function App() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentRoute, setCurrentRoute] = useState<'main' | 'staff' | 'escape'>('main');

  useEffect(() => {
    const handleRouting = () => {
      const hostname = window.location.hostname.toLowerCase();
      const hash = window.location.hash.toLowerCase();

      if (hostname.startsWith('equipo.') || hash === '#equipo' || hash === '#staff') {
        setCurrentRoute('staff');
      } else if (hostname.startsWith('escape.') || hash === '#escape' || hash === '#escaperooms') {
        setCurrentRoute('escape');
      } else {
        setCurrentRoute('main');
      }
    };

    handleRouting();
    window.addEventListener('hashchange', handleRouting);
    return () => window.removeEventListener('hashchange', handleRouting);
  }, []);

  // Subdominio equipo.nexusgamingcenter.es
  if (currentRoute === 'staff') {
    return <StaffPortal />;
  }

  // Subdominio escape.nexusgamingcenter.es
  if (currentRoute === 'escape') {
    return (
      <div className="min-h-screen bg-[#06070a] text-slate-100 flex flex-col justify-between">
        <header className="border-b border-white/10 bg-[#08090d]/90 px-6 py-4 flex items-center justify-between sticky top-0 z-50 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-950/40 text-cyan-400">
              <KeyRound className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-bold text-white text-base tracking-wide flex items-center gap-2">
                NEXUS <span className="text-cyan-400">ESCAPE LAB</span>
              </h1>
              <p className="text-[11px] text-slate-400">Experiencias Inmersivas · Chinales 45, Córdoba</p>
            </div>
          </div>

          <a
            href="https://nexusgamingcenter.es"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs text-slate-300 hover:text-white transition-colors"
          >
            Ir a Nexus Gaming & Café
            <ArrowRight className="h-3.5 w-3.5 text-cyan-400" />
          </a>
        </header>

        <main className="flex-1">
          <EscapeRooms />
        </main>

        <footer className="border-t border-white/5 py-6 text-center text-xs text-slate-500">
          NEXUS CORDOBA SL · Polígono Industrial Chinales 45, Córdoba · info@nexusgamingcenter.es
        </footer>
      </div>
    );
  }

  // Web principal completa
  return (
    <div className="min-h-screen bg-[#06070a] text-slate-100 selection:bg-cyan-500 selection:text-black">
      {/* Navegación */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-[#06070a]/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <a href="#" className="flex items-center gap-3 group">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 p-[1px] transition-transform group-hover:scale-105">
                <div className="h-full w-full bg-[#06070a] rounded-[11px] flex items-center justify-center">
                  <Gamepad2 className="h-5 w-5 text-cyan-400" />
                </div>
              </div>
              <span className="font-black tracking-wider text-xl text-white">
                NEXUS <span className="text-cyan-400 font-light">CENTER</span>
              </span>
            </a>

            {/* Menú Desktop */}
            <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
              <a href="#cafeteria" className="hover:text-cyan-400 transition-colors">Cafetería & Bar</a>
              <a href="#promociones" className="hover:text-cyan-400 transition-colors">Promociones</a>
              <a href="#horarios" className="hover:text-cyan-400 transition-colors">Horarios</a>
              <a href="#torneos" className="hover:text-cyan-400 transition-colors">Torneos & TCG</a>
              <a 
                href="https://escape.nexusgamingcenter.es" 
                className="text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1.5 transition-colors"
              >
                <KeyRound className="h-4 w-4" />
                Escape Rooms
              </a>
            </div>

            {/* Botón Acción */}
            <div className="hidden md:flex items-center gap-3">
              <a
                href="https://escape.nexusgamingcenter.es"
                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-all shadow-[0_0_15px_rgba(0,242,254,0.3)] flex items-center gap-1.5"
              >
                <KeyRound className="h-3.5 w-3.5" />
                Reservar Escape Room
              </a>
            </div>

            {/* Botón Menú Móvil */}
            <div className="md:hidden">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-300"
              >
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Menú Móvil */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-white/10 bg-[#090b10] px-4 pt-2 pb-6 space-y-3">
            <a
              href="#cafeteria"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-white/5"
            >
              Cafetería & Bar
            </a>
            <a
              href="#promociones"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-white/5"
            >
              Promociones & Combos
            </a>
            <a
              href="#horarios"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-white/5"
            >
              Horarios
            </a>
            <a
              href="#torneos"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-white/5"
            >
              Torneos & TCG
            </a>
            <a
              href="https://escape.nexusgamingcenter.es"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm text-cyan-400 font-bold hover:bg-white/5"
            >
              Escape Rooms
            </a>
            <a
              href="https://equipo.nexusgamingcenter.es"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-xs text-slate-500 hover:text-slate-400"
            >
              Acceso Empleados
            </a>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="pt-36 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex flex-col items-center text-center relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[350px] bg-cyan-500/15 blur-[140px] pointer-events-none rounded-full" />

        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-950/40 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-8">
          <Sparkles className="h-4 w-4" />
          Polígono Industrial Chinales 45 · Córdoba
        </div>

        <h1 className="text-4xl sm:text-6xl md:text-7xl font-black text-white tracking-tight max-w-4xl">
          EL NUEVO PUNTO DE ENCUENTRO <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-500">GAMING & CAFÉ</span>
        </h1>

        <p className="mt-6 text-base sm:text-lg text-slate-300 max-w-2xl leading-relaxed">
          Café de especialidad, desayunos y tapas, torneos oficiales de Magic, Pokémon y Yu-Gi-Oh!, experiencias de Escape Room y el mejor ambiente lúdico de Córdoba.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <a
            href="https://escape.nexusgamingcenter.es"
            className="px-6 py-3.5 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-sm transition-all shadow-[0_0_25px_rgba(0,242,254,0.4)] flex items-center gap-2"
          >
            <KeyRound className="h-4 w-4" />
            Descubre Nexus Escape Lab
          </a>
          <a
            href="#cafeteria"
            className="px-6 py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-sm transition-all flex items-center gap-2"
          >
            <Coffee className="h-4 w-4 text-cyan-400" />
            Ver Cafetería & Carta
          </a>
        </div>
      </section>

      {/* SECCIÓN CAFETERÍA & BAR DETALLADA */}
      <section id="cafeteria" className="py-20 border-t border-white/5 bg-[#07080d]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <div className="inline-flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider mb-2">
              <UtensilsCrossed className="h-4 w-4" />
              Gastronomía & Chill Out
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white">Cafetería & Bar Temático Nexus</h2>
            <p className="mt-4 text-sm text-slate-300 leading-relaxed">
              Un espacio cómodo para disfrutar solo o en compañía. Desayunos con panes artesanos, meriendas con bollería recién horneada y tapeo para tus tardes de partidas.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {/* Desayunos */}
            <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/10">
              <div className="h-10 w-10 rounded-2xl bg-cyan-950/50 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-4">
                <Coffee className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Desayunos Especiales</h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Café 100% arábica de especialidad, tostadas con mollete de Antequera o pan de pueblo, aceite AOVE, jamón ibérico, aguacate y zumo de naranja natural recién exprimido.
              </p>
              <span className="text-[11px] font-mono font-bold text-cyan-400 bg-cyan-950/40 px-2.5 py-1 rounded-lg border border-cyan-500/20">
                Desde primera hora
              </span>
            </div>

            {/* Meriendas & Snacks */}
            <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/10">
              <div className="h-10 w-10 rounded-2xl bg-cyan-950/50 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-4">
                <Zap className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Meriendas & Energy Boost</h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Batidos especiales, smoothies, cookies gigantes americanas, gofres y frappés para recargar energías entre partida y partida.
              </p>
              <span className="text-[11px] font-mono font-bold text-cyan-400 bg-cyan-950/40 px-2.5 py-1 rounded-lg border border-cyan-500/20">
                Tardes dulces
              </span>
            </div>

            {/* Tapas y Cervezas */}
            <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/10">
              <div className="h-10 w-10 rounded-2xl bg-cyan-950/50 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-4">
                <UtensilsCrossed className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Tapeo, Burgers & Bebidas</h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Nachos con queso cheddar y guacamole, perritos especiales, mini-burgers, refrescos de importación y cervezas frías para tus tardes de torneo.
              </p>
              <span className="text-[11px] font-mono font-bold text-cyan-400 bg-cyan-950/40 px-2.5 py-1 rounded-lg border border-cyan-500/20">
                Tarde / Noche
              </span>
            </div>
          </div>

          {/* Servicios del local */}
          <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-cyan-950/20 via-black/40 to-blue-950/20 border border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center sm:text-left">
            <div className="flex items-center gap-4 justify-center sm:justify-start">
              <Wifi className="h-6 w-6 text-cyan-400 shrink-0" />
              <div>
                <h4 className="text-sm font-bold text-white">Wi-Fi 6 de Alta Velocidad</h4>
                <p className="text-xs text-slate-400">Conexión ultrarrápida gratuita para clientes</p>
              </div>
            </div>
            <div className="flex items-center gap-4 justify-center sm:justify-start">
              <Zap className="h-6 w-6 text-cyan-400 shrink-0" />
              <div>
                <h4 className="text-sm font-bold text-white">Enchufes y USB en Mesas</h4>
                <p className="text-xs text-slate-400">Carga tu móvil o portátil mientras juegas</p>
              </div>
            </div>
            <div className="flex items-center gap-4 justify-center sm:justify-start">
              <Gamepad2 className="h-6 w-6 text-cyan-400 shrink-0" />
              <div>
                <h4 className="text-sm font-bold text-white">Ludoteca de Cortesía</h4>
                <p className="text-xs text-slate-400">Juegos de mesa disponibles para usar en el bar</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PROMOCIONES & COMBOS */}
      <section id="promociones" className="py-20 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="inline-flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider mb-2">
              <Tag className="h-4 w-4" />
              Ofertas Especiales
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white">Combos y Promociones</h2>
            <p className="mt-3 text-sm text-slate-300">
              Aprovecha nuestras ofertas combinadas para desayunar, merendar o jugar al mejor precio.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-3xl bg-[#0d0f17] border border-white/10 flex flex-col justify-between">
              <div>
                <span className="text-xs uppercase font-bold text-cyan-400">Desayuno Gamer</span>
                <h3 className="text-xl font-bold text-white mt-1">Café + Mollete Especial</h3>
                <p className="text-xs text-slate-400 mt-2">
                  Café con leche o infusión + media tostada con aceite, tomate y jamón ibérico o aguacate.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-white/5 flex items-baseline justify-between">
                <span className="text-xs text-slate-400">De 8:30 a 12:00</span>
                <span className="text-2xl font-black text-cyan-400 font-mono">3,20 €</span>
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-cyan-950/30 border border-cyan-500/40 flex flex-col justify-between shadow-[0_0_20px_rgba(0,242,254,0.1)]">
              <div>
                <span className="text-xs uppercase font-bold text-emerald-400">Combo Torneo</span>
                <h3 className="text-xl font-bold text-white mt-1">Refresco + Tapa Caliente</h3>
                <p className="text-xs text-slate-400 mt-2">
                  Bebida fría o cerveza + ración de nachos con queso fundido o hot dog temático durante las rondas de torneos.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-white/5 flex items-baseline justify-between">
                <span className="text-xs text-slate-400">Tardes de competición</span>
                <span className="text-2xl font-black text-cyan-400 font-mono">4,90 €</span>
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-[#0d0f17] border border-white/10 flex flex-col justify-between">
              <div>
                <span className="text-xs uppercase font-bold text-cyan-400">Pack Meriendas</span>
                <h3 className="text-xl font-bold text-white mt-1">Batido Especial + Cookie</h3>
                <p className="text-xs text-slate-400 mt-2">
                  Batido artesanal a elegir (Oreo, Kinder, Fresa o Vainilla) acompañado de cookie gigante horneada.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-white/5 flex items-baseline justify-between">
                <span className="text-xs text-slate-400">De 16:30 a 20:00</span>
                <span className="text-2xl font-black text-cyan-400 font-mono">4,50 €</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HORARIOS */}
      <section id="horarios" className="py-20 border-t border-white/5 bg-[#07080d]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="p-8 sm:p-10 rounded-3xl bg-[#0d0f17] border border-white/10 shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <Clock className="h-6 w-6 text-cyan-400" />
              <div>
                <h3 className="text-2xl font-bold text-white">Horarios de Apertura</h3>
                <p className="text-xs text-slate-400">Estamos en Polígono Chinales 45, Córdoba</p>
              </div>
            </div>

            <div className="space-y-4 text-xs sm:text-sm">
              <div className="flex justify-between items-center py-3 border-b border-white/5">
                <span className="font-semibold text-slate-300">Lunes a Jueves</span>
                <span className="font-mono text-cyan-400 font-bold">08:30 – 14:00 | 16:30 – 21:30</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-white/5">
                <span className="font-semibold text-slate-300">Viernes (Torneos & Noches)</span>
                <span className="font-mono text-cyan-400 font-bold">08:30 – 14:00 | 16:30 – 23:30</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-white/5">
                <span className="font-semibold text-slate-300">Sábados (Jornada Continua)</span>
                <span className="font-mono text-emerald-400 font-bold">10:00 – 23:30 (Ininterrumpido)</span>
              </div>
              <div className="flex justify-between items-center py-3">
                <span className="font-semibold text-slate-300">Domingos y Festivos de Evento</span>
                <span className="font-mono text-cyan-400 font-bold">10:00 – 21:00</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MÓDULO DE ESCAPE ROOMS INTEGRADO */}
      <EscapeRooms />

      {/* TORNEOS & EVENTOS */}
      <section id="torneos" className="py-20 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider mb-2">
            <Trophy className="h-4 w-4" />
            Comunidad & Competición
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-white">Torneos TCG y Ligas Semanales</h2>
          <p className="mt-4 text-sm text-slate-300 max-w-2xl mx-auto">
            Espacio oficial para torneos de Magic: The Gathering, Pokémon TCG, Yu-Gi-Oh!, One Piece y Star Wars Unlimited. Mesas amplias, tapetes y jueces oficiales.
          </p>
        </div>
      </section>

      {/* PIE DE PÁGINA */}
      <footer id="ubicacion" className="border-t border-white/10 bg-[#050608] pt-16 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
            <div className="space-y-3">
              <h3 className="font-bold text-white text-base">NEXUS GAMING CENTER</h3>
              <p className="text-xs text-slate-400">
                Polígono Industrial Chinales 45<br />14007 Córdoba, España
              </p>
            </div>
            <div>
              <h4 className="font-bold text-white text-xs uppercase tracking-wider mb-3">Secciones</h4>
              <ul className="space-y-2 text-xs text-slate-400">
                <li><a href="#cafeteria" className="hover:text-cyan-400">Cafetería & Desayunos</a></li>
                <li><a href="#promociones" className="hover:text-cyan-400">Promociones</a></li>
                <li><a href="#horarios" className="hover:text-cyan-400">Horarios</a></li>
                <li><a href="https://escape.nexusgamingcenter.es" className="hover:text-cyan-400">Escape Rooms</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-white text-xs uppercase tracking-wider mb-3">Contacto</h4>
              <ul className="space-y-2 text-xs text-slate-400">
                <li className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-cyan-400" />
                  <span>Chinales 45, Córdoba</span>
                </li>
                <li><span>info@nexusgamingcenter.es</span></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-white text-xs uppercase tracking-wider mb-3">Portal Interno</h4>
              <a
                href="https://equipo.nexusgamingcenter.es"
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white bg-white/5 border border-white/10 px-3 py-2 rounded-xl transition-colors"
              >
                <ShieldCheck className="h-4 w-4 text-cyan-400" />
                Acceso Empleados (Fichaje)
              </a>
            </div>
          </div>

          <div className="pt-8 border-t border-white/5 text-center text-xs text-slate-500">
            © {new Date().getFullYear()} NEXUS CORDOBA SL · Todos los derechos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
}