import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { 
  Utensils, 
  Plus, 
  Minus, 
  Send, 
  Printer, 
  ArrowLeft, 
  MapPin, 
  CheckCircle2, 
  DollarSign, 
  CreditCard, 
  Lock, 
  LockOpen, 
  Calculator, 
  User, 
  X 
} from 'lucide-react';

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

interface CajaDiaria {
  id: number;
  fecha: string;
  remanente_apertura: number;
  total_efectivo: number;
  total_tarjeta: number;
  efectivo_real: number;
  descuadre: number;
  remanente_cierre: number;
  efectivo_retirado: number;
  estado: 'abierta' | 'cerrada';
}

interface TableWaiterProps {
  onBack: () => void;
}

export default function TableWaiter({ onBack }: TableWaiterProps) {
  // Estado de Login de Camarero
  const [camareroActivo, setCamareroActivo] = useState<{ id: string, nombre: string } | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [loginError, setLoginError] = useState(false);

  // Estados principales de Sala
  const [mesaSeleccionada, setMesaSeleccionada] = useState<string>('1');
  const [productosCarta, setProductosCarta] = useState<Producto[]>([]);
  const [loadingCarta, setLoadingCarta] = useState(true);
  
  const [carritoActual, setCarritoActual] = useState<Array<Producto & { cantidad: number }>>([]);
  const [mesasAbiertas, setMesasAbiertas] = useState<MesaAbierta[]>([]);
  const [cuentaMesaActual, setCuentaMesaActual] = useState<ItemPedido[]>([]);
  
  // Estados para Combos / Menús
  const [comboActivo, setComboActivo] = useState<Producto | null>(null);
  const [pasoComboActual, setPasoComboActual] = useState(0);
  const [seleccionesCombo, setSeleccionesCombo] = useState<Record<number, OpcionCombo>>({});

  // Estados de Caja
  const [cajaHoy, setCajaHoy] = useState<CajaDiaria | null>(null);
  const [remanenteAperturaInput, setRemanenteAperturaInput] = useState<string>('50.00');
  const [efectivoRealInput, setEfectivoRealInput] = useState<string>('');
  const [remanenteCierreInput, setRemanenteCierreInput] = useState<string>('50.00');

  // Estados de Interfaz
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [categoriaActiva, setCategoriaActiva] = useState<'bebidas' | 'tapeo' | 'menus'>('bebidas');
  const [vistaSeccion, setVistaSeccion] = useState<'tomar_nota' | 'mesas_abiertas' | 'caja'>('tomar_nota');

  // Función de Login
  const loginCamarero = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(false);
    
    const { data } = await supabase
      .from('empleados')
      .select('*')
      .eq('pin', pinInput)
      .single();
      
    if (data) {
      setCamareroActivo({ id: data.id, nombre: data.nombre });
      cargarProductosCarta();
      cargarMesasAbiertas();
      cargarCaja();
    } else {
      setLoginError(true);
    }
  };

  // Efecto en tiempo real (solo si está logueado)
  useEffect(() => {
    if (!camareroActivo) return;

    const channel = supabase
      .channel('realtime-waiter')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comandas_cocina' },
        () => {
          cargarMesasAbiertas();
          cargarCaja();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [camareroActivo]);

  // Actualizar la vista al cambiar de mesa seleccionada
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
      
    if (data) {
      setProductosCarta(data as Producto[]);
    }
    setLoadingCarta(false);
  };

  const cargarCaja = async () => {
    const fechaHoy = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('caja_diaria')
      .select('*')
      .eq('fecha', fechaHoy)
      .single();

    if (data) {
      setCajaHoy(data as CajaDiaria);
    } else {
      setCajaHoy(null);
      const { data: lastCaja } = await supabase
        .from('caja_diaria')
        .select('remanente_cierre')
        .order('fecha', { ascending: false })
        .limit(1)
        .single();
        
      if (lastCaja) {
        setRemanenteAperturaInput(lastCaja.remanente_cierre.toString());
      }
    }
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
            const existente = mapMesas[mKey].items.find(x => x.nombre === it.nombre);
            if (existente) {
              existente.cantidad += (it.cantidad || 1);
            } else {
              mapMesas[mKey].items.push({
                nombre: it.nombre,
                precio: it.precio || 0,
                cantidad: it.cantidad || 1,
                destino: row.tipo_destino
              });
            }
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

  // Función para gestionar clicks en la carta (identifica si es combo normal)
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

  // Confirmar el pop-up del combo y enviar los items al carrito
  const confirmarCombo = (seleccionesFinales: Record<number, OpcionCombo>) => {
    if (!comboActivo) return;
    
    const baseId = Date.now();
    const itemsNuevos: Array<Producto & { cantidad: number }> = [];

    // Añadir artículo padre (El menú con su precio)
    itemsNuevos.push({ 
      ...comboActivo, 
      id: baseId, 
      cantidad: 1 
    });

    // Añadir opciones hijas a 0€ formateadas
    comboActivo.opciones_combo?.forEach((_, idx) => {
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
    });

    setCarritoActual(prev => [...prev, ...itemsNuevos]);
    setComboActivo(null);
    setSeleccionesCombo({});
    setPasoComboActual(0);
    setMensaje(`¡${comboActivo.nombre} configurado!`);
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
  const totalCuentaMesa = cuentaMesaActual.reduce((acc, item) => acc + (Number(item.precio) * item.cantidad), 0) + totalCarritoActual;

  const enviarPedidoCamarero = async () => {
    if (carritoActual.length === 0 || !camareroActivo) return;
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
            camarero_nombre: camareroActivo.nombre,
            items: itemsCocina.map(i => ({ 
              nombre: i.nombre, 
              precio: Number(i.precio), 
              cantidad: i.cantidad, 
              comentarios: `Anotado por ${camareroActivo.nombre}`, 
              es_menu: i.categoria === 'menus' 
            }))
          }])
        );
      }

      if (itemsBarra.length > 0) {
        promesas.push(
          supabase.from('comandas_cocina').insert([{
            ticket_number: ticketNum,
            mesa: `MESA ${mesaSeleccionada}`,
            tipo_destino: 'barra',
            camarero_nombre: camareroActivo.nombre,
            items: itemsBarra.map(i => ({ 
              nombre: i.nombre, 
              precio: Number(i.precio), 
              cantidad: i.cantidad, 
              comentarios: `Anotado por ${camareroActivo.nombre}` 
            }))
          }])
        );
      }

      await Promise.all(promesas);
      
      setMensaje(`¡Pedido enviado con éxito!`);
      setCarritoActual([]);
      cargarMesasAbiertas();
      
      setTimeout(() => {
        setVistaSeccion('mesas_abiertas');
        setMensaje(null);
      }, 1500);

    } catch (err: any) {
      setMensaje('Error al enviar pedido: ' + err.message);
    } finally {
      setEnviando(false);
    }
  };

  const cobrarMesa = async (mesaNombre: string, metodo: 'efectivo' | 'tarjeta') => {
    if (!cajaHoy || cajaHoy.estado === 'cerrada') {
      alert('¡ATENCIÓN! La caja no está abierta. Ve a la pestaña "Caja y Cierre" para abrir el turno del día antes de cobrar.');
      return;
    }

    const mesaObj = mesasAbiertas.find(m => m.mesa === mesaNombre);
    if (!mesaObj || !camareroActivo) return;

    try {
      // 1. Sincronizar venta con Loyverse
      const { data: cartaIds } = await supabase.from('productos_carta').select('nombre, loyverse_variant_id');
      const mapLoyverseIds: Record<string, string> = {};
      if (cartaIds) {
        cartaIds.forEach(p => { 
          mapLoyverseIds[p.nombre] = p.loyverse_variant_id; 
        });
      }

      const itemsAEnviarLoyverse = mesaObj.items.map(it => ({
        cantidad: it.cantidad,
        precio: it.precio,
        loyverse_variant_id: mapLoyverseIds[it.nombre] || ""
      }));

      try {
        await fetch('/api/sync-receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            receipt_number: mesaObj.ticket_number || Math.floor(100000 + Math.random() * 900000).toString(),
            total_money: mesaObj.total_ticket,
            payment_type: metodo,
            items: itemsAEnviarLoyverse
          })
        });
      } catch (fetchErr) {
        console.warn("Loyverse API no disponible. Se guardará solo en Supabase.");
      }

      // 2. Cerrar en Supabase
      await supabase
        .from('comandas_cocina')
        .update({ 
          estado: 'servido', 
          metodo_pago: metodo, 
          loyverse_sync: true, 
          camarero_nombre: camareroActivo.nombre, 
          total_ticket: mesaObj.total_ticket 
        })
        .eq('mesa', mesaNombre)
        .neq('estado', 'servido');

      // 3. Actualizar importes de caja diaria
      const nuevoEfectivo = Number(cajaHoy.total_efectivo) + (metodo === 'efectivo' ? mesaObj.total_ticket : 0);
      const nuevaTarjeta = Number(cajaHoy.total_tarjeta) + (metodo === 'tarjeta' ? mesaObj.total_ticket : 0);
      
      await supabase
        .from('caja_diaria')
        .update({ total_efectivo: nuevoEfectivo, total_tarjeta: nuevaTarjeta })
        .eq('id', cajaHoy.id);

      // Limpiar memoria local si el cliente escaneó
      const mNumNum = mesaNombre.replace('MESA ', '');
      localStorage.removeItem(`nexus_mesa_${mNumNum}_cuenta`);

      alert(`¡Mesa ${mesaNombre} cobrada por ${camareroActivo.nombre} en ${metodo.toUpperCase()} (${mesaObj.total_ticket.toFixed(2)} €)!`);
      cargarMesasAbiertas();
      cargarCaja();
    } catch (err: any) {
      alert('Error al cobrar la mesa: ' + err.message);
    }
  };

  const imprimirTicket = () => {
    window.print();
  };

  const abrirCaja = async () => {
    const fechaHoy = new Date().toISOString().split('T')[0];
    const remanente = parseFloat(remanenteAperturaInput) || 0;
    
    await supabase.from('caja_diaria').insert([{ 
      fecha: fechaHoy, 
      remanente_apertura: remanente, 
      total_efectivo: 0, 
      total_tarjeta: 0, 
      estado: 'abierta' 
    }]);

    alert(`Turno de hoy abierto con un fondo de caja de ${remanente.toFixed(2)} €.`);
    cargarCaja();
  };

  const cerrarCaja = async () => {
    if (!cajaHoy) return;
    
    const efectivoReal = parseFloat(efectivoRealInput) || 0;
    const remanenteCierre = parseFloat(remanenteCierreInput) || 0;
    
    const teoricoEfectivo = Number(cajaHoy.remanente_apertura) + Number(cajaHoy.total_efectivo);
    const descuadre = efectivoReal - teoricoEfectivo;
    const efectivoRetirado = efectivoReal - remanenteCierre;

    await supabase
      .from('caja_diaria')
      .update({ 
        efectivo_real: efectivoReal,
        descuadre: descuadre,
        remanente_cierre: remanenteCierre,
        efectivo_retirado: efectivoRetirado,
        estado: 'cerrada' 
      })
      .eq('id', cajaHoy.id);

    alert(`¡Caja cerrada! Descuadre: ${descuadre.toFixed(2)} €. Dinero a retirar: ${efectivoRetirado.toFixed(2)} €.`);
    cargarCaja();
  };

  // VISTA PREVIA: Pantalla de Login de Camarero
  if (!camareroActivo) {
    return (
      <div className="min-h-screen bg-[#050609] flex items-center justify-center p-4">
        <div className="w-full max-w-sm p-8 rounded-3xl bg-[#0d0f17] border border-white/10 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="h-16 w-16 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mb-4">
              <User className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-black text-white">Hola, Equipo</h2>
            <p className="text-sm text-slate-400">Introduce tu PIN de empleado para empezar el turno en sala.</p>
          </div>
          <form onSubmit={loginCamarero} className="space-y-4 pt-4">
            <input
              type="password"
              pattern="[0-9]*"
              inputMode="numeric"
              autoFocus
              placeholder="••••"
              value={pinInput}
              onChange={(e) => { 
                setPinInput(e.target.value); 
                setLoginError(false); 
              }}
              className="w-full bg-black/60 border border-white/15 rounded-xl px-4 py-4 text-center text-2xl tracking-[1em] font-mono font-bold text-white outline-none focus:border-amber-400"
            />
            {loginError && (
              <p className="text-xs text-rose-400 text-center font-bold">
                PIN incorrecto. Inténtalo de nuevo.
              </p>
            )}
            <button 
              type="submit" 
              className="w-full py-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg transition-all"
            >
              Entrar al Portal
            </button>
            <button 
              type="button" 
              onClick={onBack} 
              className="w-full text-xs text-slate-500 hover:text-white pt-2 cursor-pointer transition-colors"
            >
              Cancelar y volver a la web
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050609] text-slate-100 p-4 sm:p-6 flex flex-col justify-between selection:bg-cyan-500 selection:text-black relative">
      
      {/* MODAL DE COMBOS / MENÚS FLOTANTE */}
      {comboActivo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md px-4 print:hidden">
          <div className="w-full max-w-md bg-[#0d0f17] border border-amber-500/30 rounded-3xl p-6 shadow-2xl animate-slide-up">
            <div className="flex justify-between items-center mb-5 border-b border-white/10 pb-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-amber-500">Configurando:</span>
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
               <h4 className="text-amber-400 font-bold text-sm bg-amber-950/30 p-3 rounded-xl border border-amber-500/20">
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
                      className="p-4 rounded-xl border border-white/10 bg-black/60 hover:border-amber-400 hover:bg-amber-950/40 text-left transition-all flex items-center justify-between group"
                    >
                      <span className="font-bold text-slate-200 text-sm group-hover:text-amber-400">{opcion.nombre}</span>
                      <Plus className="h-4 w-4 text-slate-600 group-hover:text-amber-400" />
                    </button>
                  ))}
               </div>
            </div>
          </div>
        </div>
      )}

      {/* CABECERA PRINCIPAL DEL PORTAL */}
      <header className="border-b border-white/10 pb-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 sticky top-0 bg-[#050609]/90 backdrop-blur-md z-30 print:hidden">
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
              <Utensils className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-black tracking-wide text-white">NEXUS · PORTAL CAMAREROS</h1>
              <p className="text-xs text-slate-400 flex items-center gap-1">
                Sesión activa: <strong className="text-amber-400">{camareroActivo.nombre}</strong>
              </p>
            </div>
          </div>
          
          <button
            type="button"
            onClick={onBack}
            className="sm:hidden flex items-center gap-1 px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 text-xs text-slate-300"
          >
            <ArrowLeft className="h-4 w-4" /> Volver
          </button>
        </div>

        <div className="flex items-center gap-3 flex-wrap justify-center">
          <div className="flex gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
            <button
              onClick={() => setVistaSeccion('tomar_nota')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                vistaSeccion === 'tomar_nota' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              📝 Tomar Nota
            </button>
            <button
              onClick={() => setVistaSeccion('mesas_abiertas')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all relative ${
                vistaSeccion === 'mesas_abiertas' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              📋 Mesas ({mesasAbiertas.length})
            </button>
            <button
              onClick={() => setVistaSeccion('caja')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                vistaSeccion === 'caja' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              💰 Caja y Cierre
            </button>
          </div>

          <button
            type="button"
            onClick={() => setCamareroActivo(null)}
            className="hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white transition-all cursor-pointer text-xs font-bold"
          >
            Salir
          </button>
        </div>
      </header>

      {/* VISTA 1: TOMAR NOTA Y GESTIONAR MESA */}
      {vistaSeccion === 'tomar_nota' && (
        <main className="flex-1 max-w-5xl w-full mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 pb-24 print:block">
          
          {/* Columna Izquierda: Carta */}
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
                <span>Factura Simplificada</span>
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
                🍽️ Menús y Combos
              </button>
            </div>

            {loadingCarta ? (
              <div className="text-center py-20 text-slate-500 text-sm">Cargando artículos...</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {productosCarta
                  .filter(p => p.categoria === categoriaActiva)
                  .map((prod) => (
                    <div 
                      key={prod.id} 
                      className={`p-3.5 rounded-2xl bg-[#0d0f17] border flex items-center justify-between gap-3 shadow-md ${
                        prod.es_combo ? 'border-amber-500/40 bg-amber-950/20' : 'border-white/10'
                      }`}
                    >
                      <div>
                        <h4 className="font-bold text-white text-sm flex items-center gap-1.5">
                          {prod.nombre} 
                          {prod.es_combo && (
                            <span className="text-[9px] bg-amber-500 text-slate-950 px-1.5 py-0.5 rounded font-black uppercase">
                              Opciones
                            </span>
                          )}
                        </h4>
                        <span className="font-mono text-amber-400 font-bold text-xs mt-0.5 block">
                          {Number(prod.precio).toFixed(2)} €
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => clickAgregarAlCarrito(prod)}
                        className="h-9 w-9 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center shrink-0 active:scale-95 transition-transform cursor-pointer shadow-md font-bold"
                      >
                        <Plus className="h-5 w-5" />
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Columna Derecha: Resumen de Mesa */}
          <div className="space-y-4 print:w-full">
            <div className="p-5 rounded-3xl bg-[#0d0f17] border border-white/10 space-y-4 shadow-xl print:border-none print:bg-white print:text-black">
              
              {/* TICKET TÉRMICO PARA IMPRESIÓN */}
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
                  {cuentaMesaActual
                    .concat(carritoActual.map(c => ({ 
                      nombre: c.nombre, 
                      precio: Number(c.precio), 
                      cantidad: c.cantidad, 
                      destino: c.destino 
                    })))
                    .map((it, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span className="w-8">{it.cantidad}x</span>
                        <span className={`flex-1 truncate ${it.nombre.includes('├─') ? 'pl-2 text-[10px] text-slate-700' : ''}`}>
                          {it.nombre}
                        </span>
                        <span className="w-16 text-right">
                          {it.nombre.includes('├─') ? '' : `${(it.precio * it.cantidad).toFixed(2)} €`}
                        </span>
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
                  <p>Atendido por: {camareroActivo.nombre}</p>
                </div>
              </div>

              {/* VISTA NORMAL EN PANTALLA */}
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
                    <p className="text-xs text-slate-500 italic py-3 text-center">La mesa está vacía.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {cuentaMesaActual.map((item, idx) => (
                        <div 
                          key={idx} 
                          className={`flex items-center justify-between text-xs bg-black/40 px-3 py-2 rounded-xl border border-white/5 ${
                            item.nombre.includes('├─') ? 'opacity-70 pl-6' : ''
                          }`}
                        >
                          <span className="text-white font-medium">
                            <span className="text-amber-400 font-mono font-bold mr-2">{item.cantidad}x</span>
                            {item.nombre}
                          </span>
                          <span className="font-mono text-slate-300">
                            {item.nombre.includes('├─') ? '' : `${(item.precio * item.cantidad).toFixed(2)} €`}
                          </span>
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
                              <button 
                                onClick={() => cambiarCantidadCarrito(item.id, -1)} 
                                className="text-slate-400 hover:text-white"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="font-mono font-bold text-white w-3 text-center">{item.cantidad}</span>
                              <button 
                                onClick={() => cambiarCantidadCarrito(item.id, 1)} 
                                className="text-slate-400 hover:text-white"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
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
      )}

      {/* VISTA 2: LISTADO DE MESAS ABIERTAS */}
      {vistaSeccion === 'mesas_abiertas' && (
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
                        <div 
                          key={iIdx} 
                          className={`flex justify-between text-xs bg-black/40 px-2.5 py-1.5 rounded-lg ${
                            it.nombre.includes('├─') ? 'opacity-60 pl-5' : ''
                          }`}
                        >
                          <span className="text-slate-200">
                            <span className="text-amber-400 font-mono font-bold mr-1.5">{it.cantidad}x</span>
                            {it.nombre}
                          </span>
                          <span className="font-mono text-slate-400">
                            {it.nombre.includes('├─') ? '' : `${(it.precio * it.cantidad).toFixed(2)} €`}
                          </span>
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

      {/* VISTA 3: APERTURA Y CIERRE DE CAJA */}
      {vistaSeccion === 'caja' && (
        <main className="flex-1 max-w-2xl w-full mx-auto space-y-6 pb-24">
          
          {!cajaHoy ? (
            <div className="p-6 rounded-3xl bg-[#0d0f17] border border-amber-500/40 space-y-5 shadow-xl">
              <div className="flex items-center gap-3 text-amber-400 border-b border-white/10 pb-4">
                <LockOpen className="h-6 w-6" />
                <h2 className="text-xl font-bold text-white">Apertura de Turno</h2>
              </div>
              <p className="text-sm text-slate-400">
                No hay ninguna caja abierta para el día de hoy. Por favor, verifica el dinero inicial en el cajón para empezar a cobrar a tu nombre.
              </p>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase">Fondo Inicial / Remanente (€)</label>
                <input
                  type="number"
                  step="0.01"
                  value={remanenteAperturaInput}
                  onChange={(e) => setRemanenteAperturaInput(e.target.value)}
                  className="w-full bg-black/60 border border-white/20 rounded-xl px-4 py-3 text-lg font-mono font-bold text-white outline-none focus:border-amber-400"
                />
              </div>
              <button 
                onClick={abrirCaja} 
                className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm uppercase flex items-center justify-center gap-2 cursor-pointer shadow-lg"
              >
                <LockOpen className="h-5 w-5" /> Abrir Caja
              </button>
            </div>
          ) : cajaHoy.estado === 'abierta' ? (
            <div className="p-6 rounded-3xl bg-[#0d0f17] border border-cyan-500/40 space-y-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-3 text-cyan-400">
                  <Calculator className="h-6 w-6" />
                  <h2 className="text-xl font-bold text-white">Arqueo y Cierre de Caja</h2>
                </div>
                <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-xl text-xs font-bold">
                  Turno Abierto
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-black/40 p-3 rounded-xl border border-white/5 space-y-1">
                  <span className="text-xs text-slate-400 uppercase">Fondo Inicial:</span>
                  <p className="font-mono text-lg font-bold text-white">{Number(cajaHoy.remanente_apertura).toFixed(2)} €</p>
                </div>
                <div className="bg-black/40 p-3 rounded-xl border border-white/5 space-y-1">
                  <span className="text-xs text-slate-400 uppercase">Ventas Efectivo:</span>
                  <p className="font-mono text-lg font-bold text-emerald-400">+{Number(cajaHoy.total_efectivo).toFixed(2)} €</p>
                </div>
                <div className="col-span-2 bg-sky-950/20 p-4 rounded-xl border border-sky-500/30 flex justify-between items-center">
                  <span className="text-sm font-bold text-sky-400 uppercase">Teórico en Cajón:</span>
                  <span className="font-mono text-2xl font-black text-white">{(Number(cajaHoy.remanente_apertura) + Number(cajaHoy.total_efectivo)).toFixed(2)} €</span>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-white/10">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-amber-400 uppercase">Efectivo Real Contado (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Dinero físico total en el cajón..."
                    value={efectivoRealInput}
                    onChange={(e) => setEfectivoRealInput(e.target.value)}
                    className="w-full bg-black/60 border border-amber-500/40 rounded-xl px-4 py-3 text-lg font-mono font-bold text-amber-400 outline-none focus:border-amber-400"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 uppercase">Fondo a dejar para mañana (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={remanenteCierreInput}
                    onChange={(e) => setRemanenteCierreInput(e.target.value)}
                    className="w-full bg-black/60 border border-white/20 rounded-xl px-4 py-3 text-lg font-mono font-bold text-white outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <button 
                onClick={cerrarCaja} 
                className="w-full py-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-sm uppercase flex items-center justify-center gap-2 cursor-pointer shadow-lg"
              >
                <Lock className="h-5 w-5" /> Cerrar Caja y Terminar Turno
              </button>
            </div>
          ) : (
            <div className="p-8 rounded-3xl bg-[#0d0f17] border border-white/10 text-center space-y-4 shadow-xl">
              <Lock className="h-12 w-12 text-slate-600 mx-auto" />
              <h2 className="text-xl font-bold text-white">Caja Cerrada</h2>
              <p className="text-sm text-slate-400">
                El turno de hoy ya ha sido cerrado. Descuadre: <span className="font-mono text-white">{Number(cajaHoy.descuadre).toFixed(2)} €</span>. Efectivo retirado: <span className="font-mono text-white">{Number(cajaHoy.efectivo_retirado).toFixed(2)} €</span>.
              </p>
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