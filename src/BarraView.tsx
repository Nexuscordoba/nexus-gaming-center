// src/BarraView.tsx
import { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabase';
import {
  cargarTicketsBarraAbiertos,
  generarSiguienteNumeroTicketBarra,
  crearTicketBarra,
  actualizarTicketBarra,
  cancelarTicketBarra,
  cobrarTicketBarra,
  imprimirComandaTicketBarra,
  type TicketBarra,
  type TicketBarraItem
} from './barraService';
import {
  type ConfiguracionFiscal,
  abrirCajonPortamonedasRawBT,
  redondearMoneda
} from './fiscalService';
import CobroModal from './CobroModal';
import {
  Beer,
  Plus,
  Minus,
  Trash2,
  Printer,
  CreditCard,
  CheckCircle2,
  Clock,
  Search,
  X,
  Save,
  Zap,
  Edit,
  RefreshCw,
  ShoppingBag
} from 'lucide-react';

interface ProductoSimple {
  id: number;
  nombre: string;
  precio: number;
  categoria: string;
  destino: 'cocina' | 'barra';
  imagen_url?: string;
  codigo_barras?: string;
  tipo_iva?: number;
  porcentaje_iva?: number;
  articulo_inventario_id?: string;
}

interface BarraViewProps {
  productos: ProductoSimple[];
  camareroNombre: string;
  configFiscal?: ConfiguracionFiscal | null;
  cajaHoyId?: number;
  onAlerta?: (mensaje: string, tipo: 'exito' | 'error' | 'aviso') => void;
  modoIncrustado?: boolean; // Si se muestra como pestaña dentro de TableWaiter
}

export default function BarraView({
  productos,
  camareroNombre,
  configFiscal,
  cajaHoyId,
  onAlerta,
  modoIncrustado = false
}: BarraViewProps) {
  // Estado de tickets abiertos en tiempo real
  const [ticketsAbiertos, setTicketsAbiertos] = useState<TicketBarra[]>([]);
  const [cargandoTickets, setCargandoTickets] = useState(false);

  // Estado del ticket en edición / creación
  const [ticketEnEdicionId, setTicketEnEdicionId] = useState<string | null>(null);
  const [aliasInput, setAliasInput] = useState('');
  const [itemsComanda, setItemsComanda] = useState<TicketBarraItem[]>([]);

  // Filtros de productos para la comanda rápida
  const [categoriaActiva, setCategoriaActiva] = useState<string>('Todas');
  const [busqueda, setBusqueda] = useState('');

  // Modal de cobro
  const [modalCobroTicket, setModalCobroTicket] = useState<TicketBarra | null>(null);
  const [procesandoCobro, setProcesandoCobro] = useState(false);

  // Estados de impresión / acción
  const [imprimiendoId, setImprimiendoId] = useState<string | null>(null);

  // Carga inicial y suscripción Realtime a Supabase
  const refrescarTickets = async () => {
    setCargandoTickets(true);
    try {
      const tickets = await cargarTicketsBarraAbiertos();
      setTicketsAbiertos(tickets);
    } catch (err) {
      console.warn('Error al refrescar tickets barra:', err);
    } finally {
      setCargandoTickets(false);
    }
  };

  useEffect(() => {
    refrescarTickets();

    // Suscripción Realtime a cambios en la tabla tickets_barra
    const canal = supabase
      .channel('realtime_tickets_barra')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tickets_barra' },
        () => {
          refrescarTickets();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, []);

  // Categorías calculadas
  const categoriasDisponibles = useMemo(() => {
    const cats = Array.from(new Set(productos.map((p) => p.categoria || 'Varios'))).filter(Boolean);
    return ['Todas', ...cats];
  }, [productos]);

  // Productos filtrados
  const productosFiltrados = useMemo(() => {
    return productos.filter((p) => {
      const coincideCat = categoriaActiva === 'Todas' || p.categoria === categoriaActiva;
      const coincideBusqueda =
        !busqueda ||
        p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        (p.codigo_barras && p.codigo_barras.includes(busqueda));
      return coincideCat && coincideBusqueda;
    });
  }, [productos, categoriaActiva, busqueda]);

  // Total de la comanda en preparación
  const totalComandaActual = useMemo(() => {
    return redondearMoneda(
      itemsComanda.reduce((acc, item) => acc + Number(item.precio) * item.cantidad, 0)
    );
  }, [itemsComanda]);

  // Añadir producto al borrador
  const agregarProducto = (p: ProductoSimple) => {
    setItemsComanda((prev) => {
      const index = prev.findIndex((it) => it.producto_id === p.id);
      if (index !== -1) {
        const copia = [...prev];
        copia[index] = { ...copia[index], cantidad: copia[index].cantidad + 1 };
        return copia;
      }
      return [
        ...prev,
        {
          idCarritoUnico: Date.now() + Math.random(),
          producto_id: p.id,
          articulo_inventario_id: p.articulo_inventario_id,
          nombre: p.nombre,
          precio: Number(p.precio),
          cantidad: 1,
          destino: p.destino,
          tipo_iva: p.tipo_iva,
          porcentaje_iva: p.porcentaje_iva
        }
      ];
    });
  };

  const modificarCantidad = (index: number, delta: number) => {
    setItemsComanda((prev) => {
      const item = prev[index];
      if (!item) return prev;
      const nuevaCantidad = item.cantidad + delta;
      if (nuevaCantidad <= 0) {
        return prev.filter((_, i) => i !== index);
      }
      const copia = [...prev];
      copia[index] = { ...copia[index], cantidad: nuevaCantidad };
      return copia;
    });
  };

  const eliminarItem = (index: number) => {
    setItemsComanda((prev) => prev.filter((_, i) => i !== index));
  };

  const limpiarBorrador = () => {
    setItemsComanda([]);
    setAliasInput('');
    setTicketEnEdicionId(null);
  };

  // Guardar como cuenta abierta en barra
  const guardarCuentaBarra = async () => {
    if (itemsComanda.length === 0) {
      onAlerta?.('Añade al menos un producto a la comanda de barra.', 'aviso');
      return;
    }

    try {
      if (ticketEnEdicionId) {
        // Actualizar ticket existente
        await actualizarTicketBarra(ticketEnEdicionId, {
          cliente_alias: aliasInput.trim() || 'Barra',
          items: itemsComanda,
          total: totalComandaActual
        });
        onAlerta?.('Cuenta de barra actualizada correctamente.', 'exito');
      } else {
        // Crear nuevo ticket correlativo
        const numero = await generarSiguienteNumeroTicketBarra();
        const nuevo = await crearTicketBarra({
          numero_ticket: numero,
          cliente_alias: aliasInput.trim() || 'Barra',
          items: itemsComanda,
          total: totalComandaActual,
          camarero_nombre: camareroNombre
        });
        onAlerta?.(`¡Ticket de Barra ${nuevo.numero_ticket} abierto correctamente!`, 'exito');
      }

      // Solo si tuvo éxito en Supabase limpiamos el formulario y refrescamos
      limpiarBorrador();
      await refrescarTickets();
    } catch (err: any) {
      console.error('❌ Error al guardar el ticket de barra en Supabase:', err);
      const errMsg = err?.message || 'Error desconocido al guardar en Supabase';
      onAlerta?.(`❌ Error al guardar en barra: ${errMsg}`, 'error');
    }
  };

  // Abrir modal de cobro directo desde el borrador
  const abrirCobroDirectoBorrador = async () => {
    if (itemsComanda.length === 0) {
      onAlerta?.('Añade al menos un producto antes de cobrar.', 'aviso');
      return;
    }

    // Creamos temporalmente el objeto ticket para cobrarlo de inmediato
    const numero = ticketEnEdicionId
      ? ticketsAbiertos.find((t) => t.id === ticketEnEdicionId)?.numero_ticket || 'B-01'
      : await generarSiguienteNumeroTicketBarra();

    const ticketTemporal: TicketBarra = {
      id: ticketEnEdicionId || `temp_${Date.now()}`,
      numero_ticket: numero,
      cliente_alias: aliasInput.trim() || 'Barra',
      items: itemsComanda,
      total: totalComandaActual,
      estado: 'abierto',
      camarero_nombre: camareroNombre,
      created_at: new Date().toISOString()
    };

    setModalCobroTicket(ticketTemporal);
  };

  // Abrir cobro de un ticket abierto existente
  const abrirCobroTicketExistente = (t: TicketBarra) => {
    setModalCobroTicket(t);
  };

  // Confirmar cobro y cierre de ticket
  const confirmarCobro = async (metodo: 'efectivo' | 'tarjeta' | 'bizum') => {
    if (!modalCobroTicket || procesandoCobro) return;

    setProcesandoCobro(true);
    try {
      let ticketFinal = modalCobroTicket;

      // Si el ticket aún no estaba guardado en BD, crearlo primero
      if (modalCobroTicket.id.startsWith('temp_')) {
        ticketFinal = await crearTicketBarra({
          numero_ticket: modalCobroTicket.numero_ticket,
          cliente_alias: modalCobroTicket.cliente_alias,
          items: modalCobroTicket.items,
          total: modalCobroTicket.total,
          camarero_nombre: camareroNombre
        });
      }

      const res = await cobrarTicketBarra({
        ticket: ticketFinal,
        metodo,
        camareroNombre,
        configFiscal,
        cajaHoyId
      });

      if (res.ok) {
        onAlerta?.(
          `¡Ticket ${ticketFinal.numero_ticket} cobrado (${ticketFinal.total.toFixed(2)} €) en ${metodo.toUpperCase()}!`,
          'exito'
        );
        // Si estábamos editando este ticket en el borrador, limpiarlo
        if (ticketEnEdicionId === ticketFinal.id || modalCobroTicket.id.startsWith('temp_')) {
          limpiarBorrador();
        }
        setModalCobroTicket(null);
        await refrescarTickets();
      } else {
        onAlerta?.(`Error al procesar cobro: ${res.error || 'Desconocido'}`, 'error');
      }
    } catch (err: any) {
      console.error('❌ Error cobrando ticket de barra en Supabase:', err);
      const errMsg = err?.message || 'Error inesperado al cobrar ticket de barra';
      onAlerta?.(`❌ Error al procesar cobro: ${errMsg}`, 'error');
    } finally {
      setProcesandoCobro(false);
    }
  };

  // Cargar ticket abierto en borrador para modificarlo
  const editarTicket = (t: TicketBarra) => {
    setTicketEnEdicionId(t.id);
    setAliasInput(t.cliente_alias === 'Barra' ? '' : t.cliente_alias || '');
    setItemsComanda(t.items || []);
  };

  // Imprimir comanda / ticket previo
  const manejarImprimirComanda = (t: TicketBarra) => {
    setImprimiendoId(t.id);
    try {
      imprimirComandaTicketBarra(t, configFiscal, camareroNombre, () => {
        setImprimiendoId(null);
      });
      onAlerta?.(`Enviando comanda ${t.numero_ticket} a la impresora...`, 'exito');
    } catch (err) {
      console.error(err);
      setImprimiendoId(null);
    }
  };

  // Cancelar ticket
  const manejarCancelarTicket = async (t: TicketBarra) => {
    if (!window.confirm(`¿Seguro que deseas cancelar el ticket de barra ${t.numero_ticket}?`)) {
      return;
    }
    await cancelarTicketBarra(t.id);
    if (ticketEnEdicionId === t.id) {
      limpiarBorrador();
    }
    await refrescarTickets();
    onAlerta?.(`Ticket ${t.numero_ticket} cancelado.`, 'aviso');
  };

  return (
    <div className={`space-y-6 ${modoIncrustado ? '' : 'p-4 max-w-7xl mx-auto'}`}>
      {/* BARRA SUPERIOR DE ACCIONES RÁPIDAS */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#0d0f17] p-4 rounded-3xl border border-white/10 shadow-xl">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="h-12 w-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shadow-[0_0_15px_rgba(245,158,11,0.2)]">
            <Beer className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <span>TPV DE BARRA · CUENTAS RÁPIDAS</span>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs border border-amber-500/30">
                Independiente de mesas
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Gestión directa de cañas, tapas y cafés sin bloquear el plano de salón.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={() => {
              abrirCajonPortamonedasRawBT();
              onAlerta?.('Pulso de apertura enviado al cajón portamonedas.', 'exito');
            }}
            title="Abrir cajón portamonedas (ESC/POS Raw Print)"
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 font-bold text-xs cursor-pointer transition-all"
          >
            <span>Abrir cajón</span>
          </button>
          <button
            type="button"
            onClick={limpiarBorrador}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(245,158,11,0.35)] cursor-pointer transition-all"
          >
            <Plus className="h-4 w-4 stroke-[3]" />
            <span>🍺 Nuevo Ticket de Barra</span>
          </button>
          <button
            type="button"
            onClick={refrescarTickets}
            disabled={cargandoTickets}
            title="Refrescar cuentas de barra"
            className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${cargandoTickets ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* CONTENEDOR PRINCIPAL DIVIDIDO: COMANDA RÁPIDA (IZQ) Y CUENTAS ABIERTAS (DER) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* COLUMNA IZQUIERDA: COMANDA RÁPIDA Y CATÁLOGO DE PRODUCTOS (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* PANEL DE NUEVO TICKET / COMANDA EN CURSO */}
          <div className="bg-[#0d0f17] p-4 rounded-3xl border border-white/10 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-amber-400" />
                <span className="text-xs font-black uppercase tracking-wider text-slate-300">
                  {ticketEnEdicionId ? 'Modificando Ticket de Barra' : 'Comanda Rápida de Barra'}
                </span>
              </div>
              {ticketEnEdicionId && (
                <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/30">
                  Editando ticket activo
                </span>
              )}
            </div>

            {/* ALIAS / CLIENTE */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={aliasInput}
                onChange={(e) => setAliasInput(e.target.value)}
                placeholder="Alias o cliente (ej: Javier - Cerveza, Barra 3... opcional)"
                className="flex-1 bg-black/60 border border-white/15 focus:border-amber-400 rounded-2xl px-4 py-2 text-xs text-white placeholder-slate-500 outline-none transition-all"
              />
              {aliasInput && (
                <button
                  type="button"
                  onClick={() => setAliasInput('')}
                  className="p-2 rounded-xl text-slate-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* ARTÍCULOS EN LA COMANDA */}
            {itemsComanda.length === 0 ? (
              <div className="py-8 text-center border-2 border-dashed border-white/10 rounded-2xl text-slate-500 space-y-1">
                <Beer className="h-8 w-8 mx-auto opacity-30 text-amber-400" />
                <p className="text-xs font-bold">Comanda vacía</p>
                <p className="text-[11px] text-slate-500">Pulsa en cualquier artículo abajo para añadirlo a la barra</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {itemsComanda.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-2 p-2.5 rounded-2xl bg-white/5 border border-white/5 hover:border-white/15 transition-all text-xs"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-white truncate">{item.nombre}</p>
                      <p className="text-[10px] text-slate-400">
                        {item.precio.toFixed(2)} € · Subtotal: {(item.precio * item.cantidad).toFixed(2)} €
                        {item.destino === 'cocina' && (
                          <span className="ml-1.5 px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-semibold">
                            Cocina
                          </span>
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => modificarCantidad(idx, -1)}
                        className="w-7 h-7 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center font-bold"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-6 text-center font-black text-amber-400 text-sm">
                        {item.cantidad}
                      </span>
                      <button
                        type="button"
                        onClick={() => modificarCantidad(idx, 1)}
                        className="w-7 h-7 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center font-bold"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => eliminarItem(idx)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors ml-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TOTAL Y BOTONES DE ACCIÓN DE LA COMANDA */}
            {itemsComanda.length > 0 && (
              <div className="pt-3 border-t border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase font-bold text-slate-400">Total Comanda:</span>
                  <span className="text-2xl font-black text-amber-400">
                    {totalComandaActual.toFixed(2)} €
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={guardarCuentaBarra}
                    className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-300 font-black text-xs uppercase tracking-wider transition-all cursor-pointer"
                  >
                    <Save className="h-4 w-4" />
                    <span>💾 Guardar en Barra</span>
                  </button>
                  <button
                    type="button"
                    onClick={abrirCobroDirectoBorrador}
                    className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all cursor-pointer"
                  >
                    <Zap className="h-4 w-4 stroke-[3]" />
                    <span>⚡ Cobro Rápido</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* CATÁLOGO RÁPIDO DE ARTÍCULOS */}
          <div className="bg-[#0d0f17] p-4 rounded-3xl border border-white/10 shadow-xl space-y-3">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                Artículos de Cafetería y Barra:
              </span>
              <div className="relative w-full sm:w-56">
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar producto..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="w-full bg-black/60 border border-white/15 focus:border-amber-400 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white outline-none"
                />
              </div>
            </div>

            {/* PÍLDORAS DE CATEGORÍA */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {categoriasDisponibles.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoriaActiva(cat)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    categoriaActiva === cat
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'bg-white/5 hover:bg-white/10 text-slate-400'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* REJILLA DE PRODUCTOS */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-96 overflow-y-auto pr-1">
              {productosFiltrados.slice(0, 48).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => agregarProducto(p)}
                  className="p-3 rounded-2xl bg-white/5 hover:bg-amber-500/20 border border-white/10 hover:border-amber-500/50 text-left transition-all cursor-pointer flex flex-col justify-between group active:scale-95"
                >
                  <div>
                    <p className="font-bold text-white text-xs group-hover:text-amber-300 transition-colors line-clamp-2">
                      {p.nombre}
                    </p>
                    <span className="text-[10px] text-slate-500 block capitalize">
                      {p.categoria}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="font-black text-amber-400 text-xs">
                      {Number(p.precio).toFixed(2)} €
                    </span>
                    <span className="h-6 w-6 rounded-lg bg-white/10 group-hover:bg-amber-500 group-hover:text-slate-950 text-white flex items-center justify-center transition-all">
                      <Plus className="h-3.5 w-3.5 stroke-[3]" />
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA: PANEL DE CUENTAS DE BARRA ABIERTAS (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-[#0d0f17] p-4 rounded-3xl border border-white/10 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-cyan-400" />
                <h3 className="text-xs font-black uppercase tracking-wider text-white">
                  Cuentas de Barra Abiertas
                </h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-xs font-black">
                {ticketsAbiertos.length} activas
              </span>
            </div>

            {/* LISTA DE TICKETS ABIERTOS */}
            {ticketsAbiertos.length === 0 ? (
              <div className="py-12 text-center text-slate-500 space-y-2">
                <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-500/40" />
                <p className="text-xs font-bold text-slate-400">¡Barra al día!</p>
                <p className="text-[11px] text-slate-600">
                  No hay tickets de barra pendientes de cobro en este momento.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[700px] overflow-y-auto pr-1">
                {ticketsAbiertos.map((t) => {
                  const fecha = new Date(t.created_at);
                  const hora = fecha.toLocaleTimeString('es-ES', {
                    hour: '2-digit',
                    minute: '2-digit'
                  });

                  return (
                    <div
                      key={t.id}
                      className="bg-black/60 rounded-2xl border border-white/10 hover:border-amber-500/40 p-3.5 space-y-3 transition-all shadow-md"
                    >
                      {/* CABECERA DEL TICKET */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 font-black text-xs border border-amber-500/30">
                              {t.numero_ticket}
                            </span>
                            <span className="font-bold text-white text-xs truncate max-w-[150px]">
                              {t.cliente_alias || 'Cliente Barra'}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500 flex items-center gap-1 mt-1">
                            <Clock className="h-3 w-3" /> Abierto a las {hora}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-lg font-black text-amber-400 block">
                            {Number(t.total).toFixed(2)} €
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {t.items?.length || 0} producto(s)
                          </span>
                        </div>
                      </div>

                      {/* DETALLE COMPACTO DE ARTÍCULOS */}
                      <div className="bg-white/5 rounded-xl p-2 text-[11px] text-slate-300 space-y-1">
                        {t.items?.map((it, idx) => (
                          <div key={idx} className="flex justify-between items-center">
                            <span className="truncate pr-2">
                              {it.cantidad}x {it.nombre}
                            </span>
                            <span className="font-mono text-slate-400 shrink-0">
                              {(it.precio * it.cantidad).toFixed(2)} €
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* BOTONES DIRECTOS: COBRAR, IMPRIMIR, EDITAR Y CANCELAR */}
                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/5">
                        <button
                          type="button"
                          onClick={() => manejarImprimirComanda(t)}
                          disabled={imprimiendoId === t.id}
                          className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold transition-all cursor-pointer"
                        >
                          <Printer className="h-3.5 w-3.5" />
                          <span>{imprimiendoId === t.id ? 'Imprimiendo...' : '🖨️ Ticket'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => abrirCobroTicketExistente(t)}
                          className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black transition-all cursor-pointer shadow-md"
                        >
                          <CreditCard className="h-3.5 w-3.5" />
                          <span>💳 Cobrar</span>
                        </button>
                      </div>

                      <div className="flex justify-between items-center text-[10px] pt-1 text-slate-500">
                        <button
                          type="button"
                          onClick={() => editarTicket(t)}
                          className="hover:text-amber-400 flex items-center gap-1 cursor-pointer"
                        >
                          <Edit className="h-3 w-3" /> Añadir más artículos
                        </button>
                        <button
                          type="button"
                          onClick={() => manejarCancelarTicket(t)}
                          className="hover:text-rose-400 flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3" /> Cancelar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL DE COBRO DE TICKET DE BARRA UNIFICADO */}
      {modalCobroTicket && (
        <CobroModal
          identificador={`TICKET ${modalCobroTicket.numero_ticket}`}
          subtitulo={modalCobroTicket.cliente_alias || 'Cliente Barra'}
          total={modalCobroTicket.total}
          procesando={procesandoCobro}
          onConfirmarCobro={(metodo) => confirmarCobro(metodo)}
          onCerrar={() => setModalCobroTicket(null)}
        />
      )}
    </div>
  );
}
