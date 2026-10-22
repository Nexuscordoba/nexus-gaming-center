import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { Plus, Minus, Send, MapPin, ReceiptText, CheckCircle2, ShoppingCart, X } from 'lucide-react';

interface OpcionCombo {
  nombre: string;
  destino: 'cocina' | 'barra';
}

interface PasoCombo {
  titulo: string;
  opciones: OpcionCombo[];
}

interface Producto {
  id: number;
  nombre: string;
  precio: number;
  categoria: 'bebidas' | 'tapeo' | 'menus';
  destino: 'cocina' | 'barra';
  es_combo?: boolean;
  opciones_combo?: PasoCombo[];
  loyverse_variant_id?: string;
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
  
  // Estados para Combos / Menús
  const [comboActivo, setComboActivo] = useState<Producto | null>(null);
  const [pasoComboActual, setPasoComboActual] = useState(0);
  const [seleccionesCombo, setSeleccionesCombo] = useState<Record<number, OpcionCombo>>({});
  
  const [enviando, setEnviando] = useState(false);
  const [enviandoCuenta, setEnviandoCuenta] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [categoriaActiva, setCategoriaActiva] = useState<'bebidas' | 'tapeo' | 'menus'>('bebidas');

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

    cargarProductosCarta();
    cargarCuentaDesdeSupabase(mNum);

    // Escuchar cambios en vivo (Si el camarero añade algo o si cobra la cuenta)
    const channel = supabase
      .channel(`mesa-${mNum}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comandas_cocina', filter: `mesa=eq.MESA ${mNum}` },
        (payload: any) => {
          // Si el camarero marca la cuenta como servida, limpiamos la mesa
          const comanda = payload.new;
          if (comanda && comanda.tipo_destino === 'cuenta' && comanda.estado === 'servido') {
            setCuentaMesa([]);
            setCarritoActual([]);
            localStorage.removeItem(`nexus_mesa_${mNum}_cuenta`);
            setMensaje('¡Cuenta cobrada con éxito! Gracias por vuestra visita.');
          } else {
            // Si hay otro cambio, recargamos la cuenta para ver los nuevos platos
            cargarCuentaDesdeSupabase(mNum);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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

  const cargarCuentaDesdeSupabase = async (mNum: string) => {
    const { data } = await supabase
      .from('comandas_cocina')
      .select('*')
      .eq('mesa', `MESA ${mNum}`)
      .neq('estado', 'servido')
      .neq('tipo_destino', 'cuenta');

    if (data && data.length > 0) {
      const itemsAcumulados: ItemPedido[] = [];
      data.forEach((comanda: any) => {
        if (comanda.items && Array.isArray(comanda.items)) {
          comanda.items.forEach((it: any) => {
            const existente = itemsAcumulados.find(x => x.nombre === it.nombre);
            if (existente) {
              existente.cantidad += (it.cantidad || 1);
            } else {
              itemsAcumulados.push({
                id: Math.random(),
                nombre: it.nombre,
                precio: Number(it.precio || 0),
                cantidad: it.cantidad || 1,
                destino: comanda.tipo_destino
              });
            }
          });
        }
      });
      setCuentaMesa(itemsAcumulados);
    } else {
      setCuentaMesa([]);
    }
  };

  const clickAgregarAlCarrito = (prod: Producto) => {
    if (prod.es_combo && prod.opciones_combo && prod.opciones_combo.length > 0) {
      setComboActivo(prod);
      setPasoComboActual(0);
      setSeleccionesCombo({});
    } else {
      setCarritoActual(prev => {
        const existe = prev.find(p => p.id === prod.id);
        if (existe) {
          return prev.map(p => p.id === prod.id ? { ...p, cantidad: p.cantidad + 1 } : p);
        }
        return [...prev, { ...prod, cantidad: 1 }];
      });
      setMensaje(null);
    }
  };

  const confirmarCombo = (seleccionesFinales: Record<number, OpcionCombo>) => {
    if (!comboActivo) return;
    
    const baseId = Date.now();
    const itemsNuevos: Array<Producto & { cantidad: number }> = [];

    // Añadir el menú base
    itemsNuevos.push({ 
      ...comboActivo, 
      id: baseId, 
      cantidad: 1 
    });

    // Añadir las opciones seleccionadas a 0€ usando un bucle for tradicional para evitar variables sin uso
    const opcionesLength = comboActivo.opciones_combo?.length || 0;
    for (let idx = 0; idx < opcionesLength; idx++) {
      const seleccion = seleccionesFinales[idx];
      if (seleccion) {
        itemsNuevos.push({
          id: baseId + idx + 1,
          nombre: ` ├─ ${seleccion.nombre}`,
          precio: 0,
          categoria: comboActivo.categoria,
          destino: seleccion.destino,
          cantidad: 1
        });
      }
    }

    setCarritoActual(prev => [...prev, ...itemsNuevos]);
    setComboActivo(null);
    setSeleccionesCombo({});
    setPasoComboActual(0);
    setMensaje(`¡${comboActivo.nombre} añadido al pedido!`);
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
            items: itemsCocina.map(i => ({ 
              nombre: i.nombre, 
              precio: Number(i.precio), 
              cantidad: i.cantidad, 
              variante: '', 
              comentarios: '', 
              es_menu: i.categoria === 'menus' 
            }))
          }])
        );
      }

      if (itemsBarra.length > 0) {
        promesas.push(
          supabase.from('comandas_cocina').insert([{
            ticket_number: ticketNum,
            mesa: `MESA ${mesaNum}`,
            tipo_destino: 'barra',
            items: itemsBarra.map(i => ({ 
              nombre: i.nombre, 
              precio: Number(i.precio), 
              cantidad: i.cantidad, 
              variante: '', 
              comentarios: '' 
            }))
          }])
        );
      }

      await Promise.all(promesas);
      
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
        items: [{ 
          nombre: '¡EL CLIENTE PIDE LA CUENTA!', 
          cantidad: 1, 
          variante: '', 
          comentarios: `Total cuenta: ${totalCuentaAcumulada.toFixed(2)} €` 
        }]
      }]);

      setMensaje('¡Cuenta solicitada! Un camarero se acercará en breve.');
    } catch (err: any) {
      setMensaje('Error al solicitar la cuenta: ' + err.message);
    } finally {
      setEnviandoCuenta(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#06070a] text-slate-100 flex flex-col justify-between selection:bg-cyan-500 selection:text-black relative">
      
      {/* MODAL DE COMBOS / MENÚS FLOTANTE */}
      {comboActivo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md px-4">
          <div className="w-full max-w-md bg-[#0d0f17] border border-cyan-500/30 rounded-3xl p-6 shadow-2xl animate-slide-up">
            <div className="flex justify-between items-center mb-5 border-b border-white/10 pb-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-cyan-400">Configurando tu pedido:</span>
                <h3 className="text-xl font-black text-white">{comboActivo.nombre}</h3>
              </div>
              <button 
                onClick={() => { 
                  setComboActivo(null); 
                  setPasoComboActual(0); 
                  setSeleccionesCombo({}); 
                }} 
                className="text-slate-400 hover:text-white bg-white/5 p-1.5 rounded-lg transition-colors"
              >
                <X className="h-5 w-5"/>
              </button>
            </div>
            
            <div className="space-y-4">
               <h4 className="text-cyan-400 font-bold text-sm bg-cyan-950/30 p-3 rounded-xl border border-cyan-500/20">
                 Paso {pasoComboActual + 1} de {comboActivo.opciones_combo?.length}: {comboActivo.opciones_combo?.[pasoComboActual].titulo}
               </h4>
               
               <div className="grid grid-cols-1 gap-2.5 max-h-72 overflow-y-auto pr-1">
                  {comboActivo.opciones_combo?.[pasoComboActual].opciones.map((opcion, idx) => (
                    <button 
                      key={idx}
                      onClick={() => {
                         const nuevasSel = {...seleccionesCombo, [pasoComboActual]: opcion};
                         setSeleccionesCombo(nuevasSel);
                         
                         if (pasoComboActual < (comboActivo.opciones_combo?.length || 0) - 1) {
                            setPasoComboActual(prev => prev + 1);
                         } else {
                            confirmarCombo(nuevasSel);
                         }
                      }}
                      className="p-4 rounded-xl border border-white/10 bg-black/60 hover:border-cyan-400 hover:bg-cyan-950/40 text-left transition-all flex items-center justify-between group"
                    >
                      <span className="font-bold text-slate-200 text-sm group-hover:text-cyan-400">{opcion.nombre}</span>
                      <Plus className="h-4 w-4 text-slate-600 group-hover:text-cyan-400" />
                    </button>
                  ))}
               </div>
            </div>
          </div>
        </div>
      )}

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
          <div className="p-4 rounded-3xl bg-[#0d0f17] border border-cyan-500/30 space-y-3 shadow-xl animate-fade-in">
            <div className="flex items-center justify-between pb-2 border-b border-white/10 text-cyan-400 font-bold text-xs uppercase tracking-wider">
              <span className="flex items-center gap-1.5"><ShoppingCart className="h-4 w-4" /> Tu Cuenta Acumulada</span>
              <span className="font-mono text-sm">{totalCuentaAcumulada.toFixed(2)} €</span>
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {cuentaMesa.map((item, idx) => (
                <div 
                  key={idx} 
                  className={`flex items-center justify-between text-xs bg-black/40 px-3 py-2 rounded-xl border border-white/5 ${
                    item.nombre.includes('├─') ? 'opacity-70 pl-6' : ''
                  }`}
                >
                  <span className="text-white font-medium">
                    <span className="text-cyan-400 font-mono font-bold mr-2">{item.cantidad}x</span>
                    {item.nombre}
                  </span>
                  <span className="font-mono text-slate-300">
                    {item.nombre.includes('├─') ? '' : `${(item.precio * item.cantidad).toFixed(2)} €`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            onClick={() => setCategoriaActiva('bebidas')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
              categoriaActiva === 'bebidas' ? 'bg-cyan-500 text-slate-950 shadow-md font-black' : 'bg-white/5 text-slate-400'
            }`}
          >
            ☕ Cafetería
          </button>
          <button
            onClick={() => setCategoriaActiva('tapeo')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
              categoriaActiva === 'tapeo' ? 'bg-cyan-500 text-slate-950 shadow-md font-black' : 'bg-white/5 text-slate-400'
            }`}
          >
            🍳 Cocina / Tapas
          </button>
          <button
            onClick={() => setCategoriaActiva('menus')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
              categoriaActiva === 'menus' ? 'bg-cyan-500 text-slate-950 shadow-md font-black' : 'bg-white/5 text-slate-400'
            }`}
          >
            🍽️ Menús y Combos
          </button>
        </div>

        {loadingCarta ? (
          <div className="text-center py-20 text-slate-500 text-sm">Cargando carta...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {productosCarta
              .filter(p => p.categoria === categoriaActiva)
              .map((prod) => (
                <div 
                  key={prod.id} 
                  className={`p-4 rounded-2xl bg-[#0d0f17] border flex items-center justify-between gap-3 shadow-md ${
                    prod.es_combo ? 'border-cyan-500/40 bg-cyan-950/20' : 'border-white/10'
                  }`}
                >
                  <div>
                    <h4 className="font-bold text-white text-sm flex items-center gap-1.5">
                      {prod.nombre}
                      {prod.es_combo && (
                        <span className="text-[9px] bg-cyan-500 text-slate-950 px-1.5 py-0.5 rounded font-black uppercase">
                          Opciones
                        </span>
                      )}
                    </h4>
                    <span className="font-mono text-cyan-400 font-bold text-xs mt-1 block">
                      {Number(prod.precio).toFixed(2)} €
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => clickAgregarAlCarrito(prod)}
                    className="h-10 w-10 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 flex items-center justify-center shrink-0 active:scale-95 transition-transform cursor-pointer shadow-md font-bold"
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
              <span>Añadido al pedido:</span>
              <span className="font-mono">{totalCarritoActual.toFixed(2)} €</span>
            </div>

            <div className="max-h-36 overflow-y-auto space-y-2 pr-1">
              {carritoActual.map((item) => (
                <div 
                  key={item.id} 
                  className={`flex items-center justify-between text-xs bg-cyan-950/20 p-2.5 rounded-xl border border-cyan-500/20 ${
                    item.nombre.includes('├─') ? 'pl-6' : ''
                  }`}
                >
                  <span className="font-bold text-white truncate max-w-[140px]">{item.nombre}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-cyan-400 font-bold">
                      {item.nombre.includes('├─') ? '' : `${(Number(item.precio) * item.cantidad).toFixed(2)} €`}
                    </span>
                    <div className="flex items-center gap-1 bg-white/5 px-1.5 py-0.5 rounded-lg">
                      <button onClick={() => cambiarCantidadCarrito(item.id, -1)} className="text-slate-400 hover:text-white">
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="font-mono font-bold text-white w-3 text-center">{item.cantidad}</span>
                      <button onClick={() => cambiarCantidadCarrito(item.id, 1)} className="text-slate-400 hover:text-white">
                        <Plus className="h-3 w-3" />
                      </button>
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