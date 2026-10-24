import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { 
  TrendingUp, 
  DollarSign, 
  CreditCard, 
  Wallet, 
  ArrowLeft, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  Receipt, 
  Package, 
  BarChart3, 
  Clock, 
  Search,
  Users
} from 'lucide-react';

interface CajaDiaria {
  id: number;
  fecha: string;
  remanente_apertura: number;
  total_efectivo: number;
  total_tarjeta: number;
  estado: string;
}

export default function LoyverseDashboard() {
  const [loading, setLoading] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [cajaHoy, setCajaHoy] = useState<CajaDiaria | null>(null);
  const [remanenteInput, setRemanenteInput] = useState<string>('50.00');
  const [mensaje, setMensaje] = useState<string | null>(null);
  
  const [articulosLoyverse, setArticulosLoyverse] = useState<any[]>([]);
  const [ventasRecientes, setVentasRecientes] = useState<any[]>([]);
  const [errorApi, setErrorApi] = useState<string | null>(null);
  const [filtroBusqueda, setFiltroBusqueda] = useState('');
  const [pestanaActiva, setPestanaActiva] = useState<'resumen' | 'articulos' | 'recibos'>('resumen');
  const [rankingCamareros, setRankingCamareros] = useState<{ nombre: string, total: number }[]>([]);

  useEffect(() => {
    cargarDatosCajaYRanking();
    cargarDatosLoyverse();
  }, []);

  const cargarDatosCajaYRanking = async () => {
    const fechaHoy = new Date().toISOString().split('T')[0];

    const { data: cData } = await supabase
      .from('caja_diaria')
      .select('*')
      .eq('fecha', fechaHoy)
      .single();

    if (cData) {
      setCajaHoy(cData as CajaDiaria);
      setRemanenteInput(cData.remanente_apertura?.toString() || '50.00');
    } else {
      const { data: newData } = await supabase
        .from('caja_diaria')
        .insert([{ fecha: fechaHoy, remanente_apertura: 50.00, total_efectivo: 0, total_tarjeta: 0, estado: 'abierta' }])
        .select()
        .single();
      
      if (newData) {
        setCajaHoy(newData as CajaDiaria);
        setRemanenteInput('50.00');
      }
    }

    const { data: comandasData } = await supabase
      .from('comandas_cocina')
      .select('camarero_nombre, total_ticket')
      .gte('created_at', fechaHoy + 'T00:00:00Z')
      .eq('estado', 'servido')
      .not('camarero_nombre', 'is', null);

    if (comandasData) {
      const rankMap: Record<string, number> = {};
      comandasData.forEach((c: any) => {
        const nombre = c.camarero_nombre || 'Autopedido QR';
        rankMap[nombre] = (rankMap[nombre] || 0) + Number(c.total_ticket || 0);
      });
      const rankArray = Object.entries(rankMap).map(([nombre, total]) => ({ nombre, total }));
      rankArray.sort((a, b) => b.total - a.total);
      setRankingCamareros(rankArray);
    }
  };

  const cargarDatosLoyverse = async () => {
    setLoading(true);
    setErrorApi(null);
    try {
      const res = await fetch('/api/loyverse');
      if (!res.ok) {
        throw new Error('No se pudo conectar con la API de Loyverse.');
      }
      const json = await res.json();
      if (json.items) {
        setArticulosLoyverse(json.items);
      }
      if (json.receipts) {
        setVentasRecientes(json.receipts);
      }
    } catch (err: any) {
      setErrorApi('Modo simulación / Sincronización offline activada: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const sincronizarArticulosConSupabase = async () => {
    setSincronizando(true);
    setMensaje(null);
    try {
      // Usamos directamente los artículos que ya ha descargado la pantalla
      const itemsRemotos = articulosLoyverse;

      if (!itemsRemotos || itemsRemotos.length === 0) {
        throw new Error('No hay artículos cargados en memoria. Pulsa "Actualizar API" primero.');
      }

      let countProcesados = 0;

      for (const item of itemsRemotos) {
        const nombreItem = item.item_name || item.name;
        if (!nombreItem) continue;

        const catNombre = item.category_name ? item.category_name.toLowerCase() : 'bebidas';
        const destinoAsignado = catNombre.includes('cocina') ? 'cocina' : 'barra';
        const categoriaLocal = catNombre.includes('cocina') ? 'tapeo' : 'bebidas';
        
        const mainVariant = item.variants && item.variants.length > 0 ? item.variants[0] : {};
        const skuRef = mainVariant.sku || mainVariant.variant_id || item.id?.toString() || `SKU-${Math.random().toString(36).substring(7)}`;
        const precioItem = Number(mainVariant.price || item.price || 3.00);

        // Hacemos el upsert a Supabase de manera directa
        const { error } = await supabase
          .from('productos_carta')
          .upsert([
            {
              nombre: nombreItem,
              precio: precioItem,
              categoria: categoriaLocal,
              destino: destinoAsignado,
              activo: true,
              loyverse_variant_id: skuRef
            }
          ], { 
            onConflict: 'loyverse_variant_id' 
          });

        if (!error) {
          countProcesados++;
        } else {
          console.error("Error en upsert para:", nombreItem, error.message);
        }
      }

      setMensaje(`¡Sincronización completada con éxito! Se han volcado ${countProcesados} artículos en Supabase.`);
    } catch (err: any) {
      setMensaje('Error en sincronización: ' + err.message);
    } finally {
      setSincronizando(false);
    }
  };

  const actualizarRemanente = async () => {
    if (!cajaHoy) return;
    const val = parseFloat(remanenteInput) || 0;
    
    await supabase
      .from('caja_diaria')
      .update({ remanente_apertura: val })
      .eq('id', cajaHoy.id);

    setMensaje('¡Fondo de caja / remanente actualizado correctamente!');
    cargarDatosCajaYRanking();
  };

  const volverAWebPrincipal = () => {
    if (window.location.hash) {
      window.location.hash = '';
    } else {
      window.location.href = 'https://nexusgamingcenter.es';
    }
  };

  const efectivoVentas = cajaHoy ? Number(cajaHoy.total_efectivo) : 0;
  const tarjetaVentas = cajaHoy ? Number(cajaHoy.total_tarjeta) : 0;
  const remanente = cajaHoy ? Number(cajaHoy.remanente_apertura) : 0;
  const totalVentasDia = efectivoVentas + tarjetaVentas;
  const totalCajaEfectivo = remanente + efectivoVentas;

  const articulosFiltrados = articulosLoyverse.filter(art => 
    (art.item_name || art.name || '').toLowerCase().includes(filtroBusqueda.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#050609] text-slate-100 p-4 sm:p-6 flex flex-col justify-between selection:bg-cyan-500 selection:text-black font-sans">
      
      <header className="border-b border-white/10 pb-4 mb-8 flex flex-col sm:flex-row items-center justify-between gap-4 sticky top-0 bg-[#050609]/90 backdrop-blur-md z-30">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-sky-500/10 border border-sky-500/30 text-sky-400 flex items-center justify-center">
            <TrendingUp className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black tracking-wide text-white">NEXUS TPV · DASHBOARD & LOYVERSE</h1>
            <p className="text-xs text-slate-400">Chinales 45 · Control financiero, inventario y arqueo de caja</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap justify-center">
          <button
            type="button"
            onClick={sincronizarArticulosConSupabase}
            disabled={sincronizando}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-all cursor-pointer shadow-md disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${sincronizando ? 'animate-spin' : ''}`} />
            <span>{sincronizando ? 'Sincronizando...' : 'Sincronizar Artículos a QR'}</span>
          </button>

          <button
            type="button"
            onClick={cargarDatosLoyverse}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs text-slate-300 transition-all cursor-pointer"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Actualizar API</span>
          </button>

          <button
            type="button"
            onClick={volverAWebPrincipal}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs text-slate-300 transition-all cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Volver</span>
          </button>
        </div>
      </header>

      <div className="max-w-6xl w-full mx-auto mb-6 flex gap-2 border-b border-white/10 pb-4">
        <button
          onClick={() => setPestanaActiva('resumen')}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            pestanaActiva === 'resumen' ? 'bg-sky-500 text-slate-950 shadow-md' : 'bg-white/5 text-slate-400 hover:text-white'
          }`}
        >
          <BarChart3 className="h-4 w-4" /> Resumen & Caja
        </button>
        <button
          onClick={() => setPestanaActiva('articulos')}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            pestanaActiva === 'articulos' ? 'bg-sky-500 text-slate-950 shadow-md' : 'bg-white/5 text-slate-400 hover:text-white'
          }`}
        >
          <Package className="h-4 w-4" /> Catálogo Loyverse ({articulosLoyverse.length})
        </button>
        <button
          onClick={() => setPestanaActiva('recibos')}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            pestanaActiva === 'recibos' ? 'bg-sky-500 text-slate-950 shadow-md' : 'bg-white/5 text-slate-400 hover:text-white'
          }`}
        >
          <Receipt className="h-4 w-4" /> Ventas y Recibos ({ventasRecientes.length})
        </button>
      </div>

      <main className="flex-1 max-w-6xl w-full mx-auto space-y-8 pb-16">
        
        {errorApi && (
          <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
            <span>{errorApi}</span>
          </div>
        )}

        {mensaje && (
          <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{mensaje}</span>
          </div>
        )}

        {pestanaActiva === 'resumen' && (
          <div className="space-y-8 animate-fade-in">
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              
              <div className="p-5 rounded-3xl bg-[#0d0f17] border border-white/10 space-y-2 shadow-xl">
                <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase">
                  <span>Ventas Totales Hoy</span>
                  <TrendingUp className="h-4 w-4 text-cyan-400" />
                </div>
                <div className="text-2xl font-black text-white font-mono">{totalVentasDia.toFixed(2)} €</div>
                <p className="text-[11px] text-slate-500">Facturación global de sala y barra</p>
              </div>

              <div className="p-5 rounded-3xl bg-[#0d0f17] border border-white/10 space-y-2 shadow-xl">
                <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase">
                  <span>Cobros en Efectivo</span>
                  <DollarSign className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-black text-emerald-400 font-mono">{efectivoVentas.toFixed(2)} €</div>
                <p className="text-[11px] text-slate-500">Entrada directa en cajón</p>
              </div>

              <div className="p-5 rounded-3xl bg-[#0d0f17] border border-white/10 space-y-2 shadow-xl">
                <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase">
                  <span>Cobros con Tarjeta</span>
                  <CreditCard className="h-4 w-4 text-sky-400" />
                </div>
                <div className="text-2xl font-black text-sky-400 font-mono">{tarjetaVentas.toFixed(2)} €</div>
                <p className="text-[11px] text-slate-500">Datáfono físico / TPV</p>
              </div>

              <div className="p-5 rounded-3xl bg-[#0d0f17] border border-white/10 space-y-2 shadow-xl">
                <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase">
                  <span>Efectivo en Cajón (Teórico)</span>
                  <Wallet className="h-4 w-4 text-amber-400" />
                </div>
                <div className="text-2xl font-black text-amber-400 font-mono">{totalCajaEfectivo.toFixed(2)} €</div>
                <p className="text-[11px] text-slate-500">Remanente + Efectivo de ventas</p>
              </div>

            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div className="p-6 rounded-3xl bg-[#0d0f17] border border-white/10 space-y-4 shadow-xl">
                <div className="flex items-center gap-2.5 text-amber-400 pb-3 border-b border-white/10">
                  <Wallet className="h-5 w-5" />
                  <h3 className="font-bold text-white text-base">Fondo de Caja / Remanente de Apertura</h3>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Establece el importe inicial en monedas y billetes con el que se abre la caja al comenzar la jornada.
                </p>

                <div className="flex items-center gap-3 pt-2">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      step="0.01"
                      value={remanenteInput}
                      onChange={(e) => setRemanenteInput(e.target.value)}
                      className="w-full bg-black/50 border border-white/20 rounded-xl px-4 py-2.5 text-sm font-mono font-bold text-white outline-none focus:border-amber-400"
                    />
                    <span className="absolute right-3 top-2.5 text-slate-500 font-mono">€</span>
                  </div>
                  <button
                    type="button"
                    onClick={actualizarRemanente}
                    className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md"
                  >
                    Guardar Fondo
                  </button>
                </div>
              </div>

              <div className="p-6 rounded-3xl bg-[#0d0f17] border border-white/10 space-y-4 shadow-xl">
                <div className="flex items-center gap-2.5 text-amber-400 pb-3 border-b border-white/10">
                  <Users className="h-5 w-5" />
                  <h3 className="font-bold text-white text-base">Ranking de Ventas por Camarero (Hoy)</h3>
                </div>
                {rankingCamareros.length === 0 ? (
                  <p className="text-sm text-slate-500 py-4 text-center">Aún no hay ventas cobradas hoy por ningún empleado.</p>
                ) : (
                  <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                    {rankingCamareros.map((cam, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-white/5">
                        <div className="flex items-center gap-3">
                          <span className="font-black text-amber-500 text-lg">#{idx + 1}</span>
                          <span className="font-bold text-white uppercase">{cam.nombre}</span>
                        </div>
                        <span className="font-mono text-cyan-400 font-bold text-lg">{cam.total.toFixed(2)} €</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

          </div>
        )}

        {pestanaActiva === 'articulos' && (
          <div className="space-y-4 animate-fade-in">
            <div className="p-5 rounded-3xl bg-[#0d0f17] border border-white/10 space-y-4 shadow-xl">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-3 border-b border-white/10">
                <div className="flex items-center gap-2.5 text-sky-400">
                  <Package className="h-5 w-5" />
                  <h3 className="font-bold text-white text-base">Inventario Completo Loyverse</h3>
                </div>

                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Buscar artículo..."
                    value={filtroBusqueda}
                    onChange={(e) => setFiltroBusqueda(e.target.value)}
                    className="w-full bg-black/50 border border-white/15 rounded-xl pl-9 pr-4 py-2 text-xs text-white outline-none focus:border-sky-400"
                  />
                </div>
              </div>

              {loading ? (
                <div className="text-center py-20 text-slate-500 text-sm">Cargando catálogo...</div>
              ) : articulosFiltrados.length === 0 ? (
                <div className="text-center py-16 text-slate-500 text-xs">
                  No se encontraron artículos con ese filtro de búsqueda.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-[500px] overflow-y-auto pr-1">
                  {articulosFiltrados.map((art, idx) => (
                    <div key={idx} className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-1 shadow">
                      <div className="flex items-start justify-between gap-2">
                        <h5 className="font-bold text-white text-sm">{art.item_name || art.name}</h5>
                        <span className="font-mono text-amber-400 font-bold text-sm shrink-0">
                          {Number(art.price || 0).toFixed(2)} €
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">Categoría: <span className="text-sky-300">{art.category_name || 'General'}</span></p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {pestanaActiva === 'recibos' && (
          <div className="space-y-4 animate-fade-in">
            <div className="p-6 rounded-3xl bg-[#0d0f17] border border-white/10 space-y-4 shadow-xl">
              <div className="flex items-center gap-2.5 text-emerald-400 pb-3 border-b border-white/10">
                <Receipt className="h-5 w-5" />
                <h3 className="font-bold text-white text-base">Historial de Recibos y Transacciones</h3>
              </div>

              {loading ? (
                <div className="text-center py-20 text-slate-500 text-sm">Cargando recibos de venta...</div>
              ) : ventasRecientes.length === 0 ? (
                <div className="text-center py-16 text-slate-500 text-xs">
                  No hay recibos recientes registrados en la API de Loyverse para este periodo.
                </div>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                  {ventasRecientes.map((rec, idx) => (
                    <div key={idx} className="p-4 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-between text-xs">
                      <div className="space-y-1">
                        <span className="font-mono font-bold text-sky-400">Recibo #{rec.receipt_number || rec.id}</span>
                        <p className="text-slate-400 flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {new Date(rec.created_at || Date.now()).toLocaleString()}
                        </p>
                      </div>
                      <span className="font-mono text-emerald-400 font-black text-sm">
                        {Number(rec.total_money || rec.total || 0).toFixed(2)} €
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

      </main>

      <footer className="mt-12 border-t border-white/5 pt-4 text-center text-xs text-slate-500">
        NEXUS CORDOBA SL · Sincronización Loyverse & Control Financiero Avanzado
      </footer>
    </div>
  );
}