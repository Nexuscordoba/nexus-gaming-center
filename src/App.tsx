// src/App.tsx
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
  CalendarDays,
  QrCode,
  Utensils,
  CheckCircle2
} from 'lucide-react';
import { supabase } from './supabase';
import StaffPortal from './StaffPortal';
import EscapeRooms from './EscapeRooms';
import LoyverseDashboard from './LoyverseDashboard';
import KitchenDisplay from './KitchenDisplay';
import BarDisplay from './BarDisplay';
import TableQrGenerator from './TableQrGenerator';
import TableOrder from './TableOrder';
import TableWaiter from './TableWaiter';

export default function App() {
  const [currentView, setCurrentView] = useState<'home' | 'bar'>('home');
  const [subdomainRoute, setSubdomainRoute] = useState<'main' | 'staff' | 'escape' | 'ventas' | 'cocina' | 'barra' | 'qr-generator' | 'mesa' | 'waiter'>('main');
  const [menuModalOpen, setMenuModalOpen] = useState(false);

  const [adminDesbloqueado, setAdminDesbloqueado] = useState(false);
  const [modalAdminOpen, setModalAdminOpen] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  
  // Estado para controlar el submenú de Cafetería en el Dock
  const [showCafeteriaMenu, setShowCafeteriaMenu] = useState(false);
  const [toastOfflineSync, setToastOfflineSync] = useState<string | null>(null);

  useEffect(() => {
    let sincronizando = false;

    const descontarStockPedidoOffline = async (itemsPedido: any[]) => {
      try {
        const itemsValidos = (itemsPedido || []).filter(
          (item) => item && !String(item.nombre || '').includes('├─') && Number(item.cantidad) > 0
        );

        await Promise.all(
          itemsValidos.map(async (item) => {
            const prodId = item.producto_id || item.id;
            let productoDB: { id: number; stock_actual: number | null; articulo_inventario_id?: string | null } | null = null;

            if (prodId) {
              const { data } = await supabase
                .from('productos_carta')
                .select('id, stock_actual, articulo_inventario_id')
                .eq('id', prodId)
                .maybeSingle();
              productoDB = data;
            }

            if (!productoDB && item.nombre) {
              const { data } = await supabase
                .from('productos_carta')
                .select('id, stock_actual, articulo_inventario_id')
                .eq('nombre', String(item.nombre).trim())
                .maybeSingle();
              productoDB = data;
            }

            if (!productoDB) return;

            const nuevoStock = Number(productoDB.stock_actual ?? 0) - Number(item.cantidad);
            await supabase
              .from('productos_carta')
              .update({ stock_actual: nuevoStock })
              .eq('id', productoDB.id);

            const artInvId = item.articulo_inventario_id || productoDB.articulo_inventario_id;
            if (artInvId) {
              await supabase
                .from('articulos_cafeteria')
                .update({ stock_actual: nuevoStock })
                .eq('id', artInvId);
            }
          })
        );
      } catch (stockErr) {
        console.error('Error al descontar stock de pedido offline:', stockErr);
      }
    };

    const sincronizarPedidosOffline = async () => {
      if (sincronizando || !navigator.onLine) return;

      const raw = localStorage.getItem('pedidos_offline');
      if (!raw) return;

      let cola: any[] = [];
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) cola = parsed;
      } catch (e) {
        console.error('Error al leer pedidos_offline de localStorage:', e);
        return;
      }

      if (cola.length === 0) return;

      sincronizando = true;
      const pendientesRestantes = [...cola];
      let sincronizadosExito = 0;

      try {
        for (const pedido of cola) {
          try {
            const totalFinal = Number(pedido?.totales?.totalFinal ?? 0);
            const subtotalBruto = Number(pedido?.totales?.subtotalBruto ?? totalFinal);
            const dtoGeneralPorc = Number(pedido?.totales?.dtoGeneralPorc ?? 0);
            const descuentoTotalImporte = Number(pedido?.totales?.descuentoTotalImporte ?? 0);
            const metodo = pedido?.metodo === 'tarjeta' ? 'tarjeta' : 'efectivo';

            const { data: docEmitido, error: rpcError } = await supabase.rpc('emitir_documento_fiscal', {
              p_serie: 'T',
              p_tipo_documento: 'SIMPLIFICADA',
              p_mesa: pedido.mesa || 'BARRA',
              p_vendedor: pedido.vendedor || 'Camarero',
              p_metodo_pago: metodo,
              p_importe_efectivo: metodo === 'efectivo' ? totalFinal : 0,
              p_importe_tarjeta: metodo === 'tarjeta' ? totalFinal : 0,
              p_subtotal_bruto: subtotalBruto,
              p_descuento_general_porc: dtoGeneralPorc,
              p_descuento_total_imp: descuentoTotalImporte,
              p_autorizado_por: pedido.autorizado_por || null,
              p_tipo_iva: Number(pedido.tipo_iva ?? 10),
              p_total_final: totalFinal,
              p_lineas: pedido.lineas || []
            });

            if (rpcError) throw rpcError;

            if (pedido.mesa) {
              await supabase
                .from('comandas_cocina')
                .update({
                  pagado: true,
                  metodo_pago: metodo,
                  camarero_nombre: pedido.vendedor || 'Camarero',
                  total_ticket: totalFinal,
                  factura_fiscal_id: docEmitido?.id,
                  numero_factura_legal: docEmitido?.numero_completo,
                  descuento_aplicado: descuentoTotalImporte
                })
                .eq('mesa', pedido.mesa)
                .eq('pagado', false);
            }

            // Actualizar caja_diaria activa o correspondiente al turno del pedido
            const { data: cajaDestino } = pedido.caja_id
              ? await supabase.from('caja_diaria').select('*').eq('id', pedido.caja_id).maybeSingle()
              : await supabase.from('caja_diaria').select('*').eq('estado', 'abierta').order('id', { ascending: false }).limit(1).maybeSingle();

            if (cajaDestino) {
              const nuevoEfectivo = Number(cajaDestino.total_efectivo || 0) + (metodo === 'efectivo' ? totalFinal : 0);
              const nuevaTarjeta = Number(cajaDestino.total_tarjeta || 0) + (metodo === 'tarjeta' ? totalFinal : 0);
              await supabase
                .from('caja_diaria')
                .update({
                  total_efectivo: nuevoEfectivo,
                  total_tarjeta: nuevaTarjeta
                })
                .eq('id', cajaDestino.id);
            }

            // Descontar inventario en Supabase
            await descontarStockPedidoOffline(pedido.items || []);

            // Eliminar este ticket sincronizado con éxito de la cola en localStorage
            const idx = pendientesRestantes.findIndex(
              (p) => (p.id_cola && p.id_cola === pedido.id_cola) || p === pedido
            );
            if (idx !== -1) {
              pendientesRestantes.splice(idx, 1);
            }
            if (pendientesRestantes.length === 0) {
              localStorage.removeItem('pedidos_offline');
            } else {
              localStorage.setItem('pedidos_offline', JSON.stringify(pendientesRestantes));
            }

            sincronizadosExito++;
          } catch (errPedido) {
            console.error('Error sincronizando un pedido offline con Supabase:', errPedido);
          }
        }

        if (sincronizadosExito > 0) {
          const msgExito = `¡Conexión recuperada! Se han sincronizado ${sincronizadosExito} pedido(s) pendientes de la cola offline.`;
          setToastOfflineSync(msgExito);
          window.dispatchEvent(
            new CustomEvent('pedidos-offline-sincronizados', { detail: { cantidad: sincronizadosExito } })
          );
          setTimeout(() => {
            setToastOfflineSync(null);
          }, 5500);
        }
      } finally {
        sincronizando = false;
      }
    };

    window.addEventListener('online', sincronizarPedidosOffline);
    if (navigator.onLine) {
      sincronizarPedidosOffline();
    }

    return () => {
      window.removeEventListener('online', sincronizarPedidosOffline);
    };
  }, []);

  

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
      } else if (hostname.startsWith('ventas.') || hostname.startsWith('tpv.') || hostname.startsWith('backoffice.')) {
        setSubdomainRoute('ventas');
        return;
      } else if (hostname.startsWith('cocina.')) {
        setSubdomainRoute('cocina');
        return;
      } else if (hostname.startsWith('barra.')) {
        setSubdomainRoute('barra');
        return;
      } else if (hash.startsWith('#/mesa/') || hash.startsWith('#mesa/')) {
        setSubdomainRoute('mesa');
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
      } else if (hash === '#backoffice' || hash === '#/backoffice' || hash === '#ventas' || hash === '#tpv') {
        setSubdomainRoute('ventas');
        setAdminDesbloqueado(true);
        setShowCafeteriaMenu(true);
      } else if (hash === '#cocina' || hash === '#/cocina') {
        setSubdomainRoute('cocina');
      } else if (hash === '#barra' || hash === '#/barra') {
        setSubdomainRoute('barra');
      } else if (hash === '#qr' || hash === '#/qr') {
        setSubdomainRoute('qr-generator');
      } else if (hash === '#camarero' || hash === '#/camarero' || hash === '#waiter') {
        setSubdomainRoute('waiter');
        setAdminDesbloqueado(true); 
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
      setShowCafeteriaMenu(false); 
    } else {
      setPasswordError(true);
    }
  };

  if (subdomainRoute === 'staff') {
    return <StaffPortal />;
  }

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

  if (subdomainRoute === 'ventas') {
    return (
      <LoyverseDashboard
        onBack={() => {
          window.location.hash = '';
          setSubdomainRoute('main');
        }}
      />
    );
  }

  if (subdomainRoute === 'cocina') {
    return <KitchenDisplay />;
  }

  if (subdomainRoute === 'barra') {
    return <BarDisplay />;
  }

  if (subdomainRoute === 'qr-generator') {
    return <TableQrGenerator onBack={() => setSubdomainRoute('main')} />;
  }

  if (subdomainRoute === 'mesa') {
    return <TableOrder />;
  }

  if (subdomainRoute === 'waiter') {
    return (
      <>
        {toastOfflineSync && (
          <div className="fixed top-4 right-4 z-[9999] max-w-md rounded-2xl border border-emerald-500/50 bg-emerald-950/95 px-4 py-3 text-xs font-bold text-emerald-300 shadow-2xl flex items-center gap-2.5 backdrop-blur-md">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            <span>{toastOfflineSync}</span>
          </div>
        )}
        <TableWaiter onBack={() => setSubdomainRoute('main')} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#08090d] text-slate-200 font-sans selection:bg-cyan-500 selection:text-black flex flex-col justify-between">
      
      {toastOfflineSync && (
        <div className="fixed top-4 right-4 z-[9999] max-w-md rounded-2xl border border-emerald-500/50 bg-emerald-950/95 px-4 py-3 text-xs font-bold text-emerald-300 shadow-2xl flex items-center gap-2.5 backdrop-blur-md">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
          <span>{toastOfflineSync}</span>
        </div>
      )}
      {/* MENÚ FLOTANTE DOCK REORGANIZADO */}
      {adminDesbloqueado && (
        <div className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 w-max max-w-[95%] bg-gradient-to-r from-[#0c0d14]/95 to-[#131722]/95 backdrop-blur-xl border border-cyan-500/50 p-3 sm:p-4 rounded-2xl shadow-[0_0_40px_rgba(0,242,254,0.3)] flex flex-wrap justify-center items-center gap-2 sm:gap-4 animate-slide-up">
          
          {showCafeteriaMenu ? (
            /* SUBMENÚ DE CAFETERÍA (INCLUYE BACKOFFICE SOLO PARA ADMINISTRADORES) */
            <>
              <button 
                onClick={() => setShowCafeteriaMenu(false)}
                className="flex items-center gap-1 text-slate-400 hover:text-white px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-bold transition-colors cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" /> Volver
              </button>
              <span className="text-slate-600 hidden sm:inline">|</span>
              
              <a 
                href="#camarero" 
                onClick={(e) => {
                  e.preventDefault();
                  window.location.hash = '#camarero';
                  setSubdomainRoute('waiter');
                }}
                className="flex items-center gap-1.5 hover:text-amber-400 transition-colors cursor-pointer text-amber-400 font-black text-xs sm:text-sm px-3 py-1.5 rounded-lg hover:bg-amber-500/10"
              >
                <Utensils className="h-4 w-4" /> Camareros
              </a>
              <span className="text-slate-600 hidden sm:inline">|</span>
              <a 
                href="#cocina" 
                onClick={(e) => {
                  e.preventDefault();
                  window.location.hash = '#cocina';
                  setSubdomainRoute('cocina');
                }}
                className="flex items-center gap-1.5 hover:text-amber-400 transition-colors cursor-pointer text-amber-400 font-black text-xs sm:text-sm px-3 py-1.5 rounded-lg hover:bg-amber-500/10"
              >
                <ChefHat className="h-4 w-4" /> Cocina
              </a>
              <span className="text-slate-600 hidden sm:inline">|</span>
              <a 
                href="#barra" 
                onClick={(e) => {
                  e.preventDefault();
                  window.location.hash = '#barra';
                  setSubdomainRoute('barra');
                }}
                className="flex items-center gap-1.5 hover:text-amber-400 transition-colors cursor-pointer text-amber-400 font-black text-xs sm:text-sm px-3 py-1.5 rounded-lg hover:bg-amber-500/10"
              >
                <Coffee className="h-4 w-4" /> Barra
              </a>
              <span className="text-slate-600 hidden sm:inline">|</span>
              <a 
                href="#backoffice" 
                onClick={(e) => {
                  e.preventDefault();
                  window.location.hash = '#backoffice';
                  setSubdomainRoute('ventas');
                }}
                className="flex items-center gap-1.5 hover:text-sky-400 transition-colors cursor-pointer text-sky-400 font-black text-xs sm:text-sm px-3 py-1.5 rounded-lg hover:bg-sky-500/10"
              >
                <TrendingUp className="h-4 w-4" /> Backoffice
              </a>
            </>
          ) : (
            /* MENÚ PRINCIPAL */
            <>
              <button 
                onClick={() => setShowCafeteriaMenu(true)}
                className="flex items-center gap-1.5 hover:text-amber-400 transition-colors cursor-pointer text-amber-400 font-black text-xs sm:text-sm px-3 py-1.5 rounded-lg hover:bg-amber-500/10"
              >
                <Coffee className="h-4 w-4" /> Cafetería
              </button>
              <span className="text-slate-600 hidden sm:inline">|</span>
              <a 
                href="https://equipo.nexusgamingcenter.es" 
                className="flex items-center gap-1.5 hover:text-rose-400 transition-colors text-rose-400 font-black text-xs sm:text-sm px-3 py-1.5 rounded-lg hover:bg-rose-500/10"
              >
                <Lock className="h-4 w-4" /> Staff
              </a>
              <span className="text-slate-600 hidden sm:inline">|</span>
              <a 
                href="#qr" 
                onClick={(e) => {
                  e.preventDefault();
                  setSubdomainRoute('qr-generator');
                }}
                className="flex items-center gap-1.5 hover:text-emerald-400 transition-colors cursor-pointer text-emerald-400 font-black text-xs sm:text-sm px-3 py-1.5 rounded-lg hover:bg-emerald-500/10"
              >
                <QrCode className="h-4 w-4" /> Códigos QR
              </a>
            </>
          )}
          
          <div className="pl-2 ml-auto sm:ml-0 border-l border-white/10 flex items-center">
            <button
              onClick={() => { 
                setAdminDesbloqueado(false); 
                setShowCafeteriaMenu(false); 
                window.location.hash = '';
              }}
              className="flex items-center gap-1 text-slate-400 hover:text-white px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] uppercase font-bold cursor-pointer transition-colors"
            >
              <X className="h-3 w-3" /> Cerrar
            </button>
          </div>
        </div>
      )}

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
                <span className="hidden sm:inline">Volver a la web principal</span>
                <span className="sm:hidden">Volver</span>
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

      {currentView === 'bar' ? (
        <main className="flex-grow">
          <section className="relative overflow-hidden py-16 sm:py-24 border-b border-white/[0.06]">
            <div className="absolute inset-0 z-0">
              <img
                src="https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=2000&q=80"
                alt="Café Bar Nexus"
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
                Café Bar <span className="text-amber-400 drop-shadow-[0_0_25px_rgba(245,158,11,0.5)]">Nexus</span>
              </h1>
              <p className="mt-4 text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
                Desayunos completos y menú del día casero disponibles a diario en Chinales 45.
              </p>

              <div className="mt-8 flex justify-center">
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setMenuModalOpen(true);
                  }}
                  className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-8 py-3.5 text-slate-950 text-sm font-bold uppercase tracking-wider shadow-[0_0_25px_rgba(245,158,11,0.35)] hover:opacity-95 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <FileText className="h-4 w-4" />
                  Ver carta y avisos
                </a>
              </div>
            </div>
          </section>

          <section className="max-w-6xl mx-auto px-5 py-16">
            <div className="text-center max-w-3xl mx-auto mb-10">
              <div className="inline-flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider mb-2">
                <UtensilsCrossed className="h-4 w-4" />
                Carta & Menú
              </div>
              <h2 className="text-3xl font-black text-white">Nuestra Selección</h2>
            </div>

            {/* SECCIÓN "PRÓXIMAMENTE" REEMPLAZANDO A LOS PRODUCTOS */}
            <div className="max-w-4xl mx-auto text-center py-20 px-6 sm:px-12 rounded-3xl border border-amber-500/20 bg-gradient-to-b from-[#131722] to-[#08090d] shadow-[0_0_50px_rgba(0,0,0,0.5)] relative overflow-hidden">
              <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1495474472296-pe0a88a29580?auto=format&fit=crop&w=1000&q=20')] opacity-5 bg-cover bg-center"></div>
              
              <div className="relative z-10 space-y-6">
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 mb-2">
                  <ChefHat className="h-8 w-8" />
                </div>
                
                <h3 className="text-2xl sm:text-3xl font-black text-white">
                  🌟 Nueva Experiencia Gastronómica en Preparación
                </h3>
                
                <p className="text-slate-400 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
                  Muy pronto desvelaremos nuestra nueva carta. Mantente atento a nuestras redes sociales y a esta sección para descubrir todas las novedades que estamos cocinando para ti.
                </p>
                
                <div className="pt-6">
                  <span className="inline-block px-4 py-2 rounded-full border border-white/10 bg-white/5 text-xs text-slate-300 font-semibold uppercase tracking-widest">
                    Próximamente
                  </span>
                </div>
              </div>
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
                  <h2 className="text-xl font-bold text-white mb-2">Café Bar Nexus</h2>
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

      <section id="ubicacion" className="max-w-6xl mx-auto px-5 pb-24 w-full">
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
                <h3 className="font-bold text-white text-lg">Información y Avisos</h3>
              </div>
              <button 
                onClick={() => setMenuModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 space-y-4 text-sm text-slate-300 leading-relaxed">
              <p>Desayunos completos y menú del día casero disponibles a diario en Chinales 45.</p>
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

      <footer className="border-t border-white/[0.06] bg-[#050608] text-slate-500 text-xs py-8 relative">
        <div className="max-w-6xl mx-auto px-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} NEXUS CORDOBA SL. NIF: B93887990. Todos los derechos reservados.</p>
          
          <div className="flex items-center gap-4 text-slate-400 flex-wrap">
            <span className="flex items-center gap-1">
              <Shield className="h-3.5 w-3.5" /> Empresa registrada
            </span>
            
            {!adminDesbloqueado && (
              <>
                <span>·</span>
                <button
                  onClick={() => setModalAdminOpen(true)}
                  className="flex items-center gap-1 text-slate-600 hover:text-slate-400 transition-colors cursor-pointer bg-transparent border-0 text-xs"
                  title="Área de Gestión Interna"
                >
                  <Lock className="h-3 w-3" />
                  <span>Área Interna</span>
                </button>
              </>
            )}
          </div>
        </div>

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