import React, { useState, useEffect } from 'react';
import { 
  Coffee, 
  UtensilsCrossed, 
  Clock, 
  MapPin, 
  ArrowRight, 
  FileText, 
  Shield, 
  Lock, 
  X, 
  Gamepad2,
  Phone,
  ArrowLeft,
  KeyRound,
  TrendingUp,
  ChefHat,
  Flame,
  CalendarDays,
  QrCode
} from 'lucide-react';
import StaffPortal from './StaffPortal';
import EscapeRooms from './EscapeRooms';
import LoyverseDashboard from './LoyverseDashboard';
import KitchenDisplay from './KitchenDisplay';
import BarDisplay from './BarDisplay';
import TableQrGenerator from './TableQrGenerator';

export default function App() {
  const [currentView, setCurrentView] = useState<'home' | 'bar'>('home');
  const [subdomainRoute, setSubdomainRoute] = useState<'main' | 'staff' | 'escape' | 'ventas' | 'cocina' | 'barra' | 'qr-generator'>('main');
  const [menuModalOpen, setMenuModalOpen] = useState(false);

  // Estados para el Acceso Maestro Oculto en el Footer
  const [adminDesbloqueado, setAdminDesbloqueado] = useState(false);
  const [modalAdminOpen, setModalAdminOpen] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);

  // Pestaña activa en la carta de la cafetería
  const [categoriaCarta, setCategoriaCarta] = useState<'desayunos' | 'tapeo' | 'meriendas' | 'bebidas'>('desayunos');

  // Detectar la ruta en la URL o subdominio
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
      } else if (hostname.startsWith('cocina.')) {
        setSubdomainRoute('cocina');
        return;
      } else if (hostname.startsWith('barra.')) {
        setSubdomainRoute('barra');
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
      } else if (hash === '#cocina' || hash === '#/cocina') {
        setSubdomainRoute('cocina');
      } else if (hash === '#barra' || hash === '#/barra') {
        setSubdomainRoute('barra');
      } else if (hash === '#qr' || hash === '#/qr') {
        setSubdomainRoute('qr-generator');
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

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === 'Nexus2026Admin*') {
      setAdminDesbloqueado(true);
      setModalAdminOpen(false);
      setPasswordInput('');
      setPasswordError(false);
    } else {
      setPasswordError(true);
    }
  };

  // Subdominio equipo.nexusgamingcenter.es o #equipo
  if (subdomainRoute === 'staff') {
    return <StaffPortal />;
  }

  // Subdominio escape.nexusgamingcenter.es o #escape
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

  // Subdominio ventas.nexusgamingcenter.es o #ventas
  if (subdomainRoute === 'ventas') {
    return <LoyverseDashboard />;
  }

  // Subdominio cocina.nexusgamingcenter.es o #cocina
  if (subdomainRoute === 'cocina') {
    return <KitchenDisplay />;
  }

  // Subdominio barra.nexusgamingcenter.es o #barra
  if (subdomainRoute === 'barra') {
    return <BarDisplay />;
  }

  // Generador de Códigos QR para Mesas
  if (subdomainRoute === 'qr-generator') {
    return <TableQrGenerator onBack={() => setSubdomainRoute('main')} />;
  }

  // Elementos de la Carta de la Cafetería
  const cartaItems: Record<string, Array<{ nombre: string; desc: string; precio: string; destacado?: boolean }>> = {
    desayunos: [
      { nombre: 'Café Especialidad + Mollete Ibérico', desc: 'Café 100% arábica + mollete tostado con AOVE, tomate y jamón ibérico de Los Pedroches.', precio: '3,50 €', destacado: true },
      { nombre: 'Desayuno Nexus Power', desc: 'Café o infusión + tostada de aguacate, huevo poché y semillas de chía + zumo de naranja.', precio: '4,80 €' },
      { nombre: 'Mollete Tradicional con Zurrapa o Manteca', desc: 'Tostada de pan de pueblo con zurrapa de lomo blanca/colorá o pringá casera.', precio: '2,90 €' },
      { nombre: 'Croissant Francés de Mantequilla', desc: 'Horneado a diario, relleno de jamón york y queso fundido o Nutella.', precio: '2,40 €' },
    ],
    tapeo: [
      { nombre: 'Nachos Supreme Nexus', desc: 'Totopos crujientes con doble queso cheddar fundido, guacamole casero, jalapeños y pulled pork.', precio: '7,50 €', destacado: true },
      { nombre: 'Burger Smash Doble Bacon', desc: 'Doble disco de ternera madurada 90g, queso cheddar americano, bacon crujiente y salsa secreta en pan brioche.', precio: '8,90 €' },
      { nombre: 'Perrito Caliente Especial Chinales', desc: 'Salchicha ahumada gigante, cebolla frita crujiente, bacon bites y salsas a elegir.', precio: '5,20 €' },
      { nombre: 'Fingers de Pollo Crujiente Caseros', desc: 'Tiras de pechuga marinadas y empanadas en panko con salsa barbacoa y mostaza dulce.', precio: '6,20 €' },
    ],
    meriendas: [
      { nombre: 'Batido Freakshake Oreo / Kinder', desc: 'Batido artesanal denso con helado, nata montada, sirope y topping de galletas Oreo o barrita Kinder.', precio: '4,80 €', destacado: true },
      { nombre: 'Gofre Belga con Nutella y Plátano', desc: 'Gofre caliente recién hecho con virutas de chocolate blanco y bola de helado opcional.', precio: '4,20 €' },
      { nombre: 'Cookies Gigantes Americanas', desc: 'Tres chocolates, red velvet o pepitas de chocolate con corazón fundente.', precio: '2,20 €' },
      { nombre: 'Smoothie Fruta 100% Natural', desc: 'A elegir: Fresa-Plátano o Mango-Maracuyá batido con base de zumo de manzana.', precio: '3,80 €' },
    ],
    bebidas: [
      { nombre: 'Café de Especialidad (Flat White / Latte)', desc: 'Extracción profesional con leche fresca vaporizada o bebida vegetal.', precio: '1,80 €' },
      { nombre: 'Refrescos de Importación & Monster Energy', desc: 'Dr Pepper, Mountain Dew, variedades exclusivas de Monster y Red Bull.', precio: '2,50 €' },
      { nombre: 'Cerveza de Grifo y Artesanal', desc: 'Caña bien tirada, tercios Alhambra Reserva 1925 y selección artesana local.', precio: '2,20 €' },
      { nombre: 'Kombucha Orgánica & Tés Fríos', desc: 'Té verde con jengibre o frutos rojos refrescante sin azúcares añadidos.', precio: '2,80 €' }
    ]
  };

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
        /* VISTA EXCLUSIVA DE LA CAFETERÍA (/bar) CON CARTA INTERACTIVA */
        <main className="flex-grow">
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
                Desayunos tradicionales y especiales desde primera hora de la mañana y tapeo selecto para tu jornada de trabajo.
              </p>

              <div className="mt-8 flex justify-center">
                <button
                  onClick={() => setMenuModalOpen(true)}
                  className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-8 py-3.5 text-slate-950 text-sm font-bold uppercase tracking-wider shadow-[0_0_25px_rgba(245,158,11,0.35)] hover:opacity-95 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <FileText className="h-4 w-4" />
                  Ver Información y Avisos
                </button>
              </div>
            </div>
          </section>

          {/* CARTA INTERACTIVA POR CATEGORÍAS */}
          <section className="max-w-6xl mx-auto px-5 py-16">
            <div className="text-center max-w-3xl mx-auto mb-10">
              <div className="inline-flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider mb-2">
                <UtensilsCrossed className="h-4 w-4" />
                Carta & Menú
              </div>
              <h2 className="text-3xl font-black text-white">Nuestra Selección</h2>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
              <button
                onClick={() => setCategoriaCarta('desayunos')}
                className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                  categoriaCarta === 'desayunos'
                    ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                    : 'bg-white/5 border border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                🥐 Desayunos
              </button>
              <button
                onClick={() => setCategoriaCarta('tapeo')}
                className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                  categoriaCarta === 'tapeo'
                    ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                    : 'bg-white/5 border border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                🍔 Tapeo & Burgers
              </button>
              <button
                onClick={() => setCategoriaCarta('meriendas')}
                className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                  categoriaCarta === 'meriendas'
                    ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                    : 'bg-white/5 border border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                🧇 Meriendas
              </button>
              <button
                onClick={() => setCategoriaCarta('bebidas')}
                className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                  categoriaCarta === 'bebidas'
                    ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                    : 'bg-white/5 border border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                🥤 Bebidas & Energy
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {cartaItems[categoriaCarta].map((item, index) => (
                <div
                  key={index}
                  className={`p-5 rounded-2xl border transition-all ${
                    item.destacado
                      ? 'bg-gradient-to-r from-amber-950/30 to-[#0e111a] border-amber-500/40 shadow-md'
                      : 'bg-[#0d0f17] border-white/10'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-white text-sm sm:text-base">{item.nombre}</h4>
                        {item.destacado && (
                          <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-950/70 border border-amber-500/30 px-2 py-0.5 rounded-full">
                            <Flame className="h-3 w-3" /> Top
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{item.desc}</p>
                    </div>
                    <span className="font-mono text-amber-400 font-black text-base shrink-0">
                      {item.precio}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </main>
      ) : (
        /* VISTA PRINCIPAL / PORTAL GENERAL */
        <main className="flex-grow">
          <section className="relative overflow-hidden py-24 sm:py-32 border-b border-white/[0.06]">
            <div className="absolute inset-0 z-0">
              <img
                src="https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=2000&q=80"
                alt="Ambiente Gaming y Competición"
                className="w-full h-full object-cover object-center opacity-60 scale-105 transition-transform duration-1000 ease-out"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#08090d] via-[#08090d]/60 to-[#08090d]/40" />
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
              </div>
            </div>
          </section>

          {/* Tres Pilares Centrales */}
          <section className="max-w-6xl mx-auto px-5 py-16 space-y-12">
            <div className="grid gap-6 md:grid-cols-3">
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

              <div className="rounded-2xl border border-cyan-500/40 bg-gradient-to-b from-cyan-950/30 to-[#0c0d14]/90 backdrop-blur p-6 flex flex-col justify-between hover:border-cyan-400 transition-all group relative overflow-hidden shadow-[0_0_30px_rgba(0,242,254,0.1)]">
                <div>
                  <div className="h-12 w-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                    <CalendarDays className="h-6 w-6" />
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
        </main>
      )}

      {/* SECCIÓN DE CONTACTO & UBICACIÓN */}
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
            className="w-full max-w-lg rounded-2xl border border-amber-500/30 bg-[#0c0d14] p-6 sm:p-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2.5 text-amber-400">
                <FileText className="h-5 w-5" />
                <h3 className="font-bold text-white text-lg">Carta Nexus Bar & Coffee</h3>
              </div>
              <button 
                onClick={() => setMenuModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 space-y-4 text-sm text-slate-300 leading-relaxed">
              <p>Desayunos completos, menú del día casero y bollería recién horneada disponibles a diario en Chinales 45.</p>
            </div>

            <div className="mt-6 pt-4 border-t border-white/10 flex justify-end">
              <button 
                onClick={() => setMenuModalOpen(false)}
                className="rounded-xl bg-amber-500 px-5 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pie de página con Acceso Maestro Oculto */}
      <footer className="border-t border-white/[0.06] bg-[#050608] text-slate-500 text-xs py-8 relative">
        <div className="max-w-6xl mx-auto px-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} NEXUS CORDOBA SL. NIF: B93887990. Todos los derechos reservados.</p>
          
          <div className="flex items-center gap-4 text-slate-400 flex-wrap">
            <span className="flex items-center gap-1">
              <Shield className="h-3.5 w-3.5" /> Empresa registrada
            </span>
            <span>·</span>

            {/* Acceso Maestro Oculto protegido por contraseña */}
            {adminDesbloqueado ? (
              <div className="flex items-center gap-3 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10 flex-wrap">
                <a 
                  href="#cocina" 
                  onClick={() => setSubdomainRoute('cocina')}
                  className="flex items-center gap-1 hover:text-amber-400 transition-colors cursor-pointer text-amber-400 font-bold text-xs"
                >
                  <ChefHat className="h-3.5 w-3.5" /> Cocina
                </a>
                <span>·</span>
                <a 
                  href="#barra" 
                  onClick={() => setSubdomainRoute('barra')}
                  className="flex items-center gap-1 hover:text-cyan-400 transition-colors cursor-pointer text-cyan-400 font-bold text-xs"
                >
                  <Coffee className="h-3.5 w-3.5" /> Barra
                </a>
                <span>·</span>
                <a 
                  href="https://ventas.nexusgamingcenter.es" 
                  className="flex items-center gap-1 hover:text-sky-400 transition-colors text-sky-400 font-bold text-xs"
                >
                  <TrendingUp className="h-3.5 w-3.5" /> TPV
                </a>
                <span>·</span>
                <a 
                  href="https://equipo.nexusgamingcenter.es" 
                  className="flex items-center gap-1 hover:text-rose-400 transition-colors text-rose-400 font-bold text-xs"
                >
                  <Lock className="h-3.5 w-3.5" /> Staff
                </a>
                <span>·</span>
                <a 
                  href="#qr" 
                  onClick={(e) => {
                    e.preventDefault();
                    setSubdomainRoute('qr-generator');
                  }}
                  className="flex items-center gap-1 hover:text-emerald-400 transition-colors cursor-pointer text-emerald-400 font-bold text-xs"
                >
                  <QrCode className="h-3.5 w-3.5" /> Códigos QR
                </a>
                <button
                  onClick={() => setAdminDesbloqueado(false)}
                  className="text-slate-400 hover:text-white ml-2 text-[10px] uppercase font-bold underline cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            ) : (
              <button
                onClick={() => setModalAdminOpen(true)}
                className="flex items-center gap-1 text-slate-600 hover:text-slate-400 transition-colors cursor-pointer bg-transparent border-0 text-xs"
                title="Área de Gestión Interna"
              >
                <Lock className="h-3 w-3" />
                <span>Área Interna</span>
              </button>
            )}
          </div>
        </div>

        {/* Modal de Contraseña Maestra */}
        {modalAdminOpen && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4"
            onClick={() => setModalAdminOpen(false)}
          >
            <div 
              className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#0c0d14] p-6 shadow-2xl space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2 text-cyan-400">
                  <Lock className="h-5 w-5" />
                  <h3 className="font-bold text-white text-sm">Clave de Acceso Maestro</h3>
                </div>
                <button 
                  onClick={() => setModalAdminOpen(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <p className="text-xs text-slate-400">
                  Introduce la clave maestra de gerencia para revelar los accesos internos:
                </p>

                <input
                  type="password"
                  autoFocus
                  placeholder="Contraseña maestra..."
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    setPasswordError(false);
                  }}
                  className="w-full bg-black/50 border border-white/15 rounded-xl px-3 py-2.5 text-xs text-white focus:border-cyan-400 outline-none"
                />

                {passwordError && (
                  <p className="text-xs text-rose-400">Contraseña incorrecta.</p>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setModalAdminOpen(false)}
                    className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-slate-300 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs cursor-pointer shadow-md"
                  >
                    Desbloquear
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </footer>
    </div>
  );
}