import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { Utensils, Plus, Minus, Send, Printer, ArrowLeft, MapPin, CheckCircle2, DollarSign, CreditCard } from 'lucide-react';

interface Producto {
  id: number;
  nombre: string;
  precio: number;
  categoria: 'bebidas' | 'tapeo' | 'menus';
  destino: 'cocina' | 'barra';
}

interface ItemPedido {
  nombre: string;
  precio: number;
  cantidad: number;
  destino: string;
}

interface MesaAbierta {
  id: string;
  mesa: string;
  ticket_number: string;
  items: ItemPedido[];
  total_ticket: number;
  created_at: string;
}

interface TableWaiterProps {
  onBack: () => void;
}

export default function TableWaiter({ onBack }: TableWaiterProps) {
  const [mesaSeleccionada, setMesaSeleccionada] = useState<string>('1');
  const [productosCarta, setProductosCarta] = useState<Producto[]>([]);
  const [loadingCarta, setLoadingCarta] = useState(true);
  
  const [carritoActual, setCarritoActual] = useState<Array<Producto & { cantidad: number }>>([]);
  const [mesasAbiertas, setMesasAbiertas] = useState<MesaAbierta[]>([]);
  const [cuentaMesaActual, setCuentaMesaActual] = useState<ItemPedido[]>([]);
  
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [categoriaActiva, setCategoriaActiva] = useState<'bebidas' | 'tapeo' | 'menus'>('bebidas');
  const [vistaSeccion, setVistaSeccion] = useState<'tomar_nota' | 'mesas_abiertas'>('tomar_nota');

  useEffect(() => {
    cargarProductosCarta();
    cargarMesasAbiertas();
  }, []);

  useEffect(() => {
    const encontrada = mesasAbiertas.find(m => m.mesa === `MESA ${mesaSeleccionada}`);
    if (encontrada && encontrada.items) {
      setCuentaMesaActual(encontrada.items);
    } else {
      setCuentaMesaActual([]);
    }
    setCarritoActual([]);
    setMensaje(null);
  }, [mesaSeleccionada, mesasAbiertas]);

  const cargarProductosCarta = async () => {
    setLoadingCarta(true);
    const { data } = await supabase
      .from('productos_carta')
      .select('*')
      .eq('activo', true)
      .order('id', { ascending: true });

    if (data) setProductosCarta(data as Producto[]);
    setLoadingCarta(false);
  };

  const cargarMesasAbiertas = async () => {
    const { data } = await supabase
      .from('comandas_cocina')
      .select('*')
      .neq('tipo_destino', 'cuenta')
      .neq('estado', 'servido')
      .order('created_at', { ascending: true });

    if (data) {
      const mapMesas: Record<string, MesaAbierta> = {};
      data.forEach((row: any) => {
        const mKey = row.mesa;
        if (!mapMesas[mKey]) {
          mapMesas[mKey] = {
            id: row.id,
            mesa: mKey,
            ticket_number: row.ticket_number,
            items: [],
            total_ticket: 0,
            created_at: row.created_at
          };
        }
        if (row.items && Array.isArray(row.items)) {
          row.items.forEach((it: any) => {
            mapMesas[mKey].items.push({
              nombre: it.nombre,
              precio: it.precio || 0,
              cantidad: it.cantidad || 1,
              destino: row.tipo_destino
            });
          });
        }
      });

      const listado: MesaAbierta[] = Object.values(mapMesas).map(m => {
        const total = m.items.reduce((acc, i) => acc + (i.precio * i.cantidad), 0);
        return { ...m, total_ticket: total };
      });

      setMesasAbiertas(listado);
    }
  };

  const agregarAlCarrito = (prod: Producto) => {
    setCarritoActual(prev => {
      const existe = prev.find(p => p.id === prod.id);
      if (existe) {
        return prev.map(p => p.id === prod.id ? { ...p, cantidad: p.cantidad + 1 } : p);
      }
      return [...prev, { ...prod, cantidad: 1 }];
    });
    setMensaje(null);
  };

  const cambiarCantidadCarrito = (id: number, delta: number) => {
    setCarritoActual(prev => {
      return prev.map(p => {
        if (p.id === id) {
          const nuevaCant = p.cantidad + delta;
          return nuevaCant > 0 ? { ...p, cantidad: nuevaCant } : null;
        }
        return p;
      }).filter(Boolean) as any;
    });
  };

  const totalCuentaMesa = cuentaMesaActual.reduce((acc, item) => acc + (Number(item.precio) * item.cantidad), 0) + carritoActual.reduce((acc, item) => acc + (Number(item.precio) * item.cantidad), 0);

  const enviarPedidoCamarero = async () => {
    if (carritoActual.length === 0) return;
    setEnviando(true);
    setMensaje(null);

    try {
      const itemsCocina = carritoActual.filter(i => i.destino === 'cocina');
      const itemsBarra = carritoActual.filter(i => i.destino === 'barra');
      const ticketNum = Math.floor(1000 + Math.random() * 9000).toString();

      const promesas = [];

      if (itemsCocina.length > 0) {
        promesas.push(
          supabase.from('comandas_cocina').insert([{
            ticket_number: ticketNum,
            mesa: `MESA ${mesaSeleccionada}`,
            tipo_destino: 'cocina',
            items: itemsCocina.map(i => ({ nombre: i.nombre, precio: i.precio, cantidad: i.cantidad, comentarios: 'Anotado por camarero', es_menu: i.categoria === 'menus' }))
          }])
        );
      }

      if (itemsBarra.length > 0) {
        promesas.push(
          supabase.from('comandas_cocina').insert([{
            ticket_number: ticketNum,
            mesa: `MESA ${mesaSeleccionada}`,
            tipo_destino: 'barra',
            items: itemsBarra.map(i => ({ nombre: i.nombre, precio: i.precio, cantidad: i.cantidad, comentarios: 'Anotado por camarero' }))
          }])
        );
      }

      await Promise.all(promesas);
      setCarritoActual([]);
      setMensaje(`¡Pedido enviado a KDS para la Mesa ${mesaSeleccionada}!`);
      cargarMesasAbiertas();
    } catch (err: any) {
      setMensaje('Error al enviar pedido: ' + err.message);
    } finally {
      setEnviando(false);
    }
  };

  const cobrarMesa = async (mesaNombre: string, metodo: 'efectivo' | 'tarjeta') => {
    const mesaObj = mesasAbiertas.find(m => m.mesa === mesaNombre);
    if (!mesaObj) return;

    try {
      await supabase
        .from('comandas_cocina')
        .update({ estado: 'servido', metodo_pago: metodo })
        .eq('mesa', mesaNombre)
        .neq('estado', 'servido');

      const fechaHoy = new Date().toISOString().split('T')[0];
      const { data: cajaData } = await supabase
        .from('caja_diaria')
        .select('*')
        .eq('fecha', fechaHoy)
        .single();

      if (cajaData) {
        const nuevoEfectivo = Number(cajaData.total_efectivo) + (metodo === 'efectivo' ? mesaObj.total_ticket : 0);
        const nuevaTarjeta = Number(cajaData.total_tarjeta) + (metodo === 'tarjeta' ? mesaObj.total_ticket : 0);
        await supabase
          .from('caja_diaria')
          .update({ total_efectivo: nuevoEfectivo, total_tarjeta: nuevaTarjeta })
          .eq('id', cajaData.id);
      } else {
        await supabase.from('caja_diaria').insert([{
          fecha: fechaHoy,
          total_efectivo: metodo === 'efectivo' ? mesaObj.total_ticket : 0,
          total_tarjeta: metodo === 'tarjeta' ? mesaObj.total_ticket : 0,
          estado: 'abierta'
        }]);
      }

      const mNumNum = mesaNombre.replace('MESA ', '');
      localStorage.removeItem(`nexus_mesa_${mNumNum}_cuenta`);

      alert(`¡Mesa ${mesaNombre} cobrada correctamente con ${metodo.toUpperCase()} (${mesaObj.total_ticket.toFixed(2)} €)!`);
      cargarMesasAbiertas();
    } catch (err: any) {
      alert('Error al cobrar la mesa: ' + err.message);
    }
  };

  const imprimirTicket = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-[#050609] text-slate-100 p-4 sm:p-6 flex flex-col justify-between selection:bg-cyan-500 selection:text-black">
      
      <header className="border-b border-white/10 pb-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 sticky top-0 bg-[#050609]/90 backdrop-blur-md z-30 print:hidden">
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
              <Utensils className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-black tracking-wide text-white">NEXUS · PORTAL DE CAMAREROS</h1>
              <p className="text-xs text-slate-400">Chinales 45 · Toma de notas y cobro en sala</p>
            </div>
          </div>
          
          <button
            type="button"
            onClick={onBack}
            className="sm:hidden flex items-center gap-1 px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 text-xs text-slate-300"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Volver</span>
          </button>
        </div>

        <div className="flex items-center gap-3 flex-wrap justify-center">
          <div className="flex gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
            <button
              onClick={() => setVistaSeccion('tomar_nota')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                vistaSeccion === 'tomar_nota' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              📝 Tomar Nota
            </button>
            <button
              onClick={() => setVistaSeccion('mesas_abiertas')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer relative ${
                vistaSeccion === 'mesas_abiertas' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              📋 Mesas Abiertas ({mesasAbiertas.length})
            </button>
          </div>

          <button
            type="button"
            onClick={onBack}
            className="hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs text-slate-300 hover:text-white transition-all cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Volver</span>
          </button>
        </div>
      </header>

      {vistaSeccion === 'tomar_nota' ? (
        <main className="flex-1 max-w-5xl w-full mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 pb-24 print:block">
          
          <div className="md:col-span-2 space-y-4 print:hidden">
            <div className="flex items-center justify-between bg-[#0d0f17] p-4 rounded-2xl border border-white/10">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-amber-400" />
                <span className="text-xs font-bold uppercase text-slate-300">Mesa Activa:</span>
                <select
                  value={mesaSeleccionada}
                  onChange={(e) => setMesaSeleccionada(e.target.value)}
                  className="bg-black/80 border border-amber-500/50 rounded-xl px-3 py-1.5 text-sm font-black text-amber-400 outline-none cursor-pointer"
                >
                  {Array.from({ length: 20 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>Mesa {m}</option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={imprimirTicket}
                disabled={cuentaMesaActual.length === 0 && carritoActual.length === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg transition-all cursor-pointer disabled:opacity-50"
              >
                <Printer className="h-4 w-4" />
                <span>Imprimir Factura Simplificada</span>
              </button>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
              <button
                onClick={() => setCategoriaActiva('bebidas')}
                className={`px-4 py-2 rounded-2xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
                  categoriaActiva === 'bebidas' ? 'bg-amber-500 text-slate-950 shadow-md font-black' : 'bg-white/5 text-slate-400'
                }`}
              >
                ☕ Cafetería
              </button>
              <button
                onClick={() => setCategoriaActiva('tapeo')}
                className={`px-4 py-2 rounded-2xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
                  categoriaActiva === 'tapeo' ? 'bg-amber-500 text-slate-950 shadow-md font-black' : 'bg-white/5 text-slate-400'
                }`}
              >
                🍳 Cocina / Tapas
              </button>
              <button
                onClick={() => setCategoriaActiva('menus')}
                className={`px-4 py-2 rounded-2xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
                  categoriaActiva === 'menus' ? 'bg-amber-500 text-slate-950 shadow-md font-black' : 'bg-white/5 text-slate-400'
                }`}
              >
                🍽️ Menú del Día
              </button>
            </div>

            {loadingCarta ? (
              <div className="text-center py-20 text-slate-500 text-sm">Cargando artículos...</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {productosCarta
                  .filter(p => p.categoria === categoriaActiva)
                  .map((prod) => (
                    <div key={prod.id} className="p-3.5 rounded-2xl bg-[#0d0f17] border border-white/10 flex items-center justify-between gap-3 shadow-md">
                      <div>
                        <h4 className="font-bold text-white text-sm">{prod.nombre}</h4>
                        <span className="font-mono text-amber-400 font-bold text-xs mt-0.5 block">{Number(prod.precio).toFixed(2)} €</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => agregarAlCarrito(prod)}
                        className="h-9 w-9 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center shrink-0 active:scale-95 transition-transform cursor-pointer shadow-md font-bold"
                      >
                        <Plus className="h-5 w-5" />
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>

          <div className="space-y-4 print:w-full">
            <div className="p-5 rounded-3xl bg-[#0d0f17] border border-white/10 space-y-4 shadow-xl print:border-none print:bg-white print:text-black">
              
              <div className="hidden print:block space-y-3 text-black text-xs font-mono">
                <div className="text-center space-y-1 pb-3 border-b border-black">
                  <h2 className="font-black text-sm">NEXUS CORDOBA SL</h2>
                  <p>NIF: B93887990</p>
                  <p>Avda. Principal de Chinales 45</p>
                  <p>14007 Córdoba, España</p>
                </div>
                <div className="flex justify-between py-1 border-b border-dashed border-black">
                  <span>MESA: {mesaSeleccionada}</span>
                  <span>{new Date().toLocaleString()}</span>
                </div>
                <div className="space-y-1 py-2 border-b border-black">
                  <div className="flex font-bold">
                    <span className="w-8">CANT</span>
                    <span className="flex-1">DESCRIPCIÓN</span>
                    <span className="w-16 text-right">TOTAL</span>
                  </div>
                  {cuentaMesaActual.concat(carritoActual.map(c => ({ nombre: c.nombre, precio: Number(c.precio), cantidad: c.cantidad, destino: c.destino }))).map((it, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span className="w-8">{it.cantidad}x</span>
                      <span className="flex-1 truncate">{it.nombre}</span>
                      <span className="w-16 text-right">{(it.precio * it.cantidad).toFixed(2)} €</span>
                    </div>
                  ))}
                </div>
                <div className="space-y-1 pt-2 text-right font-bold text-sm">
                  <p>TOTAL A PAGAR: {totalCuentaMesa.toFixed(2)} €</p>
                  <p className="text-[10px] font-normal">(IVA incluido)</p>
                </div>
                <div className="text-center pt-6 text-[10px] space-y-1">
                  <p>¡Gracias por su visita!</p>
                  <p>Ticket de venta simplificado</p>
                </div>
              </div>

              <div className="print:hidden">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Resumen Mesa</span>
                    <h3 className="text-lg font-black text-white">MESA {mesaSeleccionada}</h3>
                  </div>
                  <span className="font-mono font-bold text-amber-400 text-base">
                    {totalCuentaMesa.toFixed(2)} €
                  </span>
                </div>

                <div className="space-y-2 mt-3">
                  <span className="text-xs font-bold text-slate-400 block">Artículos ya pedidos / en cuenta:</span>
                  {cuentaMesaActual.length === 0 ? (
                    <p className="text-xs text-slate-500 italic py-3 text-center">No hay consumos previos registrados.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {cuentaMesaActual.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs bg-black/40 px-3 py-2 rounded-xl border border-white/5">
                          <span className="text-white font-medium">
                            <span className="text-amber-400 font-mono font-bold mr-2">{item.cantidad}x</span>
                            {item.nombre}
                          </span>
                          <span className="font-mono text-slate-300">{(item.precio * item.cantidad).toFixed(2)} €</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {carritoActual.length > 0 && (
                  <div className="pt-4 mt-4 border-t border-white/10 space-y-3">
                    <span className="text-xs font-bold text-cyan-400 block">Nuevos a enviar a KDS:</span>
                    <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                      {carritoActual.map((item) => (
                        <div key={item.id} className="flex items-center justify-between text-xs bg-cyan-950/20 p-2.5 rounded-xl border border-cyan-500/20">
                          <span className="font-bold text-white truncate max-w-[140px]">{item.nombre}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-cyan-400 font-bold">{(Number(item.precio) * item.cantidad).toFixed(2)} €</span>
                            <div className="flex items-center gap-1 bg-white/5 px-1.5 py-0.5 rounded-lg">
                              <button onClick={() => cambiarCantidadCarrito(item.id, -1)} className="text-slate-400 hover:text-white"><Minus className="h-3 w-3" /></button>
                              <span className="font-mono font-bold text-white w-3 text-center">{item.cantidad}</span>
                              <button onClick={() => cambiarCantidadCarrito(item.id, 1)} className="text-slate-400 hover:text-white"><Plus className="h-3 w-3" /></button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      disabled={enviando}
                      onClick={enviarPedidoCamarero}
                      className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-emerald-500 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-95 transition-all disabled:opacity-50"
                    >
                      <Send className="h-4 w-4" />
                      {enviando ? 'Enviando a KDS...' : 'Enviar a Cocina / Barra'}
                    </button>
                  </div>
                )}

                {mensaje && (
                  <div className="p-3 mt-3 rounded-2xl bg-cyan-950/40 border border-cyan-500/40 text-cyan-300 text-xs text-center font-semibold flex items-center justify-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>{mensaje}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

        </main>
      ) : (
        <main className="flex-1 max-w-4xl w-full mx-auto space-y-6 pb-24">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>📋 Mesas Activas con Cuenta Pendiente</span>
          </h2>

          {mesasAbiertas.length === 0 ? (
            <div className="text-center py-20 text-slate-500 space-y-2">
              <p className="text-base font-semibold">No hay mesas abiertas en este momento.</p>
              <p className="text-xs">Todas las cuentas están cobradas y cerradas.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {mesasAbiertas.map((m) => (
                <div key={m.id} className="p-5 rounded-3xl bg-[#0d0f17] border border-white/10 space-y-4 shadow-xl flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-white/10">
                      <span className="font-black text-sm px-3 py-1 rounded-xl bg-amber-500 text-slate-950 uppercase shadow">
                        {m.mesa}
                      </span>
                      <span className="font-mono text-lg font-black text-amber-400">
                        {m.total_ticket.toFixed(2)} €
                      </span>
                    </div>

                    <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                      {m.items.map((it, iIdx) => (
                        <div key={iIdx} className="flex justify-between text-xs bg-black/40 px-2.5 py-1.5 rounded-lg">
                          <span className="text-slate-200">
                            <span className="text-amber-400 font-mono font-bold mr-1.5">{it.cantidad}x</span>
                            {it.nombre}
                          </span>
                          <span className="font-mono text-slate-400">{(it.precio * it.cantidad).toFixed(2)} €</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 pt-3 border-t border-white/10">
                    <p className="text-[10px] text-slate-400 uppercase font-bold text-center">Cobrar e identificar método de pago:</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => cobrarMesa(m.mesa, 'efectivo')}
                        className="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-xs uppercase flex items-center justify-center gap-1.5 cursor-pointer shadow"
                      >
                        <DollarSign className="h-4 w-4" /> Efectivo
                      </button>
                      <button
                        onClick={() => cobrarMesa(m.mesa, 'tarjeta')}
                        className="py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs uppercase flex items-center justify-center gap-1.5 cursor-pointer shadow"
                      >
                        <CreditCard className="h-4 w-4" /> Tarjeta
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      )}

      <footer className="mt-8 border-t border-white/5 pt-4 text-center text-xs text-slate-500 print:hidden">
        NEXUS CORDOBA SL · Módulo de Sala y Caja
      </footer>
    </div>
  );
}