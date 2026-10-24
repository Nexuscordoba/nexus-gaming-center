// src/TableWaiter.tsx
import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import LoyverseDashboard from './LoyverseDashboard';
import {
  obtenerConfiguracionFiscal,
  imprimirDocumentoFiscalHTML,
  type ConfiguracionFiscal,
  type LineaTicketFiscal
} from './fiscalService';
import {
  Utensils,
  Plus,
  Minus,
  Send,
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
  ClipboardList,
  Printer,
  Info,
  Percent,
  ShieldCheck,
  RotateCcw,
  FileText,
  Settings,
  Barcode
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
  categoria: string;
  destino: 'cocina' | 'barra';
  es_combo?: boolean;
  opciones_combo?: PasoCombo[];
  loyverse_variant_id?: string;
  imagen_url?: string;
  codigo_barras?: string;
  controla_stock?: boolean;
  stock_actual?: number;
  unidad_medida?: string;
  tipo_iva?: number;
  articulo_inventario_id?: string;
}

interface ItemPedido {
  producto_id?: number;
  articulo_inventario_id?: string;
  nombre: string;
  precio: number;
  cantidad: number;
  destino: string;
  descuento_porcentaje?: number;
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

interface AlertaPersonalizada {
  id: number;
  mensaje: string;
  tipo: 'exito' | 'error' | 'aviso';
}

export default function TableWaiter({ onBack }: TableWaiterProps) {
  const [camareroActivo, setCamareroActivo] = useState<{ id: string; nombre: string; rol: string } | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [loginError, setLoginError] = useState(false);
  const [mostrarBackoffice, setMostrarBackoffice] = useState(false);

  const [configFiscal, setConfigFiscal] = useState<ConfiguracionFiscal | null>(null);
  const [mesaSeleccionada, setMesaSeleccionada] = useState<string>('1');
  const [productosCarta, setProductosCarta] = useState<Producto[]>([]);
  const [categoriasDisponibles, setCategoriasDisponibles] = useState<string[]>(['Cafetería', 'Tapas', 'Menús/Combos', 'Bebidas']);
  const [categoriaActiva, setCategoriaActiva] = useState<string>('Cafetería');
  const [busquedaCodigoBarras, setBusquedaCodigoBarras] = useState('');
  const [loadingCarta, setLoadingCarta] = useState(true);
  const [cocinaAbierta, setCocinaAbierta] = useState(true);

  const [carritoActual, setCarritoActual] = useState<Array<Producto & { cantidad: number }>>([]);
  const [mesasAbiertas, setMesasAbiertas] = useState<MesaAbierta[]>([]);
  const [cuentaMesaActual, setCuentaMesaActual] = useState<ItemPedido[]>([]);

  const [descuentosLineas, setDescuentosLineas] = useState<Record<string, number>>({});
  const [descuentoGeneralMesa, setDescuentoGeneralMesa] = useState<Record<string, number>>({});
  const [autorizadorDescuentoMesa, setAutorizadorDescuentoMesa] = useState<Record<string, string>>({});

  const [modalAuthDescuento, setModalAuthDescuento] = useState<{
    abierto: boolean;
    tipo: 'linea' | 'general';
    mesaKey: string;
    itemNombre?: string;
    porcentajePropuesto: string;
    pinAdmin: string;
  } | null>(null);

  const [modalRectificativa, setModalRectificativa] = useState<{
    factura: any;
    motivo: string;
    pinAdmin: string;
    procesando: boolean;
  } | null>(null);

  const [modalFacturaNominativa, setModalFacturaNominativa] = useState<{
    factura: any;
    razonSocial: string;
    nifCif: string;
    direccion: string;
    procesando: boolean;
  } | null>(null);

  const [comboActivo, setComboActivo] = useState<Producto | null>(null);
  const [pasoComboActual, setPasoComboActual] = useState(0);
  const [seleccionesCombo, setSeleccionesCombo] = useState<Record<number, OpcionCombo>>({});

  const [cajaHoy, setCajaHoy] = useState<CajaDiaria | null>(null);
  const [cajaAtrasada, setCajaAtrasada] = useState<CajaDiaria | null>(null);
  const [facturasHoy, setFacturasHoy] = useState<any[]>([]);
  const [remanenteAperturaInput, setRemanenteAperturaInput] = useState<string>('50.00');
  const [efectivoRealInput, setEfectivoRealInput] = useState<string>('');
  const [remanenteCierreInput, setRemanenteCierreInput] = useState<string>('50.00');

  const [enviando, setEnviando] = useState(false);
  const [imprimiendoPreTicket, setImprimiendoPreTicket] = useState(false);
  const [vistaSeccion, setVistaSeccion] = useState<'tomar_nota' | 'mesas_abiertas' | 'caja'>('tomar_nota');

  const [alertaFlotante, setAlertaFlotante] = useState<AlertaPersonalizada | null>(null);

  const mostrarAlerta = (mensaje: string, tipo: 'exito' | 'error' | 'aviso' = 'aviso') => {
    const id = Date.now();
    setAlertaFlotante({ id, mensaje, tipo });
    setTimeout(() => {
      setAlertaFlotante((prev) => (prev?.id === id ? null : prev));
    }, 4500);
  };

  useEffect(() => {
    const initSesion = async () => {
      const cfg = await obtenerConfiguracionFiscal();
      setConfigFiscal(cfg);

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

  const loginCamarero = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(false);

    const { data } = await supabase
      .from('empleados')
      .select('*')
      .eq('pin_acceso', pinInput)
      .eq('activo', true)
      .maybeSingle();

    if (data) {
      const usuario = { id: data.id, nombre: data.nombre, rol: data.rol || 'empleado' };
      setCamareroActivo(usuario);
      sessionStorage.setItem('nexus_camarero_sesion', JSON.stringify(usuario));

      cargarConfiguracion();
      cargarProductosCarta();
      cargarMesasAbiertas();
      cargarCaja();
    } else {
      setLoginError(true);
    }
  };

  useEffect(() => {
    if (!camareroActivo) return;

    const channel = supabase
      .channel('realtime-waiter')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comandas_cocina' }, () => {
        cargarMesasAbiertas();
        cargarCaja();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'facturas_tickets' }, () => {
        cargarCaja();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'productos_carta' }, () => {
        cargarProductosCarta();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'configuracion_local' }, () => {
        cargarConfiguracion();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [camareroActivo]);

  useEffect(() => {
    const encontrada = mesasAbiertas.find((m) => m.mesa === `MESA ${mesaSeleccionada}`);
    if (encontrada && encontrada.items) {
      setCuentaMesaActual(encontrada.items);
    } else {
      setCuentaMesaActual([]);
    }
    setCarritoActual([]);
  }, [mesaSeleccionada, mesasAbiertas]);

  const cargarConfiguracion = async () => {
    const { data } = await supabase.from('configuracion_local').select('*').eq('id', 1).maybeSingle();
    if (data) {
      setCocinaAbierta(data.cocina_abierta);
    }
  };

  const toggleCocina = async () => {
    const nuevoEstado = !cocinaAbierta;
    await supabase.from('configuracion_local').update({ cocina_abierta: nuevoEstado }).eq('id', 1);
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

    const { data: cats } = await supabase
      .from('categorias_cafeteria')
      .select('nombre')
      .eq('activo', true)
      .neq('nombre', 'Materia Prima (Interno)')
      .order('orden', { ascending: true });

    if (cats && cats.length > 0) {
      setCategoriasDisponibles(cats.map((c) => c.nombre));
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
      const cajaDeHoy = todasLasCajas.find((c) => c.fecha === fechaHoy);
      if (cajaDeHoy) {
        setCajaHoy(cajaDeHoy as CajaDiaria);
      } else {
        setCajaHoy(null);
      }

      const cajaAntiguaAbierta = todasLasCajas.find((c) => c.estado === 'abierta' && c.fecha !== fechaHoy);
      if (cajaAntiguaAbierta) {
        setCajaAtrasada(cajaAntiguaAbierta as CajaDiaria);
      } else {
        setCajaAtrasada(null);
        if (!cajaDeHoy && todasLasCajas[0]) {
          setRemanenteAperturaInput(todasLasCajas[0].remanente_cierre.toString());
        }
      }
    }

    const { data: fData } = await supabase
      .from('facturas_tickets')
      .select('*')
      .gte('fecha_expedicion', fechaHoy + 'T00:00:00Z')
      .order('fecha_expedicion', { ascending: false });

    if (fData) {
      setFacturasHoy(fData);
    }
  };

  const cargarMesasAbiertas = async () => {
    const { data } = await supabase.from('comandas_cocina').select('*').eq('pagado', false);

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
            const existente = mapMesas[mKey].items.find((x) => x.nombre === it.nombre);
            if (existente) {
              existente.cantidad += it.cantidad || 1;
            } else {
              mapMesas[mKey].items.push({
                producto_id: it.producto_id,
                articulo_inventario_id: it.articulo_inventario_id,
                nombre: it.nombre,
                precio: it.precio || 0,
                cantidad: it.cantidad || 1,
                destino: row.tipo_destino
              });
            }
          });
        }
      });

      const listado = Object.values(mapMesas).map((m) => {
        const total = m.items.reduce((acc, i) => acc + i.precio * i.cantidad, 0);
        return { ...m, total_ticket: total };
      });

      setMesasAbiertas(listado.filter((m) => m.total_ticket > 0));
    }
  };

  const calcularDesgloseMesa = (mesaKey: string, itemsRaw: ItemPedido[]) => {
    let subtotalBruto = 0;
    let subtotalTrasLineas = 0;

    const lineasCalculadas: LineaTicketFiscal[] = itemsRaw
      .filter((it) => !it.nombre.includes('├─') && it.precio > 0)
      .map((it) => {
        const claveLinea = `${mesaKey}__${it.nombre}`;
        const dtoLinea = descuentosLineas[claveLinea] || 0;
        const bruto = Number(it.precio) * Number(it.cantidad);
        const netoLinea = Number((bruto * (1 - dtoLinea / 100)).toFixed(2));
        subtotalBruto += bruto;
        subtotalTrasLineas += netoLinea;

        const prodCarta = productosCarta.find((p) => p.nombre.trim() === it.nombre.trim());

        return {
          articulo_id: it.articulo_inventario_id || prodCarta?.articulo_inventario_id || undefined,
          nombre: it.nombre,
          cantidad: it.cantidad,
          precio_unitario: Number(it.precio),
          descuento_porcentaje: dtoLinea,
          subtotal_linea: netoLinea,
          tipo_iva: prodCarta?.tipo_iva || configFiscal?.iva_defecto || 10
        };
      });

    const dtoGeneralPorc = descuentoGeneralMesa[mesaKey] || 0;
    const totalFinal = Number((subtotalTrasLineas * (1 - dtoGeneralPorc / 100)).toFixed(2));
    const descuentoTotalImporte = Number((subtotalBruto - totalFinal).toFixed(2));

    return {
      subtotalBruto: Number(subtotalBruto.toFixed(2)),
      dtoGeneralPorc,
      descuentoTotalImporte,
      totalFinal,
      lineasCalculadas
    };
  };

  const verificarAutorizacionAdmin = async (pinIntroducido: string): Promise<string | null> => {
    if (camareroActivo?.rol === 'admin') {
      return camareroActivo.nombre;
    }
    const pinLimpio = pinIntroducido.trim();
    if (!pinLimpio) return null;

    const { data: empAdmin } = await supabase
      .from('empleados')
      .select('nombre, apellidos')
      .eq('pin_acceso', pinLimpio)
      .eq('rol', 'admin')
      .eq('activo', true)
      .maybeSingle();

    if (empAdmin) {
      return `${empAdmin.nombre} ${empAdmin.apellidos || ''}`.trim();
    }

    const cfg = configFiscal || (await obtenerConfiguracionFiscal());
    if (cfg.pin_administrador === pinLimpio) {
      return 'Administrador Maestro';
    }

    return null;
  };

  const aplicarDescuentoAutorizado = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalAuthDescuento) return;

    const porc = Math.max(0, Math.min(100, parseFloat(modalAuthDescuento.porcentajePropuesto) || 0));
    const nombreAdmin = await verificarAutorizacionAdmin(modalAuthDescuento.pinAdmin);

    if (!nombreAdmin) {
      mostrarAlerta('PIN de Administrador incorrecto o sin permisos de administrador.', 'error');
      return;
    }

    if (modalAuthDescuento.tipo === 'linea' && modalAuthDescuento.itemNombre) {
      const claveLinea = `${modalAuthDescuento.mesaKey}__${modalAuthDescuento.itemNombre}`;
      setDescuentosLineas((prev) => ({ ...prev, [claveLinea]: porc }));
    } else {
      setDescuentoGeneralMesa((prev) => ({ ...prev, [modalAuthDescuento.mesaKey]: porc }));
    }

    setAutorizadorDescuentoMesa((prev) => ({
      ...prev,
      [modalAuthDescuento.mesaKey]: nombreAdmin
    }));

    mostrarAlerta(`Descuento del ${porc}% autorizado por ${nombreAdmin}.`, 'exito');
    setModalAuthDescuento(null);
  };

  const clickAgregarAlCarrito = (prod: Producto) => {
    if (prod.controla_stock && Number(prod.stock_actual) <= 0) {
      mostrarAlerta(`Atención: "${prod.nombre}" figura con stock agotado (${prod.stock_actual}).`, 'aviso');
    }

    if (prod.es_combo && prod.opciones_combo && prod.opciones_combo.length > 0) {
      setComboActivo(prod);
      setPasoComboActual(0);
      setSeleccionesCombo({});
    } else {
      setCarritoActual((prev) => {
        const existe = prev.find((p) => p.id === prod.id);
        if (existe) {
          return prev.map((p) => (p.id === prod.id ? { ...p, cantidad: p.cantidad + 1 } : p));
        }
        return [...prev, { ...prod, cantidad: 1 }];
      });
    }
  };

  const manejarEscaneoCodigoBarras = (e: React.FormEvent) => {
    e.preventDefault();
    const codigo = busquedaCodigoBarras.trim();
    if (!codigo) return;

    const encontrado = productosCarta.find((p) => (p.codigo_barras || '').trim() === codigo);
    if (encontrado) {
      clickAgregarAlCarrito(encontrado);
      setBusquedaCodigoBarras('');
      mostrarAlerta(`Añadido por código: ${encontrado.nombre}`, 'exito');
    } else {
      mostrarAlerta(`No existe ningún artículo con el código de barras "${codigo}".`, 'aviso');
    }
  };

  const confirmarCombo = (seleccionesFinales: Record<number, OpcionCombo>) => {
    if (!comboActivo) return;

    const baseId = Date.now();
    const itemsNuevos: Array<Producto & { cantidad: number }> = [];

    itemsNuevos.push({
      ...comboActivo,
      id: baseId,
      cantidad: 1
    });

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

    setCarritoActual((prev) => [...prev, ...itemsNuevos]);
    setComboActivo(null);
    setSeleccionesCombo({});
    setPasoComboActual(0);
  };

  const cambiarCantidadCarrito = (id: number, delta: number) => {
    setCarritoActual((prev) =>
      prev
        .map((p) => {
          if (p.id === id) {
            const nuevaCant = p.cantidad + delta;
            return nuevaCant > 0 ? { ...p, cantidad: nuevaCant } : null;
          }
          return p;
        })
        .filter(Boolean) as any
    );
  };

  const totalCarritoActual = carritoActual.reduce((acc, item) => acc + Number(item.precio) * item.cantidad, 0);
  const desgloseMesaSeleccionada = calcularDesgloseMesa(
    `MESA ${mesaSeleccionada}`,
    cuentaMesaActual.concat(
      carritoActual.map((c) => ({
        producto_id: c.id,
        articulo_inventario_id: c.articulo_inventario_id,
        nombre: c.nombre,
        precio: Number(c.precio),
        cantidad: c.cantidad,
        destino: c.destino
      }))
    )
  );

  const enviarPedidoCamarero = async () => {
    if (carritoActual.length === 0 || !camareroActivo) return;
    setEnviando(true);

    try {
      const itemsCocina = carritoActual.filter((i) => i.destino === 'cocina');
      const itemsBarra = carritoActual.filter((i) => i.destino === 'barra');
      const ticketNum = Math.floor(1000 + Math.random() * 9000).toString();

      const promesas = [];

      if (itemsCocina.length > 0) {
        promesas.push(
          supabase.from('comandas_cocina').insert([
            {
              ticket_number: ticketNum,
              mesa: `MESA ${mesaSeleccionada}`,
              tipo_destino: 'cocina',
              camarero_nombre: camareroActivo.nombre,
              items: itemsCocina.map((i) => ({
                producto_id: i.id,
                articulo_inventario_id: i.articulo_inventario_id || null,
                nombre: i.nombre,
                precio: Number(i.precio),
                cantidad: i.cantidad,
                comentarios: `Anotado por ${camareroActivo.nombre}`,
                es_menu: (i.categoria || '').toLowerCase().includes('menu')
              }))
            }
          ])
        );
      }

      if (itemsBarra.length > 0) {
        promesas.push(
          supabase.from('comandas_cocina').insert([
            {
              ticket_number: ticketNum,
              mesa: `MESA ${mesaSeleccionada}`,
              tipo_destino: 'barra',
              camarero_nombre: camareroActivo.nombre,
              items: itemsBarra.map((i) => ({
                producto_id: i.id,
                articulo_inventario_id: i.articulo_inventario_id || null,
                nombre: i.nombre,
                precio: Number(i.precio),
                cantidad: i.cantidad,
                comentarios: `Anotado por ${camareroActivo.nombre}`
              }))
            }
          ])
        );
      }

      await Promise.all(promesas);

      mostrarAlerta(`¡Comanda enviada a Cocina/Barra correctamente! Actualizando...`, 'exito');
      setCarritoActualchno: [];
      cargarMesasAbiertas();

      // Recarga automática a los 4 segundos para refrescar el total y las mesas abiertas
      setTimeout(() => {
        window.location.reload();
      }, 4000);

    } catch (err: any) {
      mostrarAlerta('Error: ' + err.message, 'error');
      setEnviando(false);
    }
  };

  const cobrarMesaLegal = async (mesaNombre: string, metodo: 'efectivo' | 'tarjeta') => {
    if (cajaAtrasada) {
      mostrarAlerta('¡ATENCIÓN! Cierra primero la caja del día anterior antes de cobrar.', 'aviso');
      return;
    }

    if (!cajaHoy || cajaHoy.estado === 'cerrada') {
      mostrarAlerta('¡ATENCIÓN! Abre la caja de hoy primero en la pestaña Caja.', 'aviso');
      return;
    }

    const mesaObj = mesasAbiertas.find((m) => m.mesa === mesaNombre);
    if (!mesaObj || !camareroActivo) return;

    const desglose = calcularDesgloseMesa(mesaNombre, mesaObj.items);
    const cfg = configFiscal || (await obtenerConfiguracionFiscal());

    try {
      const { data: docEmitido, error: rpcError } = await supabase.rpc('emitir_documento_fiscal', {
        p_serie: 'T',
        p_tipo_documento: 'SIMPLIFICADA',
        p_mesa: mesaNombre,
        p_vendedor: camareroActivo.nombre,
        p_metodo_pago: metodo,
        p_importe_efectivo: metodo === 'efectivo' ? desglose.totalFinal : 0,
        p_importe_tarjeta: metodo === 'tarjeta' ? desglose.totalFinal : 0,
        p_subtotal_bruto: desglose.subtotalBruto,
        p_descuento_general_porc: desglose.dtoGeneralPorc,
        p_descuento_total_imp: desglose.descuentoTotalImporte,
        p_autorizado_por: autorizadorDescuentoMesa[mesaNombre] || null,
        p_tipo_iva: cfg.iva_defecto || 10,
        p_total_final: desglose.totalFinal,
        p_lineas: desglose.lineasCalculadas
      });

      if (rpcError) throw rpcError;

      await supabase
        .from('comandas_cocina')
        .update({
          pagado: true,
          metodo_pago: metodo,
          camarero_nombre: camareroActivo.nombre,
          total_ticket: desglose.totalFinal,
          factura_fiscal_id: docEmitido.id,
          numero_factura_legal: docEmitido.numero_completo,
          descuento_aplicado: desglose.descuentoTotalImporte
        })
        .eq('mesa', mesaNombre)
        .eq('pagado', false);

      const nuevoEfectivo = Number(cajaHoy.total_efectivo) + (metodo === 'efectivo' ? desglose.totalFinal : 0);
      const nuevaTarjeta = Number(cajaHoy.total_tarjeta) + (metodo === 'tarjeta' ? desglose.totalFinal : 0);

      await supabase
        .from('caja_diaria')
        .update({
          total_efectivo: nuevoEfectivo,
          total_tarjeta: nuevaTarjeta
        })
        .eq('id', cajaHoy.id);

      const { data: facturaCompleta } = await supabase
        .from('facturas_tickets')
        .select('*')
        .eq('id', docEmitido.id)
        .single();

      if (facturaCompleta) {
        imprimirDocumentoFiscalHTML(facturaCompleta, cfg);
      }

      setDescuentoGeneralMesa((prev) => {
        const copia = { ...prev };
        delete copia[mesaNombre];
        return copia;
      });

      mostrarAlerta(
        `¡Ticket Legal ${docEmitido.numero_completo} emitido y cobrado (${desglose.totalFinal.toFixed(2)} €)!`,
        'exito'
      );

      cargarMesasAbiertas();
      cargarCaja();
      cargarProductosCarta();
    } catch (err: any) {
      mostrarAlerta('Error al emitir ticket legal: ' + err.message, 'error');
    }
  };

  const confirmarFacturaRectificativa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalRectificativa || !camareroActivo) return;

    if (!modalRectificativa.motivo.trim()) {
      mostrarAlerta('Debes indicar obligatoriamente el motivo de la rectificación/devolución.', 'aviso');
      return;
    }

    const nombreAdmin = await verificarAutorizacionAdmin(modalRectificativa.pinAdmin);
    if (!nombreAdmin) {
      mostrarAlerta('Se requiere autorización por PIN de un Administrador para anular/rectificar un ticket.', 'error');
      return;
    }

    setModalRectificativa({ ...modalRectificativa, procesando: true });

    try {
      const orig = modalRectificativa.factura;
      const cfg = configFiscal || (await obtenerConfiguracionFiscal());
      const importeNegativo = -Math.abs(Number(orig.total_final));
      const brutoNegativo = -Math.abs(Number(orig.subtotal_bruto));

      const lineasNegativas = (orig.lineas || []).map((l: any) => ({
        ...l,
        cantidad: -Math.abs(Number(l.cantidad)),
        subtotal_linea: -Math.abs(Number(l.subtotal_linea))
      }));

      const { data: docRect, error: rpcError } = await supabase.rpc('emitir_documento_fiscal', {
        p_serie: 'R',
        p_tipo_documento: 'RECTIFICATIVA',
        p_mesa: orig.mesa,
        p_vendedor: camareroActivo.nombre,
        p_metodo_pago: orig.metodo_pago,
        p_importe_efectivo: orig.metodo_pago === 'efectivo' ? importeNegativo : 0,
        p_importe_tarjeta: orig.metodo_pago === 'tarjeta' ? importeNegativo : 0,
        p_subtotal_bruto: brutoNegativo,
        p_descuento_general_porc: orig.descuento_general_porcentaje || 0,
        p_descuento_total_imp: 0,
        p_autorizado_por: nombreAdmin,
        p_tipo_iva: orig.tipo_iva_aplicado || cfg.iva_defecto || 10,
        p_total_final: importeNegativo,
        p_lineas: lineasNegativas,
        p_ticket_origen_id: orig.id,
        p_ticket_origen_numero: orig.numero_completo,
        p_motivo_rectificacion: modalRectificativa.motivo.trim()
      });

      if (rpcError) throw rpcError;

      if (cajaHoy && cajaHoy.estado === 'abierta') {
        const nuevoEfectivo =
          Number(cajaHoy.total_efectivo) + (orig.metodo_pago === 'efectivo' ? importeNegativo : 0);
        const nuevaTarjeta =
          Number(cajaHoy.total_tarjeta) + (orig.metodo_pago === 'tarjeta' ? importeNegativo : 0);

        await supabase
          .from('caja_diaria')
          .update({
            total_efectivo: nuevoEfectivo,
            total_tarjeta: nuevaTarjeta
          })
          .eq('id', cajaHoy.id);
      }

      const { data: rectCompleta } = await supabase
        .from('facturas_tickets')
        .select('*')
        .eq('id', docRect.id)
        .single();

      if (rectCompleta) {
        imprimirDocumentoFiscalHTML(rectCompleta, cfg);
      }

      mostrarAlerta(`Factura Rectificativa ${docRect.numero_completo} emitida e impresa.`, 'exito');
      setModalRectificativa(null);
      cargarCaja();
      cargarProductosCarta();
    } catch (err: any) {
      mostrarAlerta('Error al emitir factura rectificativa: ' + err.message, 'error');
      setModalRectificativa({ ...modalRectificativa, procesando: false });
    }
  };

  const confirmarFacturaNominativa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalFacturaNominativa || !camareroActivo) return;

    if (!modalFacturaNominativa.razonSocial.trim() || !modalFacturaNominativa.nifCif.trim()) {
      mostrarAlerta('Nombre/Razón Social y NIF/CIF del cliente son obligatorios por ley.', 'aviso');
      return;
    }

    setModalFacturaNominativa({ ...modalFacturaNominativa, procesando: true });

    try {
      const orig = modalFacturaNominativa.factura;
      const cfg = configFiscal || (await obtenerConfiguracionFiscal());

      const { data: docNom, error: rpcError } = await supabase.rpc('emitir_documento_fiscal', {
        p_serie: 'F',
        p_tipo_documento: 'NOMINATIVA',
        p_mesa: orig.mesa,
        p_vendedor: camareroActivo.nombre,
        p_metodo_pago: orig.metodo_pago,
        p_importe_efectivo: orig.importe_efectivo,
        p_importe_tarjeta: orig.importe_tarjeta,
        p_subtotal_bruto: orig.subtotal_bruto,
        p_descuento_general_porc: orig.descuento_general_porcentaje || 0,
        p_descuento_total_imp: orig.descuento_total_importe || 0,
        p_autorizado_por: orig.autorizado_por || camareroActivo.nombre,
        p_tipo_iva: orig.tipo_iva_aplicado || cfg.iva_defecto || 10,
        p_total_final: orig.total_final,
        p_lineas: orig.lineas,
        p_ticket_origen_id: orig.id,
        p_ticket_origen_numero: orig.numero_completo,
        p_motivo_rectificacion: null,
        p_cliente_nombre: modalFacturaNominativa.razonSocial.trim(),
        p_cliente_nif: modalFacturaNominativa.nifCif.trim().toUpperCase(),
        p_cliente_direccion: modalFacturaNominativa.direccion.trim()
      });

      if (rpcError) throw rpcError;

      const { data: nomCompleta } = await supabase
        .from('facturas_tickets')
        .select('*')
        .eq('id', docNom.id)
        .single();

      if (nomCompleta) {
        imprimirDocumentoFiscalHTML(nomCompleta, cfg);
      }

      mostrarAlerta(`Factura Nominativa ${docNom.numero_completo} generada e impresa correctamente.`, 'exito');
      setModalFacturaNominativa(null);
      cargarCaja();
    } catch (err: any) {
      mostrarAlerta('Error al generar factura nominativa: ' + err.message, 'error');
      setModalFacturaNominativa({ ...modalFacturaNominativa, procesando: false });
    }
  };

  const imprimirPreTicketCuenta = async () => {
    if (desgloseMesaSeleccionada.totalFinal === 0) {
      mostrarAlerta('La mesa está vacía, no hay cuenta para imprimir.', 'aviso');
      return;
    }
    setImprimiendoPreTicket(true);
    try {
      const cfg = configFiscal || (await obtenerConfiguracionFiscal());
      const ivaPorc = cfg.iva_defecto || 10;
      const baseImp = Number((desgloseMesaSeleccionada.totalFinal / (1 + ivaPorc / 100)).toFixed(2));
      const cuotaIva = Number((desgloseMesaSeleccionada.totalFinal - baseImp).toFixed(2));

      imprimirDocumentoFiscalHTML(
        {
          serie: 'PROFORMA',
          tipo_documento: 'PRE-TICKET / CUENTA MESA (PENDIENTE DE COBRO)',
          numero_completo: `CUENTA-MESA-${mesaSeleccionada}`,
          fecha_expedicion: new Date().toISOString(),
          mesa: `MESA ${mesaSeleccionada}`,
          vendedor_nombre: camareroActivo?.nombre || 'Camarero',
          metodo_pago: 'PENDIENTE',
          subtotal_bruto: desgloseMesaSeleccionada.subtotalBruto,
          descuento_general_porcentaje: desgloseMesaSeleccionada.dtoGeneralPorc,
          descuento_total_importe: desgloseMesaSeleccionada.descuentoTotalImporte,
          base_imponible: baseImp,
          cuota_iva: cuotaIva,
          tipo_iva_aplicado: ivaPorc,
          total_final: desgloseMesaSeleccionada.totalFinal,
          lineas: desgloseMesaSeleccionada.lineasCalculadas,
          hash_actual: 'PENDIENTE_DE_COBRO_DEFINITIVO'
        },
        cfg
      );
    } finally {
      setImprimiendoPreTicket(false);
    }
  };

  const abrirCaja = async () => {
    const fechaHoy = new Date().toISOString().split('T')[0];
    const remanente = parseFloat(remanenteAperturaInput) || 0;

    await supabase.from('caja_diaria').insert([
      {
        fecha: fechaHoy,
        remanente_apertura: remanente,
        total_efectivo: 0,
        total_tarjeta: 0,
        estado: 'abierta'
      }
    ]);

    mostrarAlerta(`Turno de hoy abierto con fondo de ${remanente.toFixed(2)} €.`, 'exito');
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

    if (camareroActivo) {
      await supabase.from('cierres_caja').insert([
        {
          usuario_nombre: camareroActivo.nombre,
          fondo_inicial: Number(caja.remanente_apertura),
          ventas_efectivo_sistema: Number(caja.total_efectivo),
          ventas_tarjeta_sistema: Number(caja.total_tarjeta),
          efectivo_esperado_caja: teoricoEfectivo,
          efectivo_contado_trabajador: efectivoReal,
          tarjeta_contada_trabajador: Number(caja.total_tarjeta),
          descuadre_efectivo: descuadre,
          descuadre_tarjeta: 0,
          observaciones: `Cierre desde TPV Camarero (${caja.fecha})`
        }
      ]);
    }

    mostrarAlerta(`¡Caja de fecha ${caja.fecha} cerrada y registrada en el Backoffice!`, 'exito');
    cargarCaja();
  };

  const salirSesion = () => {
    setCamareroActivo(null);
    sessionStorage.removeItem('nexus_camarero_sesion');
  };

  if (mostrarBackoffice && camareroActivo?.rol === 'admin') {
    return (
      <LoyverseDashboard
        onBack={() => {
          setMostrarBackoffice(false);
          cargarProductosCarta();
          cargarCaja();
        }}
      />
    );
  }

  if (!camareroActivo) {
    return (
      <div className="min-h-screen bg-[#050609] flex items-center justify-center p-4">
        <div className="w-full max-w-sm p-8 rounded-3xl bg-[#0d0f17] border border-white/10 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="h-16 w-16 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mb-4">
              <User className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-black text-white">Cafetería · Acceso TPV</h2>
            <p className="text-sm text-slate-400">Introduce tu PIN de empleado o administrador.</p>
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
            {loginError && <p className="text-xs text-rose-400 text-center font-bold">PIN incorrecto o usuario inactivo.</p>}
            <button
              type="submit"
              className="w-full py-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg transition-all"
            >
              Entrar a Cafetería
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
      {alertaFlotante && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] animate-slide-down">
          <div
            className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border backdrop-blur-md ${
              alertaFlotante.tipo === 'exito'
                ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-100'
                : alertaFlotante.tipo === 'error'
                ? 'bg-rose-950/90 border-rose-500/50 text-rose-100'
                : 'bg-amber-950/90 border-amber-500/50 text-amber-100'
            }`}
          >
            {alertaFlotante.tipo === 'exito' && <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />}
            {alertaFlotante.tipo === 'error' && <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0" />}
            {alertaFlotante.tipo === 'aviso' && <Info className="h-5 w-5 text-amber-400 shrink-0" />}
            <p className="text-sm font-semibold max-w-xs sm:max-w-md">{alertaFlotante.mensaje}</p>
            <button
              onClick={() => setAlertaFlotante(null)}
              className="ml-2 p-1 hover:bg-white/10 rounded-lg transition-colors cursor-pointer shrink-0"
            >
              <X className="h-4 w-4 opacity-70 hover:opacity-100" />
            </button>
          </div>
        </div>
      )}

      {modalAuthDescuento && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md px-4">
          <form
            onSubmit={aplicarDescuentoAutorizado}
            className="w-full max-w-md bg-[#0d0f17] border border-amber-500/40 rounded-3xl p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 text-amber-400">
                <ShieldCheck className="h-5 w-5" />
                <h3 className="font-black text-white text-base">
                  {modalAuthDescuento.tipo === 'linea'
                    ? `Descuento en: ${modalAuthDescuento.itemNombre}`
                    : `Descuento General (${modalAuthDescuento.mesaKey})`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalAuthDescuento(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase">Porcentaje de Descuento (%)</label>
              <div className="flex gap-2">
                {[5, 10, 15, 20, 50, 100].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setModalAuthDescuento({ ...modalAuthDescuento, porcentajePropuesto: String(p) })}
                    className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-amber-500 hover:text-slate-950 text-xs font-bold border border-white/10 cursor-pointer"
                  >
                    {p}%
                  </button>
                ))}
              </div>
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                required
                value={modalAuthDescuento.porcentajePropuesto}
                onChange={(e) =>
                  setModalAuthDescuento({ ...modalAuthDescuento, porcentajePropuesto: e.target.value })
                }
                className="w-full bg-black/60 border border-white/20 rounded-xl px-4 py-2.5 text-white font-mono font-bold"
              />
            </div>

            {camareroActivo.rol !== 'admin' ? (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-amber-400 uppercase">
                  PIN de Autorización (Solo Administradores)
                </label>
                <input
                  type="password"
                  required
                  placeholder="Introduce PIN de Administrador"
                  value={modalAuthDescuento.pinAdmin}
                  onChange={(e) => setModalAuthDescuento({ ...modalAuthDescuento, pinAdmin: e.target.value })}
                  className="w-full bg-black/60 border border-amber-500/40 rounded-xl px-4 py-2.5 text-white font-mono"
                />
              </div>
            ) : (
              <p className="text-xs text-emerald-400 bg-emerald-950/30 border border-emerald-500/30 p-2.5 rounded-xl">
                ✓ Sesión activa como Administrador ({camareroActivo.nombre}). Autorización directa.
              </p>
            )}

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModalAuthDescuento(null)}
                className="py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-slate-300 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase cursor-pointer"
              >
                Aplicar Descuento
              </button>
            </div>
          </form>
        </div>
      )}

      {modalRectificativa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md px-4">
          <form
            onSubmit={confirmarFacturaRectificativa}
            className="w-full max-w-md bg-[#0d0f17] border border-rose-500/40 rounded-3xl p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 text-rose-400">
                <RotateCcw className="h-5 w-5" />
                <h3 className="font-black text-white text-base">
                  Emitir Factura Rectificativa Simplificada
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalRectificativa(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="text-xs text-slate-300 bg-black/40 p-3 rounded-xl border border-white/10 space-y-1">
              <div>
                <strong>Ticket a rectificar:</strong> {modalRectificativa.factura.numero_completo}
              </div>
              <div>
                <strong>Importe a devolver:</strong>{' '}
                <span className="text-rose-400 font-mono font-bold">
                  -{Number(modalRectificativa.factura.total_final).toFixed(2)} € ({modalRectificativa.factura.metodo_pago})
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 uppercase">
                Motivo legal de la rectificación / devolución *
              </label>
              <input
                type="text"
                required
                placeholder="Ej: Devolución de producto / Error en método de cobro"
                value={modalRectificativa.motivo}
                onChange={(e) => setModalRectificativa({ ...modalRectificativa, motivo: e.target.value })}
                className="w-full bg-black/60 border border-white/20 rounded-xl px-3.5 py-2.5 text-xs text-white"
              />
            </div>

            {camareroActivo.rol !== 'admin' && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-rose-400 uppercase">PIN de Administrador *</label>
                <input
                  type="password"
                  required
                  placeholder="PIN de Administrador"
                  value={modalRectificativa.pinAdmin}
                  onChange={(e) => setModalRectificativa({ ...modalRectificativa, pinAdmin: e.target.value })}
                  className="w-full bg-black/60 border border-rose-500/40 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModalRectificativa(null)}
                className="py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-slate-300 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={modalRectificativa.procesando}
                className="py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase cursor-pointer disabled:opacity-50"
              >
                {modalRectificativa.procesando ? 'Emitiendo...' : 'Emitir y Devolver'}
              </button>
            </div>
          </form>
        </div>
      )}

      {modalFacturaNominativa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md px-4">
          <form
            onSubmit={confirmarFacturaNominativa}
            className="w-full max-w-md bg-[#0d0f17] border border-cyan-500/40 rounded-3xl p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 text-cyan-400">
                <FileText className="h-5 w-5" />
                <h3 className="font-black text-white text-base">Convertir en Factura Nominativa</h3>
              </div>
              <button
                type="button"
                onClick={() => setModalFacturaNominativa(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="text-xs text-slate-300 bg-black/40 p-3 rounded-xl border border-white/10">
              Canje del Ticket Simplificado <strong>{modalFacturaNominativa.factura.numero_completo}</strong> por importe
              de <strong>{Number(modalFacturaNominativa.factura.total_final).toFixed(2)} €</strong>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  Nombre Completo o Razón Social *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Empresa Cliente S.L. o Juan Pérez"
                  value={modalFacturaNominativa.razonSocial}
                  onChange={(e) =>
                    setModalFacturaNominativa({ ...modalFacturaNominativa, razonSocial: e.target.value })
                  }
                  className="w-full bg-black/60 border border-white/20 rounded-xl px-3.5 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">NIF / CIF / NIE *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: B14000000 o 30000000A"
                  value={modalFacturaNominativa.nifCif}
                  onChange={(e) => setModalFacturaNominativa({ ...modalFacturaNominativa, nifCif: e.target.value })}
                  className="w-full bg-black/60 border border-white/20 rounded-xl px-3.5 py-2 text-xs text-white uppercase font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Dirección Fiscal Completa *</label>
                <input
                  type="text"
                  required
                  placeholder="Calle, Número, CP, Ciudad, Provincia"
                  value={modalFacturaNominativa.direccion}
                  onChange={(e) =>
                    setModalFacturaNominativa({ ...modalFacturaNominativa, direccion: e.target.value })
                  }
                  className="w-full bg-black/60 border border-white/20 rounded-xl px-3.5 py-2 text-xs text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModalFacturaNominativa(null)}
                className="py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-slate-300 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={modalFacturaNominativa.procesando}
                className="py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs uppercase cursor-pointer disabled:opacity-50"
              >
                {modalFacturaNominativa.procesando ? 'Generando...' : 'Emitir e Imprimir'}
              </button>
            </div>
          </form>
        </div>
      )}

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
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <h4 className="text-amber-400 font-bold text-sm bg-amber-950/30 p-3 rounded-xl border border-amber-500/20">
                Paso {pasoComboActual + 1} de {comboActivo.opciones_combo?.length}:{' '}
                {comboActivo.opciones_combo?.[pasoComboActual].titulo}
              </h4>

              <div className="grid grid-cols-1 gap-2.5 max-h-72 overflow-y-auto pr-1">
                {comboActivo.opciones_combo?.[pasoComboActual].opciones.map((opcion, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      const nuevasSel = { ...seleccionesCombo, [pasoComboActual]: opcion };
                      setSeleccionesCombo(nuevasSel);

                      if (pasoComboActual < (comboActivo.opciones_combo?.length || 0) - 1) {
                        setPasoComboActual((prev) => prev + 1);
                      } else {
                        confirmarCombo(nuevasSel);
                      }
                    }}
                    className="p-4 rounded-xl border border-white/10 bg-black/60 hover:border-amber-400 hover:bg-amber-950/40 text-left transition-all flex items-center justify-between group cursor-pointer"
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

      <header className="border-b border-white/10 pb-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 sticky top-0 bg-[#050609]/90 backdrop-blur-md z-30 print:hidden">
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
              <Utensils className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-black tracking-wide text-white">NEXUS · CAFETERÍA & TPV</h1>
              <p className="text-xs text-slate-400 flex items-center gap-1">
                Sesión: <strong className="text-amber-400">{camareroActivo.nombre}</strong>
                {camareroActivo.rol === 'admin' && (
                  <span className="ml-1.5 px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] font-black uppercase">
                    Admin
                  </span>
                )}
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

        <div className="flex items-center gap-2.5 flex-wrap justify-center">
          {camareroActivo.rol === 'admin' && (
            <button
              type="button"
              onClick={() => setMostrarBackoffice(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-500 hover:from-cyan-400 hover:to-sky-400 text-slate-950 font-black text-xs shadow-lg cursor-pointer transition-all"
            >
              <Settings className="h-4 w-4" />
              <span>Backoffice</span>
            </button>
          )}

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
              📋 Mesas ({mesasAbiertas.length})
            </button>
            <button
              onClick={() => setVistaSeccion('caja')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                vistaSeccion === 'caja' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              💰 Caja y Tickets
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

      {vistaSeccion === 'tomar_nota' && (
        <main className="flex-1 max-w-5xl w-full mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 pb-24">
          <div className="md:col-span-2 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0d0f17] p-4 rounded-2xl border border-white/10">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-amber-400" />
                <span className="text-xs font-bold uppercase text-slate-300">Mesa:</span>
                <select
                  value={mesaSeleccionada}
                  onChange={(e) => setMesaSeleccionada(e.target.value)}
                  className="bg-black/80 border border-amber-500/50 rounded-xl px-3 py-1.5 text-sm font-black text-amber-400 outline-none cursor-pointer"
                >
                  {Array.from({ length: 20 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      Mesa {m}
                    </option>
                  ))}
                </select>
              </div>

              <form onSubmit={manejarEscaneoCodigoBarras} className="flex items-center gap-1.5 flex-1 max-w-xs">
                <div className="relative flex-1">
                  <Barcode className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Código de barras..."
                    value={busquedaCodigoBarras}
                    onChange={(e) => setBusquedaCodigoBarras(e.target.value)}
                    className="w-full bg-black/60 border border-white/15 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white outline-none focus:border-amber-400"
                  />
                </div>
              </form>

              <button
                type="button"
                onClick={imprimirPreTicketCuenta}
                disabled={imprimiendoPreTicket || (cuentaMesaActual.length === 0 && carritoActual.length === 0)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg transition-all cursor-pointer disabled:opacity-50"
              >
                <Printer className="h-4 w-4" />
                <span>Imprimir Cuenta</span>
              </button>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
              {categoriasDisponibles.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoriaActiva(cat)}
                  className={`px-4 py-2 rounded-2xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
                    categoriaActiva === cat ? 'bg-amber-500 text-slate-950' : 'bg-white/5 text-slate-400'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {loadingCarta ? (
              <div className="text-center py-20 text-slate-500 text-sm">Cargando artículos...</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {productosCarta
                  .filter((p) => {
                    const catProd = (p.categoria || '').trim().toLowerCase();
                    const catActiva = categoriaActiva.trim().toLowerCase();
                    if (!catProd) return true;
                    return catProd === catActiva || catProd.includes(catActiva) || catActiva.includes(catProd);
                  })
                  .map((prod) => (
                    <div
                      key={prod.id}
                      className={`p-3.5 rounded-2xl bg-[#0d0f17] border flex items-center justify-between gap-3 shadow-md ${
                        prod.es_combo ? 'border-amber-500/40 bg-amber-950/20' : 'border-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {prod.imagen_url ? (
                          <img
                            src={prod.imagen_url}
                            alt={prod.nombre}
                            className="h-12 w-12 rounded-xl object-cover border border-white/10 shrink-0"
                          />
                        ) : null}
                        <div>
                          <h4 className="font-bold text-white text-sm">{prod.nombre}</h4>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="font-mono text-amber-400 font-bold text-xs">
                              {Number(prod.precio).toFixed(2)} €
                            </span>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                                (prod.destino || 'barra').toLowerCase() === 'cocina'
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                              }`}
                            >
                              {prod.destino || 'barra'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => clickAgregarAlCarrito(prod)}
                        className="h-9 w-9 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center cursor-pointer active:scale-95 transition-transform font-bold shrink-0"
                      >
                        <Plus className="h-5 w-5" />
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="p-5 rounded-3xl bg-[#0d0f17] border border-white/10 space-y-4 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Resumen Mesa</span>
                  <h3 className="text-lg font-black text-white">MESA {mesaSeleccionada}</h3>
                </div>
                <div className="text-right">
                  {desgloseMesaSeleccionada.descuentoTotalImporte > 0 && (
                    <span className="text-xs line-through text-slate-500 font-mono block">
                      {desgloseMesaSeleccionada.subtotalBruto.toFixed(2)} €
                    </span>
                  )}
                  <span className="font-mono font-bold text-amber-400 text-base">
                    {desgloseMesaSeleccionada.totalFinal.toFixed(2)} €
                  </span>
                </div>
              </div>

              <div className="space-y-2 mt-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400">Artículos pedidos (Sin cobrar):</span>
                  {cuentaMesaActual.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setModalAuthDescuento({
                          abierto: true,
                          tipo: 'general',
                          mesaKey: `MESA ${mesaSeleccionada}`,
                          porcentajePropuesto: String(descuentoGeneralMesa[`MESA ${mesaSeleccionada}`] || 10),
                          pinAdmin: ''
                        })
                      }
                      className="text-[11px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/30 cursor-pointer"
                    >
                      <Percent className="h-3 w-3" /> Dto. General
                    </button>
                  )}
                </div>

                {cuentaMesaActual.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">Mesa vacía.</p>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {cuentaMesaActual.map((item, idx) => {
                      const claveLinea = `MESA ${mesaSeleccionada}__${item.nombre}`;
                      const dto = descuentosLineas[claveLinea] || 0;
                      const importeBruto = item.precio * item.cantidad;
                      const importeNeto = importeBruto * (1 - dto / 100);

                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-xs bg-black/40 px-3 py-2 rounded-xl border border-white/5 gap-2"
                        >
                          <div className="flex-1">
                            <span className="text-white">
                              <span className="text-amber-400 font-mono font-bold mr-2">{item.cantidad}x</span>
                              {item.nombre}
                            </span>
                            {dto > 0 && (
                              <span className="ml-2 text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-bold">
                                -{dto}%
                              </span>
                            )}
                          </div>
                          {!item.nombre.includes('├─') && item.precio > 0 && (
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-slate-300">{importeNeto.toFixed(2)} €</span>
                              <button
                                type="button"
                                title="Aplicar descuento a este artículo (Requiere Admin)"
                                onClick={() =>
                                  setModalAuthDescuento({
                                    abierto: true,
                                    tipo: 'linea',
                                    mesaKey: `MESA ${mesaSeleccionada}`,
                                    itemNombre: item.nombre,
                                    porcentajePropuesto: String(dto || 10),
                                    pinAdmin: ''
                                  })
                                }
                                className="p-1 rounded-lg bg-white/5 hover:bg-amber-500 hover:text-slate-950 text-slate-400 cursor-pointer"
                              >
                                <Percent className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {carritoActual.length > 0 && (
                <div className="pt-4 mt-4 border-t border-white/10 space-y-3">
                  <span className="text-xs font-bold text-cyan-400 block">
                    Nuevos a enviar al KDS ({totalCarritoActual.toFixed(2)} €):
                  </span>

                  <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                    {carritoActual.map((item) => (
                      <div
                        key={item.id}
                        className="flex justify-between text-xs bg-cyan-950/20 p-2.5 rounded-xl border border-cyan-500/20"
                      >
                        <span className="font-bold text-white truncate max-w-[140px]">{item.nombre}</span>

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
                            <span className="font-mono font-bold text-white w-3 text-center">{item.cantidad}</span>
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
            </div>
          </div>
        </main>
      )}

      {vistaSeccion === 'mesas_abiertas' && (
        <main className="flex-1 max-w-4xl w-full mx-auto space-y-6 pb-24">
          <h2 className="text-xl font-bold text-white">📋 Mesas Activas sin cobrar</h2>

          {mesasAbiertas.length === 0 ? (
            <div className="text-center py-20 text-slate-500">
              <p className="font-semibold">No hay mesas abiertas por cobrar.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {mesasAbiertas.map((m) => {
                const desglose = calcularDesgloseMesa(m.mesa, m.items);
                return (
                  <div key={m.id} className="p-5 rounded-3xl bg-[#0d0f17] border border-white/10 space-y-4 shadow-xl">
                    <div className="flex justify-between items-center border-b border-white/10 pb-2">
                      <span className="font-black text-sm px-3 py-1 rounded-xl bg-amber-500 text-slate-950 uppercase">
                        {m.mesa}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setModalAuthDescuento({
                              abierto: true,
                              tipo: 'general',
                              mesaKey: m.mesa,
                              porcentajePropuesto: String(descuentoGeneralMesa[m.mesa] || 10),
                              pinAdmin: ''
                            })
                          }
                          className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Percent className="h-3 w-3" /> Dto.
                        </button>
                        <div className="text-right">
                          {desglose.descuentoTotalImporte > 0 && (
                            <span className="text-[11px] line-through text-slate-500 font-mono block">
                              {desglose.subtotalBruto.toFixed(2)} €
                            </span>
                          )}
                          <span className="font-mono text-lg font-black text-amber-400">
                            {desglose.totalFinal.toFixed(2)} €
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                      {m.items.map((it, iIdx) => {
                        const claveLinea = `${m.mesa}__${it.nombre}`;
                        const dto = descuentosLineas[claveLinea] || 0;
                        const neto = it.precio * it.cantidad * (1 - dto / 100);
                        return (
                          <div
                            key={iIdx}
                            className="flex items-center justify-between text-xs bg-black/40 px-2.5 py-1.5 rounded-lg"
                          >
                            <span className="text-slate-200">
                              <span className="text-amber-400 font-mono font-bold mr-1.5">{it.cantidad}x</span>
                              {it.nombre}
                              {dto > 0 && (
                                <span className="ml-1.5 text-[10px] text-amber-400 font-bold">(-{dto}%)</span>
                              )}
                            </span>
                            {!it.nombre.includes('├─') && it.precio > 0 && (
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-slate-300">{neto.toFixed(2)} €</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setModalAuthDescuento({
                                      abierto: true,
                                      tipo: 'linea',
                                      mesaKey: m.mesa,
                                      itemNombre: it.nombre,
                                      porcentajePropuesto: String(dto || 10),
                                      pinAdmin: ''
                                    })
                                  }
                                  className="p-1 rounded bg-white/5 hover:bg-amber-500 hover:text-slate-950 text-slate-400 cursor-pointer"
                                >
                                  <Percent className="h-3 w-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/10">
                      <button
                        onClick={() => cobrarMesaLegal(m.mesa, 'efectivo')}
                        className="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-xs uppercase flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <DollarSign className="h-4 w-4" /> Cobrar Efectivo
                      </button>
                      <button
                        onClick={() => cobrarMesaLegal(m.mesa, 'tarjeta')}
                        className="py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs uppercase flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <CreditCard className="h-4 w-4" /> Cobrar Tarjeta
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      )}

      {vistaSeccion === 'caja' && (
        <main className="flex-1 max-w-4xl w-full mx-auto space-y-6 pb-24">
          {cajaAtrasada && (
            <div className="p-6 rounded-3xl bg-rose-950/40 border border-rose-500/50 space-y-5 shadow-xl">
              <div className="flex items-center gap-3 text-rose-400 border-b border-rose-500/30 pb-4">
                <AlertTriangle className="h-6 w-6" />
                <h2 className="text-xl font-bold text-white">¡Caja anterior abierta!</h2>
              </div>
              <p className="text-sm text-slate-300">
                Tienes que cerrar la caja del día <strong className="text-rose-400">{cajaAtrasada.fecha}</strong> antes
                de poder cobrar nada hoy.
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
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase">Fondo Inicial / Remanente (€)</label>
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
          ) : cajaHoy ? (
            <div className="p-6 rounded-3xl bg-[#0d0f17] border border-cyan-500/40 space-y-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-3 text-cyan-400">
                  <Calculator className="h-6 w-6" />
                  <h2 className="text-xl font-bold text-white">Arqueo, Tickets Legales y Facturación (Hoy)</h2>
                </div>
                <span
                  className={`px-3 py-1 rounded-xl text-xs font-bold ${
                    cajaHoy.estado === 'abierta'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-rose-500/20 text-rose-400'
                  }`}
                >
                  {cajaHoy.estado === 'abierta' ? 'Turno Abierto' : 'Caja Cerrada'}
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
                    {Number(cajaHoy.total_efectivo).toFixed(2)} €
                  </p>
                </div>
                <div className="bg-sky-950/20 p-3 rounded-xl border border-sky-500/30">
                  <span className="text-xs font-bold text-sky-400">Teórico en Cajón:</span>
                  <p className="font-mono text-xl font-black text-white mt-1">
                    {(Number(cajaHoy.remanente_apertura) + Number(cajaHoy.total_efectivo)).toFixed(2)} €
                  </p>
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t border-white/10">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-cyan-400" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                      Tickets y Facturas Emitidos Hoy ({facturasHoy.length})
                    </h4>
                  </div>
                </div>

                {facturasHoy.length === 0 ? (
                  <p className="text-xs text-slate-500 italic text-center py-6 bg-black/20 rounded-xl">
                    Aún no se han emitido tickets fiscales hoy.
                  </p>
                ) : (
                  <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                    {facturasHoy.map((f) => (
                      <div
                        key={f.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-black/40 border border-white/10 text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-black text-cyan-400 text-sm">{f.numero_completo}</span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                                f.serie === 'R'
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                  : f.serie === 'F'
                                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              }`}
                            >
                              {f.tipo_documento}
                            </span>
                            <span className="text-slate-300 font-bold">{f.mesa}</span>
                            {f.estado_fiscal !== 'EMITIDO' && (
                              <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-bold">
                                {f.estado_fiscal}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400">
                            {new Date(f.fecha_expedicion).toLocaleTimeString('es-ES')} · Atendido por:{' '}
                            <strong>{f.vendedor_nombre}</strong> · Pago: <strong>{f.metodo_pago.toUpperCase()}</strong>
                            {f.cliente_nif && ` · Cliente: ${f.cliente_nombre_razon} (${f.cliente_nif})`}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <span
                            className={`font-mono font-black text-sm mr-2 ${
                              Number(f.total_final) < 0 ? 'text-rose-400' : 'text-white'
                            }`}
                          >
                            {Number(f.total_final).toFixed(2)} €
                          </span>

                          <button
                            type="button"
                            title="Reimprimir documento fiscal"
                            onClick={async () => {
                              const cfg = configFiscal || (await obtenerConfiguracionFiscal());
                              imprimirDocumentoFiscalHTML(f, cfg);
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Printer className="h-3.5 w-3.5" /> Ticket
                          </button>

                          {f.serie === 'T' && f.estado_fiscal === 'EMITIDO' && (
                            <>
                              <button
                                type="button"
                                title="Convertir en Factura Nominativa para cliente"
                                onClick={() =>
                                  setModalFacturaNominativa({
                                    factura: f,
                                    razonSocial: '',
                                    nifCif: '',
                                    direccion: '',
                                    procesando: false
                                  })
                                }
                                className="px-2.5 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500 hover:text-slate-950 text-cyan-300 border border-cyan-500/30 font-bold flex items-center gap-1 cursor-pointer transition-all"
                              >
                                <FileText className="h-3.5 w-3.5" /> Factura
                              </button>

                              <button
                                type="button"
                                title="Anular / Devolver (Factura Rectificativa Simplificada)"
                                onClick={() =>
                                  setModalRectificativa({
                                    factura: f,
                                    motivo: '',
                                    pinAdmin: '',
                                    procesando: false
                                  })
                                }
                                className="px-2.5 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-600 hover:text-white text-rose-300 border border-rose-500/30 font-bold flex items-center gap-1 cursor-pointer transition-all"
                              >
                                <RotateCcw className="h-3.5 w-3.5" /> Devolver
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {cajaHoy.estado === 'abierta' && (
                <>
                  <div className="space-y-4 pt-6 border-t border-white/10">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-amber-400">Efectivo Real Contado en Cajón (€)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={efectivoRealInput}
                        onChange={(e) => setEfectivoRealInput(e.target.value)}
                        className="w-full bg-black/60 border border-amber-500/40 rounded-xl px-4 py-3 text-lg font-mono font-bold text-amber-400 focus:border-amber-400"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-300">Fondo a dejar para mañana (€)</label>
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
                    className="w-full py-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-sm uppercase flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Lock className="h-5 w-5" /> Cerrar Caja y Terminar Turno
                  </button>
                </>
              )}
            </div>
          ) : null}
        </main>
      )}
    </div>
  );
}