import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { Utensils, Plus, Minus, Send, Printer, ArrowLeft, MapPin, CheckCircle2 } from 'lucide-react';

interface Producto {
  id: number;
  nombre: string;
  precio: number;
  categoria: 'bebidas' | 'tapeo' | 'menus';
  destino: 'cocina' | 'barra';
}

interface ItemPedido {
  id: number;
  nombre: string;
  precio: number;
  cantidad: number;
  destino: 'cocina' | 'barra';
}

interface TableWaiterProps {
  onBack: () => void;
}

export default function TableWaiter({ onBack }: TableWaiterProps) {
  const [mesaSeleccionada, setMesaSeleccionada] = useState<string>('1');
  const [productosCarta, setProductosCarta] = useState<Producto[]>([]);
  const [loadingCarta, setLoadingCarta] = useState(true);
  
  const [carritoActual, setCarritoActual] = useState<Array<Producto & { cantidad: number }>>([]);
  const [cuentaMesa, setCuentaMesa] = useState<ItemPedido[]>([]);
  
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [categoriaActiva, setCategoriaActiva] = useState<'bebidas' | 'tapeo' | 'menus'>('bebidas');

  useEffect(() => {
    cargarProductosCarta();
    cargarCuentaMesa(mesaSeleccionada);
  }, [mesaSeleccionada]);

  const cargarProductosCarta = async () => {
    setLoadingCarta(true);
    const { data } = await supabase
      .from('productos_carta')
      .select('*')
      .eq('activo', true)
      .order('id', { ascending: true });

    if (data) {
      setProductosCarta(data as Producto[]);
    }
    setLoadingCarta(false);
  };

  const cargarCuentaMesa = async (mNum: string) => {
    const cuentaGuardada = localStorage.getItem(`nexus_mesa_${mNum}_cuenta`);
    if (cuentaGuardada) {
      try {
        setCuentaMesa(JSON.parse(cuentaGuardada));
      } catch (e) {
        setCuentaMesa([]);
      }
    } else {
      setCuentaMesa([]);
    }
    setCarritoActual([]);
    setMensaje(null);
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

  const totalCuentaAcumulada = cuentaMesa.reduce((acc, item) => acc + (Number(item.precio) * item.cantidad), 0);

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
            items: itemsCocina.map(i => ({ nombre: i.nombre, cantidad: i.cantidad, variante: '', comentarios: 'Anotado por camarero', es_menu: i.categoria === 'menus' }))
          }])
        );
      }

      if (itemsBarra.length > 0) {
        promesas.push(
          supabase.from('comandas_cocina').insert([{
            ticket_number: ticketNum,
            mesa: `MESA ${mesaSeleccionada}`,
            tipo_destino: 'barra',
            items: itemsBarra.map(i => ({ nombre: i.nombre, cantidad: i.cantidad, variante: '', comentarios: 'Anotado por camarero' }))
          }])
        );
      }

      await Promise.all(promesas);

      const nuevoHistorial = [...cuentaMesa];
      carritoActual.forEach(nuevoItem => {
        const indexExistente = nuevoHistorial.findIndex(item => item.id === nuevoItem.id);
        if (indexExistente >= 0) {
          nuevoHistorial[indexExistente].cantidad += nuevoItem.cantidad;
        } else {
          nuevoHistorial.push({
            id: nuevoItem.id,
            nombre: nuevoItem.nombre,
            precio: Number(nuevoItem.precio),
            cantidad: nuevoItem.cantidad,
            destino: nuevoItem.destino
          });
        }
      });

      setCuentaMesa(nuevoHistorial);
      localStorage.setItem(`nexus_mesa_${mesaSeleccionada}_cuenta`, JSON.stringify(nuevoHistorial));
      
      setCarritoActual([]);
      setMensaje(`¡Pedido enviado a KDS para la Mesa ${mesaSeleccionada}!`);
    } catch (err: any) {
      setMensaje('Error al enviar pedido: ' + err.message);
    } finally {
      setEnviando(false);
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
              <h1 className="text-lg sm:text-xl font-black tracking-wide text-white">NEXUS · TOMA DE NOTA MESA</h1>
              <p className="text-xs text-slate-400">Chinales 45 · Portal interno de camareros</p>
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
          <div className="flex items-center gap-2 bg-white/5 px-3.5 py-2 rounded-xl border border-white/10">
            <MapPin className="h-4 w-4 text-amber-400" />
            <span className="text-xs font-bold uppercase text-slate-300">Seleccionar Mesa:</span>
            <select
              value={mesaSeleccionada}
              onChange={(e) => setMesaSeleccionada(e.target.value)}
              className="bg-black/60 border border-amber-500/40 rounded-lg px-2.5 py-1 text-sm font-black text-amber-400 outline-none cursor-pointer"
            >
              {Array.from({ length: 20 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>Mesa {m}</option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={imprimirTicket}
            disabled={cuentaMesa.length === 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs shadow-lg transition-all ${
              cuentaMesa.length === 0 
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                : 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer'
            }`}
          >
            <Printer className="h-4 w-4" />
            <span>Imprimir Ticket</span>
          </button>

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

      <main className="flex-1 max-w-5xl w-full mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 pb-24 print:block">
        
        <div className="md:col-span-2 space-y-4 print:hidden">
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
            <div className="flex items-center justify-between pb-3 border-b border-white/10 print:border-black">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 print:text-slate-600 block">Comanda Activa</span>
                <h3 className="text-lg font-black text-white print:text-black">MESA {mesaSeleccionada}</h3>
              </div>
              <span className="font-mono font-bold text-amber-400 print:text-black text-base">
                {totalCuentaAcumulada.toFixed(2)} €
              </span>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-400 print:text-slate-700 block">Artículos en cuenta:</span>
              {cuentaMesa.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-3 text-center">La mesa está vacía actualmente.</p>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {cuentaMesa.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs bg-black/40 print:bg-slate-100 px-3 py-2 rounded-xl border border-white/5 print:border-slate-300">
                      <span className="text-white print:text-black font-medium">
                        <span className="text-amber-400 print:text-black font-mono font-bold mr-2">{item.cantidad}x</span>
                        {item.nombre}
                      </span>
                      <span className="font-mono text-slate-300 print:text-black">{(item.precio * item.cantidad).toFixed(2)} €</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {carritoActual.length > 0 && (
              <div className="pt-3 border-t border-white/10 print:hidden space-y-3">
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
              <div className="p-3 rounded-2xl bg-cyan-950/40 border border-cyan-500/40 text-cyan-300 text-xs text-center font-semibold print:hidden flex items-center justify-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{mensaje}</span>
              </div>
            )}
          </div>
        </div>

      </main>

      <footer className="mt-8 border-t border-white/5 pt-4 text-center text-xs text-slate-500 print:hidden">
        NEXUS CORDOBA SL · Portal Interno de Toma de Notas
      </footer>
    </div>
  );
}