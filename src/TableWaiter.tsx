// src/TableWaiter.tsx
import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import LoyverseDashboard from './LoyverseDashboard';
import {
  obtenerConfiguracionFiscal,
  calcularHashVeriFactu,
  calcularDesgloseImpuestosLineas,
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
  Barcode,
  Search,
  CornerDownRight,
  PenLine,
  ArrowRightLeft,
  Split,
  FolderOpen,
  TrendingUp,
  TrendingDown,
  Save,
  EyeOff,
  RefreshCw
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
  porcentaje_iva?: number;
  articulo_inventario_id?: string;
  notaExtra?: string; 
}

interface ItemPedido {
  producto_id?: number;
  articulo_inventario_id?: string;
  nombre: string;
  precio: number;
  cantidad: number;
  destino: string;
  descuento_porcentaje?: number;
  porcentaje_iva?: number;
  tipo_iva?: number;
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

const agruparFacturas = (lista: any[]) => {
  const mapa = new Map();
  lista.forEach(f => mapa.set(f.id, { ...f, hijos: [] }));
  const raices: any[] = [];
  mapa.forEach(f => {
    if (f.ticket_origen_id && mapa.has(f.ticket_origen_id)) {
      mapa.get(f.ticket_origen_id).hijos.push(f);
    } else {
      raices.push(f);
    }
  });
  return raices;
};

const getNombreMesa = (val: string) => val === 'BARRA' ? 'BARRA' : `MESA ${val}`;

export default function TableWaiter({ onBack }: TableWaiterProps) {
  const [camareroActivo, setCamareroActivo] = useState<{ id: string; nombre: string; rol: string } | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [loginError, setLoginError] = useState(false);
  const [mostrarBackoffice, setMostrarBackoffice] = useState(false);

  const [configFiscal, setConfigFiscal] = useState<ConfiguracionFiscal | null>(null);
  const [mesaSeleccionada, setMesaSeleccionada] = useState<string>('BARRA');
  const [productosCarta, setProductosCarta] = useState<Producto[]>([]);
  const [categoriasDisponibles, setCategoriasDisponibles] = useState<string[]>(['Cafetería', 'Tapas', 'Menús/Combos', 'Bebidas']);
  const [categoriaActiva, setCategoriaActiva] = useState<string>('Cafetería');
  const [busquedaCodigoBarras, setBusquedaCodigoBarras] = useState('');
  const [busquedaNombre, setBusquedaNombre] = useState('');
  const [loadingCarta, setLoadingCarta] = useState(true);
  const [cocinaAbierta, setCocinaAbierta] = useState(true);

  const [carritoActual, setCarritoActual] = useState<Array<Producto & { cantidad: number; idCarritoUnico: number }>>([]);
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

  const [modalNotaItem, setModalNotaItem] = useState<{ idCarritoUnico: number; nombre: string; notaActual: string } | null>(null);
  const [modalTraspaso, setModalTraspaso] = useState<{ origen: string; destino: string; procesando: boolean } | null>(null);
  const [modalCobroParcial, setModalCobroParcial] = useState<{
    mesaNombre: string;
    itemsDisponibles: (ItemPedido & { maxCantidad: number; cantidadSeleccionada: number })[];
    procesando: boolean;
  } | null>(null);

  // NUEVOS ESTADOS: Caja Manual y Cuentas Aparcadas
  const [modalCajaManual, setModalCajaManual] = useState<{ abierto: boolean; tipo: 'ENTRADA' | 'SALIDA' } | null>(null);
  const [cajaImporte, setCajaImporte] = useState('');
  const [cajaConcepto, setCajaConcepto] = useState('');
  const [modalCuentasAparcadas, setModalCuentasAparcadas] = useState(false);
  const [cuentasAparcadas, setCuentasAparcadas] = useState<any[]>([]);
  const [nombreCuentaAparcada, setNombreCuentaAparcada] = useState('');

  const [cajaHoy, setCajaHoy] = useState<CajaDiaria | null>(null);
  const [cajaAtrasada, setCajaAtrasada] = useState<CajaDiaria | null>(null);
  const [facturasHoy, setFacturasHoy] = useState<any[]>([]);
  const [remanenteAperturaInput, setRemanenteAperturaInput] = useState<string>('50.00');
  const [efectivoRealInput, setEfectivoRealInput] = useState<string>('');
  const [remanenteCierreInput, setRemanenteCierreInput] = useState<string>('50.00');
  const [showModalArqueo, setShowModalArqueo] = useState<boolean>(false);
  const [showModalApertura, setShowModalApertura] = useState<boolean>(false);
  const [procesandoApertura, setProcesandoApertura] = useState<boolean>(false);
  const [datosArqueoCaja, setDatosArqueoCaja] = useState<{
    id: number;
    fecha?: string;
    remanente_apertura: number;
    total_efectivo: number;
    total_tarjeta: number;
  } | null>(null);
  const [procesandoArqueo, setProcesandoArqueo] = useState<boolean>(false);
  const [resumenCierreModal, setResumenCierreModal] = useState<{
    cuadrada: boolean;
    efectivo_real: number;
    efectivo_esperado: number;
    total_tarjeta: number;
    descuadre: number;
    remanente_cierre: number;
    efectivo_retirado: number;
  } | null>(null);

  const [enviando, setEnviando] = useState(false);
  const [imprimiendoPreTicket, setImprimiendoPreTicket] = useState(false);
  const [refrescandoMesas, setRefrescandoMesas] = useState(false);
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
    const handleSynced = (ev: Event) => {
      const customEv = ev as CustomEvent<{ cantidad?: number }>;
      const cant = customEv.detail?.cantidad ?? 1;
      mostrarAlerta(`Conexión recuperada: ${cant} pedido(s) de la cola offline sincronizado(s) con éxito.`, 'exito');
      cargarMesasAbiertas();
      cargarCaja();
      cargarProductosCarta();
    };
    window.addEventListener('pedidos-offline-sincronizados', handleSynced);
    return () => window.removeEventListener('pedidos-offline-sincronizados', handleSynced);
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
      .channel('realtime-waiter-mesas-comandas')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comandas_cocina' }, () => {
        cargarMesasAbiertas();
        cargarCaja();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'comandas_cocina' }, () => {
        cargarMesasAbiertas();
        cargarCaja();
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'comandas_cocina' }, () => {

        cargarMesasAbiertas();
        cargarCaja();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'facturas_tickets' }, () => {
        cargarMesasAbiertas();
        cargarCaja();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'caja_diaria' }, () => {
        cargarCaja();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cuentas_abiertas' }, () => {
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
    const encontrada = mesasAbiertas.find((m) => m.mesa === getNombreMesa(mesaSeleccionada));
    if (encontrada && encontrada.items) {
      setCuentaMesaActual(encontrada.items);
    } else {
      setCuentaMesaActual([]);
    }
    setCarritoActual([]);
  }, [mesaSeleccionada]);

  useEffect(() => {
    const encontrada = mesasAbiertas.find((m) => m.mesa === getNombreMesa(mesaSeleccionada));
    if (encontrada && encontrada.items) {
      setCuentaMesaActual(encontrada.items);
    } else {
      setCuentaMesaActual([]);
    }
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
      const { data: maestroIva } = await supabase
        .from('articulos_cafeteria')
        .select('id, nombre, porcentaje_iva, tipo_iva');
      const mapaIvaPorId = new Map<string, number>();
      const mapaIvaPorNombre = new Map<string, number>();
      if (maestroIva) {
        maestroIva.forEach((m: any) => {
          const ivaVal = Number(m.porcentaje_iva ?? m.tipo_iva ?? 10) === 21 ? 21 : 10;
          if (m.id) mapaIvaPorId.set(String(m.id), ivaVal);
          if (m.nombre) mapaIvaPorNombre.set(String(m.nombre).trim().toLowerCase(), ivaVal);
        });
      }
      const enriquecidos = (data as Producto[]).map((p) => {
        const ivaDirecto = p.porcentaje_iva ?? p.tipo_iva;
        const ivaMaestro =
          (p.articulo_inventario_id && mapaIvaPorId.get(String(p.articulo_inventario_id))) ||
          mapaIvaPorNombre.get(String(p.nombre || '').trim().toLowerCase());
        const ivaFinal = Number(ivaDirecto ?? ivaMaestro ?? 10) === 21 ? 21 : 10;
        return {
          ...p,
          porcentaje_iva: ivaFinal,
          tipo_iva: ivaFinal
        };
      });
      setProductosCarta(enriquecidos);
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
      .order('fecha', { ascending: false })
      .order('id', { ascending: false });

    if (todasLasCajas && todasLasCajas.length > 0) {
      const cajaDeHoy = todasLasCajas.find((c) => c.fecha === fechaHoy && c.estado === 'abierta') || todasLasCajas.find((c) => c.fecha === fechaHoy);
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
                destino: row.tipo_destino,
                porcentaje_iva: it.porcentaje_iva ?? it.tipo_iva,
                tipo_iva: it.porcentaje_iva ?? it.tipo_iva
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

  const refrescarMesasManual = async () => {
    if (refrescandoMesas) return;
    setRefrescandoMesas(true);
    try {
      await Promise.all([
        cargarMesasAbiertas(),
        cargarCaja(),
        new Promise((resolve) => setTimeout(resolve, 350))
      ]);
      mostrarAlerta('Mesas y comandas sincronizadas con éxito.', 'exito');
    } catch (err: any) {
      mostrarAlerta('Error al refrescar mesas: ' + (err.message || 'Error de red'), 'error');
    } finally {
      setRefrescandoMesas(false);
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
          tipo_iva: Number(it.porcentaje_iva ?? it.tipo_iva ?? prodCarta?.porcentaje_iva ?? prodCarta?.tipo_iva ?? configFiscal?.iva_defecto ?? 10) === 21 ? 21 : 10,
          porcentaje_iva: Number(it.porcentaje_iva ?? it.tipo_iva ?? prodCarta?.porcentaje_iva ?? prodCarta?.tipo_iva ?? configFiscal?.iva_defecto ?? 10) === 21 ? 21 : 10
        };
      });

    const dtoGeneralPorc = descuentoGeneralMesa[mesaKey] || 0;
    const totalFinal = Number((subtotalTrasLineas * (1 - dtoGeneralPorc / 100)).toFixed(2));
    const desgloseIva = calcularDesgloseImpuestosLineas(lineasCalculadas, dtoGeneralPorc);
    const descuentoTotalImporte = Number((subtotalBruto - totalFinal).toFixed(2));

    return {
      subtotalBruto: Number(subtotalBruto.toFixed(2)),
      dtoGeneralPorc,
      descuentoTotalImporte,
      totalFinal,
      base_imponible_10: desgloseIva.base_imponible_10,
      iva_10: desgloseIva.iva_10,
      base_imponible_21: desgloseIva.base_imponible_21,
      iva_21: desgloseIva.iva_21,
      baseImponibleTotal: desgloseIva.baseImponibleTotal,
      cuotaIvaTotal: desgloseIva.cuotaIvaTotal,
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

    const cfgFallback = configFiscal || { razon_social: 'NEXUS CAFETERÍA Y EVENTOS S.L.', nombre_comercial: 'NEXUS', nif_cif: 'B00000000', direccion_fiscal: 'Córdoba, España', telefono: '', iva_defecto: 10, pin_administrador: '1234' };
    const cfg = configFiscal || (navigator.onLine ? await obtenerConfiguracionFiscal().catch(() => cfgFallback) : cfgFallback) || cfgFallback;
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

  // --- TRASPASO DE MESAS ---
  const confirmarTraspasoMesa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalTraspaso) return;
    setModalTraspaso({ ...modalTraspaso, procesando: true });
    try {
      const destinoFormateado = getNombreMesa(modalTraspaso.destino);
      await supabase.from('comandas_cocina').update({ mesa: destinoFormateado }).eq('mesa', modalTraspaso.origen).eq('pagado', false);
      mostrarAlerta(`Mesa traspasada con éxito a ${destinoFormateado}.`, 'exito');
      setModalTraspaso(null);
      cargarMesasAbiertas();
    } catch (err: any) {
      mostrarAlerta('Error al traspasar mesa: ' + err.message, 'error');
      setModalTraspaso({ ...modalTraspaso, procesando: false });
    }
  };

  // --- DIVIDIR CUENTA / COBRO PARCIAL ---
  const initCobroParcial = (m: MesaAbierta) => {
    const disponibles = m.items.map(it => ({
      ...it,
      maxCantidad: it.cantidad,
      cantidadSeleccionada: 0
    }));
    setModalCobroParcial({ mesaNombre: m.mesa, itemsDisponibles: disponibles, procesando: false });
  };

  const actualizarCantidadParcial = (idx: number, delta: number) => {
    if (!modalCobroParcial) return;
    const nuevos = [...modalCobroParcial.itemsDisponibles];
    const nuevaCant = nuevos[idx].cantidadSeleccionada + delta;
    if (nuevaCant >= 0 && nuevaCant <= nuevos[idx].maxCantidad) {
      nuevos[idx].cantidadSeleccionada = nuevaCant;
      setModalCobroParcial({ ...modalCobroParcial, itemsDisponibles: nuevos });
    }
  };

  const confirmarCobroParcial = async (metodo: 'efectivo' | 'tarjeta') => {
    if (!modalCobroParcial || !camareroActivo) return;
    const itemsA_Cobrar = modalCobroParcial.itemsDisponibles.filter(i => i.cantidadSeleccionada > 0);
    if (itemsA_Cobrar.length === 0) {
      mostrarAlerta('Debes seleccionar al menos un artículo para cobrar.', 'aviso');
      return;
    }

    if (cajaAtrasada) { mostrarAlerta('¡ATENCIÓN! Cierra primero la caja del día anterior.', 'aviso'); return; }
    if (!cajaHoy || cajaHoy.estado === 'cerrada') { mostrarAlerta('Abre la caja de hoy primero.', 'aviso'); return; }

    setModalCobroParcial({ ...modalCobroParcial, procesando: true });
    
    const itemsProcesados: ItemPedido[] = itemsA_Cobrar.map(i => ({
      ...i,
      cantidad: i.cantidadSeleccionada
    }));

    const desglose = calcularDesgloseMesa(modalCobroParcial.mesaNombre, itemsProcesados);
    const cfgFallback = configFiscal || { razon_social: 'NEXUS CAFETERÍA Y EVENTOS S.L.', nombre_comercial: 'NEXUS', nif_cif: 'B00000000', direccion_fiscal: 'Córdoba, España', telefono: '', iva_defecto: 10, pin_administrador: '1234' };
    const cfg = configFiscal || (navigator.onLine ? await obtenerConfiguracionFiscal().catch(() => cfgFallback) : cfgFallback) || cfgFallback;

    try {
      if (!navigator.onLine) {
        throw new Error('Sin conexión a internet (offline)');
      }

      // Paso 2 (VeriFactu): Obtener el hash_actual del último ticket emitido (SELECT hash_actual FROM facturas_tickets ORDER BY id DESC LIMIT 1)
      let hash_anterior = '';
      try {
        const { data: ultimoTicket } = await supabase
          .from('facturas_tickets')
          .select('hash_actual')
          .order('id', { ascending: false })
          .limit(1)
          .maybeSingle();
        hash_anterior = ultimoTicket?.hash_actual || '';
      } catch (errPrevHash) {
        console.error('Error al obtener hash_anterior en VeriFactu:', errPrevHash);
        hash_anterior = '';
      }

      const { data: docEmitido, error: rpcError } = await supabase.rpc('emitir_documento_fiscal', {
        p_serie: 'T', p_tipo_documento: 'SIMPLIFICADA', p_mesa: modalCobroParcial.mesaNombre, p_vendedor: camareroActivo.nombre,
        p_metodo_pago: metodo, p_importe_efectivo: metodo === 'efectivo' ? desglose.totalFinal : 0, p_importe_tarjeta: metodo === 'tarjeta' ? desglose.totalFinal : 0,
        p_subtotal_bruto: desglose.subtotalBruto, p_descuento_general_porc: desglose.dtoGeneralPorc, p_descuento_total_imp: desglose.descuentoTotalImporte,
        p_autorizado_por: autorizadorDescuentoMesa[modalCobroParcial.mesaNombre] || null, p_tipo_iva: cfg.iva_defecto || 10, p_total_final: desglose.totalFinal, p_lineas: desglose.lineasCalculadas
      });
      if (rpcError) throw rpcError;

      const { data: comandasPendientes } = await supabase.from('comandas_cocina').select('*').eq('mesa', modalCobroParcial.mesaNombre).eq('pagado', false);
      
      let itemsRestantesA_Descontar = itemsA_Cobrar.map(i => ({ nombre: i.nombre, pendienteDescontar: i.cantidadSeleccionada }));
      
      if (comandasPendientes) {
        for (const comanda of comandasPendientes) {
          let itemsModificados = [];
          let comandaCambiada = false;

          for (const it of comanda.items) {
            let qty = it.cantidad;
            const matchDescuento = itemsRestantesA_Descontar.find(r => r.nombre === it.nombre && r.pendienteDescontar > 0);
            
            if (matchDescuento) {
              const aDescontarAqui = Math.min(qty, matchDescuento.pendienteDescontar);
              qty -= aDescontarAqui;
              matchDescuento.pendienteDescontar -= aDescontarAqui;
              comandaCambiada = true;
            }
            if (qty > 0) {
              itemsModificados.push({ ...it, cantidad: qty });
            }
          }

          if (comandaCambiada) {
            if (itemsModificados.length === 0) {
              await supabase.from('comandas_cocina').delete().eq('id', comanda.id);
            } else {
              await supabase.from('comandas_cocina').update({ items: itemsModificados }).eq('id', comanda.id);
            }
          }
        }
      }

      await supabase.from('comandas_cocina').insert([{
        ticket_number: 'PARC-' + Math.floor(1000 + Math.random() * 9000),
        mesa: modalCobroParcial.mesaNombre,
        tipo_destino: 'cuenta',
        camarero_nombre: camareroActivo.nombre,
        items: itemsProcesados,
        pagado: true,
        metodo_pago: metodo,
        total_ticket: desglose.totalFinal,
        factura_fiscal_id: docEmitido.id,
        numero_factura_legal: docEmitido.numero_completo
      }]);

      const nuevoEfectivo = Number(cajaHoy.total_efectivo) + (metodo === 'efectivo' ? desglose.totalFinal : 0);
      const nuevaTarjeta = Number(cajaHoy.total_tarjeta) + (metodo === 'tarjeta' ? desglose.totalFinal : 0);
      await supabase.from('caja_diaria').update({ total_efectivo: nuevoEfectivo, total_tarjeta: nuevaTarjeta }).eq('id', cajaHoy.id);

      // Paso 3 y Paso 4 (VeriFactu): Calcular SHA-256 y guardar tipo_factura: 'F2', hash_anterior y hash_actual en facturas_tickets
      await encadenarTicketVeriFactu({
        docEmitido,
        hash_anterior,
        mesa: modalCobroParcial.mesaNombre,
        vendedor: camareroActivo.nombre,
        metodo,
        desglose,
        ivaDefecto: cfg.iva_defecto || 10,
        autorizadoPor: autorizadorDescuentoMesa[modalCobroParcial.mesaNombre] || null
      });

      const { data: facturaCompleta } = await supabase.from('facturas_tickets').select('*').eq('id', docEmitido.id).single();
      if (facturaCompleta) { imprimirDocumentoFiscalHTML(facturaCompleta, cfg); }

      await descontarInventarioSupabase(itemsProcesados);

      mostrarAlerta(`Cobro parcial de ${desglose.totalFinal.toFixed(2)} € registrado y descontado.`, 'exito');
      setModalCobroParcial(null);
      cargarMesasAbiertas(); cargarCaja(); cargarProductosCarta();
    } catch (err: any) {
      mostrarAlerta('Error en cobro parcial: ' + err.message, 'error');
      setModalCobroParcial({ ...modalCobroParcial, procesando: false });
    }
  };

  // --- REGISTRAR MOVIMIENTO MANUAL CAJA ---
  const registrarMovimientoCaja = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalCajaManual || !cajaHoy) return;
    
    const importe = parseFloat(cajaImporte);
    if (importe <= 0 || !cajaConcepto.trim()) return;

    try {
      await supabase.from('movimientos_caja_manual').insert([{
        tipo: modalCajaManual.tipo,
        importe: importe,
        concepto: cajaConcepto.trim(),
        empleado: camareroActivo?.nombre || 'Desconocido'
      }]);

      // Si es salida de caja, restamos del total efectivo. Si es entrada, sumamos.
      const factor = modalCajaManual.tipo === 'ENTRADA' ? 1 : -1;
      const nuevoEfectivo = Number(cajaHoy.total_efectivo) + (importe * factor);
      
      await supabase.from('caja_diaria').update({ total_efectivo: nuevoEfectivo }).eq('id', cajaHoy.id);
      
      mostrarAlerta(`Registrada ${modalCajaManual.tipo} de caja por ${importe.toFixed(2)}€`, 'exito');
      setModalCajaManual(null);
      setCajaImporte('');
      setCajaConcepto('');
      cargarCaja();
    } catch (error: any) {
      mostrarAlerta('Error: ' + error.message, 'error');
    }
  };

  // --- APARCAR Y RECUPERAR CUENTAS ---
  const aparcarCuenta = async () => {
    if (carritoActual.length === 0 || !nombreCuentaAparcada.trim()) return;

    try {
      await supabase.from('cuentas_abiertas').insert([{
        nombre_mesa: nombreCuentaAparcada.trim(),
        lineas: carritoActual,
        total: totalCarritoActual,
        empleado: camareroActivo?.nombre || 'Desconocido'
      }]);
      
      mostrarAlerta(`Cuenta aparcada como: ${nombreCuentaAparcada}`, 'exito');
      setCarritoActual([]);
      setNombreCuentaAparcada('');
      setModalCuentasAparcadas(false);
    } catch (error: any) {
      mostrarAlerta('Error al aparcar: ' + error.message, 'error');
    }
  };

  const cargarCuentaAparcada = async (cuenta: any) => {
    setCarritoActual(cuenta.lineas);
    await supabase.from('cuentas_abiertas').update({ estado: 'COBRADA' }).eq('id', cuenta.id);
    setModalCuentasAparcadas(false);
    mostrarAlerta(`Cuenta cargada: ${cuenta.nombre_mesa}`, 'exito');
  };

  useEffect(() => {
    if (modalCuentasAparcadas) {
      supabase.from('cuentas_abiertas').select('*').eq('estado', 'ABIERTA').then(({ data }) => {
        if (data) setCuentasAparcadas(data);
      });
    }
  }, [modalCuentasAparcadas]);

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
        const existe = prev.find((p) => p.id === prod.id && !p.notaExtra);
        if (existe) {
          return prev.map((p) => (p.id === prod.id && !p.notaExtra ? { ...p, cantidad: p.cantidad + 1 } : p));
        }
        return [...prev, { ...prod, cantidad: 1, idCarritoUnico: Date.now() + Math.random() }];
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
    const itemsNuevos: Array<Producto & { cantidad: number; idCarritoUnico: number }> = [];

    itemsNuevos.push({
      ...comboActivo,
      id: baseId,
      idCarritoUnico: baseId,
      cantidad: 1
    });

    comboActivo.opciones_combo?.forEach((_, idx) => {
      const seleccion = seleccionesFinales[idx];
      if (seleccion) {
        itemsNuevos.push({
          id: baseId + idx + 1,
          idCarritoUnico: baseId + idx + 1,
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

  const cambiarCantidadCarrito = (idCarritoUnico: number, delta: number) => {
    setCarritoActual((prev) =>
      prev
        .map((p) => {
          if (p.idCarritoUnico === idCarritoUnico) {
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
    getNombreMesa(mesaSeleccionada),
    cuentaMesaActual.concat(
      carritoActual.map((c) => ({
        producto_id: c.id,
        articulo_inventario_id: c.articulo_inventario_id,
        nombre: c.nombre,
        precio: Number(c.precio),
        cantidad: c.cantidad,
        destino: c.destino,
        porcentaje_iva: c.porcentaje_iva ?? c.tipo_iva,
        tipo_iva: c.porcentaje_iva ?? c.tipo_iva
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
      const mesaDestinoFormat = getNombreMesa(mesaSeleccionada);

      const promesas = [];

      if (itemsCocina.length > 0) {
        promesas.push(
          supabase.from('comandas_cocina').insert([
            {
              ticket_number: ticketNum,
              mesa: mesaDestinoFormat,
              tipo_destino: 'cocina',
              camarero_nombre: camareroActivo.nombre,
              items: itemsCocina.map((i) => ({
                producto_id: i.id,
                articulo_inventario_id: i.articulo_inventario_id || null,
                nombre: i.nombre,
                precio: Number(i.precio),
                cantidad: i.cantidad,
                porcentaje_iva: Number(i.porcentaje_iva ?? i.tipo_iva ?? 10) === 21 ? 21 : 10,
                tipo_iva: Number(i.porcentaje_iva ?? i.tipo_iva ?? 10) === 21 ? 21 : 10,
                comentarios: `Anotado por ${camareroActivo.nombre}` + (i.notaExtra ? ` | NOTA: ${i.notaExtra}` : ''),
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
              mesa: mesaDestinoFormat,
              tipo_destino: 'barra',
              camarero_nombre: camareroActivo.nombre,
              items: itemsBarra.map((i) => ({
                producto_id: i.id,
                articulo_inventario_id: i.articulo_inventario_id || null,
                nombre: i.nombre,
                precio: Number(i.precio),
                cantidad: i.cantidad,
                porcentaje_iva: Number(i.porcentaje_iva ?? i.tipo_iva ?? 10) === 21 ? 21 : 10,
                tipo_iva: Number(i.porcentaje_iva ?? i.tipo_iva ?? 10) === 21 ? 21 : 10,
                comentarios: `Anotado por ${camareroActivo.nombre}` + (i.notaExtra ? ` | NOTA: ${i.notaExtra}` : '')
              }))
            }
          ])
        );
      }

      await Promise.all(promesas);

      mostrarAlerta(`¡Comanda enviada a Cocina/Barra correctamente! Actualizando...`, 'exito');
      setCarritoActual([]);
      cargarMesasAbiertas();

      setTimeout(() => {
        window.location.reload();
      }, 4000);

    } catch (err: any) {
      mostrarAlerta('Error: ' + err.message, 'error');
      setEnviando(false);
    }
  };

  const descontarInventarioSupabase = async (
    itemsCarrito: Array<{
      id?: number;
      producto_id?: number;
      articulo_inventario_id?: string;
      nombre: string;
      cantidad: number;
    }>
  ) => {
    try {
      const itemsValidos = itemsCarrito.filter(
        (item) => item && !item.nombre.includes('├─') && Number(item.cantidad) > 0
      );

      await Promise.all(
        itemsValidos.map(async (item) => {
          const prodLocal = productosCarta.find(
            (p) =>
              (item.producto_id && p.id === item.producto_id) ||
              (item.id && p.id === item.id) ||
              p.nombre.trim().toLowerCase() === item.nombre.trim().toLowerCase()
          );

          const prodId = prodLocal?.id || item.producto_id || item.id;

          let productoDB: {
            id: number;
            stock_actual: number | null;
            articulo_inventario_id?: string | null;
          } | null = null;

          if (prodId) {
            const { data, error } = await supabase
              .from('productos_carta')
              .select('id, stock_actual, articulo_inventario_id')
              .eq('id', prodId)
              .maybeSingle();

            if (error) throw error;
            productoDB = data;
          }

          if (!productoDB) {
            const { data, error } = await supabase
              .from('productos_carta')
              .select('id, stock_actual, articulo_inventario_id')
              .eq('nombre', item.nombre.trim())
              .maybeSingle();

            if (error) throw error;
            productoDB = data;
          }

          if (!productoDB) return;

          const stockActual = Number(productoDB.stock_actual ?? 0);
          const nuevoStock = stockActual - Number(item.cantidad);

          const { error: updateError } = await supabase
            .from('productos_carta')
            .update({ stock_actual: nuevoStock })
            .eq('id', productoDB.id);

          if (updateError) throw updateError;

          const artInvId = item.articulo_inventario_id || productoDB.articulo_inventario_id;
          if (artInvId) {
            const { error: updateMaestroError } = await supabase
              .from('articulos_cafeteria')
              .update({ stock_actual: nuevoStock })
              .eq('id', artInvId);

            if (updateMaestroError) throw updateMaestroError;
          }
        })
      );
    } catch (invError) {
      console.error('Error al descontar inventario en Supabase:', invError);
    }
  };

  // Función auxiliar VeriFactu: calcula el hash SHA-256 (NumeroTicket + FechaExpedicion + Total + HashAnterior)
  // y actualiza/inserta en facturas_tickets con tipo_factura: 'F2', hash_anterior y hash_actual dentro de try/catch
  const encadenarTicketVeriFactu = async (params: {
    docEmitido: any;
    hash_anterior: string;
    mesa: string;
    vendedor: string;
    metodo: 'efectivo' | 'tarjeta';
    desglose: any;
    ivaDefecto: number;
    autorizadoPor: string | null;
  }) => {
    try {
      const { docEmitido, hash_anterior, mesa, vendedor, metodo, desglose, ivaDefecto, autorizadoPor } = params;
      const fechaExpedicion = String(docEmitido?.fecha_expedicion || new Date().toISOString());
      const numeroTicket = String(
        docEmitido?.numero_completo || `T-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`
      );

      // Paso 3: Calcular Hash Actual (SHA-256) nativo del navegador sobre NumeroTicket + FechaExpedicion + Total + HashAnterior
      const hash_actual = await calcularHashVeriFactu(
        numeroTicket,
        fechaExpedicion,
        desglose.totalFinal,
        hash_anterior
      );

      const base10 = Number(desglose.base_imponible_10 ?? 0);
      const iva10 = Number(desglose.iva_10 ?? 0);
      const base21 = Number(desglose.base_imponible_21 ?? 0);
      const iva21 = Number(desglose.iva_21 ?? 0);
      const baseImponible = Number(
        desglose.baseImponibleTotal ?? Number((desglose.totalFinal / (1 + ivaDefecto / 100)).toFixed(2))
      );
      const cuotaIva = Number(
        desglose.cuotaIvaTotal ?? Number((desglose.totalFinal - baseImponible).toFixed(2))
      );

      // Paso 3 (IVA) y Paso 4 (VeriFactu): Guardar desglose de impuestos (10% y 21%), tipo_factura: 'F2', hash_anterior y hash_actual en facturas_tickets
      if (docEmitido?.id) {
        const { error: updateErr } = await supabase
          .from('facturas_tickets')
          .update({
            tipo_factura: 'F2',
            base_imponible_10: base10,
            iva_10: iva10,
            base_imponible_21: base21,
            iva_21: iva21,
            base_imponible: baseImponible,
            cuota_iva: cuotaIva,
            total_final: desglose.totalFinal,
            hash_anterior,
            hash_actual
          })
          .eq('id', docEmitido.id);

        if (updateErr) {
          console.error('Aviso VeriFactu/IVA (update completo):', updateErr);
          await supabase
            .from('facturas_tickets')
            .update({
              base_imponible: baseImponible,
              cuota_iva: cuotaIva,
              total_final: desglose.totalFinal,
              hash_anterior,
              hash_actual
            })
            .eq('id', docEmitido.id);
        }
      } else {
        const payloadTicketCompleto = {
          serie: 'T',
          tipo_documento: 'SIMPLIFICADA',
          tipo_factura: 'F2',
          numero_completo: numeroTicket,
          fecha_expedicion: fechaExpedicion,
          mesa,
          vendedor_nombre: vendedor,
          metodo_pago: metodo,
          importe_efectivo: metodo === 'efectivo' ? desglose.totalFinal : 0,
          importe_tarjeta: metodo === 'tarjeta' ? desglose.totalFinal : 0,
          subtotal_bruto: desglose.subtotalBruto,
          descuento_general_porcentaje: desglose.dtoGeneralPorc,
          descuento_total_importe: desglose.descuentoTotalImporte,
          autorizado_por: autorizadoPor,
          base_imponible_10: base10,
          iva_10: iva10,
          base_imponible_21: base21,
          iva_21: iva21,
          base_imponible: baseImponible,
          cuota_iva: cuotaIva,
          tipo_iva_aplicado: ivaDefecto,
          total_final: desglose.totalFinal,
          lineas: desglose.lineasCalculadas,
          estado_fiscal: 'EMITIDO',
          hash_anterior,
          hash_actual
        };
        const { error: insertErr } = await supabase.from('facturas_tickets').insert([payloadTicketCompleto]);
        if (insertErr) {
          const { base_imponible_10: _b10, iva_10: _i10, base_imponible_21: _b21, iva_21: _i21, ...payloadFallback } = payloadTicketCompleto;
          void _b10; void _i10; void _b21; void _i21;
          await supabase.from('facturas_tickets').insert([payloadFallback]);
        }
      }
    } catch (verifactuErr) {
      console.error('Error en cálculo/inserción VeriFactu (no bloqueante):', verifactuErr);
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
    const cfgFallback = configFiscal || { razon_social: 'NEXUS CAFETERÍA Y EVENTOS S.L.', nombre_comercial: 'NEXUS', nif_cif: 'B00000000', direccion_fiscal: 'Córdoba, España', telefono: '', iva_defecto: 10, pin_administrador: '1234' };
    const cfg = configFiscal || (navigator.onLine ? await obtenerConfiguracionFiscal().catch(() => cfgFallback) : cfgFallback) || cfgFallback;

    try {
      if (!navigator.onLine) {
        throw new Error('Sin conexión a internet (offline)');
      }

      // Paso 2 (VeriFactu): Obtener el hash_actual del último ticket emitido (SELECT hash_actual FROM facturas_tickets ORDER BY id DESC LIMIT 1)
      let hash_anterior = '';
      try {
        const { data: ultimoTicket } = await supabase
          .from('facturas_tickets')
          .select('hash_actual')
          .order('id', { ascending: false })
          .limit(1)
          .maybeSingle();
        hash_anterior = ultimoTicket?.hash_actual || '';
      } catch (errPrevHash) {
        console.error('Error al obtener hash_anterior en VeriFactu:', errPrevHash);
        hash_anterior = '';
      }

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

      // Paso 3 y Paso 4 (VeriFactu): Calcular SHA-256 y guardar tipo_factura: 'F2', hash_anterior y hash_actual en facturas_tickets
      await encadenarTicketVeriFactu({
        docEmitido,
        hash_anterior,
        mesa: mesaNombre,
        vendedor: camareroActivo.nombre,
        metodo,
        desglose,
        ivaDefecto: cfg.iva_defecto || 10,
        autorizadoPor: autorizadorDescuentoMesa[mesaNombre] || null
      });

      const { data: facturaCompleta } = await supabase
        .from('facturas_tickets')
        .select('*')
        .eq('id', docEmitido.id)
        .single();

      if (facturaCompleta) {
        imprimirDocumentoFiscalHTML(facturaCompleta, cfg);
      }

      await descontarInventarioSupabase(mesaObj.items);

      setCarritoActual([]);
      if (getNombreMesa(mesaSeleccionada) === mesaNombre) {
        setCuentaMesaActual([]);
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
      try {
        const pedidoOffline = {
          id_cola: `offline_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          mesa: mesaNombre,
          fecha: new Date().toISOString(),
          metodo,
          vendedor: camareroActivo.nombre,
          caja_id: cajaHoy.id,
          autorizado_por: autorizadorDescuentoMesa[mesaNombre] || null,
          tipo_iva: cfgFallback.iva_defecto || 10,
          items: mesaObj.items,
          totales: {
            subtotalBruto: desglose.subtotalBruto,
            dtoGeneralPorc: desglose.dtoGeneralPorc,
            descuentoTotalImporte: desglose.descuentoTotalImporte,
            base_imponible_10: desglose.base_imponible_10,
            iva_10: desglose.iva_10,
            base_imponible_21: desglose.base_imponible_21,
            iva_21: desglose.iva_21,
            baseImponibleTotal: desglose.baseImponibleTotal,
            cuotaIvaTotal: desglose.cuotaIvaTotal,
            totalFinal: desglose.totalFinal,
            importeEfectivo: metodo === 'efectivo' ? desglose.totalFinal : 0,
            importeTarjeta: metodo === 'tarjeta' ? desglose.totalFinal : 0
          },
          lineas: desglose.lineasCalculadas
        };

        const rawCola = localStorage.getItem('pedidos_offline');
        const colaActual = rawCola ? JSON.parse(rawCola) : [];
        const listaPedidos = Array.isArray(colaActual) ? colaActual : [];
        listaPedidos.push(pedidoOffline);
        localStorage.setItem('pedidos_offline', JSON.stringify(listaPedidos));
      } catch (storageErr) {
        console.error('Error guardando en pedidos_offline de localStorage:', storageErr);
      }

      // Limpiar carrito y cerrar la mesa visualmente sin bloquear el TPV
      setCarritoActual([]);
      if (getNombreMesa(mesaSeleccionada) === mesaNombre) {
        setCuentaMesaActual([]);
      }
      setMesasAbiertas((prev) => prev.filter((m) => m.mesa !== mesaNombre));
      setDescuentoGeneralMesa((prev) => {
        const copia = { ...prev };
        delete copia[mesaNombre];
        return copia;
      });

      mostrarAlerta('Sin conexión. Pedido guardado en cola local', 'aviso');
      console.warn('Venta almacenada en cola offline:', err);
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
      const cfgFallback = configFiscal || { razon_social: 'NEXUS CAFETERÍA Y EVENTOS S.L.', nombre_comercial: 'NEXUS', nif_cif: 'B00000000', direccion_fiscal: 'Córdoba, España', telefono: '', iva_defecto: 10, pin_administrador: '1234' };
    const cfg = configFiscal || (navigator.onLine ? await obtenerConfiguracionFiscal().catch(() => cfgFallback) : cfgFallback) || cfgFallback;
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
      const cfgFallback = configFiscal || { razon_social: 'NEXUS CAFETERÍA Y EVENTOS S.L.', nombre_comercial: 'NEXUS', nif_cif: 'B00000000', direccion_fiscal: 'Córdoba, España', telefono: '', iva_defecto: 10, pin_administrador: '1234' };
    const cfg = configFiscal || (navigator.onLine ? await obtenerConfiguracionFiscal().catch(() => cfgFallback) : cfgFallback) || cfgFallback;

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
      const cfgFallback = configFiscal || { razon_social: 'NEXUS CAFETERÍA Y EVENTOS S.L.', nombre_comercial: 'NEXUS', nif_cif: 'B00000000', direccion_fiscal: 'Córdoba, España', telefono: '', iva_defecto: 10, pin_administrador: '1234' };
    const cfg = configFiscal || (navigator.onLine ? await obtenerConfiguracionFiscal().catch(() => cfgFallback) : cfgFallback) || cfgFallback;
      const ivaPorc = cfg.iva_defecto || 10;
      const baseImp = Number((desgloseMesaSeleccionada.totalFinal / (1 + ivaPorc / 100)).toFixed(2));
      const cuotaIva = Number((desgloseMesaSeleccionada.totalFinal - baseImp).toFixed(2));

      imprimirDocumentoFiscalHTML(
        {
          serie: 'PROFORMA',
          tipo_documento: 'PRE-TICKET / CUENTA MESA (PENDIENTE DE COBRO)',
          numero_completo: `CUENTA-MESA-${mesaSeleccionada}`,
          fecha_expedicion: new Date().toISOString(),
          mesa: getNombreMesa(mesaSeleccionada),
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

  const abrirModalAperturaCaja = () => {
    setRemanenteAperturaInput('50.00');
    setShowModalApertura(true);
  };

  const confirmarAperturaCaja = async (e: React.FormEvent) => {
    e.preventDefault();
    const remanenteNum = parseFloat(remanenteAperturaInput);
    if (isNaN(remanenteNum) || remanenteNum < 0) {
      mostrarAlerta('Por favor, introduce un fondo de caja inicial válido.', 'error');
      return;
    }

    setProcesandoApertura(true);
    try {
      const fechaHoy = new Date().toISOString().split('T')[0];
      const remanente_apertura = Number(remanenteNum.toFixed(2));

      const { data: nuevaCaja, error } = await supabase
        .from('caja_diaria')
        .insert([
          {
            fecha: fechaHoy,
            estado: 'abierta',
            remanente_apertura,
            total_efectivo: 0.00,
            total_tarjeta: 0.00,
            efectivo_real: 0.00,
            descuadre: 0.00
          }
        ])
        .select()
        .single();

      if (error) throw error;

      setShowModalApertura(false);
      setCajaHoy(nuevaCaja as CajaDiaria);
      mostrarAlerta(`¡Caja / Turno abierto con éxito! Fondo inicial: ${remanente_apertura.toFixed(2)} €.`, 'exito');
      cargarCaja();
    } catch (err: any) {
      mostrarAlerta('Error al abrir la caja: ' + err.message, 'error');
    } finally {
      setProcesandoApertura(false);
    }
  };

  /*
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

  */
  const abrirModalCierreCaja = async () => {
    try {
      const { data, error } = await supabase
        .from('caja_diaria')
        .select('id, fecha, remanente_apertura, total_efectivo, total_tarjeta, estado')
        .eq('estado', 'abierta')
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        mostrarAlerta('No hay ninguna caja abierta actualmente en el sistema.', 'aviso');
        return;
      }

      const { id, remanente_apertura, total_efectivo, total_tarjeta } = data;
      setEfectivoRealInput('');
      setDatosArqueoCaja({
        id,
        fecha: data.fecha,
        remanente_apertura: Number(remanente_apertura || 0),
        total_efectivo: Number(total_efectivo || 0),
        total_tarjeta: Number(total_tarjeta || 0)
      });
      setShowModalArqueo(true);
    } catch (err: any) {
      mostrarAlerta('Error al obtener el estado actual de la caja: ' + err.message, 'error');
    }
  };

  const confirmarCierreCaja = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!datosArqueoCaja) return;

    const efectivo_real = parseFloat(efectivoRealInput);
    if (isNaN(efectivo_real) || efectivo_real < 0) {
      mostrarAlerta('Por favor, introduce el dinero físico contado en el cajón.', 'error');
      return;
    }

    setProcesandoArqueo(true);

    try {
      const { id, remanente_apertura, total_efectivo, total_tarjeta } = datosArqueoCaja;
      const efectivoEsperado = Number((total_efectivo + remanente_apertura).toFixed(2));
      const descuadre = Number((efectivo_real - (total_efectivo + remanente_apertura)).toFixed(2));
      const remanente_cierre = 50.00;
      const efectivo_retirado = Number((efectivo_real - 50.00).toFixed(2));

      const { error: updateError } = await supabase
        .from('caja_diaria')
        .update({
          estado: 'cerrada',
          efectivo_real,
          descuadre,
          remanente_cierre,
          efectivo_retirado
        })
        .eq('id', id);

      if (updateError) throw updateError;

      if (camareroActivo) {
        try {
          await supabase.from('cierres_caja').insert([
            {
              usuario_nombre: camareroActivo.nombre,
              fondo_inicial: remanente_apertura,
              ventas_efectivo_sistema: total_efectivo,
              ventas_tarjeta_sistema: total_tarjeta,
              efectivo_esperado_caja: efectivoEsperado,
              efectivo_contado_trabajador: efectivo_real,
              tarjeta_contada_trabajador: total_tarjeta,
              descuadre_efectivo: descuadre,
              descuadre_tarjeta: 0,
              observaciones: `Cierre de Caja - Arqueo Ciego (${datosArqueoCaja.fecha || new Date().toISOString().split('T')[0]})`
            }
          ]);
        } catch (histErr) {
          console.warn('No se pudo registrar histórico en cierres_caja:', histErr);
        }
      }

      setShowModalArqueo(false);
      setDatosArqueoCaja(null);
      setEfectivoRealInput('');

      // Actualizar estado local de React inmediatamente para reflejar que el turno actual ha finalizado
      setCajaHoy((prev) =>
        prev && prev.id === id
          ? {
              ...prev,
              efectivo_real,
              descuadre,
              remanente_cierre,
              efectivo_retirado,
              estado: 'cerrada'
            }
          : prev
      );
      setCajaAtrasada((prev) => (prev && prev.id === id ? null : prev));

      const cuadrada = Math.abs(descuadre) < 0.01;
      setResumenCierreModal({
        cuadrada,
        efectivo_real,
        efectivo_esperado: efectivoEsperado,
        total_tarjeta,
        descuadre,
        remanente_cierre,
        efectivo_retirado
      });

      const msgResumen = cuadrada
        ? `¡Cierre de caja completado! La caja ha cuadrado a cero (0.00 €). Retirado: ${efectivo_retirado.toFixed(2)} €.`
        : `Cierre completado con descuadre de ${descuadre > 0 ? '+' : ''}${descuadre.toFixed(2)} €. Retirado: ${efectivo_retirado.toFixed(2)} €.`;

      mostrarAlerta(msgResumen, cuadrada ? 'exito' : 'aviso');
      cargarCaja();
    } catch (err: any) {
      mostrarAlerta('Error al cerrar la caja: ' + err.message, 'error');
    } finally {
      setProcesandoArqueo(false);
    }
  };

  /*
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

  */
  const salirSesion = () => {
    setCamareroActivo(null);
    sessionStorage.removeItem('nexus_camarero_sesion');
  };

  const renderTicket = (f: any, nivel: number = 0) => (
    <div key={f.id} className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-black/40 border border-white/10 text-xs shadow-sm`}>
      <div className="space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          {nivel > 0 && <CornerDownRight className="h-4 w-4 text-slate-500" />}
          <span className="font-mono font-black text-cyan-400 text-sm">{f.numero_completo}</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${f.serie === 'R' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : f.serie === 'F' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'}`}>
            {f.tipo_documento}
          </span>
          <span className="text-slate-300 font-bold">{f.mesa}</span>
          {f.estado_fiscal !== 'EMITIDO' && (
            <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-bold">{f.estado_fiscal}</span>
          )}
        </div>
        <p className="text-[11px] text-slate-400">
          {new Date(f.fecha_expedicion).toLocaleTimeString('es-ES')} · Atendido por: <strong>{f.vendedor_nombre}</strong> · Pago: <strong>{f.metodo_pago.toUpperCase()}</strong>
          {f.cliente_nif && ` · Cliente: ${f.cliente_nombre_razon} (${f.cliente_nif})`}
        </p>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-center">
        <span className={`font-mono font-black text-sm mr-2 ${Number(f.total_final) < 0 ? 'text-rose-400' : 'text-white'}`}>
          {Number(f.total_final).toFixed(2)} €
        </span>
        <button type="button" title="Reimprimir documento fiscal" onClick={async () => { const cfg = configFiscal || (await obtenerConfiguracionFiscal()); imprimirDocumentoFiscalHTML(f, cfg); }} className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold flex items-center gap-1 cursor-pointer">
          <Printer className="h-3.5 w-3.5" /> Ticket
        </button>
        {f.serie === 'T' && f.estado_fiscal === 'EMITIDO' && (
          <button type="button" title="Convertir en Factura Nominativa para cliente" onClick={() => setModalFacturaNominativa({ factura: f, razonSocial: '', nifCif: '', direccion: '', procesando: false })} className="px-2.5 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500 hover:text-slate-950 text-cyan-300 border border-cyan-500/30 font-bold flex items-center gap-1 cursor-pointer transition-all">
            <FileText className="h-3.5 w-3.5" /> Factura
          </button>
        )}
        {(f.serie === 'T' || f.serie === 'F') && f.estado_fiscal === 'EMITIDO' && (
          <button type="button" title="Anular / Devolver (Factura Rectificativa Simplificada)" onClick={() => setModalRectificativa({ factura: f, motivo: '', pinAdmin: '', procesando: false })} className="px-2.5 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-600 hover:text-white text-rose-300 border border-rose-500/30 font-bold flex items-center gap-1 cursor-pointer transition-all">
            <RotateCcw className="h-3.5 w-3.5" /> Devolver
          </button>
        )}
      </div>
    </div>
  );

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

  const facturasAgrupadas = agruparFacturas(facturasHoy);

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

      {/* MODAL DE APERTURA DE CAJA / TURNO */}
      {showModalApertura && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md px-4">
          <form
            onSubmit={confirmarAperturaCaja}
            className="w-full max-w-md bg-[#0d0f17] border border-emerald-500/40 rounded-3xl p-6 shadow-2xl space-y-5"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 text-emerald-400">
                <LockOpen className="h-5 w-5" />
                <h3 className="font-black text-white text-base">Apertura de Caja / Turno</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModalApertura(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Confirma el fondo de caja inicial (remanente de apertura) en efectivo con el que se inicia el turno de hoy.
            </p>

            <div className="space-y-2">
              <label className="text-xs font-bold text-emerald-400 uppercase block">
                Fondo de Caja Inicial (Remanente de Apertura) *
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  autoFocus
                  value={remanenteAperturaInput}
                  onChange={(e) => setRemanenteAperturaInput(e.target.value)}
                  className="w-full bg-black/70 border-2 border-emerald-500/50 focus:border-emerald-400 rounded-2xl px-4 py-4 text-3xl font-mono font-black text-emerald-400 text-center outline-none shadow-inner"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xl font-mono font-bold text-slate-500">
                  €
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowModalApertura(false)}
                className="py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-300 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={procesandoApertura}
                className="py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase flex items-center justify-center gap-1.5 cursor-pointer shadow-lg disabled:opacity-50"
              >
                <LockOpen className="h-4 w-4" />
                {procesandoApertura ? 'Abriendo...' : 'Confirmar Apertura'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL DE ARQUEO CIEGO - CIERRE DE CAJA */}
      {showModalArqueo && datosArqueoCaja && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md px-4">
          <form
            onSubmit={confirmarCierreCaja}
            className="w-full max-w-md bg-[#0d0f17] border border-amber-500/40 rounded-3xl p-6 shadow-2xl space-y-5"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 text-amber-400">
                <Calculator className="h-5 w-5" />
                <h3 className="font-black text-white text-base">Cierre de Caja · Arqueo Ciego</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowModalArqueo(false);
                  setDatosArqueoCaja(null);
                }}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-sky-950/30 border border-sky-500/30 space-y-1">
                <span className="text-[10px] font-bold uppercase text-sky-400 flex items-center gap-1">
                  <CreditCard className="h-3.5 w-3.5" /> Total Tarjeta
                </span>
                <p className="text-xl font-black font-mono text-white">
                  {Number(datosArqueoCaja.total_tarjeta).toFixed(2)} €
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-black/50 border border-white/10 space-y-1 flex flex-col justify-between">
                <span className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
                  <EyeOff className="h-3.5 w-3.5 text-amber-400" /> Efectivo Teórico
                </span>
                <p className="text-xs font-bold text-slate-500 italic">Oculto (Arqueo Ciego)</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-amber-400 uppercase block">
                Efectivo Real en Cajón (Monedas y Billetes) *
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  autoFocus
                  placeholder="0.00"
                  value={efectivoRealInput}
                  onChange={(e) => setEfectivoRealInput(e.target.value)}
                  className="w-full bg-black/70 border-2 border-amber-500/50 focus:border-amber-400 rounded-2xl px-4 py-4 text-3xl font-mono font-black text-amber-400 text-center outline-none shadow-inner"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xl font-mono font-bold text-slate-500">
                  €
                </span>
              </div>
              <p className="text-[11px] text-slate-400 text-center">
                Se mantendrá un fondo fijo de cierre de <strong className="text-white">50.00 €</strong> en caja.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowModalArqueo(false);
                  setDatosArqueoCaja(null);
                }}
                className="py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-300 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={procesandoArqueo}
                className="py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase flex items-center justify-center gap-1.5 cursor-pointer shadow-lg disabled:opacity-50"
              >
                <Lock className="h-4 w-4" />
                {procesandoArqueo ? 'Cerrando...' : 'Confirmar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ALERTA VISUAL / RESUMEN DE CIERRE DE CAJA */}
      {resumenCierreModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-md px-4">
          <div className="w-full max-w-md bg-[#0d0f17] border border-white/15 rounded-3xl p-6 shadow-2xl space-y-5 text-center">
            <div
              className={`h-16 w-16 mx-auto rounded-2xl flex items-center justify-center border ${
                resumenCierreModal.cuadrada
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                  : 'bg-amber-500/10 border-amber-500/40 text-amber-400'
              }`}
            >
              {resumenCierreModal.cuadrada ? (
                <CheckCircle2 className="h-9 w-9" />
              ) : (
                <AlertTriangle className="h-9 w-9" />
              )}
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-black text-white">
                {resumenCierreModal.cuadrada ? '¡Caja Cuadrada a Cero!' : 'Cierre Registrado con Descuadre'}
              </h3>
              <p className="text-xs text-slate-400">
                El turno actual ha finalizado y la caja ha quedado en estado <strong className="text-rose-400">CERRADA</strong>.
              </p>
            </div>

            <div className="bg-black/50 border border-white/10 rounded-2xl p-4 space-y-2.5 text-xs text-left">
              <div className="flex justify-between">
                <span className="text-slate-400">Efectivo Físico Contado:</span>
                <span className="font-mono font-bold text-white">{resumenCierreModal.efectivo_real.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Efectivo Teórico Esperado:</span>
                <span className="font-mono font-bold text-slate-300">{resumenCierreModal.efectivo_esperado.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total Ventas Tarjeta:</span>
                <span className="font-mono font-bold text-sky-400">{resumenCierreModal.total_tarjeta.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between border-t border-white/10 pt-2">
                <span className="font-bold text-slate-300">Descuadre:</span>
                <span
                  className={`font-mono font-black text-sm ${
                    resumenCierreModal.cuadrada ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {resumenCierreModal.descuadre > 0 ? '+' : ''}
                  {resumenCierreModal.descuadre.toFixed(2)} €
                </span>
              </div>
              <div className="flex justify-between border-t border-white/10 pt-2">
                <span className="text-slate-400">Remanente Cierre (Fondo Fijo):</span>
                <span className="font-mono font-bold text-amber-400">{resumenCierreModal.remanente_cierre.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Efectivo Retirado:</span>
                <span className="font-mono font-bold text-cyan-400">{resumenCierreModal.efectivo_retirado.toFixed(2)} €</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setResumenCierreModal(null)}
              className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs uppercase cursor-pointer shadow-lg"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* MODAL ENTRADAS Y SALIDAS MANUALES DE CAJA */}
      {modalCajaManual && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md px-4">
          <form onSubmit={registrarMovimientoCaja} className="w-full max-w-sm bg-[#0d0f17] border border-white/10 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className={`flex items-center gap-2 ${modalCajaManual.tipo === 'ENTRADA' ? 'text-emerald-400' : 'text-rose-400'}`}>
                {modalCajaManual.tipo === 'ENTRADA' ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                <h3 className="font-black text-white text-base">Registrar {modalCajaManual.tipo}</h3>
              </div>
              <button type="button" onClick={() => setModalCajaManual(null)} className="text-slate-400 hover:text-white cursor-pointer"><X className="h-5 w-5" /></button>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Importe (€) *</label>
              <input type="number" step="0.01" required value={cajaImporte} onChange={(e) => setCajaImporte(e.target.value)} className="w-full bg-black/60 border border-white/20 rounded-xl px-4 py-3 text-white font-mono text-lg font-bold" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Concepto / Motivo *</label>
              <input type="text" required placeholder="Ej: Pago a proveedor, cambio, hielo..." value={cajaConcepto} onChange={(e) => setCajaConcepto(e.target.value)} className="w-full bg-black/60 border border-white/20 rounded-xl px-4 py-3 text-white" />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setModalCajaManual(null)} className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-bold text-slate-300 text-xs cursor-pointer">Cancelar</button>
              <button type="submit" className={`flex-1 py-3 rounded-xl font-black text-xs uppercase text-slate-950 cursor-pointer ${modalCajaManual.tipo === 'ENTRADA' ? 'bg-emerald-500 hover:bg-emerald-400' : 'bg-rose-500 hover:bg-rose-400'}`}>Guardar</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL CUENTAS APARCADAS */}
      {modalCuentasAparcadas && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md px-4">
          <div className="w-full max-w-lg bg-[#0d0f17] border border-purple-500/30 rounded-3xl p-6 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
              <div className="flex items-center gap-2 text-purple-400">
                <FolderOpen className="h-5 w-5" />
                <h3 className="font-black text-white text-base">Cuentas Aparcadas (Libres)</h3>
              </div>
              <button type="button" onClick={() => setModalCuentasAparcadas(false)} className="text-slate-400 hover:text-white cursor-pointer"><X className="h-5 w-5" /></button>
            </div>
            
            {/* Guardar carrito actual */}
            {carritoActual.length > 0 && (
              <div className="bg-purple-950/20 p-4 rounded-2xl border border-purple-500/30 flex gap-2 mb-4">
                <input type="text" placeholder="Asigna un nombre a esta cuenta (Ej: Chicos del fondo)" value={nombreCuentaAparcada} onChange={(e) => setNombreCuentaAparcada(e.target.value)} className="flex-1 bg-black/60 border border-white/20 rounded-xl px-4 py-2 text-white text-xs" />
                <button onClick={aparcarCuenta} className="px-5 py-2 bg-purple-600 hover:bg-purple-500 font-bold text-white rounded-xl text-xs whitespace-nowrap flex items-center gap-2 cursor-pointer shadow-lg"><Save className="h-4 w-4" /> Aparcar Ticket</button>
              </div>
            )}

            {/* Lista de mesas */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {cuentasAparcadas.length === 0 ? (
                <p className="text-slate-500 text-xs text-center py-6 italic bg-black/20 rounded-xl">No hay cuentas aparcadas actualmente.</p>
              ) : (
                cuentasAparcadas.map(cuenta => (
                  <div key={cuenta.id} className="bg-black/40 border border-white/10 p-3.5 rounded-xl flex justify-between items-center shadow-sm">
                    <div>
                      <div className="font-bold text-white text-sm">{cuenta.nombre_mesa}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{new Date(cuenta.fecha_apertura).toLocaleTimeString()} · {cuenta.empleado}</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-mono font-bold text-amber-400">{Number(cuenta.total).toFixed(2)} €</span>
                      <button onClick={() => cargarCuentaAparcada(cuenta)} className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl text-xs shadow-md cursor-pointer transition-colors">Cargar</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL NOTAS LIBRES */}
      {modalNotaItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md px-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setCarritoActual((prev) => prev.map((p) => p.idCarritoUnico === modalNotaItem.idCarritoUnico ? { ...p, notaExtra: modalNotaItem.notaActual } : p));
              setModalNotaItem(null);
            }}
            className="w-full max-w-md bg-[#0d0f17] border border-cyan-500/40 rounded-3xl p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 text-cyan-400">
                <PenLine className="h-5 w-5" />
                <h3 className="font-black text-white text-base">Añadir Nota para Cocina/Barra</h3>
              </div>
              <button type="button" onClick={() => setModalNotaItem(null)} className="text-slate-400 hover:text-white cursor-pointer"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300">Nota para: <strong className="text-white">{modalNotaItem.nombre}</strong></label>
              <input
                type="text"
                autoFocus
                placeholder="Ej: Sin hielo, muy hecho, descafeinado..."
                value={modalNotaItem.notaActual}
                onChange={(e) => setModalNotaItem({ ...modalNotaItem, notaActual: e.target.value })}
                className="w-full bg-black/60 border border-white/20 rounded-xl px-4 py-3 text-white focus:border-cyan-400"
              />
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button type="button" onClick={() => setModalNotaItem(null)} className="py-3 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-slate-300 cursor-pointer">Cancelar</button>
              <button type="submit" className="py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs uppercase cursor-pointer">Guardar Nota</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL TRASPASO DE MESA */}
      {modalTraspaso && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md px-4">
          <form onSubmit={confirmarTraspasoMesa} className="w-full max-w-md bg-[#0d0f17] border border-amber-500/40 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 text-amber-400">
                <ArrowRightLeft className="h-5 w-5" />
                <h3 className="font-black text-white text-base">Traspasar Pedido</h3>
              </div>
              <button type="button" onClick={() => setModalTraspaso(null)} className="text-slate-400 hover:text-white cursor-pointer"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-slate-300">Mover cuenta desde <strong>{modalTraspaso.origen}</strong> a:</p>
              <select
                value={modalTraspaso.destino}
                onChange={(e) => setModalTraspaso({ ...modalTraspaso, destino: e.target.value })}
                className="w-full bg-black/60 border border-amber-500/50 rounded-xl px-4 py-3 text-sm font-black text-amber-400 outline-none cursor-pointer"
              >
                <option value="BARRA">Servicio en Barra</option>
                {Array.from({ length: 20 }, (_, i) => String(i + 1)).map((m) => (
                  getNombreMesa(m) !== modalTraspaso.origen && <option key={m} value={m}>Mesa {m}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button type="button" onClick={() => setModalTraspaso(null)} className="py-3 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-slate-300 cursor-pointer">Cancelar</button>
              <button type="submit" disabled={modalTraspaso.procesando} className="py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase cursor-pointer disabled:opacity-50">{modalTraspaso.procesando ? 'Traspasando...' : 'Confirmar Traspaso'}</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL COBRO PARCIAL */}
      {modalCobroParcial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md px-4">
          <div className="w-full max-w-md bg-[#0d0f17] border border-cyan-500/40 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 text-cyan-400">
                <Split className="h-5 w-5" />
                <h3 className="font-black text-white text-base">Dividir Cuenta: {modalCobroParcial.mesaNombre}</h3>
              </div>
              <button type="button" onClick={() => setModalCobroParcial(null)} className="text-slate-400 hover:text-white cursor-pointer"><X className="h-5 w-5" /></button>
            </div>
            <p className="text-xs text-slate-400">Selecciona cuántas unidades de cada artículo vas a cobrar ahora mismo.</p>
            
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {modalCobroParcial.itemsDisponibles.map((it, idx) => (
                <div key={idx} className={`flex items-center justify-between p-3.5 rounded-xl border ${it.cantidadSeleccionada > 0 ? 'bg-cyan-950/30 border-cyan-500/30' : 'bg-black/40 border-white/10'}`}>
                  <div className="flex-1">
                    <span className="text-white text-xs font-bold">{it.nombre}</span>
                    <div className="text-[10px] text-slate-400">{it.precio.toFixed(2)} €/ud</div>
                  </div>
                  <div className="flex gap-2 items-center bg-white/5 rounded-lg p-1.5 border border-white/10">
                    <button type="button" onClick={() => actualizarCantidadParcial(idx, -1)} className="px-2.5 py-1.5 bg-black/40 text-slate-400 hover:text-white rounded-md cursor-pointer"><Minus className="h-3 w-3" /></button>
                    <span className="text-sm font-mono font-bold w-6 text-center text-cyan-400">{it.cantidadSeleccionada}</span>
                    <button type="button" onClick={() => actualizarCantidadParcial(idx, 1)} className="px-2.5 py-1.5 bg-black/40 text-slate-400 hover:text-white rounded-md cursor-pointer"><Plus className="h-3 w-3" /></button>
                    <span className="text-xs font-mono w-6 text-center text-slate-500">/ {it.maxCantidad}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-white/10">
              <div className="flex justify-between items-center mb-4">
                <span className="text-xs font-bold text-slate-400 uppercase">Subtotal Seleccionado:</span>
                <span className="text-xl font-black text-white font-mono">
                  {modalCobroParcial.itemsDisponibles.reduce((acc, i) => acc + (i.precio * i.cantidadSeleccionada), 0).toFixed(2)} €
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => confirmarCobroParcial('efectivo')} disabled={modalCobroParcial.procesando} className="py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-xs uppercase flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"><DollarSign className="h-4 w-4" /> Efectivo</button>
                <button onClick={() => confirmarCobroParcial('tarjeta')} disabled={modalCobroParcial.procesando} className="py-3.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs uppercase flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"><CreditCard className="h-4 w-4" /> Tarjeta</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL AUTORIZACION DESCUENTO */}
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
                    className="px-3 py-2 rounded-lg bg-white/5 hover:bg-amber-500 hover:text-slate-950 text-xs font-bold border border-white/10 cursor-pointer transition-colors"
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
                className="w-full bg-black/60 border border-white/20 rounded-xl px-4 py-3 text-white font-mono font-bold"
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
                  className="w-full bg-black/60 border border-amber-500/40 rounded-xl px-4 py-3 text-white font-mono"
                />
              </div>
            ) : (
              <p className="text-xs text-emerald-400 bg-emerald-950/30 border border-emerald-500/30 p-3 rounded-xl">
                ✓ Sesión activa como Administrador ({camareroActivo.nombre}). Autorización directa.
              </p>
            )}

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModalAuthDescuento(null)}
                className="py-3 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-slate-300 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase cursor-pointer"
              >
                Aplicar Descuento
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL FACTURA RECTIFICATIVA */}
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
                  Emitir Factura Rectificativa
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

            {camareroActivo?.rol !== 'admin' && (
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

      {/* MODAL FACTURA NOMINATIVA */}
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
                <label className="text-xs font-bold text-slate-300 block mb-1">Nombre Completo o Razón Social *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Empresa Cliente S.L. o Juan Pérez"
                  value={modalFacturaNominativa.razonSocial}
                  onChange={(e) => setModalFacturaNominativa({ ...modalFacturaNominativa, razonSocial: e.target.value })}
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
                  onChange={(e) => setModalFacturaNominativa({ ...modalFacturaNominativa, direccion: e.target.value })}
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
              <h1 className="text-lg sm:text-xl font-black tracking-wide text-white">NEXUS · TPV CAFETERÍA</h1>
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
          {(!cajaHoy || cajaHoy.estado !== 'abierta') && !cajaAtrasada && (
            <button
              type="button"
              onClick={abrirModalAperturaCaja}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(16,185,129,0.4)] cursor-pointer transition-all"
            >
              <LockOpen className="h-4 w-4" />
              <span>Abrir Caja / Turno</span>
            </button>
          )}
          {camareroActivo.rol === 'admin' && (
            <button
              type="button"
              onClick={() => setMostrarBackoffice(true)}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-500 hover:from-cyan-400 hover:to-sky-400 text-slate-950 font-black text-xs shadow-lg cursor-pointer transition-all"
            >
              <Settings className="h-4 w-4" />
              <span>Backoffice</span>
            </button>
          )}

          <button
            onClick={toggleCocina}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md border cursor-pointer ${
              cocinaAbierta
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500 hover:text-slate-950'
                : 'bg-rose-500/20 text-rose-400 border-rose-500/40 hover:bg-rose-500 hover:text-slate-950'
            }`}
          >
            <Power className="h-4 w-4" />
            {cocinaAbierta ? 'Cocina Abierta' : 'Cocina CERRADA'}
          </button>

          <button
            type="button"
            onClick={refrescarMesasManual}
            disabled={refrescandoMesas}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 text-xs font-bold shadow-md transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`h-4 w-4 ${refrescandoMesas ? 'animate-spin' : ''}`} />
            <span>{refrescandoMesas ? 'Sincronizando...' : 'Refrescar Mesas'}</span>
          </button>

          <div className="flex gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
            <button
              onClick={() => setVistaSeccion('tomar_nota')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                vistaSeccion === 'tomar_nota' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              📝 Toma Notas
            </button>
            <button
              onClick={() => setVistaSeccion('mesas_abiertas')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all relative cursor-pointer ${
                vistaSeccion === 'mesas_abiertas' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              📋 Mesas ({mesasAbiertas.length})
            </button>
            <button
              onClick={() => setVistaSeccion('caja')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                vistaSeccion === 'caja' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              💰 Caja y Tickets
            </button>
          </div>

          <button
            type="button"
            onClick={salirSesion}
            className="hidden sm:flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white transition-all cursor-pointer text-xs font-bold"
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
                <span className="text-xs font-bold uppercase text-slate-300">Origen:</span>
                <select
                  value={mesaSeleccionada}
                  onChange={(e) => setMesaSeleccionada(e.target.value)}
                  className="bg-black/80 border border-amber-500/50 rounded-xl px-3 py-2 text-sm font-black text-amber-400 outline-none cursor-pointer"
                >
                  <option value="BARRA">Servicio en Barra</option>
                  {Array.from({ length: 20 }, (_, i) => String(i + 1)).map((m) => (
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
                    className="w-full bg-black/60 border border-white/15 rounded-xl pl-9 pr-3 py-2 text-xs text-white outline-none focus:border-amber-400"
                  />
                </div>
              </form>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setModalCuentasAparcadas(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg transition-all cursor-pointer"
                >
                  <FolderOpen className="h-4 w-4" />
                  <span className="hidden sm:inline">Aparcadas</span>
                </button>
                <button
                  type="button"
                  onClick={imprimirPreTicketCuenta}
                  disabled={imprimiendoPreTicket || (cuentaMesaActual.length === 0 && carritoActual.length === 0)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg transition-all cursor-pointer disabled:opacity-50"
                >
                  <Printer className="h-4 w-4" />
                  <span className="hidden sm:inline">Pre-Ticket</span>
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="relative w-full">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Buscar producto por nombre (Ignora la categoría)..."
                  value={busquedaNombre}
                  onChange={(e) => setBusquedaNombre(e.target.value)}
                  className="w-full bg-black/60 border border-white/15 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white outline-none focus:border-amber-400"
                />
              </div>
              <div className="flex gap-2 flex-wrap w-full">
                {categoriasDisponibles.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => {
                      setCategoriaActiva(cat);
                      setBusquedaNombre('');
                    }}
                    className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                      categoriaActiva === cat && !busquedaNombre.trim() ? 'bg-amber-500 text-slate-950 shadow-md' : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {loadingCarta ? (
              <div className="text-center py-20 text-slate-500 text-sm">Cargando artículos...</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {productosCarta
                  .filter((p) => {
                    if (busquedaNombre.trim()) {
                      return p.nombre.toLowerCase().includes(busquedaNombre.trim().toLowerCase());
                    }
                    const catProd = (p.categoria || '').trim().toLowerCase();
                    const catActiva = categoriaActiva.trim().toLowerCase();
                    if (!catProd) return true;
                    return catProd === catActiva || catProd.includes(catActiva) || catActiva.includes(catProd);
                  })
                  .map((prod) => (
                    <div
                      key={prod.id}
                      className={`p-3 rounded-2xl bg-[#0d0f17] border flex items-center justify-between gap-3 shadow-md transition-colors hover:bg-white/[0.02] ${
                        prod.es_combo ? 'border-amber-500/40 bg-amber-950/10' : 'border-white/10'
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
                          <h4 className="font-bold text-white text-sm leading-tight">{prod.nombre}</h4>
                          <div className="flex items-center gap-2 mt-1">
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
                        className="h-10 w-10 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center cursor-pointer active:scale-95 transition-transform font-bold shrink-0 shadow-sm"
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
                  <h3 className="text-lg font-black text-white">{getNombreMesa(mesaSeleccionada)}</h3>
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
                          mesaKey: getNombreMesa(mesaSeleccionada),
                          porcentajePropuesto: String(descuentoGeneralMesa[getNombreMesa(mesaSeleccionada)] || 10),
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
                      const claveLinea = `${getNombreMesa(mesaSeleccionada)}__${item.nombre}`;
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
                                    mesaKey: getNombreMesa(mesaSeleccionada),
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

                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {carritoActual.map((item) => (
                      <div
                        key={item.idCarritoUnico}
                        className="flex flex-col gap-2 text-xs bg-cyan-950/20 p-2.5 rounded-xl border border-cyan-500/20"
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-white truncate max-w-[140px]">{item.nombre}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-cyan-400 font-bold">
                              {item.nombre.includes('├─') ? '' : `${(Number(item.precio) * item.cantidad).toFixed(2)} €`}
                            </span>
                            
                            <div className="flex gap-1 bg-white/5 px-1 py-0.5 rounded-lg items-center">
                              {!item.nombre.includes('├─') && (
                                <button
                                  type="button"
                                  onClick={() => setModalNotaItem({ idCarritoUnico: item.idCarritoUnico, nombre: item.nombre, notaActual: item.notaExtra || '' })}
                                  className="text-cyan-400 hover:text-cyan-300 mr-1 p-1 rounded hover:bg-cyan-950/50 cursor-pointer"
                                >
                                  <PenLine className="h-3.5 w-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => cambiarCantidadCarrito(item.idCarritoUnico, -1)}
                                className="text-slate-400 hover:text-white cursor-pointer px-1.5 py-1 bg-black/40 rounded-md"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="font-mono font-bold text-white w-4 text-center">{item.cantidad}</span>
                              <button
                                onClick={() => cambiarCantidadCarrito(item.idCarritoUnico, 1)}
                                className="text-slate-400 hover:text-white cursor-pointer px-1.5 py-1 bg-black/40 rounded-md"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                        {item.notaExtra && (
                          <div className="text-[10px] text-cyan-200 bg-cyan-900/40 p-1.5 rounded-lg border border-cyan-500/20">
                            ✏️ Nota: {item.notaExtra}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setModalCuentasAparcadas(true)}
                      className="py-3 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-400 hover:bg-purple-600 hover:text-white font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-lg transition-colors"
                    >
                      <Save className="h-4 w-4" /> Aparcar
                    </button>
                    <button
                      disabled={enviando}
                      onClick={enviarPedidoCamarero}
                      className="py-3 rounded-xl bg-gradient-to-r from-amber-500 to-emerald-500 text-slate-950 font-black text-xs uppercase flex items-center justify-center gap-1.5 cursor-pointer shadow-lg active:scale-95 disabled:opacity-50"
                    >
                      <Send className="h-4 w-4" /> Enviar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      )}

      {vistaSeccion === 'mesas_abiertas' && (
        <main className="flex-1 max-w-5xl w-full mx-auto space-y-6 pb-24">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-xl font-bold text-white">📋 Mesas Activas sin cobrar</h2>
            <button
              type="button"
              onClick={refrescarMesasManual}
              disabled={refrescandoMesas}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 text-xs font-bold shadow-md transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`h-4 w-4 ${refrescandoMesas ? 'animate-spin' : ''}`} />
              <span>{refrescandoMesas ? 'Sincronizando...' : 'Refrescar Mesas'}</span>
            </button>
          </div>

          {mesasAbiertas.length === 0 ? (
            <div className="text-center py-20 text-slate-500">
              <p className="font-semibold">No hay mesas abiertas por cobrar.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                          onClick={() => setModalTraspaso({ origen: m.mesa, destino: '1', procesando: false })}
                          className="px-3 py-1.5 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs font-bold flex items-center gap-1 cursor-pointer hover:bg-sky-500 hover:text-slate-950 transition-colors"
                        >
                          <ArrowRightLeft className="h-3 w-3" />
                        </button>
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
                          className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold flex items-center gap-1 cursor-pointer hover:bg-amber-500 hover:text-slate-950 transition-colors"
                        >
                          <Percent className="h-3 w-3" />
                        </button>
                        <div className="text-right ml-2">
                          {desglose.descuentoTotalImporte > 0 && (
                            <span className="text-[11px] line-through text-slate-500 font-mono block">
                              {desglose.subtotalBruto.toFixed(2)} €
                            </span>
                          )}
                          <span className="font-mono text-xl font-black text-amber-400">
                            {desglose.totalFinal.toFixed(2)} €
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {m.items.map((it, iIdx) => {
                        const claveLinea = `${m.mesa}__${it.nombre}`;
                        const dto = descuentosLineas[claveLinea] || 0;
                        const neto = it.precio * it.cantidad * (1 - dto / 100);
                        return (
                          <div
                            key={iIdx}
                            className="flex items-center justify-between text-xs bg-black/40 px-3 py-2 rounded-xl"
                          >
                            <span className="text-slate-200">
                              <span className="text-amber-400 font-mono font-bold mr-1.5">{it.cantidad}x</span>
                              {it.nombre}
                              {dto > 0 && (
                                <span className="ml-1.5 text-[10px] text-amber-400 font-bold">(-{dto}%)</span>
                              )}
                            </span>
                            {!it.nombre.includes('├─') && it.precio > 0 && (
                              <div className="flex items-center gap-2">
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
                                  className="p-1.5 rounded-lg bg-white/5 hover:bg-amber-500 hover:text-slate-950 text-slate-400 cursor-pointer transition-colors"
                                >
                                  <Percent className="h-3 w-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-3 border-t border-white/10">
                      <button
                        onClick={() => cobrarMesaLegal(m.mesa, 'efectivo')}
                        className="py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-xs uppercase flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-colors"
                      >
                        <DollarSign className="h-4 w-4" /> Efectivo
                      </button>
                      <button
                        onClick={() => cobrarMesaLegal(m.mesa, 'tarjeta')}
                        className="py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs uppercase flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-colors"
                      >
                        <CreditCard className="h-4 w-4" /> Tarjeta
                      </button>
                      <button
                        onClick={() => initCobroParcial(m)}
                        className="py-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-slate-950 font-black text-xs uppercase flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-colors"
                      >
                        <Split className="h-4 w-4" /> Dividir
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
                onClick={abrirModalCierreCaja}
                className="w-full py-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-sm uppercase flex items-center justify-center gap-2 cursor-pointer"
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
                type="button"
                onClick={abrirModalAperturaCaja}
                className="w-full py-4 rounded-xl bg-amber-500 text-slate-950 font-black text-sm uppercase flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <LockOpen className="h-5 w-5" /> Abrir Caja / Turno
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
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold ${
                    cajaHoy.estado === 'abierta'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-rose-500/20 text-rose-400'
                  }`}
                >
                  {cajaHoy.estado === 'abierta' ? 'Turno Abierto' : 'Caja Cerrada'}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="bg-black/40 p-4 rounded-2xl border border-white/5 space-y-1">
                  <span className="text-xs text-slate-400 font-bold uppercase">Fondo Inicial:</span>
                  <p className="font-mono text-lg font-black text-white">
                    {Number(cajaHoy.remanente_apertura).toFixed(2)} €
                  </p>
                </div>
                <div className="bg-black/40 p-4 rounded-2xl border border-white/5 space-y-1">
                  <span className="text-xs text-slate-400 font-bold uppercase">Total Tarjeta:</span>
                  <p className="font-mono text-lg font-black text-cyan-400">
                    {Number(cajaHoy.total_tarjeta).toFixed(2)} €
                  </p>
                </div>
                <div className="bg-black/40 p-4 rounded-2xl border border-white/5 space-y-1">
                  <span className="text-xs text-slate-400 font-bold uppercase">Total Efectivo:</span>
                  <p className="font-mono text-lg font-black text-emerald-400">
                    {Number(cajaHoy.total_efectivo).toFixed(2)} €
                  </p>
                </div>
                <div className="bg-sky-950/20 p-4 rounded-2xl border border-sky-500/30">
                  <span className="text-xs font-bold text-sky-400 uppercase">Teórico en Cajón:</span>
                  <p className="font-mono text-2xl font-black text-white mt-1">
                    {(Number(cajaHoy.remanente_apertura) + Number(cajaHoy.total_efectivo)).toFixed(2)} €
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setModalCajaManual({ abierto: true, tipo: 'ENTRADA' })}
                  disabled={cajaHoy.estado === 'cerrada'}
                  className="flex-1 py-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 font-black text-xs uppercase flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                >
                  <TrendingUp className="h-4 w-4" /> Entrada Manual
                </button>
                <button
                  onClick={() => setModalCajaManual({ abierto: true, tipo: 'SALIDA' })}
                  disabled={cajaHoy.estado === 'cerrada'}
                  className="flex-1 py-3 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/30 font-black text-xs uppercase flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                >
                  <TrendingDown className="h-4 w-4" /> Salida / Pago
                </button>
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

                {facturasAgrupadas.length === 0 ? (
                  <p className="text-xs text-slate-500 italic text-center py-8 bg-black/20 rounded-2xl border border-white/5">
                    Aún no se han emitido tickets fiscales hoy.
                  </p>
                ) : (
                  <div className="max-h-96 overflow-y-auto space-y-3 pr-1">
                    {facturasAgrupadas.map((fRaiz) => (
                      <div key={fRaiz.id} className="bg-white/[0.02] p-2 rounded-2xl border border-white/5 shadow-sm">
                        {renderTicket(fRaiz, 0)}
                        {fRaiz.hijos && fRaiz.hijos.length > 0 && (
                          <div className="pl-4 sm:pl-8 border-l-2 border-white/10 ml-4 sm:ml-6 relative mt-2 space-y-2">
                            {fRaiz.hijos.map((hijo1: any) => (
                              <React.Fragment key={hijo1.id}>
                                {renderTicket(hijo1, 1)}
                                {hijo1.hijos && hijo1.hijos.length > 0 && (
                                  <div className="pl-4 sm:pl-8 border-l-2 border-white/10 ml-4 sm:ml-6 relative mt-2 space-y-2">
                                    {hijo1.hijos.map((hijo2: any) => renderTicket(hijo2, 2))}
                                  </div>
                                )}
                              </React.Fragment>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {cajaHoy.estado !== 'abierta' && (
                <button
                  type="button"
                  onClick={abrirModalAperturaCaja}
                  className="w-full py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm uppercase flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-[0_0_25px_rgba(16,185,129,0.4)]"
                >
                  <LockOpen className="h-5 w-5" /> Abrir Caja / Turno
                </button>
              )}

              {cajaHoy.estado === 'abierta' && (
                <>
                  <div className="hidden">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-amber-400">Efectivo Real Contado en Cajón (€)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={efectivoRealInput}
                        onChange={(e) => setEfectivoRealInput(e.target.value)}
                        className="w-full bg-black/60 border border-amber-500/40 rounded-xl px-4 py-4 text-lg font-mono font-bold text-amber-400 focus:border-amber-400"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-300">Fondo a dejar para mañana (€)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={remanenteCierreInput}
                        onChange={(e) => setRemanenteCierreInput(e.target.value)}
                        className="w-full bg-black/60 border border-white/20 rounded-xl px-4 py-4 text-lg font-mono font-bold text-white focus:border-cyan-400"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={abrirModalCierreCaja}
                    className="w-full py-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-sm uppercase flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-lg"
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