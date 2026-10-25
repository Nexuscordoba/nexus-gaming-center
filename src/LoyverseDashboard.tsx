// src/LoyverseDashboard.tsx
import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import {
  obtenerConfiguracionFiscal,
  imprimirDocumentoFiscalHTML,
  exportarTicketsAExcelCSV,
  exportarTicketsAPDF,
  calcularCosteIngredienteEscandallo,
  type ConfiguracionFiscal,
  type UnidadMedida
} from './fiscalService';
import {
  TrendingUp, DollarSign, CreditCard, Wallet, ArrowLeft, CheckCircle2,
  Receipt, Package, BarChart3, Clock, Search, Users, Plus, Trash2, Edit3,
  FileSpreadsheet, FileText, Printer, ShieldAlert, ShoppingCart, Layers,
  Scale, Barcode, Image as ImageIcon, Save, Building2, Upload, Download,
  UtensilsCrossed, X, Target, ListPlus, RotateCcw, CornerDownRight,
  UserCog, Check, Ban
} from 'lucide-react';

interface BackofficeProps {
  onBack?: () => void;
}

interface IngredienteEscandalloUI {
  ingrediente_id: string;
  nombre_ingrediente: string;
  cantidad: number;
  unidad_uso: UnidadMedida;
  unidad_base: UnidadMedida;
  coste_base: number;
  merma_porcentaje: number;
  coste_calculado: number;
}

interface OpcionComboUI {
  nombre: string;
  destino: 'barra' | 'cocina';
}

interface PasoComboUI {
  titulo: string;
  opciones: OpcionComboUI[];
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

export default function LoyverseDashboard({ onBack }: BackofficeProps) {
  const [adminVerificado, setAdminVerificado] = useState<{ nombre: string; rol: string } | null>(null);
  const [pinAdminLogin, setPinAdminLogin] = useState('');
  const [errorLoginAdmin, setErrorLoginAdmin] = useState('');

  const [pestanaActiva, setPestanaActiva] = useState<
    'ventas_dia' | 'historico_tickets' | 'articulos_escandallos' | 'inventario_compras' | 'datos_fiscales' | 'empleados'
  >('ventas_dia');

  const [configFiscal, setConfigFiscal] = useState<ConfiguracionFiscal>({
    razon_social: 'NEXUS CAFETERÍA Y EVENTOS S.L.',
    nombre_comercial: 'NEXUS',
    nif_cif: 'B00000000',
    direccion_fiscal: 'Córdoba, España',
    telefono: '',
    iva_defecto: 10,
    pin_administrador: '1234'
  });

  const [mensajeAlerta, setMensajeAlerta] = useState<{ texto: string; tipo: 'ok' | 'error' | 'info' } | null>(null);

  const [ticketsHistorico, setTicketsHistorico] = useState<any[]>([]);
  const [fechaFiltroInicio, setFechaFiltroInicio] = useState<string>(new Date().toISOString().split('T')[0]);
  const [fechaFiltroFin, setFechaFiltroFin] = useState<string>(new Date().toISOString().split('T')[0]);
  const [busquedaTicket, setBusquedaTicket] = useState('');
  const [filtroSerie, setFiltroSerie] = useState<string>('TODAS');
  const [cajaHoy, setCajaHoy] = useState<any | null>(null);
  const [cierresTrabajadores, setCierresTrabajadores] = useState<any[]>([]);

  const [articulosMaestro, setArticulosMaestro] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<string[]>(['Cafetería', 'Tapas', 'Menús/Combos', 'Bebidas', 'Materia Prima (Interno)']);
  const [nuevaCategoriaInput, setNuevaCategoriaInput] = useState('');
  const [filtroArticulos, setFiltroArticulos] = useState('');

  const [editandoArticuloId, setEditandoArticuloId] = useState<string | null>(null);
  const [artNombre, setArtNombre] = useState('');
  const [artCategoria, setArtCategoria] = useState('Cafetería');
  const [artDestino, setArtDestino] = useState<'barra' | 'cocina'>('barra');
  const [artImagenUrl, setArtImagenUrl] = useState('');
  const [artCodigoBarras, setArtCodigoBarras] = useState('');
  const [artPrecioVenta, setArtPrecioVenta] = useState('0.00');
  const [artCosteUnitario, setArtCosteUnitario] = useState('0.0000');
  const [artTipoIva, setArtTipoIva] = useState('10');
  const [artUnidadMedida, setArtUnidadMedida] = useState<UnidadMedida>('ud');
  const [artControlaStock, setArtControlaStock] = useState(true);
  const [artStockInicial, setArtStockInicial] = useState('0');
  const [artStockMinimo, setArtStockMinimo] = useState('5');
  const [artVendibleTpv, setArtVendibleTpv] = useState(true);
  const [artEsCompuesto, setArtEsCompuesto] = useState(false);
  const [lineasEscandallo, setLineasEscandallo] = useState<IngredienteEscandalloUI[]>([]);

  const [artEsCombo, setArtEsCombo] = useState(false);
  const [pasosCombo, setPasosCombo] = useState<PasoComboUI[]>([]);

  const [ingredienteSelId, setIngredienteSelId] = useState('');
  const [ingredienteCantidad, setIngredienteCantidad] = useState('1');
  const [ingredienteUnidadUso, setIngredienteUnidadUso] = useState<UnidadMedida>('g');
  const [ingredienteMerma, setIngredienteMerma] = useState('0');

  const [movimientosStock, setMovimientosStock] = useState<any[]>([]);
  const [pageMovimientos, setPageMovimientos] = useState(0); 
  const ITEMS_PER_PAGE = 40;

  const [compraArticuloId, setCompraArticuloId] = useState('');
  const [compraCantidad, setCompraCantidad] = useState('');
  const [compraCosteUnitario, setCompraCosteUnitario] = useState('');
  const [compraProveedor, setCompraProveedor] = useState('');
  const [compraAlbaran, setCompraAlbaran] = useState('');

  const [isImportingCSV, setIsImportingCSV] = useState(false);

  const [empleados, setEmpleados] = useState<any[]>([]);
  const [modalEmpleado, setModalEmpleado] = useState<{ id?: string, nombre: string, apellidos: string, pin: string, rol: string, activo: boolean } | null>(null);

  const [modalElaboracion, setModalElaboracion] = useState<{
    abierto: boolean;
    articuloDestinoId: string;
    cantidadGenerada: string;
    ingredientes: Array<{ id: string; articulo_id: string; nombre: string; cantidad: number; costeBase: number; unidad: string }>;
    ingSelId: string;
    ingSelCant: string;
    ingSelCoste: string;
    procesando: boolean;
  } | null>(null);

  const [modalAjusteStock, setModalAjusteStock] = useState<{
    articuloId: string;
    nombre: string;
    stockActual: number;
    nuevoStock: string;
    unidad: string;
    motivo: string;
    procesando: boolean;
  } | null>(null);

  const [modalRectificativa, setModalRectificativa] = useState<{
    factura: any;
    motivo: string;
    procesando: boolean;
  } | null>(null);

  const [modalFacturaNominativa, setModalFacturaNominativa] = useState<{
    factura: any;
    razonSocial: string;
    nifCif: string;
    direccion: string;
    procesando: boolean;
  } | null>(null);

  const notificar = (texto: string, tipo: 'ok' | 'error' | 'info' = 'ok') => {
    setMensajeAlerta({ texto, tipo });
    setTimeout(() => setMensajeAlerta(null), 4500);
  };

  const cargarEmpleados = async () => {
    const { data } = await supabase.from('empleados').select('*').order('nombre', { ascending: true });
    if (data) setEmpleados(data);
  };

  const guardarEmpleado = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalEmpleado) return;
    try {
      const payload = {
        nombre: modalEmpleado.nombre.trim(),
        apellidos: modalEmpleado.apellidos.trim(),
        pin_acceso: modalEmpleado.pin.trim(),
        rol: modalEmpleado.rol,
        activo: modalEmpleado.activo
      };

      if (modalEmpleado.id) {
        await supabase.from('empleados').update(payload).eq('id', modalEmpleado.id);
        notificar('Empleado actualizado correctamente.');
      } else {
        await supabase.from('empleados').insert([payload]);
        notificar('Empleado creado correctamente.');
      }
      setModalEmpleado(null);
      cargarEmpleados();
    } catch (err: any) {
      notificar('Error: ' + err.message, 'error');
    }
  };

  useEffect(() => {
    if (adminVerificado && pestanaActiva === 'empleados') cargarEmpleados();
  }, [pestanaActiva, adminVerificado]);

  useEffect(() => {
    if (adminVerificado) cargarMovimientosInventario(pageMovimientos);
  }, [pageMovimientos, adminVerificado]);

  useEffect(() => {
    const verificarSesionExistente = async () => {
      const cfg = await obtenerConfiguracionFiscal();
      setConfigFiscal(cfg);

      const sesionCamarero = sessionStorage.getItem('nexus_camarero_sesion');
      if (sesionCamarero) {
        const parsed = JSON.parse(sesionCamarero);
        if (parsed.rol === 'admin') {
          setAdminVerificado({ nombre: parsed.nombre, rol: 'admin' });
        }
      }
    };
    verificarSesionExistente();
  }, []);

  useEffect(() => {
    if (!adminVerificado) return;
    cargarTodoBackoffice();
  }, [adminVerificado, fechaFiltroInicio, fechaFiltroFin]);

  const handleLoginAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorLoginAdmin('');

    const { data } = await supabase
      .from('empleados')
      .select('id, nombre, apellidos, rol')
      .eq('pin_acceso', pinAdminLogin.trim())
      .eq('rol', 'admin')
      .eq('activo', true)
      .maybeSingle();

    if (data) {
      const userObj = { id: data.id, nombre: `${data.nombre} ${data.apellidos || ''}`.trim(), rol: 'admin' };
      setAdminVerificado(userObj);
      sessionStorage.setItem('nexus_camarero_sesion', JSON.stringify(userObj));
      return;
    }

    if (pinAdminLogin.trim() === configFiscal.pin_administrador) {
      setAdminVerificado({ nombre: 'Administrador Fiscal', rol: 'admin' });
      return;
    }

    setErrorLoginAdmin('Acceso denegado: El PIN no corresponde a un usuario con rol Administrador.');
  };

  const cargarTodoBackoffice = async () => {
    await Promise.all([
      cargarTicketsYVentas(),
      cargarArticulosYCategorias(),
      cargarMovimientosInventario(0)
    ]);
  };

  const cargarTicketsYVentas = async () => {
    const inicioISO = `${fechaFiltroInicio}T00:00:00.000Z`;
    const finISO = `${fechaFiltroFin}T23:59:59.999Z`;

    const { data: tData } = await supabase
      .from('facturas_tickets')
      .select('*')
      .gte('fecha_expedicion', inicioISO)
      .lte('fecha_expedicion', finISO)
      .order('fecha_expedicion', { ascending: false });

    if (tData) {
      setTicketsHistorico(tData);
    }

    const fechaHoy = new Date().toISOString().split('T')[0];
    const { data: cData } = await supabase
      .from('caja_diaria')
      .select('*')
      .eq('fecha', fechaHoy)
      .maybeSingle();

    setCajaHoy(cData || null);

    const { data: cierresData } = await supabase
      .from('cierres_caja')
      .select('*')
      .order('fecha_cierre', { ascending: false })
      .limit(25);

    if (cierresData) {
      setCierresTrabajadores(cierresData);
    }
  };

  const cargarArticulosYCategorias = async () => {
    const { data: cats } = await supabase
      .from('categorias_cafeteria')
      .select('nombre')
      .eq('activo', true)
      .order('orden', { ascending: true });

    if (cats && cats.length > 0) {
      setCategorias(cats.map((c) => c.nombre));
    }

    const { data: arts } = await supabase
      .from('articulos_cafeteria')
      .select('*')
      .order('nombre', { ascending: true });

    if (arts && arts.length > 0) {
      setArticulosMaestro(arts);
    }
  };

  const cargarMovimientosInventario = async (page: number = 0) => {
    const from = page * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;
    const { data } = await supabase
      .from('movimientos_stock')
      .select('*, articulos_cafeteria(nombre, unidad_medida)')
      .order('created_at', { ascending: false })
      .range(from, to);

    if (data) {
      setMovimientosStock(data);
    }
  };

  const confirmarFacturaRectificativa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalRectificativa || !adminVerificado) return;

    if (!modalRectificativa.motivo.trim()) {
      notificar('Debes indicar obligatoriamente el motivo de la rectificación/devolución.', 'info');
      return;
    }

    setModalRectificativa({ ...modalRectificativa, procesando: true });

    try {
      const orig = modalRectificativa.factura;
      const cfg = configFiscal;
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
        p_vendedor: adminVerificado.nombre,
        p_metodo_pago: orig.metodo_pago,
        p_importe_efectivo: orig.metodo_pago === 'efectivo' ? importeNegativo : 0,
        p_importe_tarjeta: orig.metodo_pago === 'tarjeta' ? importeNegativo : 0,
        p_subtotal_bruto: brutoNegativo,
        p_descuento_general_porc: orig.descuento_general_porcentaje || 0,
        p_descuento_total_imp: 0,
        p_autorizado_por: adminVerificado.nombre,
        p_tipo_iva: orig.tipo_iva_aplicado || cfg.iva_defecto || 10,
        p_total_final: importeNegativo,
        p_lineas: lineasNegativas,
        p_ticket_origen_id: orig.id,
        p_ticket_origen_numero: orig.numero_completo,
        p_motivo_rectificacion: modalRectificativa.motivo.trim()
      });

      if (rpcError) throw rpcError;

      // Devolver stock al anular / rectificar factura
      for (const linea of (orig.lineas || [])) {
        if (linea.articulo_id || linea.producto_id) {
          const artId = linea.articulo_id || linea.producto_id;
          const cantVendida = Number(linea.cantidad || 0);
          const artRef = articulosMaestro.find(a => a.id === artId);
          if (artRef && artRef.controla_stock) {
            const nuevoStock = Number(artRef.stock_actual || 0) + cantVendida;
            await supabase.from('articulos_cafeteria').update({ stock_actual: nuevoStock }).eq('id', artId);
            await supabase.from('productos_carta').update({ stock_actual: nuevoStock }).eq('articulo_inventario_id', artId);
          }
        }
      }

      const fechaHoy = new Date().toISOString().split('T')[0];
      if (cajaHoy && cajaHoy.estado === 'abierta' && orig.fecha_expedicion.startsWith(fechaHoy)) {
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

      notificar(`Factura Rectificativa ${docRect.numero_completo} emitida e impresa.`, 'ok');
      setModalRectificativa(null);
      cargarTicketsYVentas();
      cargarArticulosYCategorias();
    } catch (err: any) {
      notificar('Error al emitir factura rectificativa: ' + err.message, 'error');
      setModalRectificativa({ ...modalRectificativa, procesando: false });
    }
  };

  const confirmarFacturaNominativa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalFacturaNominativa || !adminVerificado) return;

    if (!modalFacturaNominativa.razonSocial.trim() || !modalFacturaNominativa.nifCif.trim()) {
      notificar('Nombre/Razón Social y NIF/CIF del cliente son obligatorios por ley.', 'info');
      return;
    }

    setModalFacturaNominativa({ ...modalFacturaNominativa, procesando: true });

    try {
      const orig = modalFacturaNominativa.factura;
      const cfg = configFiscal;

      const { data: docNom, error: rpcError } = await supabase.rpc('emitir_documento_fiscal', {
        p_serie: 'F',
        p_tipo_documento: 'NOMINATIVA',
        p_mesa: orig.mesa,
        p_vendedor: adminVerificado.nombre,
        p_metodo_pago: orig.metodo_pago,
        p_importe_efectivo: orig.importe_efectivo,
        p_importe_tarjeta: orig.importe_tarjeta,
        p_subtotal_bruto: orig.subtotal_bruto,
        p_descuento_general_porc: orig.descuento_general_porcentaje || 0,
        p_descuento_total_imp: orig.descuento_total_importe || 0,
        p_autorizado_por: orig.autorizado_por || adminVerificado.nombre,
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

      notificar(`Factura Nominativa ${docNom.numero_completo} generada e impresa correctamente.`, 'ok');
      setModalFacturaNominativa(null);
      cargarTicketsYVentas();
    } catch (err: any) {
      notificar('Error al generar factura nominativa: ' + err.message, 'error');
      setModalFacturaNominativa({ ...modalFacturaNominativa, procesando: false });
    }
  };

  useEffect(() => {
    if (artEsCompuesto) {
      const sumaCosteEscandallo = lineasEscandallo.reduce((acc, l) => acc + l.coste_calculado, 0);
      setArtCosteUnitario(sumaCosteEscandallo.toFixed(4));
    }
  }, [artEsCompuesto, lineasEscandallo]);

  const agregarPasoCombo = () => {
    setPasosCombo([...pasosCombo, { titulo: `Paso ${pasosCombo.length + 1}`, opciones: [] }]);
  };

  const eliminarPasoCombo = (index: number) => {
    setPasosCombo(pasosCombo.filter((_, i) => i !== index));
  };

  const actualizarTituloPaso = (index: number, titulo: string) => {
    const nuevos = [...pasosCombo];
    nuevos[index].titulo = titulo;
    setPasosCombo(nuevos);
  };

  const agregarOpcionAPaso = (indexPaso: number) => {
    const nuevos = [...pasosCombo];
    nuevos[indexPaso].opciones.push({ nombre: 'Nueva opción', destino: 'barra' });
    setPasosCombo(nuevos);
  };

  const eliminarOpcionDePaso = (indexPaso: number, indexOpcion: number) => {
    const nuevos = [...pasosCombo];
    nuevos[indexPaso].opciones = nuevos[indexPaso].opciones.filter((_, i) => i !== indexOpcion);
    setPasosCombo(nuevos);
  };

  const actualizarOpcion = (indexPaso: number, indexOpcion: number, campo: 'nombre' | 'destino', valor: string) => {
    const nuevos = [...pasosCombo];
    nuevos[indexPaso].opciones[indexOpcion] = { ...nuevos[indexPaso].opciones[indexOpcion], [campo]: valor };
    setPasosCombo(nuevos);
  };

  const agregarIngredienteAEscandallo = () => {
    if (!ingredienteSelId) return;
    const ingObj = articulosMaestro.find((a) => a.id === ingredienteSelId);
    if (!ingObj) return;

    const cant = parseFloat(ingredienteCantidad) || 0;
    const merma = parseFloat(ingredienteMerma) || 0;
    if (cant <= 0) return;

    const costeCalc = calcularCosteIngredienteEscandallo(
      Number(ingObj.coste_unitario || 0),
      (ingObj.unidad_medida || 'ud') as UnidadMedida,
      cant,
      ingredienteUnidadUso,
      merma
    );

    setLineasEscandallo((prev) => [
      ...prev,
      {
        ingrediente_id: ingObj.id,
        nombre_ingrediente: ingObj.nombre,
        cantidad: cant,
        unidad_uso: ingredienteUnidadUso,
        unidad_base: (ingObj.unidad_medida || 'ud') as UnidadMedida,
        coste_base: Number(ingObj.coste_unitario || 0),
        merma_porcentaje: merma,
        coste_calculado: costeCalc
      }
    ]);

    setIngredienteCantidad('1');
    setIngredienteMerma('0');
  };

  const eliminarLineaEscandallo = (idx: number) => {
    setLineasEscandallo((prev) => prev.filter((_, i) => i !== idx));
  };

  const limpiarFormularioArticulo = () => {
    setEditandoArticuloId(null);
    setArtNombre('');
    setArtCategoria('Cafetería');
    setArtDestino('barra');
    setArtImagenUrl('');
    setArtCodigoBarras('');
    setArtPrecioVenta('0.00');
    setArtCosteUnitario('0.0000');
    setArtTipoIva('10');
    setArtUnidadMedida('ud');
    setArtControlaStock(true);
    setArtStockInicial('0');
    setArtStockMinimo('5');
    setArtVendibleTpv(true);
    setArtEsCompuesto(false);
    setLineasEscandallo([]);
    setArtEsCombo(false);
    setPasosCombo([]);
  };

  const seleccionarArticuloParaEditar = async (art: any) => {
    setEditandoArticuloId(art.id);
    setArtNombre(art.nombre);
    setArtCategoria(art.categoria || 'Cafetería');
    setArtDestino(art.destino || 'barra');
    setArtImagenUrl(art.imagen_url || '');
    setArtCodigoBarras(art.codigo_barras || '');
    setArtPrecioVenta(String(art.precio_venta || 0));
    setArtCosteUnitario(String(art.coste_unitario || 0));
    setArtTipoIva(String(art.tipo_iva || 10));
    setArtUnidadMedida((art.unidad_medida || 'ud') as UnidadMedida);
    setArtControlaStock(Boolean(art.controla_stock));
    setArtStockInicial(String(art.stock_actual || 0));
    setArtStockMinimo(String(art.stock_minimo || 0));
    setArtVendibleTpv(Boolean(art.vendible_tpv));
    setArtEsCombo(Boolean(art.es_combo));
    setPasosCombo(art.opciones_combo || []);
    setArtEsCompuesto(Boolean(art.es_compuesto));

    if (art.es_compuesto) {
      const { data: escData } = await supabase
        .from('escandallos_cafeteria')
        .select('*, ingrediente:articulos_cafeteria!ingrediente_id(nombre, unidad_medida, coste_unitario)')
        .eq('articulo_padre_id', art.id);

      if (escData) {
        const mapeadas: IngredienteEscandalloUI[] = escData.map((e: any) => {
          const uBase = (e.ingrediente?.unidad_medida || 'ud') as UnidadMedida;
          const cBase = Number(e.ingrediente?.coste_unitario || 0);
          return {
            ingrediente_id: e.ingrediente_id,
            nombre_ingrediente: e.ingrediente?.nombre || 'Ingrediente',
            cantidad: Number(e.cantidad),
            unidad_uso: (e.unidad_uso || 'ud') as UnidadMedida,
            unidad_base: uBase,
            coste_base: cBase,
            merma_porcentaje: Number(e.merma_porcentaje || 0),
            coste_calculado: calcularCosteIngredienteEscandallo(
              cBase,
              uBase,
              Number(e.cantidad),
              (e.unidad_uso || 'ud') as UnidadMedida,
              Number(e.merma_porcentaje || 0)
            )
          };
        });
        setLineasEscandallo(mapeadas);
      }
    } else {
      setLineasEscandallo([]);
    }
  };

  const manejarSubidaImagen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop();
    const fileName = `prod_${Date.now()}.${ext}`;

    const { data, error } = await supabase.storage.from('productos').upload(fileName, file, { upsert: true });

    if (!error && data) {
      const { data: pubUrl } = supabase.storage.from('productos').getPublicUrl(fileName);
      setArtImagenUrl(pubUrl.publicUrl);
      notificar('Imagen subida correctamente a Supabase Storage.');
    } else {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setArtImagenUrl(reader.result);
          notificar('Imagen cargada y lista para sincronizar.');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const guardarYSincronizarArticulo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!artNombre.trim()) return;

    const precioNum = parseFloat(artPrecioVenta) || 0;
    const costeNum = parseFloat(artCosteUnitario) || 0;
    const ivaNum = parseFloat(artTipoIva) || 10;
    const stockNum = parseFloat(artStockInicial) || 0;
    const minNum = parseFloat(artStockMinimo) || 0;

    try {
      let articuloIdFinal = editandoArticuloId;

      const payloadMaestro = {
        nombre: artNombre.trim(),
        categoria: artCategoria,
        destino: artDestino,
        imagen_url: artImagenUrl.trim(),
        codigo_barras: artCodigoBarras.trim(),
        precio_venta: precioNum,
        coste_unitario: costeNum,
        tipo_iva: ivaNum,
        unidad_medida: artUnidadMedida,
        controla_stock: artControlaStock,
        stock_actual: stockNum,
        stock_minimo: minNum,
        es_compuesto: artEsCompuesto,
        vendible_tpv: artVendibleTpv,
        es_combo: artEsCombo,
        opciones_combo: artEsCombo ? pasosCombo : [],
        activo: true,
        updated_at: new Date().toISOString()
      };

      if (editandoArticuloId) {
        const { error } = await supabase
          .from('articulos_cafeteria')
          .update(payloadMaestro)
          .eq('id', editandoArticuloId);
        if (error) throw error;
      } else {
        const { data: nuevoArt, error } = await supabase
          .from('articulos_cafeteria')
          .insert([payloadMaestro])
          .select()
          .single();
        if (error) throw error;
        articuloIdFinal = nuevoArt.id;

        if (artControlaStock && stockNum > 0) {
          await supabase.from('movimientos_stock').insert([
            {
              articulo_id: articuloIdFinal,
              tipo_movimiento: 'AJUSTE_INICIAL',
              cantidad: stockNum,
              coste_compra_unitario: costeNum,
              usuario_nombre: adminVerificado?.nombre || 'Admin',
              observaciones: 'Stock inicial en creación de artículo'
            }
          ]);
        }
      }

      if (articuloIdFinal) {
        await supabase.from('escandallos_cafeteria').delete().eq('articulo_padre_id', articuloIdFinal);

        if (artEsCompuesto && lineasEscandallo.length > 0) {
          const filasEsc = lineasEscandallo.map((l) => ({
            articulo_padre_id: articuloIdFinal,
            ingrediente_id: l.ingrediente_id,
            cantidad: l.cantidad,
            unidad_uso: l.unidad_uso,
            merma_porcentaje: l.merma_porcentaje
          }));
          await supabase.from('escandallos_cafeteria').insert(filasEsc);
        }

        const payloadCarta = {
          nombre: artNombre.trim(),
          precio: precioNum,
          categoria: artCategoria,
          destino: artDestino,
          activo: artVendibleTpv,
          imagen_url: artImagenUrl.trim(),
          codigo_barras: artCodigoBarras.trim(),
          coste_unitario: costeNum,
          tipo_iva: ivaNum,
          unidad_medida: artUnidadMedida,
          controla_stock: artControlaStock,
          stock_actual: stockNum,
          stock_minimo: minNum,
          es_compuesto: artEsCompuesto,
          es_combo: artEsCombo,
          opciones_combo: artEsCombo ? pasosCombo : [],
          escandallo_json: lineasEscandallo,
          articulo_inventario_id: articuloIdFinal
        };

        const { data: existeEnCarta } = await supabase
          .from('productos_carta')
          .select('id')
          .or(`articulo_inventario_id.eq.${articuloIdFinal},nombre.eq.${artNombre.trim()}`)
          .maybeSingle();

        if (existeEnCarta) {
          await supabase.from('productos_carta').update(payloadCarta).eq('id', existeEnCarta.id);
        } else if (artVendibleTpv) {
          await supabase.from('productos_carta').insert([payloadCarta]);
        }
      }

      notificar(
        editandoArticuloId
          ? `Artículo "${artNombre}" modificado y sincronizado correctamente en Supabase.`
          : `Artículo "${artNombre}" creado y sincronizado correctamente en TPV.`
      );
      limpiarFormularioArticulo();
      cargarArticulosYCategorias();
    } catch (err: any) {
      notificar('Error guardando artículo: ' + err.message, 'error');
    }
  };

  const crearNuevaCategoria = async () => {
    if (!nuevaCategoriaInput.trim()) return;
    const nombreLimpio = nuevaCategoriaInput.trim();
    await supabase.from('categorias_cafeteria').insert([{ nombre: nombreLimpio, orden: categorias.length + 1 }]);
    setCategorias((prev) => [...prev, nombreLimpio]);
    setArtCategoria(nombreLimpio);
    setNuevaCategoriaInput('');
    notificar(`Categoría visual "${nombreLimpio}" añadida.`);
  };

  const borrarCategoria = async (catNombre: string) => {
    const confirmacion = window.confirm(`¿Seguro que deseas eliminar la categoría "${catNombre}"?`);
    if (!confirmacion) return;

    try {
      await supabase.from('categorias_cafeteria').delete().eq('nombre', catNombre);
      setCategorias((prev) => prev.filter((c) => c !== catNombre));
      if (artCategoria === catNombre) {
        setArtCategoria('Cafetería');
      }
      notificar(`Categoría "${catNombre}" eliminada correctamente.`);
    } catch (err: any) {
      notificar('Error al borrar la categoría: ' + err.message, 'error');
    }
  };

  const descargarPlantillaCSV = () => {
    const cabeceras = "Nombre;Categoria;Destino(barra/cocina);PrecioVenta;CosteUnitario;TipoIVA;UnidadMedida;ControlaStock(SI/NO);StockInicial;StockMinimo;VisibleTPV(SI/NO)\n";
    const ejemplo1 = "Café Solo;Cafetería;barra;1.20;0.15;10;ud;SI;100;10;SI\n";
    const ejemplo2 = "Ensalada César;Cocina / Tapas;cocina;6.50;2.10;10;ud;SI;20;5;SI\n";
    const blob = new Blob([cabeceras + ejemplo1 + ejemplo2], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "plantilla_importacion_articulos.csv";
    link.click();
  };

  const manejarImportacionCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImportingCSV(true);
    notificar('Procesando archivo CSV...', 'info');

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lineas = text.split('\n').map(l => l.trim()).filter(l => l);
        
        let importados = 0;
        let ignorados = 0;

        for (let i = 1; i < lineas.length; i++) {
          const columnas = lineas[i].split(';');
          if (columnas.length < 11) {
            ignorados++;
            continue;
          }

          const [
            nombre, categoria, destino, precio, coste, iva, 
            unidad, controlaStock, stockIni, stockMin, visible
          ] = columnas;

          if (!nombre) {
            ignorados++;
            continue;
          }

          const payloadMaestro = {
            nombre: nombre.trim(),
            categoria: categoria.trim() || 'Cafetería',
            destino: destino.trim().toLowerCase() === 'cocina' ? 'cocina' : 'barra',
            precio_venta: parseFloat(precio) || 0,
            coste_unitario: parseFloat(coste) || 0,
            tipo_iva: parseFloat(iva) || 10,
            unidad_medida: unidad.trim().toLowerCase() || 'ud',
            controla_stock: controlaStock.trim().toUpperCase() === 'SI',
            stock_actual: parseFloat(stockIni) || 0,
            stock_minimo: parseFloat(stockMin) || 0,
            vendible_tpv: visible.trim().toUpperCase() === 'SI',
            es_compuesto: false,
            es_combo: false,
            opciones_combo: [],
            activo: true
          };

          const { data: existe } = await supabase
            .from('articulos_cafeteria')
            .select('id')
            .eq('nombre', payloadMaestro.nombre)
            .maybeSingle();

          if (existe) {
            ignorados++;
            continue;
          }

          const { data: nuevoArt } = await supabase
            .from('articulos_cafeteria')
            .insert([payloadMaestro])
            .select()
            .single();

          if (nuevoArt) {
            if (payloadMaestro.controla_stock && payloadMaestro.stock_actual > 0) {
              await supabase.from('movimientos_stock').insert([{
                articulo_id: nuevoArt.id,
                tipo_movimiento: 'AJUSTE_INICIAL',
                cantidad: payloadMaestro.stock_actual,
                coste_compra_unitario: payloadMaestro.coste_unitario,
                usuario_nombre: adminVerificado?.nombre || 'Admin Importación',
                observaciones: 'Stock inicial por CSV'
              }]);
            }

            if (payloadMaestro.vendible_tpv) {
              await supabase.from('productos_carta').insert([{
                articulo_inventario_id: nuevoArt.id,
                nombre: payloadMaestro.nombre,
                precio: payloadMaestro.precio_venta,
                categoria: payloadMaestro.categoria,
                destino: payloadMaestro.destino,
                activo: true,
                coste_unitario: payloadMaestro.coste_unitario,
                tipo_iva: payloadMaestro.tipo_iva,
                unidad_medida: payloadMaestro.unidad_medida,
                controla_stock: payloadMaestro.controla_stock,
                stock_actual: payloadMaestro.stock_actual,
                stock_minimo: payloadMaestro.stock_minimo,
                es_compuesto: false,
                es_combo: false,
                opciones_combo: []
              }]);
            }
            importados++;
          }
        }
        
        cargarArticulosYCategorias();
        notificar(`Importación completada: ${importados} artículos nuevos añadidos. (${ignorados} ignorados o duplicados).`, 'ok');
      } catch (err: any) {
        notificar('Error procesando CSV: ' + err.message, 'error');
      } finally {
        setIsImportingCSV(false);
        if (e.target) e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const registrarCompraMercancia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!compraArticuloId) return;

    const cantComprada = parseFloat(compraCantidad) || 0;
    if (cantComprada <= 0) {
      notificar('Introduce una cantidad comprada mayor que 0.', 'error');
      return;
    }

    const artActual = articulosMaestro.find((a) => a.id === compraArticuloId);
    if (!artActual) return;

    const nuevoStockReal = Number(artActual.stock_actual || 0) + cantComprada;
    const nuevoCoste =
      compraCosteUnitario.trim() !== ''
        ? parseFloat(compraCosteUnitario)
        : Number(artActual.coste_unitario || 0);

    try {
      await supabase
        .from('articulos_cafeteria')
        .update({
          stock_actual: nuevoStockReal,
          coste_unitario: nuevoCoste,
          updated_at: new Date().toISOString()
        })
        .eq('id', compraArticuloId);

      await supabase
        .from('productos_carta')
        .update({
          stock_actual: nuevoStockReal,
          coste_unitario: nuevoCoste
        })
        .eq('articulo_inventario_id', compraArticuloId);

      await supabase.from('movimientos_stock').insert([
        {
          articulo_id: compraArticuloId,
          tipo_movimiento: 'COMPRA',
          cantidad: cantComprada,
          coste_compra_unitario: nuevoCoste,
          proveedor: compraProveedor.trim(),
          numero_albaran_factura: compraAlbaran.trim(),
          usuario_nombre: adminVerificado?.nombre || 'Administrador',
          observaciones: `Entrada compra proveedor ${compraProveedor.trim()}`
        }
      ]);

      notificar(
        `Compra registrada: +${cantComprada} ${artActual.unidad_medida} añadidos a "${artActual.nombre}". Nuevo stock: ${nuevoStockReal.toFixed(2)} ${artActual.unidad_medida}.`
      );
      setCompraCantidad('');
      setCompraCosteUnitario('');
      setCompraProveedor('');
      setCompraAlbaran('');
      cargarArticulosYCategorias();
      cargarMovimientosInventario(pageMovimientos);
    } catch (err: any) {
      notificar('Error al registrar la compra: ' + err.message, 'error');
    }
  };

  const procesarAjusteStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalAjusteStock) return;

    const nuevoFisico = parseFloat(modalAjusteStock.nuevoStock) || 0;
    const diferencia = nuevoFisico - modalAjusteStock.stockActual;
    
    if (diferencia === 0) {
      notificar('El stock introducido es igual al actual. No hay cambios.', 'info');
      setModalAjusteStock(null);
      return;
    }

    setModalAjusteStock({ ...modalAjusteStock, procesando: true });

    try {
      await supabase.from('articulos_cafeteria').update({ stock_actual: nuevoFisico }).eq('id', modalAjusteStock.articuloId);
      await supabase.from('productos_carta').update({ stock_actual: nuevoFisico }).eq('articulo_inventario_id', modalAjusteStock.articuloId);

      await supabase.from('movimientos_stock').insert([{
        articulo_id: modalAjusteStock.articuloId,
        tipo_movimiento: 'AJUSTE_MANUAL',
        cantidad: diferencia,
        coste_compra_unitario: 0,
        usuario_nombre: adminVerificado?.nombre || 'Admin',
        observaciones: modalAjusteStock.motivo.trim() || 'Regularización manual de stock'
      }]);

      notificar(`Stock de "${modalAjusteStock.nombre}" ajustado a ${nuevoFisico} ${modalAjusteStock.unidad}.`, 'ok');
      setModalAjusteStock(null);
      cargarArticulosYCategorias();
      cargarMovimientosInventario(pageMovimientos);
    } catch (err: any) {
      notificar('Error al realizar el ajuste: ' + err.message, 'error');
      setModalAjusteStock({ ...modalAjusteStock, procesando: false });
    }
  };

  const agregarIngredienteAElaboracion = () => {
    if (!modalElaboracion || !modalElaboracion.ingSelId) return;
    const ingObj = articulosMaestro.find((a) => a.id === modalElaboracion.ingSelId);
    if (!ingObj) return;

    const cant = parseFloat(modalElaboracion.ingSelCant) || 0;
    const costeManual = modalElaboracion.ingSelCoste.trim() !== '' ? parseFloat(modalElaboracion.ingSelCoste) : Number(ingObj.coste_unitario || 0);
    if (cant <= 0) return;

    const nuevoIng = {
      id: Date.now().toString(),
      articulo_id: ingObj.id,
      nombre: ingObj.nombre,
      cantidad: cant,
      unidad: ingObj.unidad_medida,
      costeBase: costeManual
    };

    setModalElaboracion({
      ...modalElaboracion,
      ingredientes: [...modalElaboracion.ingredientes, nuevoIng],
      ingSelId: '',
      ingSelCant: '1',
      ingSelCoste: ''
    });
  };

  const eliminarIngredienteElaboracion = (idToRemove: string) => {
    if (!modalElaboracion) return;
    setModalElaboracion({
      ...modalElaboracion,
      ingredientes: modalElaboracion.ingredientes.filter(i => i.id !== idToRemove)
    });
  };

  const confirmarElaboracionLote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalElaboracion) return;

    const racionesGeneradas = parseFloat(modalElaboracion.cantidadGenerada) || 0;
    if (racionesGeneradas <= 0 || modalElaboracion.ingredientes.length === 0) {
      notificar('Debes indicar las raciones generadas y añadir al menos un ingrediente.', 'error');
      return;
    }

    setModalElaboracion({ ...modalElaboracion, procesando: true });

    try {
      let costeTotalIngredientes = 0;
      const promesasIngredientes = modalElaboracion.ingredientes.map(async (ing) => {
        costeTotalIngredientes += (ing.cantidad * ing.costeBase);
        
        const refObj = articulosMaestro.find(a => a.id === ing.articulo_id);
        const nuevoStockIng = (Number(refObj?.stock_actual) || 0) - ing.cantidad;

        await supabase.from('articulos_cafeteria').update({ stock_actual: nuevoStockIng }).eq('id', ing.articulo_id);
        await supabase.from('productos_carta').update({ stock_actual: nuevoStockIng }).eq('articulo_inventario_id', ing.articulo_id);

        await supabase.from('movimientos_stock').insert([{
          articulo_id: ing.articulo_id,
          tipo_movimiento: 'ELABORACION_SALIDA',
          cantidad: -Math.abs(ing.cantidad),
          coste_compra_unitario: ing.costeBase,
          usuario_nombre: adminVerificado?.nombre || 'Admin',
          observaciones: `Consumo para elaboración de lote de ${racionesGeneradas} raciones`
        }]);
      });

      await Promise.all(promesasIngredientes);

      const costeProporcionalUnitario = costeTotalIngredientes / racionesGeneradas;
      const platoDestino = articulosMaestro.find(a => a.id === modalElaboracion.articuloDestinoId);
      const nuevoStockPlato = (Number(platoDestino?.stock_actual) || 0) + racionesGeneradas;

      await supabase.from('articulos_cafeteria').update({ 
        stock_actual: nuevoStockPlato,
        coste_unitario: costeProporcionalUnitario 
      }).eq('id', modalElaboracion.articuloDestinoId);

      await supabase.from('productos_carta').update({ 
        stock_actual: nuevoStockPlato,
        coste_unitario: costeProporcionalUnitario 
      }).eq('articulo_inventario_id', modalElaboracion.articuloDestinoId);

      await supabase.from('movimientos_stock').insert([{
        articulo_id: modalElaboracion.articuloDestinoId,
        tipo_movimiento: 'ELABORACION_ENTRADA',
        cantidad: racionesGeneradas,
        coste_compra_unitario: costeProporcionalUnitario,
        usuario_nombre: adminVerificado?.nombre || 'Admin',
        observaciones: `Producción de lote interno (${racionesGeneradas} raciones). Coste total: ${costeTotalIngredientes.toFixed(2)}€`
      }]);

      notificar(`Lote elaborado con éxito: +${racionesGeneradas} raciones con un coste unitario de ${costeProporcionalUnitario.toFixed(2)}€`, 'ok');
      setModalElaboracion(null);
      cargarArticulosYCategorias();
      cargarMovimientosInventario(pageMovimientos);
    } catch (err: any) {
      notificar('Error al procesar la elaboración del lote: ' + err.message, 'error');
      setModalElaboracion({ ...modalElaboracion, procesando: false });
    }
  };

  const guardarConfiguracionFiscal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (configFiscal.id) {
      await supabase.from('configuracion_fiscal').update(configFiscal).eq('id', configFiscal.id);
    } else {
      await supabase.from('configuracion_fiscal').insert([configFiscal]);
    }
    notificar('Datos fiscales y PIN de autorización actualizados correctamente.');
  };

  if (!adminVerificado) {
    return (
      <div className="min-h-screen bg-[#050609] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#0d0f17] border border-cyan-500/30 rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="h-14 w-14 mx-auto rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center">
              <ShieldAlert className="h-7 w-7" />
            </div>
            <h2 className="text-xl font-black text-white">BACKOFFICE CAFETERÍA</h2>
            <p className="text-xs text-slate-400">
              Acceso restringido exclusivamente a usuarios con perfil <strong>Administrador</strong>.
            </p>
          </div>

          <form onSubmit={handleLoginAdmin} className="space-y-4">
            <input
              type="password"
              autoFocus
              placeholder="PIN de Administrador"
              value={pinAdminLogin}
              onChange={(e) => setPinAdminLogin(e.target.value)}
              className="w-full bg-black/60 border border-white/15 rounded-xl px-4 py-3.5 text-center text-xl tracking-[0.5em] font-mono font-bold text-white outline-none focus:border-cyan-400"
            />
            {errorLoginAdmin && <p className="text-xs text-rose-400 text-center font-bold">{errorLoginAdmin}</p>}
            <button
              type="submit"
              className="w-full py-3.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs uppercase tracking-wider cursor-pointer"
            >
              Verificar Rol Administrador
            </button>
            <button
              type="button"
              onClick={() => (onBack ? onBack() : (window.location.hash = ''))}
              className="w-full py-2 text-xs text-slate-400 hover:text-white cursor-pointer"
            >
              Volver a Cafetería
            </button>
          </form>
        </div>
      </div>
    );
  }

  const ticketsFiltrados = ticketsHistorico.filter((t) => {
    const coincideSerie = filtroSerie === 'TODAS' || t.serie === filtroSerie;
    const texto = `${t.numero_completo} ${t.vendedor_nombre} ${t.mesa} ${t.cliente_nif || ''} ${t.cliente_nombre_razon || ''}`.toLowerCase();
    return coincideSerie && texto.includes(busquedaTicket.toLowerCase());
  });

  const totalFacturadoPeriodo = ticketsFiltrados.reduce((acc, t) => acc + Number(t.total_final || 0), 0);
  const totalEfectivoPeriodo = ticketsFiltrados
    .filter((t) => t.metodo_pago === 'efectivo')
    .reduce((acc, t) => acc + Number(t.total_final || 0), 0);
  const totalTarjetaPeriodo = ticketsFiltrados
    .filter((t) => t.metodo_pago === 'tarjeta')
    .reduce((acc, t) => acc + Number(t.total_final || 0), 0);
  const numOperacionesValidas = ticketsFiltrados.filter((t) => t.serie === 'T').length;
  const ticketMedioPeriodo = numOperacionesValidas > 0 ? totalFacturadoPeriodo / numOperacionesValidas : 0;

  const mapaVendedores: Record<string, { nombre: string; operaciones: number; total: number }> = {};
  ticketsFiltrados.forEach((t) => {
    if (t.serie === 'F') return;
    const vend = t.vendedor_nombre || 'Sin asignar';
    if (!mapaVendedores[vend]) {
      mapaVendedores[vend] = { nombre: vend, operaciones: 0, total: 0 };
    }
    mapaVendedores[vend].operaciones += 1;
    mapaVendedores[vend].total += Number(t.total_final || 0);
  });
  const ventasPorVendedor = Object.values(mapaVendedores).sort((a, b) => b.total - a.total);
  const maxVentaVendedor = ventasPorVendedor.length > 0 ? ventasPorVendedor[0].total : 1; 

  const mapaHoras: Record<string, { hora: string; operaciones: number; total: number }> = {};
  ticketsFiltrados.forEach((t) => {
    if (t.serie === 'F') return;
    const fechaObj = new Date(t.fecha_expedicion);
    const h = String(fechaObj.getHours()).padStart(2, '0') + ':00';
    if (!mapaHoras[h]) {
      mapaHoras[h] = { hora: h, operaciones: 0, total: 0 };
    }
    mapaHoras[h].operaciones += 1;
    mapaHoras[h].total += Number(t.total_final || 0);
  });
  const ventasPorHora = Object.values(mapaHoras).sort((a, b) => a.hora.localeCompare(b.hora));
   

  // Generar array continuo de 08:00 a 23:00 para el gráfico de líneas
  const horasContinuas = Array.from({ length: 16 }, (_, i) => {
    const horaStr = String(i + 8).padStart(2, '0') + ':00';
    const encontrado = ventasPorHora.find(v => v.hora === horaStr);
    return {
      hora: horaStr,
      total: encontrado ? encontrado.total : 0,
      operaciones: encontrado ? encontrado.operaciones : 0
    };
  });
  const maxVentaLinea = Math.max(...horasContinuas.map(h => h.total), 1);

  const margenBeneficioArticulo =
    parseFloat(artPrecioVenta) > 0
      ? (((parseFloat(artPrecioVenta) - parseFloat(artCosteUnitario)) / parseFloat(artPrecioVenta)) * 100).toFixed(1)
      : '0.0';

  return (
    <div className="min-h-screen bg-[#050609] text-slate-100 p-4 sm:p-6 flex flex-col justify-between font-sans">
      
      {/* MODAL DE AJUSTE RÁPIDO DE STOCK */}
      {modalAjusteStock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md px-4 z-[100]">
          <form
            onSubmit={procesarAjusteStock}
            className="w-full max-w-sm bg-[#0d0f17] border border-cyan-500/40 rounded-3xl p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 text-cyan-400">
                <Target className="h-5 w-5" />
                <h3 className="font-black text-white text-base">Ajuste / Regularización</h3>
              </div>
              <button
                type="button"
                onClick={() => setModalAjusteStock(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="text-xs text-slate-300 bg-black/40 p-3 rounded-xl border border-white/10">
              Ajustando inventario de:<br/>
              <strong className="text-white text-sm block mt-1">{modalAjusteStock.nombre}</strong>
            </div>

            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Stock Actual</label>
                <div className="w-full bg-black/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-slate-400 font-mono">
                  {modalAjusteStock.stockActual} {modalAjusteStock.unidad}
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-cyan-400 block mb-1">Nuevo Stock Físico *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={modalAjusteStock.nuevoStock}
                  onChange={(e) => setModalAjusteStock({ ...modalAjusteStock, nuevoStock: e.target.value })}
                  className="w-full bg-black/60 border border-cyan-500/40 rounded-xl px-3.5 py-2.5 text-cyan-400 font-mono font-bold"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Motivo (Opcional)</label>
              <input
                type="text"
                placeholder="Ej: Stock Inicial, Merma por rotura, Cuadre mensual..."
                value={modalAjusteStock.motivo}
                onChange={(e) => setModalAjusteStock({ ...modalAjusteStock, motivo: e.target.value })}
                className="w-full bg-black/60 border border-white/20 rounded-xl px-3.5 py-2.5 text-xs text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModalAjusteStock(null)}
                className="py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-slate-300 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={modalAjusteStock.procesando}
                className="py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs uppercase cursor-pointer disabled:opacity-50"
              >
                {modalAjusteStock.procesando ? 'Guardando...' : 'Confirmar Ajuste'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL ELABORACIÓN LOTE */}
      {modalElaboracion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md px-4 z-[100]">
          <form
            onSubmit={confirmarElaboracionLote}
            className="w-full max-w-2xl bg-[#0d0f17] border border-emerald-500/40 rounded-3xl p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 text-emerald-400">
                <UtensilsCrossed className="h-5 w-5" />
                <h3 className="font-black text-white text-base">Herramienta de Elaboración de Lotes (Producción)</h3>
              </div>
              <button
                type="button"
                onClick={() => setModalElaboracion(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Plato Destino a Generar (Suma Stock)</label>
                <select
                  required
                  value={modalElaboracion.articuloDestinoId}
                  onChange={(e) => setModalElaboracion({ ...modalElaboracion, articuloDestinoId: e.target.value })}
                  className="w-full bg-black/60 border border-emerald-500/40 rounded-xl px-3.5 py-2.5 text-white text-xs"
                >
                  <option value="">-- Selecciona el plato elaborado --</option>
                  {articulosMaestro.map(a => (
                    <option key={a.id} value={a.id}>{a.nombre} (Stock actual: {a.stock_actual} {a.unidad_medida})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Raciones Generadas del Plato *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="Ej: 20 tapas / 5 tartas"
                  value={modalElaboracion.cantidadGenerada}
                  onChange={(e) => setModalElaboracion({ ...modalElaboracion, cantidadGenerada: e.target.value })}
                  className="w-full bg-black/60 border border-emerald-500/40 rounded-xl px-3.5 py-2.5 text-emerald-400 font-mono font-bold text-xs"
                />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
              <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">Añadir Ingredientes Consumidos</h4>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <select
                  value={modalElaboracion.ingSelId}
                  onChange={(e) => {
                    const selId = e.target.value;
                    const ingFound = articulosMaestro.find(a => a.id === selId);
                    setModalElaboracion({
                      ...modalElaboracion,
                      ingSelId: selId,
                      ingSelCoste: ingFound ? String(ingFound.coste_unitario || 0) : ''
                    });
                  }}
                  className="sm:col-span-5 bg-black/60 border border-white/20 rounded-xl px-2.5 py-2 text-white text-xs"
                >
                  <option value="">-- Seleccionar ingrediente --</option>
                  {articulosMaestro
                    .filter(a => a.id !== modalElaboracion.articuloDestinoId)
                    .map(a => (
                      <option key={a.id} value={a.id}>{a.nombre} ({Number(a.coste_unitario || 0).toFixed(2)}€/{a.unidad_medida})</option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Cantidad"
                  value={modalElaboracion.ingSelCant}
                  onChange={(e) => setModalElaboracion({ ...modalElaboracion, ingSelCant: e.target.value })}
                  className="sm:col-span-3 bg-black/60 border border-white/20 rounded-xl px-2.5 py-2 text-white text-xs font-mono"
                />
                <input
                  type="number"
                  step="0.0001"
                  placeholder="Coste unitario (€)"
                  value={modalElaboracion.ingSelCoste}
                  onChange={(e) => setModalElaboracion({ ...modalElaboracion, ingSelCoste: e.target.value })}
                  className="sm:col-span-3 bg-black/60 border border-amber-500/40 rounded-xl px-2.5 py-2 text-amber-400 text-xs font-mono font-bold"
                  title="Puedes modificar el coste a mano si se compró específicamente para este lote"
                />
                <button
                  type="button"
                  onClick={agregarIngredienteAElaboracion}
                  className="sm:col-span-1 rounded-xl bg-amber-500 text-slate-950 font-bold flex items-center justify-center cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              {modalElaboracion.ingredientes.length > 0 && (
                <div className="space-y-1.5 mt-3 max-h-40 overflow-y-auto pr-1">
                  {modalElaboracion.ingredientes.map((ing: any) => (
                    <div key={ing.id} className="flex justify-between items-center bg-black/40 px-3 py-2 rounded-lg text-xs">
                      <span className="text-white"><strong>{ing.nombre}</strong>: {ing.cantidad} {ing.unidad} <span className="text-amber-400 font-mono">({ing.costeBase.toFixed(4)}€/ud)</span></span>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-emerald-400 font-bold">{(ing.cantidad * ing.costeBase).toFixed(2)} €</span>
                        <button
                          type="button"
                          onClick={() => eliminarIngredienteElaboracion(ing.id)}
                          className="text-rose-400 hover:text-rose-300 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-2">
              <div className="text-xs text-slate-400">
                Coste total materia prima: <strong className="text-white">
                  {modalElaboracion.ingredientes.reduce((acc: number, i: any) => acc + (i.cantidad * i.costeBase), 0).toFixed(2)} €
                </strong>
              </div>
              <button
                type="submit"
                disabled={modalElaboracion.procesando}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-xs uppercase cursor-pointer disabled:opacity-50"
              >
                {modalElaboracion.procesando ? 'Procesando Lote...' : 'Finalizar Elaboración'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL EMPLEADO */}
      {modalEmpleado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md px-4 z-[100]">
          <form onSubmit={guardarEmpleado} className="w-full max-w-sm bg-[#0d0f17] border border-purple-500/40 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 text-purple-400"><UserCog className="h-5 w-5" /><h3 className="font-black text-white text-base">{modalEmpleado.id ? 'Editar Empleado' : 'Nuevo Empleado'}</h3></div>
              <button type="button" onClick={() => setModalEmpleado(null)} className="text-slate-400 hover:text-white cursor-pointer"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3 text-xs">
              <div><label className="font-bold text-slate-300 block mb-1">Nombre *</label><input type="text" required value={modalEmpleado.nombre} onChange={(e) => setModalEmpleado({ ...modalEmpleado, nombre: e.target.value })} className="w-full bg-black/60 border border-white/20 rounded-xl px-3.5 py-2.5 text-white" /></div>
              <div><label className="font-bold text-slate-300 block mb-1">Apellidos</label><input type="text" value={modalEmpleado.apellidos} onChange={(e) => setModalEmpleado({ ...modalEmpleado, apellidos: e.target.value })} className="w-full bg-black/60 border border-white/20 rounded-xl px-3.5 py-2.5 text-white" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="font-bold text-amber-400 block mb-1">PIN de Acceso *</label><input type="text" required value={modalEmpleado.pin} onChange={(e) => setModalEmpleado({ ...modalEmpleado, pin: e.target.value })} className="w-full bg-black/60 border border-amber-500/40 rounded-xl px-3.5 py-2.5 text-amber-400 font-mono font-bold" /></div>
                <div><label className="font-bold text-slate-300 block mb-1">Rol</label><select value={modalEmpleado.rol} onChange={(e) => setModalEmpleado({ ...modalEmpleado, rol: e.target.value })} className="w-full bg-black/60 border border-white/20 rounded-xl px-3.5 py-2.5 text-white"><option value="empleado">Empleado/Camarero</option><option value="admin">Administrador</option></select></div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer pt-2"><input type="checkbox" checked={modalEmpleado.activo} onChange={(e) => setModalEmpleado({ ...modalEmpleado, activo: e.target.checked })} className="h-4 w-4 accent-emerald-400" /><span className="font-bold text-emerald-300">Empleado Activo (Permite login)</span></label>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button type="button" onClick={() => setModalEmpleado(null)} className="py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-slate-300 cursor-pointer">Cancelar</button>
              <button type="submit" className="py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs uppercase cursor-pointer">Guardar</button>
            </div>
          </form>
        </div>
      )}

      {/* MODALES BACKOFFICE PARA FACTURACIÓN */}
      {modalRectificativa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md px-4 z-[100]">
          <form onSubmit={confirmarFacturaRectificativa} className="w-full max-w-md bg-[#0d0f17] border border-rose-500/40 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 text-rose-400"><RotateCcw className="h-5 w-5" /><h3 className="font-black text-white text-base">Emitir Factura Rectificativa</h3></div>
              <button type="button" onClick={() => setModalRectificativa(null)} className="text-slate-400 hover:text-white cursor-pointer"><X className="h-5 w-5" /></button>
            </div>
            <div className="text-xs text-slate-300 bg-black/40 p-3 rounded-xl border border-white/10 space-y-1">
              <div><strong>Ticket a rectificar:</strong> {modalRectificativa.factura.numero_completo}</div>
              <div><strong>Importe a devolver:</strong> <span className="text-rose-400 font-mono font-bold">-{Number(modalRectificativa.factura.total_final).toFixed(2)} € ({modalRectificativa.factura.metodo_pago})</span></div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 uppercase">Motivo legal de la rectificación *</label>
              <input type="text" required placeholder="Ej: Devolución de producto / Error en cobro" value={modalRectificativa.motivo} onChange={(e) => setModalRectificativa({ ...modalRectificativa, motivo: e.target.value })} className="w-full bg-black/60 border border-white/20 rounded-xl px-3.5 py-2.5 text-xs text-white" />
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button type="button" onClick={() => setModalRectificativa(null)} className="py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-slate-300 cursor-pointer">Cancelar</button>
              <button type="submit" disabled={modalRectificativa.procesando} className="py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase cursor-pointer disabled:opacity-50">{modalRectificativa.procesando ? 'Emitiendo...' : 'Emitir y Devolver'}</button>
            </div>
          </form>
        </div>
      )}

      {modalFacturaNominativa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md px-4 z-[100]">
          <form onSubmit={confirmarFacturaNominativa} className="w-full max-w-md bg-[#0d0f17] border border-cyan-500/40 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 text-cyan-400"><FileText className="h-5 w-5" /><h3 className="font-black text-white text-base">Convertir en Factura Nominativa</h3></div>
              <button type="button" onClick={() => setModalFacturaNominativa(null)} className="text-slate-400 hover:text-white cursor-pointer"><X className="h-5 w-5" /></button>
            </div>
            <div className="text-xs text-slate-300 bg-black/40 p-3 rounded-xl border border-white/10">
              Canje del Ticket <strong>{modalFacturaNominativa.factura.numero_completo}</strong> por importe de <strong>{Number(modalFacturaNominativa.factura.total_final).toFixed(2)} €</strong>
            </div>
            <div className="space-y-3">
              <div><label className="text-xs font-bold text-slate-300 block mb-1">Nombre Completo o Razón Social *</label><input type="text" required placeholder="Ej: Empresa Cliente S.L." value={modalFacturaNominativa.razonSocial} onChange={(e) => setModalFacturaNominativa({ ...modalFacturaNominativa, razonSocial: e.target.value })} className="w-full bg-black/60 border border-white/20 rounded-xl px-3.5 py-2 text-xs text-white" /></div>
              <div><label className="text-xs font-bold text-slate-300 block mb-1">NIF / CIF / NIE *</label><input type="text" required placeholder="Ej: B14000000" value={modalFacturaNominativa.nifCif} onChange={(e) => setModalFacturaNominativa({ ...modalFacturaNominativa, nifCif: e.target.value })} className="w-full bg-black/60 border border-white/20 rounded-xl px-3.5 py-2 text-xs text-white uppercase font-mono" /></div>
              <div><label className="text-xs font-bold text-slate-300 block mb-1">Dirección Fiscal Completa *</label><input type="text" required placeholder="Calle, Número, CP, Ciudad, Provincia" value={modalFacturaNominativa.direccion} onChange={(e) => setModalFacturaNominativa({ ...modalFacturaNominativa, direccion: e.target.value })} className="w-full bg-black/60 border border-white/20 rounded-xl px-3.5 py-2 text-xs text-white" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button type="button" onClick={() => setModalFacturaNominativa(null)} className="py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-slate-300 cursor-pointer">Cancelar</button>
              <button type="submit" disabled={modalFacturaNominativa.procesando} className="py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs uppercase cursor-pointer disabled:opacity-50">{modalFacturaNominativa.procesando ? 'Generando...' : 'Emitir e Imprimir'}</button>
            </div>
          </form>
        </div>
      )}

      <header className="border-b border-white/10 pb-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 sticky top-0 bg-[#050609]/95 backdrop-blur-md z-30">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center"><TrendingUp className="h-7 w-7" /></div>
          <div><h1 className="text-lg sm:text-xl font-black tracking-wide text-white">CAFETERÍA · BACKOFFICE</h1><p className="text-xs text-slate-400">Admin activo: <strong className="text-cyan-400">{adminVerificado.nombre}</strong></p></div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => (onBack ? onBack() : (window.location.hash = ''))} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-bold text-white cursor-pointer"><ArrowLeft className="h-4 w-4" /><span>Volver a TPV</span></button>
        </div>
      </header>

      <div className="max-w-7xl w-full mx-auto mb-6 flex flex-wrap gap-2 border-b border-white/10 pb-4">
        <button onClick={() => setPestanaActiva('ventas_dia')} className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${pestanaActiva === 'ventas_dia' ? 'bg-cyan-500 text-slate-950 shadow-md' : 'bg-white/5 text-slate-400 hover:text-white'}`}><BarChart3 className="h-4 w-4" /> Ventas y Cuadre</button>
        <button onClick={() => setPestanaActiva('historico_tickets')} className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${pestanaActiva === 'historico_tickets' ? 'bg-cyan-500 text-slate-950 shadow-md' : 'bg-white/5 text-slate-400 hover:text-white'}`}><Receipt className="h-4 w-4" /> Histórico Tickets</button>
        <button onClick={() => setPestanaActiva('articulos_escandallos')} className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${pestanaActiva === 'articulos_escandallos' ? 'bg-cyan-500 text-slate-950 shadow-md' : 'bg-white/5 text-slate-400 hover:text-white'}`}><Layers className="h-4 w-4" /> Artículos y Escandallos</button>
        <button onClick={() => setPestanaActiva('inventario_compras')} className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${pestanaActiva === 'inventario_compras' ? 'bg-cyan-500 text-slate-950 shadow-md' : 'bg-white/5 text-slate-400 hover:text-white'}`}><Package className="h-4 w-4" /> Inventario y Compras</button>
        <button onClick={() => setPestanaActiva('empleados')} className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${pestanaActiva === 'empleados' ? 'bg-purple-500 text-slate-950 shadow-md' : 'bg-white/5 text-slate-400 hover:text-white'}`}><UserCog className="h-4 w-4" /> Empleados</button>
        <button onClick={() => setPestanaActiva('datos_fiscales')} className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${pestanaActiva === 'datos_fiscales' ? 'bg-cyan-500 text-slate-950 shadow-md' : 'bg-white/5 text-slate-400 hover:text-white'}`}><Building2 className="h-4 w-4" /> Configuración Fiscal</button>
      </div>

      <main className="flex-1 max-w-7xl w-full mx-auto space-y-6 pb-16">
        {mensajeAlerta && (
          <div className={`p-4 rounded-2xl border text-xs font-bold flex items-center gap-2 ${mensajeAlerta.tipo === 'ok' ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300' : mensajeAlerta.tipo === 'info' ? 'bg-sky-950/60 border-sky-500/40 text-sky-300' : 'bg-rose-950/60 border-rose-500/40 text-rose-300'}`}><CheckCircle2 className="h-4 w-4 shrink-0" /><span>{mensajeAlerta.texto}</span></div>
        )}

        {/* PESTAÑA EMPLEADOS */}
        {pestanaActiva === 'empleados' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-[#0d0f17] p-4 rounded-2xl border border-white/10">
              <h2 className="text-sm font-black text-white flex items-center gap-2"><UserCog className="h-5 w-5 text-purple-400" /> Gestión de Camareros y Administradores</h2>
              <button type="button" onClick={() => setModalEmpleado({ nombre: '', apellidos: '', pin: '', rol: 'empleado', activo: true })} className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs uppercase cursor-pointer flex items-center gap-2 shadow-lg"><Plus className="h-4 w-4" /> Nuevo Empleado</button>
            </div>
            
            <div className="overflow-x-auto max-h-[600px] border border-white/10 rounded-2xl bg-[#0d0f17]">
              <table className="w-full text-left text-xs">
                <thead className="bg-white/5 text-slate-400 uppercase sticky top-0 backdrop-blur-md z-10 shadow-md">
                  <tr><th className="p-4">Estado</th><th className="p-4">Nombre Completo</th><th className="p-4">Rol en TPV</th><th className="p-4">PIN de Acceso</th><th className="p-4 text-right">Acciones</th></tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {empleados.length === 0 ? (
                    <tr><td colSpan={5} className="p-8 text-center text-slate-500">No hay empleados registrados.</td></tr>
                  ) : (
                    empleados.map((emp) => (
                      <tr key={emp.id} className="hover:bg-white/[0.02]">
                        <td className="p-4">{emp.activo ? <span className="bg-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 w-max"><Check className="h-3 w-3"/> Activo</span> : <span className="bg-rose-500/20 text-rose-400 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 w-max"><Ban className="h-3 w-3"/> Inactivo</span>}</td>
                        <td className="p-4 font-bold text-white text-sm">{emp.nombre} {emp.apellidos}</td>
                        <td className="p-4"><span className={`px-2.5 py-1 rounded-lg font-bold uppercase text-[10px] ${emp.rol === 'admin' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'}`}>{emp.rol}</span></td>
                        <td className="p-4 font-mono text-slate-400">{emp.pin_acceso}</td>
                        <td className="p-4 text-right">
                          <button type="button" onClick={() => setModalEmpleado({ id: emp.id, nombre: emp.nombre, apellidos: emp.apellidos || '', pin: emp.pin_acceso, rol: emp.rol, activo: emp.activo })} className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-purple-500 hover:text-white text-slate-300 font-bold flex items-center gap-1.5 cursor-pointer ml-auto transition-colors"><Edit3 className="h-4 w-4" /> Editar</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {pestanaActiva === 'ventas_dia' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-[#0d0f17] p-4 rounded-2xl border border-white/10">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-300 uppercase">Consultar Fecha:</span>
                <input type="date" value={fechaFiltroInicio} onChange={(e) => { setFechaFiltroInicio(e.target.value); setFechaFiltroFin(e.target.value); }} className="bg-black/60 border border-white/20 rounded-xl px-3 py-1.5 text-xs text-white" />
              </div>
              <span className="text-xs text-slate-400">Operaciones registradas: <strong>{ticketsFiltrados.length}</strong></span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-3xl bg-[#0d0f17] border border-white/10 space-y-1"><div className="flex justify-between text-xs text-slate-400 font-bold uppercase"><span>Facturación Neta Día</span><TrendingUp className="h-4 w-4 text-cyan-400" /></div><div className="text-2xl font-black text-white font-mono">{totalFacturadoPeriodo.toFixed(2)} €</div><p className="text-[11px] text-slate-500">{ticketsFiltrados.length} documentos fiscales emitidos</p></div>
              <div className="p-5 rounded-3xl bg-[#0d0f17] border border-white/10 space-y-1"><div className="flex justify-between text-xs text-slate-400 font-bold uppercase"><span>Total Efectivo</span><DollarSign className="h-4 w-4 text-emerald-400" /></div><div className="text-2xl font-black text-emerald-400 font-mono">{totalEfectivoPeriodo.toFixed(2)} €</div><p className="text-[11px] text-slate-500">Cobros netos en metálico</p></div>
              <div className="p-5 rounded-3xl bg-[#0d0f17] border border-white/10 space-y-1"><div className="flex justify-between text-xs text-slate-400 font-bold uppercase"><span>Total Tarjeta</span><CreditCard className="h-4 w-4 text-sky-400" /></div><div className="text-2xl font-black text-sky-400 font-mono">{totalTarjetaPeriodo.toFixed(2)} €</div><p className="text-[11px] text-slate-500">Cobros por datáfono bancario</p></div>
              <div className="p-5 rounded-3xl bg-[#0d0f17] border border-white/10 space-y-1"><div className="flex justify-between text-xs text-slate-400 font-bold uppercase"><span>Ticket Medio</span><Wallet className="h-4 w-4 text-amber-400" /></div><div className="text-2xl font-black text-amber-400 font-mono">{ticketMedioPeriodo.toFixed(2)} €</div><p className="text-[11px] text-slate-500">Promedio por operación</p></div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="p-6 rounded-3xl bg-[#0d0f17] border border-white/10 space-y-4">
                <div className="flex items-center gap-2 text-amber-400 border-b border-white/10 pb-3"><Users className="h-5 w-5" /><h3 className="font-bold text-white text-sm">Ventas por Vendedor y Ticket Medio</h3></div>
                {ventasPorVendedor.length === 0 ? ( <p className="text-xs text-slate-500 py-6 text-center">No hay ventas en esta fecha.</p> ) : (
                  <div className="space-y-4 pt-2">
                    {ventasPorVendedor.map((v, i) => (
                      <div key={i} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <div><span className="font-black text-amber-400 mr-2">#{i + 1}</span><span className="font-bold text-white uppercase">{v.nombre}</span><span className="text-slate-500 ml-2">({v.operaciones} tkts)</span></div>
                          <div className="text-right font-mono font-black text-cyan-400">{v.total.toFixed(2)} €</div>
                        </div>
                        <div className="w-full bg-black/60 rounded-full h-1.5 border border-white/5 overflow-hidden mt-2">
                          <div className="bg-amber-400 h-1.5 rounded-full" style={{ width: `${Math.max(1, (v.total / maxVentaVendedor) * 100)}%` }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* GRÁFICO DE LÍNEAS CONTINUAS POR HORAS (08:00 A 23:00) */}
              <div className="p-6 rounded-3xl bg-[#0d0f17] border border-white/10 space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2 text-cyan-400">
                    <Clock className="h-5 w-5" />
                    <h3 className="font-bold text-white text-sm">Evolución de Ventas por Horas (Apertura a Cierre)</h3>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">08:00 - 23:00</span>
                </div>

                <div className="pt-2 pb-2">
                  <div className="h-44 w-full relative">
                    <svg className="w-full h-full overflow-visible" viewBox="0 0 600 120" preserveAspectRatio="none">
                      {/* Líneas guía horizontales */}
                      <line x1="0" y1="0" x2="600" y2="0" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                      <line x1="0" y1="60" x2="600" y2="60" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                      <line x1="0" y1="120" x2="600" y2="120" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />

                      {/* Línea de tendencia SVG */}
                      <path
                        d={horasContinuas.reduce((acc, h, idx) => {
                          const x = (idx / (horasContinuas.length - 1)) * 600;
                          const y = 120 - (h.total / maxVentaLinea) * 100;
                          return idx === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
                        }, '')}
                        fill="none"
                        stroke="#22d3ee"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      {/* Puntos interactivos en cada hora */}
                      {horasContinuas.map((h, idx) => {
                        const x = (idx / (horasContinuas.length - 1)) * 600;
                        const y = 120 - (h.total / maxVentaLinea) * 100;
                        return (
                          <g key={idx} className="group cursor-pointer">
                            <circle cx={x} cy={y} r="4" className="fill-cyan-400 stroke-[#0d0f17] stroke-2 transition-all group-hover:r-7" />
                            {h.total > 0 && (
                              <text x={x} y={y - 10} textAnchor="middle" className="text-[9px] font-mono fill-cyan-300 opacity-0 group-hover:opacity-100 transition-opacity">
                                {h.total.toFixed(0)}€
                              </text>
                            )}
                          </g>
                        );
                      })}
                    </svg>
                  </div>

                  {/* Eje X de Horas */}
                  <div className="flex justify-between text-[9px] font-mono text-slate-500 pt-3 border-t border-white/5">
                    {horasContinuas.map((h, idx) => (
                      <span key={idx} className={h.total > 0 ? 'text-cyan-400 font-bold' : ''}>{h.hora.substring(0, 2)}h</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-[#0d0f17] border border-white/10 space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2 text-emerald-400"><Wallet className="h-5 w-5" /><h3 className="font-bold text-white text-sm">Comprobación de Cuadres y Cierres de Caja de los Trabajadores</h3></div>
                {cajaHoy && ( <span className="text-xs font-mono text-amber-400">Estado Caja Hoy: <strong>{String(cajaHoy.estado).toUpperCase()}</strong> | Fondo: {Number(cajaHoy.remanente_apertura).toFixed(2)} €</span> )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/5 text-slate-400 uppercase">
                    <tr><th className="p-3">Fecha / Hora Cierre</th><th className="p-3">Trabajador</th><th className="p-3 text-right">Fondo Inicial</th><th className="p-3 text-right">Efectivo Sist.</th><th className="p-3 text-right">Tarjeta Sist.</th><th className="p-3 text-right">Esperado Cajón</th><th className="p-3 text-right">Contado Trabajador</th><th className="p-3 text-right">Descuadre</th></tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {cierresTrabajadores.length === 0 ? ( <tr><td colSpan={8} className="p-6 text-center text-slate-500">No hay cierres de turno registrados todavía.</td></tr> ) : (
                      cierresTrabajadores.map((c) => (
                        <tr key={c.id} className="hover:bg-white/[0.02]">
                          <td className="p-3">{new Date(c.fecha_cierre).toLocaleString('es-ES')}</td>
                          <td className="p-3 font-bold text-white">{c.usuario_nombre}</td>
                          <td className="p-3 text-right font-mono">{Number(c.fondo_inicial).toFixed(2)} €</td>
                          <td className="p-3 text-right font-mono text-emerald-400">{Number(c.ventas_efectivo_sistema).toFixed(2)} €</td>
                          <td className="p-3 text-right font-mono text-sky-400">{Number(c.ventas_tarjeta_sistema).toFixed(2)} €</td>
                          <td className="p-3 text-right font-mono font-bold text-white">{Number(c.efectivo_esperado_caja).toFixed(2)} €</td>
                          <td className="p-3 text-right font-mono font-bold text-amber-400">{Number(c.efectivo_contado_trabajador).toFixed(2)} €</td>
                          <td className="p-3 text-right font-mono font-black"><span className={`px-2 py-0.5 rounded ${Math.abs(Number(c.descuadre_efectivo)) < 0.05 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>{Number(c.descuadre_efectivo).toFixed(2)} €</span></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {pestanaActiva === 'historico_tickets' && (
          <div className="p-6 rounded-3xl bg-[#0d0f17] border border-white/10 space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div className="flex flex-wrap items-center gap-3">
                <div><label className="text-[10px] uppercase font-bold text-slate-400 block">Desde</label><input type="date" value={fechaFiltroInicio} onChange={(e) => setFechaFiltroInicio(e.target.value)} className="bg-black/60 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white" /></div>
                <div><label className="text-[10px] uppercase font-bold text-slate-400 block">Hasta</label><input type="date" value={fechaFiltroFin} onChange={(e) => setFechaFiltroFin(e.target.value)} className="bg-black/60 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white" /></div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block">Serie Fiscal</label>
                  <select value={filtroSerie} onChange={(e) => setFiltroSerie(e.target.value)} className="bg-black/60 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white">
                    <option value="TODAS">Todas (T, R, F)</option><option value="T">Serie T (Simplificadas)</option><option value="R">Serie R (Rectificativas)</option><option value="F">Serie F (Nominativas)</option>
                  </select>
                </div>
                <div className="relative"><label className="text-[10px] uppercase font-bold text-slate-400 block">Buscar</label><input type="text" placeholder="Nº, NIF, Camarero..." value={busquedaTicket} onChange={(e) => setBusquedaTicket(e.target.value)} className="bg-black/60 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white" /></div>
              </div>
              <div className="flex items-center gap-2.5">
                <button type="button" onClick={() => exportarTicketsAExcelCSV(ticketsFiltrados, 'libro_facturas_nexus')} className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer"><FileSpreadsheet className="h-4 w-4" /> Exportar Excel (.CSV)</button>
                <button type="button" onClick={() => exportarTicketsAPDF(ticketsFiltrados, configFiscal)} className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer"><FileText className="h-4 w-4" /> Exportar PDF Oficial</button>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[600px] border border-white/10 rounded-2xl bg-black/20">
              <table className="w-full text-left text-xs">
                <thead className="bg-white/5 text-slate-400 uppercase sticky top-0 backdrop-blur-md z-10 shadow-md">
                  <tr>
                    <th className="p-3">Nº Oficial</th>
                    <th className="p-3">Tipo</th>
                    <th className="p-3">Fecha y Hora</th>
                    <th className="p-3">Mesa / Vendedor</th>
                    <th className="p-3">Pago</th>
                    <th className="p-3 text-right">Base Imp.</th>
                    <th className="p-3 text-right">IVA</th>
                    <th className="p-3 text-right">Total</th>
                    <th className="p-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {(() => {
                    const raices = agruparFacturas(ticketsFiltrados);
                    if (raices.length === 0) { return <tr><td colSpan={9} className="p-8 text-center text-slate-500">No hay documentos en el rango seleccionado.</td></tr>; }

                    const renderFila = (f: any, nivel: number) => (
                      <React.Fragment key={f.id}>
                        <tr className={`hover:bg-white/[0.05] transition-colors ${nivel > 0 ? 'bg-white/[0.02]' : ''}`}>
                          <td className="p-3 font-mono font-bold text-cyan-400 flex items-center gap-2" style={{ paddingLeft: `${nivel * 1.5 + 0.75}rem` }}>
                            {nivel > 0 && <span className="text-slate-600"><CornerDownRight className="h-4 w-4"/></span>}
                            {f.numero_completo}
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${f.serie === 'R' ? 'bg-rose-500/20 text-rose-300' : f.serie === 'F' ? 'bg-purple-500/20 text-purple-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                              {f.tipo_documento}
                            </span>
                            {f.estado_fiscal !== 'EMITIDO' && <span className="ml-2 text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-bold">{f.estado_fiscal}</span>}
                          </td>
                          <td className="p-3 text-slate-400">{new Date(f.fecha_expedicion).toLocaleString('es-ES')}</td>
                          <td className="p-3">
                            {f.mesa} · <strong>{f.vendedor_nombre}</strong>
                            {f.cliente_nif && <span className="block text-[10px] text-cyan-300">Cliente: {f.cliente_nombre_razon} ({f.cliente_nif})</span>}
                          </td>
                          <td className="p-3 uppercase font-bold text-slate-300">{f.metodo_pago}</td>
                          <td className="p-3 text-right font-mono text-slate-400">{Number(f.base_imponible).toFixed(2)} €</td>
                          <td className="p-3 text-right font-mono text-slate-400">{Number(f.cuota_iva).toFixed(2)} €</td>
                          <td className={`p-3 text-right font-mono font-black ${Number(f.total_final) < 0 ? 'text-rose-400' : 'text-white'}`}>
                            {Number(f.total_final).toFixed(2)} €
                          </td>
                          <td className="p-3 text-right flex justify-end gap-1.5">
                            <button type="button" title="Imprimir" onClick={() => imprimirDocumentoFiscalHTML(f, configFiscal)} className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center cursor-pointer">
                              <Printer className="h-3.5 w-3.5" />
                            </button>
                            {f.serie === 'T' && f.estado_fiscal === 'EMITIDO' && (
                              <button type="button" title="Convertir en Factura Nominativa" onClick={() => setModalFacturaNominativa({ factura: f, razonSocial: '', nifCif: '', direccion: '', procesando: false })} className="px-2.5 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500 hover:text-slate-950 text-cyan-300 flex items-center cursor-pointer transition-all">
                                <FileText className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {(f.serie === 'T' || f.serie === 'F') && f.estado_fiscal === 'EMITIDO' && (
                              <button type="button" title="Anular / Devolver" onClick={() => setModalRectificativa({ factura: f, motivo: '', procesando: false })} className="px-2.5 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-600 hover:text-white text-rose-300 flex items-center cursor-pointer transition-all">
                                <RotateCcw className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                        {f.hijos?.map((h: any) => renderFila(h, nivel + 1))}
                      </React.Fragment>
                    );

                    return raices.map(r => renderFila(r, 0));
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {pestanaActiva === 'articulos_escandallos' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <form onSubmit={guardarYSincronizarArticulo} className="lg:col-span-7 p-6 rounded-3xl bg-[#0d0f17] border border-white/10 space-y-5">
              <div className="flex items-center justify-between border-b border-white/10 pb-3 flex-wrap gap-3">
                <h3 className="font-black text-white text-base">
                  {editandoArticuloId ? '✏️ Editando Artículo' : '➕ Crear Nuevo Artículo / Receta'}
                </h3>
                <div className="flex items-center gap-2">
                  {!editandoArticuloId && (
                    <>
                      <button type="button" onClick={descargarPlantillaCSV} className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-300 flex items-center gap-1.5 cursor-pointer">
                        <Download className="h-3.5 w-3.5" /> Plantilla CSV
                      </button>
                      <label className="px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500 hover:text-slate-950 border border-cyan-500/30 text-cyan-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors">
                        <Upload className="h-3.5 w-3.5" />
                        {isImportingCSV ? 'Importando...' : 'Importar CSV'}
                        <input type="file" accept=".csv" className="hidden" onChange={manejarImportacionCSV} disabled={isImportingCSV} />
                      </label>
                    </>
                  )}
                  {editandoArticuloId && (
                    <button type="button" onClick={limpiarFormularioArticulo} className="text-xs text-amber-400 hover:underline cursor-pointer">
                      Cancelar edición y crear nuevo
                    </button>
                  )}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2 text-xs">
                <span className="font-bold text-slate-300 block">Categorías Visuales Existentes (Pestañas TPV):</span>
                <div className="flex flex-wrap gap-1.5">
                  {categorias.map((cat) => (
                    <span key={cat} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-black/50 border border-white/15 text-slate-200 font-bold text-xs">
                      {cat}
                      <button type="button" onClick={() => borrarCategoria(cat)} className="text-rose-400 hover:text-rose-300 ml-1 p-0.5 cursor-pointer" title={`Borrar categoría ${cat}`}>
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Nombre del Artículo *</label>
                  <input type="text" required placeholder="Ej: Café con Leche / Tapa Salmorejo" value={artNombre} onChange={(e) => setArtNombre(e.target.value)} className="w-full bg-black/60 border border-white/20 rounded-xl px-3.5 py-2.5 text-white font-bold" />
                </div>
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Categoría Visual (Pestaña TPV)</label>
                  <div className="flex gap-1.5">
                    <select value={artCategoria} onChange={(e) => setArtCategoria(e.target.value)} className="flex-1 bg-black/60 border border-white/20 rounded-xl px-3 py-2.5 text-white">
                      {categorias.map((c) => (<option key={c} value={c}>{c}</option>))}
                    </select>
                    <input type="text" placeholder="+ Nueva" value={nuevaCategoriaInput} onChange={(e) => setNuevaCategoriaInput(e.target.value)} className="w-24 bg-black/60 border border-white/20 rounded-xl px-2 text-white" />
                    <button type="button" onClick={crearNuevaCategoria} className="px-2.5 rounded-xl bg-cyan-500 text-slate-950 font-bold cursor-pointer">+</button>
                  </div>
                </div>
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Destino KDS (Pantalla de Impresión)</label>
                  <select value={artDestino} onChange={(e) => setArtDestino(e.target.value as 'barra' | 'cocina')} className="w-full bg-black/60 border border-cyan-500/40 rounded-xl px-3.5 py-2.5 text-cyan-300 font-bold">
                    <option value="barra">Barra</option>
                    <option value="cocina">Cocina</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Unidad de Medida Base</label>
                  <select value={artUnidadMedida} onChange={(e) => setArtUnidadMedida(e.target.value as UnidadMedida)} className="w-full bg-black/60 border border-amber-500/40 rounded-xl px-3.5 py-2.5 text-amber-300 font-bold">
                    <option value="ud">Unidad (ud)</option><option value="kg">Kilogramos (kg)</option><option value="g">Gramos (g)</option><option value="l">Litros (l)</option><option value="ml">Mililitros (ml)</option><option value="m">Metros (m)</option><option value="cm">Centímetros (cm)</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Código de Barras (EAN / SKU)</label>
                  <div className="relative">
                    <Barcode className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                    <input type="text" placeholder="Escanea o escribe el código..." value={artCodigoBarras} onChange={(e) => setArtCodigoBarras(e.target.value)} className="w-full bg-black/60 border border-white/20 rounded-xl pl-9 pr-3 py-2.5 text-white font-mono" />
                  </div>
                </div>
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Precio de Venta PVP con IVA (€)</label>
                  <input type="number" step="0.01" value={artPrecioVenta} onChange={(e) => setArtPrecioVenta(e.target.value)} className="w-full bg-black/60 border border-white/20 rounded-xl px-3.5 py-2.5 text-emerald-400 font-mono font-bold text-sm" />
                </div>
                <div>
                  <label className="font-bold text-slate-300 block mb-1">
                    Coste por {artUnidadMedida} (€) {artEsCompuesto && '(Auto por Escandallo)'}
                  </label>
                  <input type="number" step="0.0001" readOnly={artEsCompuesto} value={artCosteUnitario} onChange={(e) => setArtCosteUnitario(e.target.value)} className="w-full bg-black/60 border border-white/20 rounded-xl px-3.5 py-2.5 text-amber-400 font-mono font-bold text-sm" />
                  <span className="text-[10px] text-slate-400">Margen bruto estimado: {margenBeneficioArticulo}%</span>
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="font-bold text-slate-300 block">Imagen del Producto (URL o Subir Archivo)</label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input type="text" placeholder="https://... o sube una foto desde tu equipo" value={artImagenUrl} onChange={(e) => setArtImagenUrl(e.target.value)} className="flex-1 bg-black/60 border border-white/20 rounded-xl px-3.5 py-2 text-white" />
                    <label className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold flex items-center gap-1.5 cursor-pointer shrink-0">
                      <ImageIcon className="h-4 w-4 text-cyan-400" /> Subir Foto
                      <input type="file" accept="image/*" onChange={manejarSubidaImagen} className="hidden" />
                    </label>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-black/40 border border-white/10 text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={artControlaStock} onChange={(e) => setArtControlaStock(e.target.checked)} className="h-4 w-4 accent-cyan-400" />
                  <span className="font-bold text-white">Lleva Control de Stock</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={artVendibleTpv} onChange={(e) => setArtVendibleTpv(e.target.checked)} className="h-4 w-4 accent-emerald-400" />
                  <span className="font-bold text-emerald-300">Visible en TPV / Carta</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={artEsCompuesto} onChange={(e) => { setArtEsCompuesto(e.target.checked); if (e.target.checked) setArtEsCombo(false); }} className="h-4 w-4 accent-amber-400" />
                  <span className="font-bold text-amber-300">Es Elaboración (Escandallo)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={artEsCombo} onChange={(e) => { setArtEsCombo(e.target.checked); if (e.target.checked) setArtEsCompuesto(false); }} className="h-4 w-4 accent-purple-400" />
                  <span className="font-bold text-purple-300">Combo / Opciones (Menús, Combinados)</span>
                </label>
              </div>

              {artControlaStock && !artEsCompuesto && (
                <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-cyan-950/20 border border-cyan-500/30 text-xs">
                  <div>
                    <label className="font-bold text-cyan-300 block mb-1">Stock Inicial / Actual ({artUnidadMedida})</label>
                    <input type="number" step="0.001" value={artStockInicial} onChange={(e) => setArtStockInicial(e.target.value)} className="w-full bg-black/60 border border-white/20 rounded-xl px-3 py-2 text-white font-mono font-bold" />
                  </div>
                  <div>
                    <label className="font-bold text-slate-300 block mb-1">Stock Mínimo Alerta</label>
                    <input type="number" step="0.001" value={artStockMinimo} onChange={(e) => setArtStockMinimo(e.target.value)} className="w-full bg-black/60 border border-white/20 rounded-xl px-3 py-2 text-white font-mono" />
                  </div>
                </div>
              )}

              {artEsCombo && (
                <div className="p-4 rounded-2xl bg-purple-950/20 border border-purple-500/40 space-y-4 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-purple-400 font-bold">
                      <ListPlus className="h-4 w-4" />
                      <span>Opciones del Menú, Tostada o Combinado</span>
                    </div>
                    <button type="button" onClick={agregarPasoCombo} className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold flex items-center gap-1 cursor-pointer">
                      <Plus className="h-3 w-3" /> Añadir Paso
                    </button>
                  </div>

                  <div className="space-y-4">
                    {pasosCombo.map((paso, pIdx) => (
                      <div key={pIdx} className="p-3 bg-black/40 border border-white/10 rounded-xl space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-400">{pIdx + 1}.</span>
                          <input type="text" placeholder="Ej: Elige el refresco / Elige el tipo de pan" value={paso.titulo} onChange={(e) => actualizarTituloPaso(pIdx, e.target.value)} className="flex-1 bg-black/60 border border-white/20 rounded-lg px-3 py-1.5 text-white font-bold" />
                          <button type="button" onClick={() => eliminarPasoCombo(pIdx)} className="text-rose-400 hover:text-rose-300 p-1"><Trash2 className="h-4 w-4" /></button>
                        </div>
                        <div className="pl-6 space-y-2">
                          {paso.opciones.map((opc, oIdx) => (
                            <div key={oIdx} className="flex gap-2 items-center">
                              <input type="text" placeholder="Nombre de la opción" value={opc.nombre} onChange={(e) => actualizarOpcion(pIdx, oIdx, 'nombre', e.target.value)} className="flex-1 bg-black/60 border border-white/20 rounded-lg px-2 py-1.5 text-white text-xs" />
                              <select value={opc.destino} onChange={(e) => actualizarOpcion(pIdx, oIdx, 'destino', e.target.value)} className="bg-black/60 border border-white/20 rounded-lg px-2 py-1.5 text-white text-xs">
                                <option value="barra">Barra</option><option value="cocina">Cocina</option>
                              </select>
                              <button type="button" onClick={() => eliminarOpcionDePaso(pIdx, oIdx)} className="text-slate-500 hover:text-rose-400"><X className="h-4 w-4" /></button>
                            </div>
                          ))}
                          <button type="button" onClick={() => agregarOpcionAPaso(pIdx)} className="text-purple-400 hover:text-purple-300 font-bold flex items-center gap-1 mt-1 text-[10px] uppercase">
                            <Plus className="h-3 w-3" /> Añadir Opción a este paso
                          </button>
                        </div>
                      </div>
                    ))}
                    {pasosCombo.length === 0 && (<p className="text-slate-500 italic text-center py-2">No hay pasos configurados.</p>)}
                  </div>
                </div>
              )}

              {artEsCompuesto && (
                <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-500/40 space-y-4 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-amber-400 font-bold">
                      <Scale className="h-4 w-4" />
                      <span>Configuración del Escandallo (Ingredientes por peso, volumen o unidad)</span>
                    </div>
                    <span className="font-mono font-black text-amber-300">
                      Coste Total Escandallo: {Number(artCosteUnitario).toFixed(4)} €
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                    <div className="sm:col-span-5">
                      <label className="text-[10px] text-slate-300 block mb-1">Ingrediente / Artículo Base</label>
                      <select value={ingredienteSelId} onChange={(e) => setIngredienteSelId(e.target.value)} className="w-full bg-black/70 border border-white/20 rounded-xl px-2.5 py-2 text-white">
                        <option value="">-- Seleccionar ingrediente --</option>
                        {articulosMaestro.filter((a) => a.id !== editandoArticuloId && !a.es_combo).map((a) => (
                          <option key={a.id} value={a.id}>{a.nombre} ({Number(a.coste_unitario).toFixed(2)}€/{a.unidad_medida})</option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-[10px] text-slate-300 block mb-1">Cantidad</label>
                      <input type="number" step="0.001" value={ingredienteCantidad} onChange={(e) => setIngredienteCantidad(e.target.value)} className="w-full bg-black/70 border border-white/20 rounded-xl px-2.5 py-2 text-white font-mono" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-[10px] text-slate-300 block mb-1">Unidad Receta</label>
                      <select value={ingredienteUnidadUso} onChange={(e) => setIngredienteUnidadUso(e.target.value as UnidadMedida)} className="w-full bg-black/70 border border-white/20 rounded-xl px-2 py-2 text-amber-300 font-bold">
                        <option value="g">g (gramos)</option><option value="kg">kg (kilos)</option><option value="ml">ml (mililitros)</option><option value="l">l (litros)</option><option value="ud">ud (unidades)</option><option value="cm">cm</option><option value="m">m</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-[10px] text-slate-300 block mb-1">% Merma</label>
                      <input type="number" step="0.5" value={ingredienteMerma} onChange={(e) => setIngredienteMerma(e.target.value)} className="w-full bg-black/70 border border-white/20 rounded-xl px-2 py-2 text-white font-mono" />
                    </div>
                    <div className="sm:col-span-1">
                      <button type="button" onClick={agregarIngredienteAEscandallo} className="w-full py-2 rounded-xl bg-amber-500 text-slate-950 font-black flex items-center justify-center cursor-pointer">
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {lineasEscandallo.length > 0 && (
                    <div className="space-y-1.5 pt-2">
                      {lineasEscandallo.map((l, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-black/50 px-3 py-2 rounded-xl border border-white/10">
                          <div>
                            <strong className="text-white">{l.nombre_ingrediente}</strong>: <span className="text-amber-300 font-mono">{l.cantidad} {l.unidad_uso}</span>
                            {l.merma_porcentaje > 0 && (<span className="text-slate-400 ml-1.5">(Merma: {l.merma_porcentaje}%)</span>)}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-bold text-emerald-400">{l.coste_calculado.toFixed(4)} €</span>
                            <button type="button" onClick={() => eliminarLineaEscandallo(idx)} className="text-rose-400 hover:text-rose-300 cursor-pointer"><Trash2 className="h-4 w-4" /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <button type="submit" className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg">
                <Save className="h-4 w-4" />
                {editandoArticuloId ? 'Guardar Cambios y Sincronizar en Supabase' : 'Confirmar Creación y Sincronizar con TPV'}
              </button>
            </form>

            <div className="lg:col-span-5 p-6 rounded-3xl bg-[#0d0f17] border border-white/10 space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="font-bold text-white text-sm">Catálogo Sincronizado ({articulosMaestro.length})</h3>
                <div className="relative w-44">
                  <Search className="h-3.5 w-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                  <input type="text" placeholder="Buscar artículo..." value={filtroArticulos} onChange={(e) => setFiltroArticulos(e.target.value)} className="w-full bg-black/60 border border-white/15 rounded-xl pl-8 pr-2.5 py-1.5 text-xs text-white" />
                </div>
              </div>

              <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
                {articulosMaestro.filter((a) => a.nombre.toLowerCase().includes(filtroArticulos.toLowerCase())).map((art) => (
                  <div key={art.id} className="p-3.5 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-3">
                      {art.imagen_url ? (
                        <img src={art.imagen_url} alt={art.nombre} className="h-11 w-11 rounded-xl object-cover border border-white/10" />
                      ) : (
                        <div className="h-11 w-11 rounded-xl bg-white/5 flex items-center justify-center text-slate-500"><Package className="h-5 w-5" /></div>
                      )}
                      <div>
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <span>{art.nombre}</span>
                          {art.es_compuesto && (<span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">Escandallo</span>)}
                          {art.es_combo && (<span className="text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded">Opciones</span>)}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Pestaña: <strong className="text-cyan-300">{art.categoria}</strong> · Destino: <strong className="text-amber-300 uppercase">{art.destino || 'barra'}</strong> · PVP: <strong className="text-emerald-400">{Number(art.precio_venta).toFixed(2)}€</strong>
                        </div>
                      </div>
                    </div>
                    <button type="button" onClick={() => seleccionarArticuloParaEditar(art)} className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-cyan-500 hover:text-slate-950 text-white font-bold flex items-center gap-1 cursor-pointer transition-all">
                      <Edit3 className="h-3.5 w-3.5" /> Editar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {pestanaActiva === 'inventario_compras' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-[#0d0f17] p-4 rounded-2xl border border-white/10">
              <h2 className="text-sm font-black text-white flex items-center gap-2">
                <Layers className="h-5 w-5 text-emerald-400" />
                Gestión Centralizada de Stock y Elaboraciones
              </h2>
              <button type="button" onClick={() => setModalElaboracion({ abierto: true, articuloDestinoId: '', cantidadGenerada: '', ingredientes: [], ingSelId: '', ingSelCant: '1', ingSelCoste: '', procesando: false })} className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase cursor-pointer flex items-center gap-2 transition-all shadow-lg">
                <UtensilsCrossed className="h-4 w-4" /> Elaborar Lote / Receta
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <form onSubmit={registrarCompraMercancia} className="lg:col-span-5 p-6 rounded-3xl bg-[#0d0f17] border border-cyan-500/30 space-y-4 text-xs">
                <div className="flex items-center gap-2 text-cyan-400 border-b border-white/10 pb-3">
                  <ShoppingCart className="h-5 w-5" />
                  <h3 className="font-black text-white text-sm">Registrar Compra Proveedor (Entrada Stock)</h3>
                </div>
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Seleccionar Artículo / Materia Prima *</label>
                  <select required value={compraArticuloId} onChange={(e) => { setCompraArticuloId(e.target.value); const sel = articulosMaestro.find((a) => a.id === e.target.value); if (sel) setCompraCosteUnitario(String(sel.coste_unitario || '')); }} className="w-full bg-black/60 border border-white/20 rounded-xl px-3.5 py-2.5 text-white">
                    <option value="">-- Elige artículo comprado --</option>
                    {articulosMaestro.map((a) => (<option key={a.id} value={a.id}>{a.nombre} (Stock actual: {Number(a.stock_actual).toFixed(2)} {a.unidad_medida})</option>))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-cyan-400 block mb-1">Cantidad Comprada a Sumar *</label>
                    <input type="number" step="0.001" required placeholder="Ej: 10 o 2.500" value={compraCantidad} onChange={(e) => setCompraCantidad(e.target.value)} className="w-full bg-black/60 border border-cyan-500/40 rounded-xl px-3.5 py-2.5 text-white font-mono font-bold" />
                  </div>
                  <div>
                    <label className="font-bold text-slate-300 block mb-1">Coste Compra Unitario (€)</label>
                    <input type="number" step="0.0001" placeholder="Coste por ud/kg/l" value={compraCosteUnitario} onChange={(e) => setCompraCosteUnitario(e.target.value)} className="w-full bg-black/60 border border-white/20 rounded-xl px-3.5 py-2.5 text-amber-400 font-mono font-bold" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-300 block mb-1">Proveedor</label>
                    <input type="text" placeholder="Ej: Distribuciones Córdoba" value={compraProveedor} onChange={(e) => setCompraProveedor(e.target.value)} className="w-full bg-black/60 border border-white/20 rounded-xl px-3.5 py-2 text-white" />
                  </div>
                  <div>
                    <label className="font-bold text-slate-300 block mb-1">Nº Albarán / Factura</label>
                    <input type="text" placeholder="ALB-2026-..." value={compraAlbaran} onChange={(e) => setCompraAlbaran(e.target.value)} className="w-full bg-black/60 border border-white/20 rounded-xl px-3.5 py-2 text-white font-mono" />
                  </div>
                </div>
                <button type="submit" className="w-full py-3.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black uppercase tracking-wider cursor-pointer shadow-lg">
                  Añadir Compra y Sumar al Inventario
                </button>
              </form>

              <div className="lg:col-span-7 p-6 rounded-3xl bg-[#0d0f17] border border-white/10 space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <h3 className="font-bold text-white text-sm">Estado del Stock Real por Artículo</h3>
                  <span className="text-xs text-slate-400">
                    Valoración total en almacén: <strong className="text-emerald-400 font-mono">{articulosMaestro.reduce((acc, a) => acc + Math.max(0, Number(a.stock_actual)) * Number(a.coste_unitario || 0), 0).toFixed(2)} €</strong>
                  </span>
                </div>
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-white/5 text-slate-400 uppercase sticky top-0 backdrop-blur-md">
                      <tr><th className="p-2.5">Artículo</th><th className="p-2.5 text-right">Stock Real Actual</th><th className="p-2.5 text-right">Coste Unit.</th><th className="p-2.5 text-center">Acciones</th></tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {articulosMaestro.map((a) => {
                        const bajoMinimo = a.controla_stock && Number(a.stock_actual) <= Number(a.stock_minimo);
                        return (
                          <tr key={a.id} className="hover:bg-white/[0.02]">
                            <td className="p-2.5"><div className="font-bold text-white">{a.nombre}</div><div className="text-[10px] text-slate-500">{a.categoria}</div></td>
                            <td className="p-2.5 text-right"><span className={`font-mono font-black text-sm ${bajoMinimo ? 'text-rose-400' : 'text-cyan-400'}`}>{Number(a.stock_actual).toFixed(Number.isInteger(Number(a.stock_actual)) ? 0 : 2)} {a.unidad_medida}</span></td>
                            <td className="p-2.5 text-right font-mono text-slate-400">{Number(a.coste_unitario).toFixed(3)} €</td>
                            <td className="p-2.5 text-center">
                              <button type="button" title="Ajuste rápido de stock" onClick={() => setModalAjusteStock({ articuloId: a.id, nombre: a.nombre, stockActual: Number(a.stock_actual), nuevoStock: String(Number(a.stock_actual)), unidad: a.unidad_medida, motivo: '', procesando: false })} className="px-2 py-1.5 rounded-lg bg-white/5 hover:bg-cyan-500 hover:text-slate-950 text-cyan-400 transition-colors cursor-pointer">
                                <Target className="h-4 w-4 mx-auto" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-[#0d0f17] border border-white/10 space-y-3">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-white text-sm">Últimos Movimientos de Inventario</h3>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setPageMovimientos(Math.max(0, pageMovimientos - 1))} disabled={pageMovimientos === 0} className="px-3 py-1 bg-white/10 text-white rounded-lg hover:bg-white/20 disabled:opacity-50 text-xs cursor-pointer">Anterior</button>
                  <span className="text-slate-400 text-xs py-1 font-bold">Pág {pageMovimientos + 1}</span>
                  <button type="button" onClick={() => setPageMovimientos(pageMovimientos + 1)} disabled={movimientosStock.length < ITEMS_PER_PAGE} className="px-3 py-1 bg-white/10 text-white rounded-lg hover:bg-white/20 disabled:opacity-50 text-xs cursor-pointer">Siguiente</button>
                </div>
              </div>
              <div className="overflow-x-auto max-h-60">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/5 text-slate-400 uppercase">
                    <tr><th className="p-2.5">Fecha</th><th className="p-2.5">Artículo</th><th className="p-2.5">Tipo</th><th className="p-2.5 text-right">Cantidad</th><th className="p-2.5">Observaciones / Albarán</th><th className="p-2.5">Usuario</th></tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {movimientosStock.map((m) => (
                      <tr key={m.id}>
                        <td className="p-2.5">{new Date(m.created_at).toLocaleString('es-ES')}</td>
                        <td className="p-2.5 font-bold text-white">{m.articulos_cafeteria?.nombre || '-'}</td>
                        <td className="p-2.5"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${Number(m.cantidad) >= 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>{m.tipo_movimiento}</span></td>
                        <td className="p-2.5 text-right font-mono font-bold">{Number(m.cantidad) > 0 ? `+${Number(m.cantidad).toFixed(Number.isInteger(Number(m.cantidad)) ? 0 : 2)}` : Number(m.cantidad).toFixed(Number.isInteger(Number(m.cantidad)) ? 0 : 2)} {m.articulos_cafeteria?.unidad_medida || ''}</td>
                        <td className="p-2.5 text-slate-400">{m.proveedor ? `${m.proveedor} (${m.numero_albaran_factura || ''}) ` : ''}{m.observaciones}</td>
                        <td className="p-2.5 text-slate-300">{m.usuario_nombre}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {pestanaActiva === 'datos_fiscales' && (
          <form onSubmit={guardarConfiguracionFiscal} className="max-w-2xl mx-auto p-6 rounded-3xl bg-[#0d0f17] border border-white/10 space-y-4 text-xs">
            <div className="flex items-center gap-2 text-cyan-400 border-b border-white/10 pb-3">
              <Building2 className="h-5 w-5" />
              <h3 className="font-bold text-white text-base">Textos Legales Obligatorios del Ticket (RD 1619/2012) y PIN Maestro</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="font-bold text-slate-300 block mb-1">Nombre Comercial (Cabecera Ticket)</label>
                <input type="text" required value={configFiscal.nombre_comercial} onChange={(e) => setConfigFiscal({ ...configFiscal, nombre_comercial: e.target.value })} className="w-full bg-black/60 border border-white/20 rounded-xl px-3.5 py-2.5 text-white" />
              </div>
              <div>
                <label className="font-bold text-slate-300 block mb-1">Razón Social Completa *</label>
                <input type="text" required value={configFiscal.razon_social} onChange={(e) => setConfigFiscal({ ...configFiscal, razon_social: e.target.value })} className="w-full bg-black/60 border border-white/20 rounded-xl px-3.5 py-2.5 text-white" />
              </div>
              <div>
                <label className="font-bold text-slate-300 block mb-1">NIF / CIF del Emisor *</label>
                <input type="text" required value={configFiscal.nif_cif} onChange={(e) => setConfigFiscal({ ...configFiscal, nif_cif: e.target.value })} className="w-full bg-black/60 border border-white/20 rounded-xl px-3.5 py-2.5 text-white font-mono uppercase" />
              </div>
              <div>
                <label className="font-bold text-slate-300 block mb-1">Teléfono del Local</label>
                <input type="text" value={configFiscal.telefono} onChange={(e) => setConfigFiscal({ ...configFiscal, telefono: e.target.value })} className="w-full bg-black/60 border border-white/20 rounded-xl px-3.5 py-2.5 text-white" />
              </div>
              <div className="sm:col-span-2">
                <label className="font-bold text-slate-300 block mb-1">Domicilio Fiscal Completo *</label>
                <input type="text" required value={configFiscal.direccion_fiscal} onChange={(e) => setConfigFiscal({ ...configFiscal, direccion_fiscal: e.target.value })} className="w-full bg-black/60 border border-white/20 rounded-xl px-3.5 py-2.5 text-white" />
              </div>
              <div>
                <label className="font-bold text-slate-300 block mb-1">IVA Hostelería por Defecto (%)</label>
                <input type="number" step="0.5" value={configFiscal.iva_defecto} onChange={(e) => setConfigFiscal({ ...configFiscal, iva_defecto: parseFloat(e.target.value) || 10 })} className="w-full bg-black/60 border border-white/20 rounded-xl px-3.5 py-2.5 text-white font-mono" />
              </div>
              <div>
                <label className="font-bold text-amber-400 block mb-1">PIN Maestro Autorización Descuentos / Rectificativas</label>
                <input type="text" required value={configFiscal.pin_administrador} onChange={(e) => setConfigFiscal({ ...configFiscal, pin_administrador: e.target.value })} className="w-full bg-black/60 border border-amber-500/40 rounded-xl px-3.5 py-2.5 text-amber-400 font-mono font-bold" />
              </div>
            </div>
            <button type="submit" className="w-full py-3.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black uppercase cursor-pointer">
              Guardar Configuración Fiscal
            </button>
          </form>
        )}
      </main>
    </div>
  );
}