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
  X, 
  AlertTriangle, 
  Power,
  ClipboardList
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
  const [cocinaAbierta, setCocinaAbierta] = useState(true);
  
  const [carritoActual, setCarritoActual] = useState<Array<Producto & { cantidad: number }>>([]);
  const [mesasAbiertas, setMesasAbiertas] = useState<MesaAbierta[]>([]);
  const [cuentaMesaActual, setCuentaMesaActual] = useState<ItemPedido[]>([]);
  
  // Estado para PopUp de Combos / Menús
  const [comboActivo, setComboActivo] = useState<Producto | null>(null);
  const [pasoComboActual, setPasoComboActual] = useState(0);
  const [seleccionesCombo, setSeleccionesCombo] = useState<Record<number, OpcionCombo>>({});

  // Estados de Caja y Cuadre
  const [cajaHoy, setCajaHoy] = useState<CajaDiaria | null>(null);
  const [cajaAtrasada, setCajaAtrasada] = useState<CajaDiaria | null>(null); 
  const [operacionesHoy, setOperacionesHoy] = useState<any[]>([]); // Historial de tickets cobrados
  const [remanenteAperturaInput, setRemanenteAperturaInput] = useState<string>('50.00');
  const [efectivoRealInput, setEfectivoRealInput] = useState<string>('');
  const [remanenteCierreInput, setRemanenteCierreInput] = useState<string>('50.00');

  // Estados de Interfaz
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [categoriaActiva, setCategoriaActiva] = useState<'bebidas' | 'tapeo' | 'menus'>('bebidas');
  const [vistaSeccion, setVistaSeccion] = useState<'tomar_nota' | 'mesas_abiertas' | 'caja'>('tomar_nota');

  // Recuperar Sesión Automáticamente al Recargar
  useEffect(() => {
    const initSesion = async () => {
      const sesionGuardada = sessionStorage.getItem('nexus_camarero_sesion');
      if (sesionGuardada) {
        const parsed = JSON.parse(sesionGuardada);
        setCamareroActivo(parsed);
        cargarConfiguracion();
        cargarProductosCarta();
        cargarMesasAbiertas();
        cargarCaja();
      }
    };
    initSesion();
  }, []);

  // Función de Login
  const loginCamarero = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(false);
    
    const { data } = await supabase
      .from('empleados')
      .select('*')
      .eq('pin_acceso', pinInput)
      .single();
      
    if (data) {
      const usuario = { id: data.id, nombre: data.nombre };
      setCamareroActivo(usuario);
      sessionStorage.setItem('nexus_camarero_sesion', JSON.stringify(usuario)); // Guarda la sesión
      
      cargarConfiguracion();
      cargarProductosCarta();
      cargarMesasAbiertas();
      cargarCaja();
    } else {
      setLoginError(true);
    }
  };

  // Efectos en tiempo real (Sockets)
  useEffect(() => {
    if (!camareroActivo) return;

    const channel = supabase.channel('realtime-waiter')
      .on(
        'postgres_changes', 
        { event: '*', schema: 'public', table: 'comandas_cocina' }, 
        () => {
          cargarMesasAbiertas();
          cargarCaja();
        }
      )
      .on(
        'postgres_changes', 
        { event: '*', schema: 'public', table: 'configuracion_local' }, 
        () => {
          cargarConfiguracion();
        }
      )
      .subscribe();

    return () => { 
      supabase.removeChannel(channel); 
    };
  }, [camareroActivo]);

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

  const cargarConfiguracion = async () => {
    const { data } = await supabase
      .from('configuracion_local')
      .select('*')
      .eq('id', 1)
      .single();

    if (data) {
      setCocinaAbierta(data.cocina_abierta);
    }
  };

  const toggleCocina = async () => {
    const nuevoEstado = !cocinaAbierta;
    await supabase
      .from('configuracion_local')
      .update({ cocina_abierta: nuevoEstado })
      .eq('id', 1);
      
    setCocinaAbierta(nuevoEstado);
  };

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
    const { data: todasLasCajas } = await supabase
      .from('caja_diaria')
      .select('*')
      .order('fecha', { ascending: false });

    if (todasLasCajas && todasLasCajas.length > 0) {
      const cajaDeHoy = todasLasCajas.find(c => c.fecha === fechaHoy);
      if (cajaDeHoy) {
        setCajaHoy(cajaDeHoy as CajaDiaria);
      } else {
        setCajaHoy(null);
      }

      // Buscar si hay alguna caja anterior que se quedó sin cerrar
      const cajaAntiguaAbierta = todasLasCajas.find(c => c.estado === 'abierta' && c.fecha !== fechaHoy);
      if (cajaAntiguaAbierta) {
        setCajaAtrasada(cajaAntiguaAbierta as CajaDiaria);
      } else {
        setCajaAtrasada(null);
        // Si no hay caja atrasada y hoy no se ha abierto, sugerir remanente de la última caja
        if (!cajaDeHoy && todasLasCajas[0]) {
          setRemanenteAperturaInput(todasLasCajas[0].remanente_cierre.toString());
        }
      }
    }

    // Cargar operaciones de hoy para el cuadre (Solo las pagadas hoy)
    const { data: opData } = await supabase
      .from('comandas_cocina')
      .select('*')
      .eq('pagado', true)
      .gte('created_at', fechaHoy + 'T00:00:00Z')
      .order('created_at', { ascending: false });
      
    if (opData) {
      // Agrupamos para no repetir tickets si cocina y barra fueron enviados separados
      const uniqueTickets: Record<string, any> = {};
      opData.forEach(op => {
        if (!uniqueTickets[op.ticket_number]) {
          uniqueTickets[op.ticket_number] = op;
        } else {
          // Si ya existe, sumamos el total (por si cocina y barra se cobraron en un solo ticket)
          uniqueTickets[op.ticket_number].total_ticket += op.total_ticket;
        }
      });
      setOperacionesHoy(Object.values(uniqueTickets));
    }
  };

  const cargarMesasAbiertas = async () => {
    // Solo cargamos lo que NO está pagado
    const { data } = await supabase
      .from('comandas_cocina')
      .select('*')
      .eq('pagado', false);

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

      const listado = Object.values(mapMesas).map(m => {
        const total = m.items.reduce((acc, i) => acc + (i.precio * i.cantidad), 0);
        return { ...m, total_ticket: total };
      });
      
      // Evitamos mostrar mesas a 0€
      setMesasAbiertas(listado.filter(m => m.total_ticket > 0)); 
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
    
    itemsNuevos.push({ ...comboActivo, id: baseId, cantidad: 1 });
    
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
  };

  const cambiarCantidadCarrito = (id: number, delta: number) => {
    setCarritoActual(prev => prev.map(p => {
      if (p.id === id) {
        const nuevaCant = p.cantidad + delta;
        return nuevaCant > 0 ? { ...p, cantidad: nuevaCant } : null;
      }
      return p;
    }).filter(Boolean) as any);
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
      setMensaje('Error: ' + err.message); 
    } finally { 
      setEnviando(false); 
    }
  };

  const cobrarMesa = async (mesaNombre: string, metodo: 'efectivo' | 'tarjeta') => {
    if (cajaAtrasada) { 
      alert('¡ATENCIÓN! Tienes que cerrar la caja del día anterior antes de cobrar nada.'); 
      return; 
    }
    
    if (!cajaHoy || cajaHoy.estado === 'cerrada') { 
      alert('¡ATENCIÓN! Abre la caja de hoy primero.'); 
      return; 
    }
    
    const mesaObj = mesasAbiertas.find(m => m.mesa === mesaNombre);
    if (!mesaObj || !camareroActivo) return;

    try {
      const { data: cartaIds } = await supabase
        .from('productos_carta')
        .select('nombre, loyverse_variant_id');
        
      const mapLoyverseIds: Record<string, string> = {};
      
      if (cartaIds) {
        cartaIds.forEach(p => { 
          mapLoyverseIds[p.nombre.trim()] = p.loyverse_variant_id; 
        });
      }

      const itemsAEnviarLoyverse = mesaObj.items.map(it => {
        // Limpiamos los adornos del nombre para que empareje exacto con el Loyverse Variant ID
        const nombreLimpio = it.nombre.replace('├─', '').trim();
        return { 
          cantidad: it.cantidad, 
          precio: it.precio, 
          loyverse_variant_id: mapLoyverseIds[nombreLimpio] || "" 
        };
      });

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
      } catch (e) { 
        console.warn("Aviso Loyverse (offline)."); 
      }

      // IMPORTANTE: Marcamos pagado = true pero NO modificamos el "estado" a servido 
      // para que siga apareciendo en las pantallas de cocina y barra.
      await supabase
        .from('comandas_cocina')
        .update({ 
          pagado: true, 
          metodo_pago: metodo, 
          camarero_nombre: camareroActivo.nombre, 
          total_ticket: mesaObj.total_ticket 
        })
        .eq('mesa', mesaNombre)
        .eq('pagado', false);
      
      const nuevoEfectivo = Number(cajaHoy.total_efectivo) + (metodo === 'efectivo' ? mesaObj.total_ticket : 0);
      const nuevaTarjeta = Number(cajaHoy.total_tarjeta) + (metodo === 'tarjeta' ? mesaObj.total_ticket : 0);
      
      await supabase
        .from('caja_diaria')
        .update({ 
          total_efectivo: nuevoEfectivo, 
          total_tarjeta: nuevaTarjeta 
        })
        .eq('id', cajaHoy.id);

      alert(`¡Mesa ${mesaNombre} cobrada por ${camareroActivo.nombre} en ${metodo.toUpperCase()}!`);
      
      cargarMesasAbiertas();
      cargarCaja();
    } catch (err: any) { 
      alert('Error al cobrar la mesa: ' + err.message); 
    }
  };

  const abrirCaja = async () => {
    const fechaHoy = new Date().toISOString().split('T')[0];
    const remanente = parseFloat(remanenteAperturaInput) || 0;
    
    await supabase
      .from('caja_diaria')
      .insert([{ 
        fecha: fechaHoy, 
        remanente_apertura: remanente, 
        total_efectivo: 0, 
        total_tarjeta: 0, 
        estado: 'abierta' 
      }]);
      
    alert(`Turno de hoy abierto.`);
    cargarCaja();
  };

  const cerrarCajaEspecifica = async (caja: CajaDiaria) => {
    const efectivoReal = parseFloat(efectivoRealInput) || 0;
    const remanenteCierre = parseFloat(remanenteCierreInput) || 0;
    const teoricoEfectivo = Number(caja.remanente_apertura) + Number(caja.total_efectivo);
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
      .eq('id', caja.id);
      
    alert(`¡Caja de fecha ${caja.fecha} cerrada correctamente!`);
    cargarCaja();
  };

  // Función para cerrar sesión de camarero manualmente
  const salirSesion = () => {
    setCamareroActivo(null);
    sessionStorage.removeItem('nexus_camarero_sesion');
  };

  // --- INTERFAZ LOGIN CAMARERO ---
  if (!camareroActivo) {
    return (
      <div className="min-h-screen bg-[#050609] flex items-center justify-center p-4">
        <div className="w-full max-w-sm p-8 rounded-3xl bg-[#0d0f17] border border-white/10 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="h-16 w-16 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mb-4">
              <User className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-black text-white">Hola, Equipo</h2>
            <p className="text-sm text-slate-400">Introduce tu PIN para empezar.</p>
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
                PIN incorrecto.
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
              className="w-full text-xs text-slate-500 hover:text-white pt-3 cursor-pointer transition-colors"
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
      
      {/* MODAL POPUP PARA COMBOS Y MENÚS */}
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
                className="text-slate-400 hover:text-white bg-white/5 p-1.5 rounded-lg cursor-pointer"
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
                      className="p-4 rounded-xl border border-white/10 bg-black/60 hover:border-amber-400 hover:bg-amber-950/40 text-left transition-all flex items-center justify-between group cursor-pointer"
                    >
                      <span className="font-bold text-slate-200 text-sm group-hover:text-amber-400">
                        {opcion.nombre}
                      </span>
                      <Plus className="h-4 w-4 text-slate-600 group-hover:text-amber-400" />
                    </button>
                  ))}
               </div>
            </div>
          </div>
        </div>
      )}

      {/* CABECERA PRINCIPAL */}
      <header className="border-b border-white/10 pb-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 sticky top-0 bg-[#050609]/90 backdrop-blur-md z-30 print:hidden">
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
              <Utensils className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-black tracking-wide text-white">NEXUS · PORTAL CAMAREROS</h1>
              <p className="text-xs text-slate-400 flex items-center gap-1">
                Sesión: <strong className="text-amber-400">{camareroActivo.nombre}</strong>
              </p>
            </div>
          </div>
          
          <button
            type="button"
            onClick={salirSesion}
            className="sm:hidden flex items-center gap-1 px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 text-xs text-slate-300 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" /> Salir
          </button>
        </div>
        
        <div className="flex items-center gap-3 flex-wrap justify-center">
          
          <button 
            onClick={toggleCocina} 
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-md border cursor-pointer ${
              cocinaAbierta 
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500 hover:text-slate-950' 
                : 'bg-rose-500/20 text-rose-400 border-rose-500/40 hover:bg-rose-500 hover:text-slate-950'
            }`}
          >
            <Power className="h-4 w-4" /> 
            {cocinaAbierta ? 'Cocina Abierta' : 'Cocina CERRADA'}
          </button>
          
          <div className="flex gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
            <button 
              onClick={() => setVistaSeccion('tomar_nota')} 
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                vistaSeccion === 'tomar_nota' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              📝 Toma Notas
            </button>
            <button 
              onClick={() => setVistaSeccion('mesas_abiertas')} 
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all relative cursor-pointer ${
                vistaSeccion === 'mesas_abiertas' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              📋 Mesas
            </button>
            <button 
              onClick={() => setVistaSeccion('caja')} 
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                vistaSeccion === 'caja' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              💰 Caja
            </button>
          </div>
          
          <button
            type="button"
            onClick={salirSesion}
            className="hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white transition-all cursor-pointer text-xs font-bold"
          >
            Salir
          </button>
        </div>
      </header>

      {/* VISTA 1: TOMAR NOTA Y CARRITO */}
      {vistaSeccion === 'tomar_nota' && (
        <main className="flex-1 max-w-5xl w-full mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 pb-24 print:block">
          
          <div className="md:col-span-2 space-y-4 print:hidden">
            <div className="flex items-center justify-between bg-[#0d0f17] p-4 rounded-2xl border border-white/10">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-amber-400" />
                <span className="text-xs font-bold uppercase text-slate-300">Mesa:</span>
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
                onClick={() => window.print()} 
                disabled={cuentaMesaActual.length === 0 && carritoActual.length === 0} 
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg transition-all cursor-pointer disabled:opacity-50"
              >
                <Printer className="h-4 w-4" /> 
                <span>Factura</span>
              </button>
            </div>
            
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
              <button 
                onClick={() => setCategoriaActiva('bebidas')} 
                className={`px-4 py-2 rounded-2xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
                  categoriaActiva === 'bebidas' ? 'bg-amber-500 text-slate-950' : 'bg-white/5 text-slate-400'
                }`}
              >
                ☕ Cafetería
              </button>
              <button 
                onClick={() => setCategoriaActiva('tapeo')} 
                className={`px-4 py-2 rounded-2xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
                  categoriaActiva === 'tapeo' ? 'bg-amber-500 text-slate-950' : 'bg-white/5 text-slate-400'
                }`}
              >
                🍳 Tapas
              </button>
              <button 
                onClick={() => setCategoriaActiva('menus')} 
                className={`px-4 py-2 rounded-2xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
                  categoriaActiva === 'menus' ? 'bg-amber-500 text-slate-950' : 'bg-white/5 text-slate-400'
                }`}
              >
                🍽️ Menús/Combos
              </button>
            </div>
            
            {loadingCarta ? (
              <div className="text-center py-20 text-slate-500 text-sm">
                Cargando artículos...
              </div>
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
                        <h4 className="font-bold text-white text-sm">
                          {prod.nombre}
                        </h4>
                        <span className="font-mono text-amber-400 font-bold text-xs mt-0.5 block">
                          {Number(prod.precio).toFixed(2)} €
                        </span>
                      </div>
                      <button 
                        onClick={() => clickAgregarAlCarrito(prod)} 
                        className="h-9 w-9 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center cursor-pointer active:scale-95 transition-transform font-bold"
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
                  <h2 className="font-black text-sm">NEXUS CORDOBA</h2>
                  <p>MESA: {mesaSeleccionada}</p>
                </div>
                
                <div className="space-y-1 py-2 border-b border-black">
                  {cuentaMesaActual
                    .concat(carritoActual.map(c => ({ 
                      nombre: c.nombre, 
                      precio: Number(c.precio), 
                      cantidad: c.cantidad, 
                      destino: c.destino 
                    })))
                    .map((it, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span className="flex-1 truncate">
                          {it.cantidad}x {it.nombre}
                        </span>
                        <span>
                          {(it.precio * it.cantidad).toFixed(2)} €
                        </span>
                      </div>
                  ))}
                </div>
                
                <div className="pt-2 text-right font-bold text-sm">
                  <p>TOTAL: {totalCuentaMesa.toFixed(2)} €</p>
                </div>
                
              </div>
              
              <div className="print:hidden">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Resumen Mesa
                    </span>
                    <h3 className="text-lg font-black text-white">
                      MESA {mesaSeleccionada}
                    </h3>
                  </div>
                  <span className="font-mono font-bold text-amber-400 text-base">
                    {totalCuentaMesa.toFixed(2)} €
                  </span>
                </div>
                
                <div className="space-y-2 mt-3">
                  <span className="text-xs font-bold text-slate-400 block">
                    Artículos pedidos (Sin cobrar):
                  </span>
                  {cuentaMesaActual.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">Mesa vacía.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {cuentaMesaActual.map((item, idx) => (
                        <div 
                          key={idx} 
                          className="flex justify-between text-xs bg-black/40 px-3 py-2 rounded-xl border border-white/5"
                        >
                          <span className="text-white">
                            <span className="text-amber-400 font-mono font-bold mr-2">
                              {item.cantidad}x
                            </span>
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
                    <span className="text-xs font-bold text-cyan-400 block">
                      Nuevos a enviar a KDS:
                    </span>
                    
                    <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                      {carritoActual.map((item) => (
                        <div 
                          key={item.id} 
                          className="flex justify-between text-xs bg-cyan-950/20 p-2.5 rounded-xl border border-cyan-500/20"
                        >
                          <span className="font-bold text-white truncate max-w-[140px]">
                            {item.nombre}
                          </span>
                          
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-cyan-400 font-bold">
                              {item.nombre.includes('├─') ? '' : `${(Number(item.precio) * item.cantidad).toFixed(2)} €`}
                            </span>
                            
                            <div className="flex gap-1 bg-white/5 px-1.5 py-0.5 rounded-lg">
                              <button 
                                onClick={() => cambiarCantidadCarrito(item.id, -1)} 
                                className="text-slate-400 hover:text-white cursor-pointer"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="font-mono font-bold text-white w-3 text-center">
                                {item.cantidad}
                              </span>
                              <button 
                                onClick={() => cambiarCantidadCarrito(item.id, 1)} 
                                className="text-slate-400 hover:text-white cursor-pointer"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <button 
                      disabled={enviando} 
                      onClick={enviarPedidoCamarero} 
                      className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-emerald-500 text-slate-950 font-black text-xs uppercase flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-95 disabled:opacity-50"
                    >
                      <Send className="h-4 w-4" /> Enviar Pedido
                    </button>
                  </div>
                )}
                
                {mensaje && (
                  <div className="p-3 mt-3 rounded-2xl bg-cyan-950/40 border border-cyan-500/40 text-cyan-300 text-xs text-center font-semibold">
                    <CheckCircle2 className="h-4 w-4 inline mr-1" /> 
                    {mensaje}
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
          
          <h2 className="text-xl font-bold text-white">
            📋 Mesas Activas sin cobrar
          </h2>
          
          {mesasAbiertas.length === 0 ? (
            <div className="text-center py-20 text-slate-500">
              <p className="font-semibold">No hay mesas abiertas por cobrar.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {mesasAbiertas.map((m) => (
                <div 
                  key={m.id} 
                  className="p-5 rounded-3xl bg-[#0d0f17] border border-white/10 space-y-4 shadow-xl"
                >
                  <div className="flex justify-between border-b border-white/10 pb-2">
                    <span className="font-black text-sm px-3 py-1 rounded-xl bg-amber-500 text-slate-950 uppercase">
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
                        className="flex justify-between text-xs bg-black/40 px-2.5 py-1.5 rounded-lg"
                      >
                        <span className="text-slate-200">
                          <span className="text-amber-400 font-mono font-bold mr-1.5">
                            {it.cantidad}x
                          </span>
                          {it.nombre}
                        </span>
                        <span className="font-mono text-slate-400">
                          {it.nombre.includes('├─') ? '' : `${(it.precio * it.cantidad).toFixed(2)} €`}
                        </span>
                      </div>
                    ))}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/10">
                    <button 
                      onClick={() => cobrarMesa(m.mesa, 'efectivo')} 
                      className="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-xs uppercase flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <DollarSign className="h-4 w-4" /> Efectivo
                    </button>
                    <button 
                      onClick={() => cobrarMesa(m.mesa, 'tarjeta')} 
                      className="py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs uppercase flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <CreditCard className="h-4 w-4" /> Tarjeta
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      )}

      {/* VISTA 3: CAJA Y CUADRE DETALLADO */}
      {vistaSeccion === 'caja' && (
        <main className="flex-1 max-w-3xl w-full mx-auto space-y-6 pb-24">
          
          {cajaAtrasada && (
             <div className="p-6 rounded-3xl bg-rose-950/40 border border-rose-500/50 space-y-5 shadow-xl animate-pulse">
               <div className="flex items-center gap-3 text-rose-400 border-b border-rose-500/30 pb-4">
                 <AlertTriangle className="h-6 w-6" />
                 <h2 className="text-xl font-bold text-white">¡Caja anterior abierta!</h2>
               </div>
               <p className="text-sm text-slate-300">
                 Tienes que cerrar la caja del día <strong className="text-rose-400">{cajaAtrasada.fecha}</strong> antes de poder cobrar nada hoy.
               </p>
               <button 
                 onClick={() => cerrarCajaEspecifica(cajaAtrasada)} 
                 className="w-full py-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-sm uppercase flex items-center justify-center gap-2 cursor-pointer"
               >
                 Forzar Cierre de Caja Atrasada
               </button>
             </div>
          )}

          {!cajaHoy && !cajaAtrasada ? (
            <div className="p-6 rounded-3xl bg-[#0d0f17] border border-amber-500/40 space-y-5 shadow-xl">
              <div className="flex items-center gap-3 text-amber-400 border-b border-white/10 pb-4">
                <LockOpen className="h-6 w-6" />
                <h2 className="text-xl font-bold text-white">Apertura de Turno</h2>
              </div>
              <p className="text-sm text-slate-400">
                Verifica el dinero inicial para empezar a cobrar a tu nombre.
              </p>
              
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase">
                  Fondo Inicial / Remanente (€)
                </label>
                <input 
                  type="number" 
                  step="0.01" 
                  value={remanenteAperturaInput} 
                  onChange={(e) => setRemanenteAperturaInput(e.target.value)} 
                  className="w-full bg-black/60 border border-white/20 rounded-xl px-4 py-3 text-lg font-mono font-bold text-white focus:border-amber-400"
                />
              </div>
              
              <button 
                onClick={abrirCaja} 
                className="w-full py-3.5 rounded-xl bg-amber-500 text-slate-950 font-black text-sm uppercase flex items-center justify-center gap-2 cursor-pointer"
              >
                <LockOpen className="h-5 w-5" /> Abrir Caja
              </button>
            </div>
          ) : cajaHoy && cajaHoy.estado === 'abierta' ? (
            <div className="p-6 rounded-3xl bg-[#0d0f17] border border-cyan-500/40 space-y-6 shadow-xl">
              
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-3 text-cyan-400">
                  <Calculator className="h-6 w-6" />
                  <h2 className="text-xl font-bold text-white">Arqueo y Cierre</h2>
                </div>
                <span className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-xl text-xs font-bold">
                  Turno Abierto
                </span>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="bg-black/40 p-3 rounded-xl border border-white/5 space-y-1">
                  <span className="text-xs text-slate-400">Fondo Inicial:</span>
                  <p className="font-mono text-lg font-bold text-white">
                    {Number(cajaHoy.remanente_apertura).toFixed(2)} €
                  </p>
                </div>
                <div className="bg-black/40 p-3 rounded-xl border border-white/5 space-y-1">
                  <span className="text-xs text-slate-400">Total Tarjeta:</span>
                  <p className="font-mono text-lg font-bold text-cyan-400">
                    {Number(cajaHoy.total_tarjeta).toFixed(2)} €
                  </p>
                </div>
                <div className="bg-black/40 p-3 rounded-xl border border-white/5 space-y-1">
                  <span className="text-xs text-slate-400">Total Efectivo:</span>
                  <p className="font-mono text-lg font-bold text-emerald-400">
                    +{Number(cajaHoy.total_efectivo).toFixed(2)} €
                  </p>
                </div>
                <div className="bg-sky-950/20 p-3 rounded-xl border border-sky-500/30">
                  <span className="text-xs font-bold text-sky-400">Teórico en Cajón:</span>
                  <p className="font-mono text-xl font-black text-white mt-1">
                    {(Number(cajaHoy.remanente_apertura) + Number(cajaHoy.total_efectivo)).toFixed(2)} €
                  </p>
                </div>
              </div>

              {/* LISTADO DE OPERACIONES COBRADAS PARA EL CUADRE */}
              <div className="space-y-3 pt-4 border-t border-white/10">
                <div className="flex items-center gap-2 text-slate-400 mb-2">
                  <ClipboardList className="h-4 w-4" />
                  <h4 className="text-xs font-bold uppercase tracking-wider">Resumen de Tickets Cobrados Hoy</h4>
                </div>
                
                {operacionesHoy.length === 0 ? (
                  <p className="text-xs text-slate-500 italic text-center py-4 bg-black/20 rounded-xl">
                    Aún no hay cobros registrados en este turno.
                  </p>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-2 pr-1 scrollbar-none">
                    {operacionesHoy.map((op, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-white/5 text-xs hover:bg-white/5 transition-colors">
                        <div className="space-y-1">
                          <div>
                            <span className="font-bold text-white uppercase">{op.mesa}</span>
                            <span className="text-slate-500 ml-2 font-mono text-[10px]">#{op.ticket_number}</span>
                          </div>
                          <p className="text-[10px] text-slate-400">
                            {new Date(op.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} · {op.camarero_nombre}
                          </p>
                        </div>
                        <div className="text-right space-y-1">
                          <span className="font-mono font-bold text-white text-sm block">
                            {Number(op.total_ticket).toFixed(2)} €
                          </span>
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded flex items-center justify-center gap-1 w-max ml-auto ${
                            op.metodo_pago === 'efectivo' 
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                              : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                          }`}>
                            {op.metodo_pago === 'efectivo' ? <DollarSign className="h-3 w-3" /> : <CreditCard className="h-3 w-3" />}
                            {op.metodo_pago}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="space-y-4 pt-6 border-t border-white/10">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-amber-400">
                    Efectivo Real Contado (€)
                  </label>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={efectivoRealInput} 
                    onChange={(e) => setEfectivoRealInput(e.target.value)} 
                    className="w-full bg-black/60 border border-amber-500/40 rounded-xl px-4 py-3 text-lg font-mono font-bold text-amber-400 focus:border-amber-400"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300">
                    Fondo a dejar para mañana (€)
                  </label>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={remanenteCierreInput} 
                    onChange={(e) => setRemanenteCierreInput(e.target.value)} 
                    className="w-full bg-black/60 border border-white/20 rounded-xl px-4 py-3 text-lg font-mono font-bold text-white focus:border-cyan-400"
                  />
                </div>
              </div>
              
              <button 
                onClick={() => cerrarCajaEspecifica(cajaHoy)} 
                className="w-full py-4 rounded-xl bg-rose-600 text-white font-black text-sm uppercase flex items-center justify-center gap-2 cursor-pointer"
              >
                <Lock className="h-5 w-5" /> Cerrar Caja y Terminar Turno
              </button>
            </div>
          ) : !cajaAtrasada && cajaHoy && cajaHoy.estado === 'cerrada' ? (
             <div className="p-8 rounded-3xl bg-[#0d0f17] border border-white/10 text-center space-y-4 shadow-xl">
               <Lock className="h-12 w-12 text-slate-600 mx-auto" />
               <h2 className="text-xl font-bold text-white">Caja Cerrada</h2>
               <p className="text-sm text-slate-400">
                 Turno de hoy cerrado. Descuadre: {Number(cajaHoy.descuadre).toFixed(2)} €.
               </p>
             </div>
          ) : null}
        </main>
      )}
    </div>
  );
}