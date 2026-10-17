import { useState, useEffect } from 'react';
import { 
  Gamepad2, 
  Coffee, 
  Trophy, 
  Sparkles, 
  Menu, 
  X, 
  ArrowRight,
  ShieldCheck,
  KeyRound
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

  // Si entra a través de equipo.nexusgamingcenter.es o #equipo
  if (currentRoute === 'staff') {
    return <StaffPortal />;
  }

  // Si entra a través de escape.nexusgamingcenter.es o #escape
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
              <p className="text-[11px] text-slate-400">Experiencias Inmersivas · Chinales 45</p>
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

  // Web principal
  return (
    <div className="min-h-screen bg-[#06070a] text-slate-100 selection:bg-cyan-500 selection:text-black">
      {/* Navegación Principal */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-[#06070a]/80 backdrop-blur-xl">
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

            {/* Enlaces Desktop */}
            <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
              <a href="#cafeteria" className="hover:text-cyan-400 transition-colors">Cafetería</a>
              <a href="#torneos" className="hover:text-cyan-400 transition-colors">Eventos & TCG</a>
              <a 
                href="https://escape.nexusgamingcenter.es" 
                className="text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1.5 transition-colors"
              >
                <KeyRound className="h-4 w-4" />
                Escape Rooms
              </a>
              <a href="#ubicacion" className="hover:text-cyan-400 transition-colors">Ubicación</a>
            </div>

            {/* Botón Acción Desktop */}
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

        {/* Menú Móvil Desplegable */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-white/10 bg-[#090b10] px-4 pt-2 pb-6 space-y-3">
            <a
              href="#cafeteria"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-white/5"
            >
              Cafetería
            </a>
            <a
              href="#torneos"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-white/5"
            >
              Eventos & TCG
            </a>
            <a
              href="https://escape.nexusgamingcenter.es"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm text-cyan-400 font-bold hover:bg-white/5"
            >
              Escape Rooms
            </a>
            <a
              href="#ubicacion"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-white/5"
            >
              Ubicación
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
          Apertura en Polígono Chinales 45 · Córdoba
        </div>

        <h1 className="text-4xl sm:text-6xl md:text-7xl font-black text-white tracking-tight max-w-4xl">
          EL NUEVO PUNTO DE ENCUENTRO <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-500">GAMING & CAFÉ</span>
        </h1>

        <p className="mt-6 text-base sm:text-lg text-slate-300 max-w-2xl leading-relaxed">
          Cafetería temática de especialidad, torneos oficiales de Magic, Pokémon, Yu-Gi-Oh!, experiencias inmersivas de Escape Room y el mejor ambiente gaming de Córdoba.
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
            className="px-6 py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-sm transition-all"
          >
            Ver Cafetería & Carta
          </a>
        </div>
      </section>

      {/* Módulo Integrado de Escape Rooms */}
      <EscapeRooms />

      {/* Sección Cafetería */}
      <section id="cafeteria" className="py-20 border-t border-white/5 bg-[#07080d]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider mb-2">
                <Coffee className="h-4 w-4" />
                Desayunos, Meriendas y Tapas
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-white">Cafetería & Lounge Temático</h2>
              <p className="mt-4 text-sm text-slate-300 leading-relaxed">
                Disfruta de café de especialidad, bollería horneada al momento, batidos especiales y aperitivos mientras juegas o te preparas para el próximo torneo.
              </p>
            </div>
            <div className="p-8 rounded-3xl bg-white/[0.02] border border-white/10 space-y-4">
              <div className="flex items-center gap-4 text-sm text-slate-300">
                <span className="h-2 w-2 rounded-full bg-cyan-400"></span>
                Zona Wi-Fi 6 de alta velocidad y tomas de carga en mesa
              </div>
              <div className="flex items-center gap-4 text-sm text-slate-300">
                <span className="h-2 w-2 rounded-full bg-cyan-400"></span>
                Horario continuado de lunes a domingo
              </div>
              <div className="flex items-center gap-4 text-sm text-slate-300">
                <span className="h-2 w-2 rounded-full bg-cyan-400"></span>
                Menús especiales para cumpleaños y celebraciones de empresa
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Sección Torneos y Eventos */}
      <section id="torneos" className="py-20 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider mb-2">
            <Trophy className="h-4 w-4" />
            Comunidad & Competición
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-white">Torneos TCG y Ligas Semanales</h2>
          <p className="mt-4 text-sm text-slate-300 max-w-2xl mx-auto">
            Espacio oficial para torneos de Magic: The Gathering, Pokémon TCG, Yu-Gi-Oh!, One Piece y Star Wars Unlimited.
          </p>
        </div>
      </section>

      {/* Ubicación y Pie de Página */}
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
              <h4 className="font-bold text-white text-xs uppercase tracking-wider mb-3">Experiencias</h4>
              <ul className="space-y-2 text-xs text-slate-400">
                <li><a href="https://escape.nexusgamingcenter.es" className="hover:text-cyan-400">Escape Rooms</a></li>
                <li><a href="#cafeteria" className="hover:text-cyan-400">Cafetería & Desayunos</a></li>
                <li><a href="#torneos" className="hover:text-cyan-400">Torneos Oficiales TCG</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-white text-xs uppercase tracking-wider mb-3">Contacto</h4>
              <ul className="space-y-2 text-xs text-slate-400">
                <li><span>Polígono Chinales 45, Córdoba</span></li>
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