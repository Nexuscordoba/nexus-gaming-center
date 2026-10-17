import { Coffee, Gamepad2, Calendar, MapPin, Clock, ArrowRight, Shield, Lock } from 'lucide-react';

export default function App() {
  return (
    <div className="min-h-screen bg-[#08090d] text-slate-200 font-sans selection:bg-cyan-500 selection:text-black">
      {/* Barra superior */}
      <header className="border-b border-white/[0.06] bg-[#06070a]/90 backdrop-blur sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-950/40 text-cyan-400 shadow-[0_0_15px_rgba(0,242,254,0.15)]">
              <Gamepad2 className="h-5 w-5" />
            </div>
            <span className="font-bold text-white tracking-wider text-base">
              NEXUS <span className="text-cyan-400">GAMING CENTER</span>
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-slate-300">
            <a href="#cafeteria" className="hover:text-cyan-400 transition-colors">Cafetería</a>
            <a href="#eventos" className="hover:text-cyan-400 transition-colors">Eventos & TCG</a>
            <a href="#gaming" className="hover:text-cyan-400 transition-colors">Zona Gaming</a>
            <a href="#contacto" className="hover:text-cyan-400 transition-colors">Ubicación</a>
          </nav>
        </div>
      </header>

      {/* Hero Principal con imagen gaming de fondo visible */}
      <section className="relative overflow-hidden py-24 sm:py-32 border-b border-white/[0.06]">
        {/* Capa de imagen con opacidad reforzada */}
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
            Cafetería de especialidad, torneos oficiales de cartas coleccionables, zona de consolas y un espacio diseñado para compartir partidas.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-xs font-semibold uppercase tracking-wider">
            <a
              href="#eventos"
              className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-3 text-slate-950 shadow-[0_0_25px_rgba(0,242,254,0.4)] hover:opacity-95 transition-all"
            >
              Explorar Actividades
            </a>
            <a
              href="#contacto"
              className="rounded-xl border border-white/30 bg-black/50 px-6 py-3 text-white backdrop-blur hover:bg-black/70 transition-all"
            >
              Cómo llegar
            </a>
          </div>
        </div>
      </section>

      {/* Tres Pilares Centrales */}
      <main className="max-w-6xl mx-auto px-5 py-16 space-y-12">
        <div className="grid gap-6 md:grid-cols-3">
          {/* Tarjeta 1: Bar & Cafetería */}
          <div id="cafeteria" className="rounded-2xl border border-white/10 bg-[#0c0d14]/80 backdrop-blur p-6 flex flex-col justify-between hover:border-amber-400/40 transition-all group shadow-lg">
            <div>
              <div className="h-12 w-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                <Coffee className="h-6 w-6" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Nexus Bar & Coffee</h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                Desayunos, meriendas, cafés de especialidad, bebidas temáticas y snacks para disfrutar entre partidas o desconectar.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center justify-between text-xs font-semibold text-amber-400">
              <span>Consulta la carta en mesa</span>
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Tarjeta 2: Eventos & TCG (Enlace a compra de entradas) */}
          <div id="eventos" className="rounded-2xl border border-cyan-500/40 bg-gradient-to-b from-cyan-950/30 to-[#0c0d14]/90 backdrop-blur p-6 flex flex-col justify-between hover:border-cyan-400 transition-all group relative overflow-hidden shadow-[0_0_30px_rgba(0,242,254,0.1)]">
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
          <div id="gaming" className="rounded-2xl border border-white/10 bg-[#0c0d14]/80 backdrop-blur p-6 flex flex-col justify-between hover:border-purple-400/40 transition-all group shadow-lg">
            <div>
              <div className="h-12 w-12 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                <Gamepad2 className="h-6 w-6" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Zona Gaming & Free Play</h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                Mesas acondicionadas para juegos de cartas, puestos de juego libre y espacio para comunidades y creadores de contenido.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center justify-between text-xs font-semibold text-purple-400">
              <span>Espacio abierto</span>
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>

        {/* Sección de Ubicación con la dirección de Chinales */}
        <section id="contacto" className="rounded-2xl border border-white/10 bg-[#06070a]/90 backdrop-blur p-8 shadow-xl">
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <h3 className="text-lg font-bold text-white mb-4">Ven a conocernos</h3>
              <div className="space-y-4 text-sm text-slate-300">
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-cyan-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-white block">Avenida principal de Chinales 45</span>
                    <span className="text-slate-400">14007 Córdoba, España</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-cyan-400 shrink-0" />
                  <span>Abierto para eventos, torneos, juego libre y cafetería</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col justify-center md:items-end">
              <p className="text-xs text-slate-400 mb-2">¿Quieres organizar un torneo o actividad con nosotros?</p>
              <a
                href="mailto:nexuscordoba26@gmail.com"
                className="text-sm font-semibold text-cyan-400 hover:text-cyan-300 hover:underline transition-colors"
              >
                nexuscordoba26@gmail.com
              </a>
            </div>
          </div>
        </section>
      </main>

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