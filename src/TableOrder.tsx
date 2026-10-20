import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { Plus, Minus, Send, MapPin, ReceiptText } from 'lucide-react';

interface Producto {
  nombre: string;
  precio: number;
  categoria: 'desayunos' | 'tapeo' | 'bebidas' | 'menus';
  destino: 'cocina' | 'barra';
}

export default function TableOrder() {
  const [mesaNum, setMesaNum] = useState<string>('1');
  const [carrito, setCarrito] = useState<Array<Producto & { cantidad: number }>>([]);
  const [enviando, setEnviando] = useState(false);
  const [enviandoCuenta, setEnviandoCuenta] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [categoriaActiva, setCategoriaActiva] = useState<'desayunos' | 'tapeo' | 'bebidas' | 'menus'>('desayunos');

  useEffect(() => {
    const hash = window.location.hash;
    const match = hash.match(/mesa\/(\d+)/);
    if (match && match[1]) {
      setMesaNum(match[1]);
    } else {
      const params = new URLSearchParams(window.location.search);
      const m = params.get('mesa');
      if (m) setMesaNum(m);
    }
  }, []);

  const productosCarta: Producto[] = [
    { nombre: 'Café de Especialidad + Mollete Ibérico', precio: 3.50, categoria: 'desayunos', destino: 'barra' },
    { nombre: 'Desayuno Nexus Power (Tostada Aguacate + Zumo)', precio: 4.80, categoria: 'desayunos', destino: 'barra' },
    { nombre: 'Mollete Tradicional con Zurrapa o Pringá', precio: 2.90, categoria: 'desayunos', destino: 'barra' },
    { nombre: 'Croissant Francés de Mantequilla', precio: 2.40, categoria: 'desayunos', destino: 'barra' },

    { nombre: 'Nachos Supreme con Queso y Guacamole', precio: 7.50, categoria: 'tapeo', destino: 'cocina' },
    { nombre: 'Burger Smash Doble Bacon', precio: 8.90, categoria: 'tapeo', destino: 'cocina' },
    { nombre: 'Perrito Caliente Especial Chinales', precio: 5.20, categoria: 'tapeo', destino: 'cocina' },
    { nombre: 'Fingers de Pollo Crujiente (6 uds)', precio: 6.20, categoria: 'tapeo', destino: 'cocina' },

    { nombre: 'Refresco de Importación (Dr Pepper / Mountain Dew)', precio: 2.50, categoria: 'bebidas', destino: 'barra' },
    { nombre: 'Monster Energy / Red Bull', precio: 2.80, categoria: 'bebidas', destino: 'barra' },
    { nombre: 'Tercio Cerveza Alhambra Reserva 1925', precio: 2.60, categoria: 'bebidas', destino: 'barra' },
    { nombre: 'Kombucha Orgánica & Tés Fríos', precio: 2.80, categoria: 'bebidas', destino: 'barra' },

    { nombre: 'Menú del Día Casero (1º, 2º, Pan y Bebida)', precio: 11.50, categoria: 'menus', destino: 'cocina' },
  ];

  const agregarAlCarrito = (prod: Producto) => {
    setCarrito(prev => {
      const existe = prev.find(p => p.nombre === prod.nombre);
      if (existe) {
        return prev.map(p => p.nombre === prod.nombre ? { ...p, cantidad: p.cantidad + 1 } : p);
      }
      return [...prev, { ...prod, cantidad: 1 }];
    });
    setMensaje(null);
  };

  const cambiarCantidad = (nombre: string, delta: number) => {
    setCarrito(prev => {
      return prev.map(p => {
        if (p.nombre === nombre) {
          const nuevaCant = p.cantidad + delta;
          return nuevaCant > 0 ? { ...p, cantidad: nuevaCant } : null;
        }
        return p;
      }).filter(Boolean) as any;
    });
  };

  const totalCarrito = carrito.reduce((acc, item) => acc + (item.precio * item.cantidad), 0);

  const enviarPedido = async () => {
    if (carrito.length === 0) return;
    setEnviando(true);
    setMensaje(null);

    try {
      const itemsCocina = carrito.filter(i => i.destino === 'cocina');
      const itemsBarra = carrito.filter(i => i.destino === 'barra');
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

      setMensaje('¡Pedido enviado con éxito a cocina y barra!');
      setCarrito([]);
    } catch (err: any) {
      setMensaje('Error al enviar el pedido: ' + err.message);
    } finally {
      setEnviando(false);
    }
  };

  const pedirCuenta = async () => {
    setEnviandoCuenta(true);
    try {
      const ticketNum = Math.floor(1000 + Math.random() * 9000).toString();
      await supabase.from('comandas_cocina').insert([{
        ticket_number: ticketNum,
        mesa: `MESA ${mesaNum}`,
        tipo_destino: 'cuenta',
        items: [{ nombre: '¡EL CLIENTE PIDE LA CUENTA!', cantidad: 1, variante: '', comentarios: 'Llevar ticket en papel a mesa' }]
      }]);

      setMensaje('¡Cuenta solicitada! Un camarero se acercará con el ticket.');
    } catch (err: any) {
      setMensaje('Error al solicitar la cuenta: ' + err.message);
    } finally {
      setEnviandoCuenta(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#06070a] text-slate-100 flex flex-col justify-between pb-24 selection:bg-cyan-500 selection:text-black">
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
          disabled={enviandoCuenta}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-orange-600 text-white font-bold text-xs shadow-lg active:scale-95 transition-all cursor-pointer"
        >
          <ReceiptText className="h-4 w-4" />
          <span>{enviandoCuenta ? 'Avisando...' : 'Pedir Cuenta'}</span>
        </button>
      </header>

      <main className="max-w-3xl w-full mx-auto p-4 space-y-6">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            onClick={() => setCategoriaActiva('desayunos')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
              categoriaActiva === 'desayunos' ? 'bg-cyan-500 text-slate-950 shadow-md' : 'bg-white/5 text-slate-400'
            }`}
          >
            🥐 Desayunos
          </button>
          <button
            onClick={() => setCategoriaActiva('tapeo')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
              categoriaActiva === 'tapeo' ? 'bg-cyan-500 text-slate-950 shadow-md' : 'bg-white/5 text-slate-400'
            }`}
          >
            🍔 Tapeo & Burgers
          </button>
          <button
            onClick={() => setCategoriaActiva('bebidas')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
              categoriaActiva === 'bebidas' ? 'bg-cyan-500 text-slate-950 shadow-md' : 'bg-white/5 text-slate-400'
            }`}
          >
            🥤 Bebidas
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {productosCarta
            .filter(p => p.categoria === categoriaActiva)
            .map((prod, idx) => (
              <div key={idx} className="p-4 rounded-2xl bg-[#0d0f17] border border-white/10 flex items-center justify-between gap-3 shadow-md">
                <div>
                  <h4 className="font-bold text-white text-sm">{prod.nombre}</h4>
                  <span className="font-mono text-cyan-400 font-bold text-xs mt-1 block">{prod.precio.toFixed(2)} €</span>
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

        {mensaje && (
          <div className="p-4 rounded-2xl bg-cyan-950/40 border border-cyan-500/40 text-cyan-300 text-xs text-center font-semibold">
            {mensaje}
          </div>
        )}
      </main>

      {carrito.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-[#0c0e17]/95 backdrop-blur-md border-t border-white/10 p-4 shadow-2xl z-50">
          <div className="max-w-3xl mx-auto space-y-3">
            <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
              {carrito.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs bg-black/40 p-2.5 rounded-xl border border-white/5">
                  <span className="font-bold text-white truncate max-w-[180px]">{item.nombre}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-cyan-400 font-bold">{(item.precio * item.cantidad).toFixed(2)} €</span>
                    <div className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-lg">
                      <button onClick={() => cambiarCantidad(item.nombre, -1)} className="text-slate-400 hover:text-white"><Minus className="h-3 w-3" /></button>
                      <span className="font-mono font-bold text-white w-4 text-center">{item.cantidad}</span>
                      <button onClick={() => cambiarCantidad(item.nombre, 1)} className="text-slate-400 hover:text-white"><Plus className="h-3 w-3" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Pedido</span>
                <span className="text-xl font-black text-cyan-300 font-mono">{totalCarrito.toFixed(2)} €</span>
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