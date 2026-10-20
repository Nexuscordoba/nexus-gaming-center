import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { Plus, Minus, Send, MapPin, ReceiptText, CheckCircle2, ShoppingCart } from 'lucide-react';

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

export default function TableOrder() {
  const [mesaNum, setMesaNum] = useState<string>('1');
  const [productosCarta, setProductosCarta] = useState<Producto[]>([]);
  const [loadingCarta, setLoadingCarta] = useState(true);
  
  const [carritoActual, setCarritoActual] = useState<Array<Producto & { cantidad: number }>>([]);
  const [cuentaMesa, setCuentaMesa] = useState<ItemPedido[]>([]);
  
  const [enviando, setEnviando] = useState(false);
  const [enviandoCuenta, setEnviandoCuenta] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [categoriaActiva, setCategoriaActiva] = useState<'bebidas' | 'tapeo' | 'menus'>('bebidas');

  // Detectar número de mesa y recuperar historial previo
  useEffect(() => {
    const hash = window.location.hash;
    const match = hash.match(/mesa\/(\d+)/);
    let mNum = '1';
    if (match && match[1]) {
      mNum = match[1];
    } else {
      const params = new URLSearchParams(window.location.search);
      const m = params.get('mesa');
      if (m) mNum = m;
    }
    setMesaNum(mNum);

    const cuentaGuardada = localStorage.getItem(`nexus_mesa_${mNum}_cuenta`);
    if (cuentaGuardada) {
      try {
        setCuentaMesa(JSON.parse(cuentaGuardada));
      } catch (e) {
        console.error(e);
      }
    }

    cargarProductosCarta();
  }, []);

  // Guardar cuenta en localStorage
  useEffect(() => {
    if (mesaNum) {
      localStorage.setItem(`nexus_mesa_${mesaNum}_cuenta`, JSON.stringify(cuentaMesa));
    }
  }, [cuentaMesa, mesaNum]);

  // Suscripción en tiempo real: si el camarero marca la cuenta como atendida/cobrada en barra, limpiar mesa automáticamente
  useEffect(() => {
    if (!mesaNum) return;

    const channel = supabase
      .channel(`mesa-limpieza-${mesaNum}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'comandas_cocina' },
        (payload: any) => {
          const comandaModificada = payload.new;
          if (
            comandaModificada && 
            comandaModificada.tipo_destino === 'cuenta' && 
            comandaModificada.mesa === `MESA ${mesaNum}` && 
            comandaModificada.estado === 'servido'
          ) {
            setCuentaMesa([]);
            setCarritoActual([]);
            localStorage.removeItem(`nexus_mesa_${mesaNum}_cuenta`);
            setMensaje('¡Cuenta cobrada con éxito! Gracias por vuestra visita.');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [mesaNum]);

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

  const totalCarritoActual = carritoActual.reduce((acc, item) => acc + (Number(item.precio) * item.cantidad), 0);
  const totalCuentaAcumulada = cuentaMesa.reduce((acc, item) => acc + (Number(item.precio) * item.cantidad), 0);

  const enviarPedido = async () => {
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
            mesa: `MESA ${mesaNum}`,
            tipo_destino: 'cocina',
            items: itemsCocina.map(i => ({ nombre: i.nombre, cantidad: i.cantidad, variante: '', comentarios: '', es_menu: i.categoria === 'menus' }))
          }])
        );
      }

      if (itemsBarra.length > 0) {
        promesas.push(
          supabase.from('comandas_cocina').insert([{
            ticket_number: ticketNum,
            mesa: `MESA ${mesaNum}`,
            tipo_destino: 'barra',
            items: itemsBarra.map(i => ({ nombre: i.nombre, cantidad: i.cantidad, variante: '', comentarios: '' }))
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
      setCarritoActual([]);
      setMensaje('¡Pedido enviado a cocina y barra correctamente!');
    } catch (err: any) {
      setMensaje('Error al enviar el pedido: ' + err.message);
    } finally {
      setEnviando(false);
    }
  };

  const pedirCuenta = async () => {
    if (totalCuentaAcumulada === 0) return;
    setEnviandoCuenta(true);
    try {
      const ticketNum = Math.floor(1000 + Math.random() * 9000).toString();
      await supabase.from('comandas_cocina').insert([{
        ticket_number: ticketNum,
        mesa: `MESA ${mesaNum}`,
        tipo_destino: 'cuenta',
        estado: 'pendiente',
        items: [{ nombre: '¡EL CLIENTE PIDE LA CUENTA!', cantidad: 1, variante: '', comentarios: `Total cuenta: ${totalCuentaAcumulada.toFixed(2)} €` }]
      }]);

      setMensaje('¡Cuenta solicitada! Un camarero se acercará con el ticket.');
    } catch (err: any) {
      setMensaje('Error al solicitar la cuenta: ' + err.message);
    } finally {
      setEnviandoCuenta(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#06070a] text-slate-100 flex flex-col justify-between selection:bg-cyan-500 selection:text-black">
      <header className="border-b border-white/10 bg-[#08090d]/90 backdrop-blur px-5 py-4 sticky top-0 z-40 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center font-black">
            M{mesaNum}
          </div>
          <div>
            <h1 className="font-bold text-white text-base">NEXUS MESA DIGITAL</h1>
            <p className="text-[11px] text-slate-400 flex items-center gap-1">
              <MapPin className="h-3 w-3 text-cyan-400" /> Mesa {mesaNum} · Chinales 45
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={pedirCuenta}
          disabled={enviandoCuenta || totalCuentaAcumulada === 0}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-white font-bold text-xs shadow-lg transition-all ${
            totalCuentaAcumulada === 0 
              ? 'bg-slate-700 opacity-50 cursor-not-allowed' 
              : 'bg-gradient-to-r from-rose-600 to-orange-600 active:scale-95 cursor-pointer'
          }`}
        >
          <ReceiptText className="h-4 w-4" />
          <span>{enviandoCuenta ? 'Avisando...' : 'Pedir Cuenta'}</span>
        </button>
      </header>

      <main className={`max-w-3xl w-full mx-auto p-4 space-y-6 ${carritoActual.length > 0 ? 'pb-72' : 'pb-24'}`}>
        {cuentaMesa.length > 0 && (
          <div className="p-4 rounded-3xl bg-[#0d0f17] border border-cyan-500/30 space-y-3 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-white/10 text-cyan-400 font-bold text-xs uppercase tracking-wider">
              <span className="flex items-center gap-1.5"><ShoppingCart className="h-4 w-4" /> Cuenta Acumulada de Mesa</span>
              <span className="font-mono text-sm">{totalCuentaAcumulada.toFixed(2)} €</span>
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {cuentaMesa.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs bg-black/40 px-3 py-2 rounded-xl border border-white/5">
                  <span className="text-white font-medium">
                    <span className="text-cyan-400 font-mono font-bold mr-2">{item.cantidad}x</span>
                    {item.nombre}
                  </span>
                  <span className="font-mono text-slate-300">{(item.precio * item.cantidad).toFixed(2)} €</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            onClick={() => setCategoriaActiva('bebidas')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
              categoriaActiva === 'bebidas' ? 'bg-cyan-500 text-slate-950 shadow-md' : 'bg-white/5 text-slate-400'
            }`}
          >
            ☕ Cafetería
          </button>
          <button
            onClick={() => setCategoriaActiva('tapeo')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
              categoriaActiva === 'tapeo' ? 'bg-cyan-500 text-slate-950 shadow-md' : 'bg-white/5 text-slate-400'
            }`}
          >
            🍳 Cocina / Tapas
          </button>
          <button
            onClick={() => setCategoriaActiva('menus')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
              categoriaActiva === 'menus' ? 'bg-cyan-500 text-slate-950 shadow-md' : 'bg-white/5 text-slate-400'
            }`}
          >
            🍽️ Menú del Día
          </button>
        </div>

        {loadingCarta ? (
          <div className="text-center py-20 text-slate-500 text-sm">Cargando carta...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {productosCarta
              .filter(p => p.categoria === categoriaActiva)
              .map((prod) => (
                <div key={prod.id} className="p-4 rounded-2xl bg-[#0d0f17] border border-white/10 flex items-center justify-between gap-3 shadow-md">
                  <div>
                    <h4 className="font-bold text-white text-sm">{prod.nombre}</h4>
                    <span className="font-mono text-cyan-400 font-bold text-xs mt-1 block">{Number(prod.precio).toFixed(2)} €</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => agregarAlCarrito(prod)}
                    className="h-10 w-10 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 flex items-center justify-center shrink-0 active:scale-95 transition-transform cursor-pointer shadow-md"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                </div>
              ))}
          </div>
        )}

        {mensaje && (
          <div className="p-4 rounded-2xl bg-cyan-950/40 border border-cyan-500/40 text-cyan-300 text-xs text-center font-semibold flex items-center justify-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{mensaje}</span>
          </div>
        )}
      </main>

      {carritoActual.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-[#0c0e17]/95 backdrop-blur-md border-t border-cyan-500/40 p-4 shadow-2xl z-50 animate-slide-up">
          <div className="max-w-3xl mx-auto space-y-3">
            <div className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center justify-between">
              <span>Nuevos artículos a pedir:</span>
              <span className="font-mono">{totalCarritoActual.toFixed(2)} €</span>
            </div>

            <div className="max-h-36 overflow-y-auto space-y-2 pr-1">
              {carritoActual.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-xs bg-black/40 p-2.5 rounded-xl border border-white/5">
                  <span className="font-bold text-white truncate max-w-[180px]">{item.nombre}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-cyan-400 font-bold">{(Number(item.precio) * item.cantidad).toFixed(2)} €</span>
                    <div className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-lg">
                      <button onClick={() => cambiarCantidadCarrito(item.id, -1)} className="text-slate-400 hover:text-white"><Minus className="h-3 w-3" /></button>
                      <span className="font-mono font-bold text-white w-4 text-center">{item.cantidad}</span>
                      <button onClick={() => cambiarCantidadCarrito(item.id, 1)} className="text-slate-400 hover:text-white"><Plus className="h-3 w-3" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Total a Enviar</span>
                <span className="text-xl font-black text-cyan-300 font-mono">{totalCarritoActual.toFixed(2)} €</span>
              </div>
              <button
                type="button"
                disabled={enviando}
                onClick={enviarPedido}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-lg active:scale-95 transition-all disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {enviando ? 'Enviando...' : 'Enviar Pedido'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}