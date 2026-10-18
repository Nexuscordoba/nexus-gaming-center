import { useState } from 'react';
import { supabase } from './supabase';
import { 
  TrendingUp, 
  DollarSign, 
  Package, 
  AlertTriangle, 
  ArrowLeft, 
  RefreshCw, 
  Receipt,
  Lock,
  Delete,
  ShieldCheck,
  LogOut
} from 'lucide-react';

interface ItemLoyverse {
  id: string;
  item_name: string;
  category_id?: string;
  variants: Array<{
    variant_id: string;
    item_id: string;
    price: number;
    cost: number;
  }>;
}

interface InventoryLoyverse {
  variant_id: string;
  in_stock: number;
}

interface ReceiptLoyverse {
  receipt_number: string;
  created_at: string;
  total_money: number;
  payments: Array<{
    type: string;
    money_amount: number;
  }>;
}

export default function LoyverseDashboard() {
  // Autenticación de Administrador
  const [autenticado, setAutenticado] = useState(false);
  const [adminNombre, setAdminNombre] = useState('');
  const [pin, setPin] = useState('');
  const [verificandoPin, setVerificandoPin] = useState(false);
  const [errorAuth, setErrorAuth] = useState<string | null>(null);

  // Datos financieros y de TPV
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ItemLoyverse[]>([]);
  const [inventory, setInventory] = useState<InventoryLoyverse[]>([]);
  const [receipts, setReceipts] = useState<ReceiptLoyverse[]>([]);
  const [tab, setTab] = useState<'resumen' | 'rentabilidad' | 'inventario' | 'ventas'>('resumen');

  const volverAWebPrincipal = () => {
    if (window.location.hash) {
      window.location.hash = '';
    } else {
      window.location.href = 'https://nexusgamingcenter.es';
    }
  };

  const handleNumero = (num: string) => {
    if (pin.length < 6) {
      setPin((prev) => prev + num);
      setErrorAuth(null);
    }
  };

  const handleBorrar = () => {
    setPin((prev) => prev.slice(0, -1));
    setErrorAuth(null);
  };

  // Validar credenciales de Administrador en Supabase
  const verificarAccesoAdmin = async () => {
    if (pin.length < 4) {
      setErrorAuth('Introduce un PIN de al menos 4 dígitos');
      return;
    }

    setVerificandoPin(true);
    setErrorAuth(null);

    try {
      const { data, error: dbErr } = await supabase
        .from('empleados')
        .select('*')
        .eq('pin_acceso', pin)
        .eq('activo', true)
        .maybeSingle();

      if (dbErr) throw dbErr;

      if (!data) {
        setErrorAuth('PIN incorrecto o usuario no registrado');
        setPin('');
      } else if (data.rol !== 'admin') {
        setErrorAuth('Acceso denegado: este panel requiere privilegios de Administrador / Gerencia');
        setPin('');
      } else {
        setAutenticado(true);
        setAdminNombre(`${data.nombre} ${data.apellidos}`);
        cargarDatos();
      }
    } catch (err: any) {
      setErrorAuth('Error de conexión: ' + (err.message || 'Inténtalo de nuevo'));
    } finally {
      setVerificandoPin(false);
    }
  };

  const cargarDatos = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/loyverse');
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error al obtener datos');
      }

      setItems(data.items || []);
      setInventory(data.inventory || []);
      setReceipts(data.receipts || []);
    } catch (err: any) {
      setError(err.message || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const cerrarSesion = () => {
    setAutenticado(false);
    setPin('');
    setAdminNombre('');
  };

  // Cálculos financieros
  const totalFacturado = receipts.reduce((acc, r) => acc + (r.total_money || 0), 0);
  const ticketMedio = receipts.length > 0 ? totalFacturado / receipts.length : 0;

  const stockMap = new Map<string, number>();
  inventory.forEach((inv) => {
    stockMap.set(inv.variant_id, inv.in_stock || 0);
  });

  // SI NO ESTÁ AUTENTICADO: Pantalla de Bloqueo / PIN
  if (!autenticado) {
    return (
      <div className="min-h-screen bg-[#06070a] text-slate-100 flex flex-col justify-between selection:bg-cyan-500 selection:text-black">
        <header className="border-b border-white/10 bg-[#08090d]/80 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-950/40 text-cyan-400">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-bold text-white text-base tracking-wide flex items-center gap-2">
                NEXUS <span className="text-cyan-400">TPV & FINANZAS</span>
              </h1>
              <p className="text-[11px] text-slate-400">Acceso Restringido a Gerencia · Chinales 45</p>
            </div>
          </div>

          <button
            type="button"
            onClick={volverAWebPrincipal}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs text-slate-300 hover:text-white transition-all cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Volver a la web principal</span>
          </button>
        </header>

        <main className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#0c0d14] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-center">
            <div className="flex justify-center">
              <div className="h-14 w-14 rounded-2xl bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-[0_0_20px_rgba(0,242,254,0.15)]">
                <Lock className="h-7 w-7" />
              </div>
            </div>

            <div>
              <h2 className="text-lg font-bold text-white">Panel Directivo Protegido</h2>
              <p className="text-xs text-slate-400 mt-1">
                Introduce tu PIN de Administrador para consultar ventas, márgenes e inventario
              </p>
            </div>

            {/* Puntos indicadores del PIN */}
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

            {/* Teclado táctil */}
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
                disabled={pin.length < 4 || verificandoPin}
                onClick={verificarAccesoAdmin}
                className="h-14 rounded-2xl bg-cyan-500 font-bold text-slate-950 hover:bg-cyan-400 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center shadow-[0_0_15px_rgba(0,242,254,0.3)]"
              >
                {verificandoPin ? '...' : 'Entrar'}
              </button>
            </div>

            {errorAuth && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs">
                {errorAuth}
              </div>
            )}
          </div>
        </main>

        <footer className="border-t border-white/5 py-4 text-center text-xs text-slate-500">
          NEXUS CÓRDOBA SL · Acceso Confidencial
        </footer>
      </div>
    );
  }

  // SI ESTÁ AUTENTICADO COMO ADMIN: Panel Completo
  return (
    <div className="min-h-screen bg-[#06070a] text-slate-100 flex flex-col justify-between selection:bg-cyan-500 selection:text-black">
      {/* Cabecera */}
      <header className="border-b border-white/10 bg-[#08090d]/80 px-6 py-4 flex items-center justify-between sticky top-0 z-40 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-950/40 text-cyan-400">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-bold text-white text-base tracking-wide flex items-center gap-2">
              NEXUS <span className="text-cyan-400">TPV & FINANZAS</span>
            </h1>
            <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              Sesión iniciada: <span className="text-white font-medium">{adminNombre}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={cargarDatos}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs text-slate-300 hover:text-white transition-all cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            <span>Actualizar</span>
          </button>

          <button
            type="button"
            onClick={cerrarSesion}
            title="Bloquear y salir del panel"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-500/20 bg-rose-950/20 hover:bg-rose-900/30 text-xs text-rose-300 transition-all cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Bloquear</span>
          </button>

          <button
            type="button"
            onClick={volverAWebPrincipal}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs text-slate-300 hover:text-white transition-all cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Volver a la web principal</span>
          </button>
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Selector de Pestañas */}
        <div className="flex flex-wrap gap-2 border-b border-white/10 pb-4">
          <button
            type="button"
            onClick={() => setTab('resumen')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              tab === 'resumen'
                ? 'bg-cyan-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white bg-white/5'
            }`}
          >
            Resumen General
          </button>
          <button
            type="button"
            onClick={() => setTab('rentabilidad')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              tab === 'rentabilidad'
                ? 'bg-cyan-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white bg-white/5'
            }`}
          >
            Rentabilidad & Márgenes
          </button>
          <button
            type="button"
            onClick={() => setTab('inventario')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              tab === 'inventario'
                ? 'bg-cyan-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white bg-white/5'
            }`}
          >
            Inventario & Stock
          </button>
          <button
            type="button"
            onClick={() => setTab('ventas')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              tab === 'ventas'
                ? 'bg-cyan-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white bg-white/5'
            }`}
          >
            Últimos Tickets
          </button>
        </div>

        {error && (
          <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* PESTAÑA: RESUMEN GENERAL */}
        {tab === 'resumen' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-6 rounded-3xl bg-[#0c0d14] border border-white/10">
                <span className="text-xs uppercase font-bold text-slate-400 flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-emerald-400" />
                  Facturación Registrada
                </span>
                <span className="text-3xl font-black text-white font-mono mt-2 block">
                  {totalFacturado.toFixed(2)} €
                </span>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Total de {receipts.length} tickets en Loyverse
                </span>
              </div>

              <div className="p-6 rounded-3xl bg-[#0c0d14] border border-white/10">
                <span className="text-xs uppercase font-bold text-slate-400 flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-cyan-400" />
                  Ticket Medio
                </span>
                <span className="text-3xl font-black text-cyan-400 font-mono mt-2 block">
                  {ticketMedio.toFixed(2)} €
                </span>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Gasto medio por cliente
                </span>
              </div>

              <div className="p-6 rounded-3xl bg-[#0c0d14] border border-white/10">
                <span className="text-xs uppercase font-bold text-slate-400 flex items-center gap-2">
                  <Package className="h-4 w-4 text-amber-400" />
                  Catálogo Activo
                </span>
                <span className="text-3xl font-black text-white font-mono mt-2 block">
                  {items.length} productos
                </span>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Sincronizados desde el TPV
                </span>
              </div>
            </div>
          </div>
        )}

        {/* PESTAÑA: RENTABILIDAD & MÁRGENES */}
        {tab === 'rentabilidad' && (
          <div className="bg-[#0c0d14] border border-white/10 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div>
                <h3 className="font-bold text-white text-base">Análisis de Márgenes por Producto</h3>
                <p className="text-xs text-slate-400">Comparativa entre precio de venta y coste de compra</p>
              </div>
            </div>

            <div className="border border-white/10 rounded-2xl overflow-hidden bg-black/30 max-h-[480px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-white/[0.03] text-slate-400 border-b border-white/10 uppercase tracking-wider font-semibold sticky top-0 backdrop-blur-md">
                  <tr>
                    <th className="py-3 px-4">Artículo</th>
                    <th className="py-3 px-4 text-right">PVP</th>
                    <th className="py-3 px-4 text-right">Coste</th>
                    <th className="py-3 px-4 text-right">Margen Bruto</th>
                    <th className="py-3 px-4 text-right">% Rentabilidad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300">
                  {items.map((item) => {
                    const variant = item.variants?.[0];
                    const pvp = variant?.price || 0;
                    const coste = variant?.cost || 0;
                    const margen = pvp - coste;
                    const rentabilidad = pvp > 0 ? (margen / pvp) * 100 : 0;

                    return (
                      <tr key={item.id} className="hover:bg-white/[0.02]">
                        <td className="py-3 px-4 font-semibold text-white">{item.item_name}</td>
                        <td className="py-3 px-4 font-mono text-right">{pvp.toFixed(2)} €</td>
                        <td className="py-3 px-4 font-mono text-slate-400 text-right">{coste.toFixed(2)} €</td>
                        <td className="py-3 px-4 font-mono text-right font-bold text-emerald-400">
                          +{margen.toFixed(2)} €
                        </td>
                        <td className="py-3 px-4 font-mono text-right">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            rentabilidad >= 60 
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30' 
                              : 'bg-white/5 text-slate-300'
                          }`}>
                            {rentabilidad.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PESTAÑA: INVENTARIO & STOCK */}
        {tab === 'inventario' && (
          <div className="bg-[#0c0d14] border border-white/10 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div>
                <h3 className="font-bold text-white text-base">Control de Stock en Chinales 45</h3>
                <p className="text-xs text-slate-400">Unidades reales registradas en almacén y barra</p>
              </div>
            </div>

            <div className="border border-white/10 rounded-2xl overflow-hidden bg-black/30 max-h-[480px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-white/[0.03] text-slate-400 border-b border-white/10 uppercase tracking-wider font-semibold sticky top-0 backdrop-blur-md">
                  <tr>
                    <th className="py-3 px-4">Artículo</th>
                    <th className="py-3 px-4 text-center">Stock Actual</th>
                    <th className="py-3 px-4 text-right">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300">
                  {items.map((item) => {
                    const variantId = item.variants?.[0]?.variant_id;
                    const stock = stockMap.get(variantId) ?? 0;
                    const esBajo = stock <= 5;

                    return (
                      <tr key={item.id} className="hover:bg-white/[0.02]">
                        <td className="py-3 px-4 font-semibold text-white">{item.item_name}</td>
                        <td className="py-3 px-4 font-mono text-center font-bold text-white">
                          {stock} uds
                        </td>
                        <td className="py-3 px-4 text-right">
                          {esBajo ? (
                            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-500/30">
                              Stock Bajo
                            </span>
                          ) : (
                            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                              Disponible
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PESTAÑA: ÚLTIMOS TICKETS */}
        {tab === 'ventas' && (
          <div className="bg-[#0c0d14] border border-white/10 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div>
                <h3 className="font-bold text-white text-base">Histórico de Ventas</h3>
                <p className="text-xs text-slate-400">Tickets emitidos en el TPV</p>
              </div>
            </div>

            <div className="border border-white/10 rounded-2xl overflow-hidden bg-black/30 max-h-[480px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-white/[0.03] text-slate-400 border-b border-white/10 uppercase tracking-wider font-semibold sticky top-0 backdrop-blur-md">
                  <tr>
                    <th className="py-3 px-4">Ticket</th>
                    <th className="py-3 px-4">Fecha y Hora</th>
                    <th className="py-3 px-4 text-right">Importe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300">
                  {receipts.map((r, i) => (
                    <tr key={i} className="hover:bg-white/[0.02]">
                      <td className="py-3 px-4 font-mono font-semibold text-cyan-400">
                        #{r.receipt_number}
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {new Date(r.created_at).toLocaleString('es-ES')}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-white text-right">
                        {(r.total_money || 0).toFixed(2)} €
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-white/5 py-4 text-center text-xs text-slate-500">
        NEXUS CÓRDOBA SL · Conectado con Loyverse POS API
      </footer>
    </div>
  );
}