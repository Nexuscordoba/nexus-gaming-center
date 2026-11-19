// src/LoyverseDashboard.tsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from './supabase';
import HistorialCajas from './HistorialCajas';
import GuisosAdminPanel from './GuisosAdminPanel';
import MesasReservasPanel from './MesasReservasPanel';
import {
  CornerDownRight,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Plus,
  Edit,
  Trash2,
  Clock,
  Printer,
  Download,
  Calendar,
  FileText,
  ExternalLink,
  RefreshCw,
  X,
  FileSpreadsheet
} from 'lucide-react';
import { imprimirInformeInspeccionLaboral } from './InspectionReportPrint';
import {
  obtenerConfiguracionFiscal,
  calcularHashVeriFactu,
  calcularDesgloseImpuestosLineas,
  imprimirDocumentoFiscalHTML,
  exportarTicketsAExcelCSV,
  exportarTicketsAPDF,
  calcularCosteIngredienteEscandallo,
  obtenerFactorConversion,
  redondearMoneda,
  type ConfiguracionFiscal,
  type LineaTicketFiscal,
  type UnidadMedida
} from './fiscalService';

interface BackofficeProps {
  onBack?: () => void;
  initialTab?: 'resumen' | 'tickets' | 'articulos' | 'inventario' | 'guisos' | 'mesas' | 'empleados' | 'configuracion' | 'gastos';
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

interface IngredienteElaboracionUI {
  ingrediente_id: string;
  nombre: string;
  cantidad: number;
  unidad_uso: UnidadMedida;
  unidad_base: UnidadMedida;
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

const factorConversionUnidades = (unidadUso: UnidadMedida, unidadBase: UnidadMedida): number => {
  if (unidadUso === unidadBase) return 1;
  if (unidadUso === 'g' && unidadBase === 'kg') return 0.001;
  if (unidadUso === 'kg' && unidadBase === 'g') return 1000;
  if (unidadUso === 'ml' && unidadBase === 'l') return 0.001;
  if (unidadUso === 'l' && unidadBase === 'ml') return 1000;
  if (unidadUso === 'cl' && unidadBase === 'l') return 0.01;
  if (unidadUso === 'l' && unidadBase === 'cl') return 100;
  if (unidadUso === 'cl' && unidadBase === 'ml') return 10;
  if (unidadUso === 'ml' && unidadBase === 'cl') return 0.1;
  return obtenerFactorConversion(unidadBase, unidadUso);
};

export default function LoyverseDashboard({ onBack, initialTab = 'resumen' }: BackofficeProps) {
  const [adminVerificado, setAdminVerificado] = useState<{ nombre: string; rol: string } | null>(null);
  const [pinAcceso, setPinAcceso] = useState('');
  const [errorPin, setErrorPin] = useState('');

  const [tabActiva, setTabActiva] = useState<
    'resumen' | 'tickets' | 'articulos' | 'inventario' | 'guisos' | 'mesas' | 'empleados' | 'configuracion' | 'gastos'
  >(initialTab);

  useEffect(() => {
    setTabActiva(initialTab);
  }, [initialTab]);

  const [configFiscal, setConfigFiscal] = useState<ConfiguracionFiscal>({
    razon_social: 'NEXUS CAFETERÍA Y EVENTOS S.L.',
    nombre_comercial: 'NEXUS',
    nif_cif: 'B00000000',
    direccion_fiscal: 'Córdoba, España',
    telefono: '',
    iva_defecto: 10,
    pin_administrador: '1234'
  });

  const [mensajeToast, setMensajeToast] = useState<{ texto: string; tipo: 'ok' | 'error' | 'info' } | null>(null);
  const alertaTimeoutRef = useRef<number | null>(null);

  const [ticketsHistorico, setTicketsHistorico] = useState<any[]>([]);
  const [filtroFechaInicio, setFiltroFechaInicio] = useState<string>(new Date().toISOString().split('T')[0]);
  const [filtroFechaFin, setFiltroFechaFin] = useState<string>(new Date().toISOString().split('T')[0]);
  const [busquedaTicket, setBusquedaTicket] = useState('');
  const [filtroSerieTicket, setFiltroSerieTicket] = useState<'TODAS' | 'T' | 'R' | 'F'>('TODAS');
  const [cajaHoy, setCajaHoy] = useState<any | null>(null);

  const [articulosMaestro, setArticulosMaestro] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<string[]>([
    'Cafetería',
    'Tapas',
    'Menús/Combos',
    'Bebidas',
    'Materia Prima (Interno)'
  ]);
  const [nuevaCategoriaInput, setNuevaCategoriaInput] = useState('');
  const [busquedaArticulo, setBusquedaArticulo] = useState('');

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
  const hayMasMovimientos = movimientosStock.length >= ITEMS_PER_PAGE;

  const [compraArticuloId, setCompraArticuloId] = useState('');
  const [compraCantidad, setCompraCantidad] = useState('');
  const [compraCosteUnitario, setCompraCosteUnitario] = useState('');
  const [compraProveedor, setCompraProveedor] = useState('');
  const [compraAlbaran, setCompraAlbaran] = useState('');

  // Estados para Proveedores
  const [listaProveedores, setListaProveedores] = useState<any[]>([]);
  const proveedoresSugeridos: string[] = useMemo(() => {
    return Array.from(
      new Set(
        listaProveedores
          .map((p: any) => String(typeof p === 'string' ? p : p?.nombre || '').trim())
          .filter(Boolean)
      )
    );
  }, [listaProveedores]);

  const [isImportingCSV, setIsImportingCSV] = useState(false);
  const [refrescandoStock, setRefrescandoStock] = useState<boolean>(false);
  const [procesandoLoginAdmin, setProcesandoLoginAdmin] = useState<boolean>(false);
  const [cargandoCierreCaja, setCargandoCierreCaja] = useState<boolean>(false);
  const [guardandoArticulo, setGuardandoArticulo] = useState<boolean>(false);
  const [registrandoCompra, setRegistrandoCompra] = useState<boolean>(false);
  const [guardandoEmpleado, setGuardandoEmpleado] = useState<boolean>(false);
  const [guardandoConfigFiscal, setGuardandoConfigFiscal] = useState<boolean>(false);
  const [creandoCategoria, setCreandoCategoria] = useState<boolean>(false);

  const [empleados, setEmpleados] = useState<any[]>([]);
  const [empNombre, setEmpNombre] = useState<string>('');
  const [empApellidos, setEmpApellidos] = useState<string>('');
  const [empDniNie, setEmpDniNie] = useState<string>('');
  const [empTelefono, setEmpTelefono] = useState<string>('');
  const [empEmail, setEmpEmail] = useState<string>('');
  const [empFechaAlta, setEmpFechaAlta] = useState<string>(new Date().toISOString().split('T')[0]);
  const [empPin, setEmpPin] = useState<string>('');
  const [empRol, setEmpRol] = useState<'camarero' | 'cocinero' | 'encargado' | 'admin'>('camarero');
  const [empHorarioAsignado, setEmpHorarioAsignado] = useState<string>('08:00 - 16:00');
  const [empDiasTrabajo, setEmpDiasTrabajo] = useState<string>('Lunes a Viernes');
  const [empHorasSemanales, setEmpHorasSemanales] = useState<number>(40);
  const [editandoEmpleado, setEditandoEmpleado] = useState<any | null>(null);

  const [subtabEmpleados, setSubtabEmpleados] = useState<'plantilla' | 'fichajes'>('plantilla');
  const [fichajesHistorico, setFichajesHistorico] = useState<any[]>([]);
  const [cargandoFichajes, setCargandoFichajes] = useState<boolean>(false);
  const [filtroFichajeEmpleado, setFiltroFichajeEmpleado] = useState<string>('TODOS');
  const [filtroFichajeDesde, setFiltroFichajeDesde] = useState<string>(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  );
  const [filtroFichajeHasta, setFiltroFichajeHasta] = useState<string>(
    () => new Date().toISOString().split('T')[0]
  );

  const [modalFichajeManual, setModalFichajeManual] = useState<boolean>(false);
  const [manualEmpId, setManualEmpId] = useState<string>('');
  const [manualFecha, setManualFecha] = useState<string>(new Date().toISOString().split('T')[0]);
  const [manualHora, setManualHora] = useState<string>('09:00');
  const [manualTipo, setManualTipo] = useState<'entrada' | 'inicio_descanso' | 'fin_descanso' | 'salida'>('entrada');
  const [manualMotivo, setManualMotivo] = useState<string>('');
  const [guardandoFichajeManual, setGuardandoFichajeManual] = useState<boolean>(false);

  const [modalEditarFichaje, setModalEditarFichaje] = useState<{
    fichaje: any;
    fecha: string;
    hora: string;
    tipo: string;
    motivo: string;
    procesando: boolean;
  } | null>(null);

  const [modalEliminarFichaje, setModalEliminarFichaje] = useState<{
    fichaje: any;
    motivo: string;
    procesando: boolean;
  } | null>(null);

  // Estados Módulo Ingresos y Gastos Generales
  const [movimientosGenerales, setMovimientosGenerales] = useState<any[]>([]);
  const [cargandoMovimientos, setCargandoMovimientos] = useState<boolean>(false);
  const [mesGastos, setMesGastos] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [filtroTipoMov, setFiltroTipoMov] = useState<'TODOS' | 'INGRESO' | 'GASTO'>('TODOS');
  const [filtroCategoriaMov, setFiltroCategoriaMov] = useState<string>('TODAS');
  const [filtroEstadoMov, setFiltroEstadoMov] = useState<'TODOS' | 'pagado' | 'pendiente'>('TODOS');
  const [busquedaMov, setBusquedaMov] = useState<string>('');

  const [movTipo, setMovTipo] = useState<'GASTO' | 'INGRESO'>('GASTO');
  const [movFecha, setMovFecha] = useState<string>(new Date().toISOString().split('T')[0]);
  const [movCategoria, setMovCategoria] = useState<string>('Mercancía / Alimentación');
  const [movTercero, setMovTercero] = useState<string>('');
  const [movConcepto, setMovConcepto] = useState<string>('');
  const [movNumeroFactura, setMovNumeroFactura] = useState<string>('');
  const [movModoCalculo, setMovModoCalculo] = useState<'directo' | 'inverso'>('directo');
  const [movTipoIva, setMovTipoIva] = useState<number>(21);
  const [movBase, setMovBase] = useState<string>('');
  const [movCuotaIva, setMovCuotaIva] = useState<string>('');
  const [movTotal, setMovTotal] = useState<string>('');
  const [movMetodoPago, setMovMetodoPago] = useState<string>('transferencia');
  const [movPagado, setMovPagado] = useState<boolean>(true);
  const [movArchivo, setMovArchivo] = useState<File | null>(null);
  const [guardandoMovimiento, setGuardandoMovimiento] = useState<boolean>(false);
  const [sincronizandoCierres, setSincronizandoCierres] = useState<boolean>(false);

  const [modalElaboracion, setModalElaboracion] = useState<{
    articuloDestinoId: string;
    cantidadResultante: string;
    ingredientesUsados: IngredienteElaboracionUI[];
    observaciones?: string;
    procesando: boolean;
  } | null>(null);
  const [elabIngSelId, setElabIngSelId] = useState<string>('');
  const [elabIngCant, setElabIngCant] = useState<string>('1');
  const [elabIngUnidad, setElabIngUnidad] = useState<UnidadMedida>('g');

  const [modalAjusteStock, setModalAjusteStock] = useState<{
    articulo: any;
    tipo: 'MERMA' | 'RECUENTO_FISICO';
    cantidad: string;
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
    email?: string;
    procesando: boolean;
  } | null>(null);

  const [modalCierreZ, setModalCierreZ] = useState<{
    id: number | string;
    fecha?: string;
    fondoInicial: number;
    ventasEfectivo: number;
    ventasTarjeta: number;
    entradasManuales: number;
    salidasManuales: number;
    cambiosMetodos: number;
    efectivoEsperado: number;
    efectivoRealInput: string;
    procesando: boolean;
  } | null>(null);
  const [fondoInicialInput, setFondoInicialInput] = useState<string>('50.00');
  const [procesandoApertura, setProcesandoApertura] = useState<boolean>(false);

  const notificar = (texto: string, tipo: 'ok' | 'error' | 'info' = 'ok') => {
    setMensajeToast({ texto, tipo });
    if (alertaTimeoutRef.current !== null) {
      window.clearTimeout(alertaTimeoutRef.current);
    }
    alertaTimeoutRef.current = window.setTimeout(() => setMensajeToast(null), 4500);
  };

  const obtenerDesgloseTicketSeguro = (t: any) => {
    const desgloseCalc = calcularDesgloseImpuestosLineas(
      Array.isArray(t.lineas) ? t.lineas : [],
      Number(t.descuento_general_porcentaje || 0),
      t.total_final !== undefined ? Number(t.total_final) : undefined
    );
    const base_imponible_10 = redondearMoneda(Number(t.base_imponible_10 ?? desgloseCalc.base_imponible_10));
    const iva_10 = redondearMoneda(Number(t.iva_10 ?? desgloseCalc.iva_10));
    const base_imponible_21 = redondearMoneda(Number(t.base_imponible_21 ?? desgloseCalc.base_imponible_21));
    const iva_21 = redondearMoneda(Number(t.iva_21 ?? desgloseCalc.iva_21));
    const baseImponibleTotal = redondearMoneda(
      Number(t.base_imponible ?? (base_imponible_10 + base_imponible_21))
    );
    const cuotaIvaTotal = redondearMoneda(Number(t.cuota_iva ?? (iva_10 + iva_21)));
    return {
      base_imponible_10,
      iva_10,
      base_imponible_21,
      iva_21,
      baseImponibleTotal,
      cuotaIvaTotal
    };
  };

  const ticketsFiltrados = useMemo(() => {
    return ticketsHistorico.filter((t: any) => {
      if (filtroSerieTicket !== 'TODAS' && t.serie !== filtroSerieTicket) return false;
      if (busquedaTicket.trim() !== '') {
        const q = busquedaTicket.toLowerCase();
        const matchNum = String(t.numero_completo || '').toLowerCase().includes(q);
        const matchNif = String(t.cliente_nif || '').toLowerCase().includes(q);
        const matchNom = String(t.cliente_nombre || t.cliente_nombre_razon || '').toLowerCase().includes(q);
        const matchMesa = String(t.mesa || '').toLowerCase().includes(q);
        const matchOrig = String(t.ticket_origen_numero || '').toLowerCase().includes(q);
        return matchNum || matchNif || matchNom || matchMesa || matchOrig;
      }
      return true;
    });
  }, [ticketsHistorico, filtroSerieTicket, busquedaTicket]);

  // Reorganizar documentos para que las rectificativas (R-) cuelguen siempre justo debajo de su documento padre (T- o F-)
  const ticketsJerarquicos = useMemo(() => {
    if (filtroSerieTicket === 'R') {
      return ticketsFiltrados.map((t: any) => ({ ...t, esRectificativaHija: false }));
    }

    const rectificativasPorPadre = new Map<string, any[]>();

    ticketsHistorico.forEach((t: any) => {
      if (t.serie === 'R') {
        const claveId = t.ticket_origen_id ? String(t.ticket_origen_id) : '';
        const claveNum = t.ticket_origen_numero ? String(t.ticket_origen_numero).trim().toUpperCase() : '';

        if (claveId) {
          if (!rectificativasPorPadre.has(claveId)) rectificativasPorPadre.set(claveId, []);
          rectificativasPorPadre.get(claveId)!.push(t);
        }
        if (claveNum && claveNum !== claveId) {
          if (!rectificativasPorPadre.has(claveNum)) rectificativasPorPadre.set(claveNum, []);
          rectificativasPorPadre.get(claveNum)!.push(t);
        }
      }
    });

    const resultado: any[] = [];
    const idsAgregados = new Set<string | number>();

    ticketsFiltrados.forEach((t: any) => {
      if (t.serie === 'R') {
        const tienePadreEnLista =
          (t.ticket_origen_id && ticketsFiltrados.some((p: any) => p.id === t.ticket_origen_id)) ||
          (t.ticket_origen_numero && ticketsFiltrados.some((p: any) => p.numero_completo === t.ticket_origen_numero));
        if (tienePadreEnLista) {
          return;
        }
      }

      resultado.push({ ...t, esRectificativaHija: false });
      idsAgregados.add(t.id);

      const hijosPorId = t.id ? rectificativasPorPadre.get(String(t.id)) || [] : [];
      const hijosPorNum = t.numero_completo ? rectificativasPorPadre.get(String(t.numero_completo).trim().toUpperCase()) || [] : [];
      const todosHijos = [...hijosPorId];
      hijosPorNum.forEach((hn) => {
        if (!todosHijos.some((th) => th.id === hn.id)) {
          todosHijos.push(hn);
        }
      });

      todosHijos.sort((a, b) => new Date(a.fecha_expedicion).getTime() - new Date(b.fecha_expedicion).getTime());

      todosHijos.forEach((hijo) => {
        if (!idsAgregados.has(hijo.id)) {
          resultado.push({
            ...hijo,
            esRectificativaHija: true,
            padreDocumento: t
          });
          idsAgregados.add(hijo.id);
        }
      });
    });

    ticketsFiltrados.forEach((t: any) => {
      if (t.serie === 'R' && !idsAgregados.has(t.id)) {
        resultado.push({ ...t, esRectificativaHija: false });
        idsAgregados.add(t.id);
      }
    });

    return resultado;
  }, [ticketsFiltrados, ticketsHistorico, filtroSerieTicket]);

  const metricasResumen = useMemo(() => {
    let ventasBrutas = 0;
    let baseImponible = 0;
    let cuotaIva = 0;
    let base10 = 0;
    let iva10 = 0;
    let base21 = 0;
    let iva21 = 0;
    let totalEfectivo = 0;
    let totalTarjeta = 0;

    for (const t of ticketsHistorico) {
      if (t.serie === 'F' && t.ticket_origen_id) continue;
      const total = Number(t.total_final || 0);
      const d = obtenerDesgloseTicketSeguro(t);
      ventasBrutas = redondearMoneda(ventasBrutas + total);
      baseImponible = redondearMoneda(baseImponible + d.baseImponibleTotal);
      cuotaIva = redondearMoneda(cuotaIva + d.cuotaIvaTotal);
      base10 = redondearMoneda(base10 + d.base_imponible_10);
      iva10 = redondearMoneda(iva10 + d.iva_10);
      base21 = redondearMoneda(base21 + d.base_imponible_21);
      iva21 = redondearMoneda(iva21 + d.iva_21);

      if (t.metodo_pago === 'efectivo') {
        totalEfectivo = redondearMoneda(totalEfectivo + total);
      } else if (t.metodo_pago === 'tarjeta') {
        totalTarjeta = redondearMoneda(totalTarjeta + total);
      } else {
        totalEfectivo = redondearMoneda(totalEfectivo + Number(t.importe_efectivo || 0));
        totalTarjeta = redondearMoneda(totalTarjeta + Number(t.importe_tarjeta || 0));
      }
    }

    let valorInventarioCoste = 0;
    let valorInventarioVenta = 0;
    const alertasStock: any[] = [];

    for (const art of articulosMaestro) {
      if (art.controla_stock) {
        const stock = Math.max(0, Number(art.stock_actual || 0));
        valorInventarioCoste = redondearMoneda(valorInventarioCoste + stock * Number(art.coste_unitario || 0));
        if (art.vendible_tpv) {
          valorInventarioVenta = redondearMoneda(valorInventarioVenta + stock * Number(art.precio_venta || 0));
        }
        if (Number(art.stock_actual || 0) <= Number(art.stock_minimo || 0)) {
          alertasStock.push(art);
        }
      }
    }

    return {
      ventasBrutas,
      baseImponible,
      cuotaIva,
      base10,
      iva10,
      base21,
      iva21,
      totalEfectivo,
      totalTarjeta,
      valorInventarioCoste,
      valorInventarioVenta,
      alertasStock
    };
  }, [ticketsHistorico, articulosMaestro]);

  const resumenGastos = useMemo(() => {
    let baseIngresos = 0;
    let cuotaIvaIngresos = 0;
    let totalIngresos = 0;

    let baseGastos = 0;
    let cuotaIvaGastos = 0;
    let totalGastos = 0;

    for (const mov of movimientosGenerales) {
      const b = Number(mov.base_imponible || 0);
      const iva = Number(mov.cuota_iva || 0);
      const tot = Number(mov.total || 0);

      if (mov.tipo === 'INGRESO') {
        baseIngresos = redondearMoneda(baseIngresos + b);
        cuotaIvaIngresos = redondearMoneda(cuotaIvaIngresos + iva);
        totalIngresos = redondearMoneda(totalIngresos + tot);
      } else {
        baseGastos = redondearMoneda(baseGastos + b);
        cuotaIvaGastos = redondearMoneda(cuotaIvaGastos + iva);
        totalGastos = redondearMoneda(totalGastos + tot);
      }
    }

    const beneficioOperativoNeto = redondearMoneda(baseIngresos - baseGastos);
    const previsionTrimestralIva = redondearMoneda(cuotaIvaIngresos - cuotaIvaGastos);

    return {
      baseIngresos,
      cuotaIvaIngresos,
      totalIngresos,
      baseGastos,
      cuotaIvaGastos,
      totalGastos,
      beneficioOperativoNeto,
      previsionTrimestralIva
    };
  }, [movimientosGenerales]);

  const cargarEmpleados = async () => {
    try {
      const { data, error } = await supabase.from('empleados').select('*').order('nombre', { ascending: true });
      if (error) throw error;
      if (data) setEmpleados(data);
    } catch (err) {
      console.error('Error al cargar empleados:', err);
    }
  };

  const limpiarFormEmpleado = () => {
    setEmpNombre('');
    setEmpApellidos('');
    setEmpDniNie('');
    setEmpTelefono('');
    setEmpEmail('');
    setEmpFechaAlta(new Date().toISOString().split('T')[0]);
    setEmpPin('');
    setEmpRol('camarero');
    setEmpHorarioAsignado('08:00 - 16:00');
    setEmpDiasTrabajo('Lunes a Viernes');
    setEmpHorasSemanales(40);
    setEditandoEmpleado(null);
  };

  const iniciarEdicionEmpleado = (emp: any) => {
    setEditandoEmpleado(emp);
    setEmpNombre(emp.nombre || '');
    setEmpApellidos(emp.apellidos || '');
    setEmpDniNie(emp.dni_nie || '');
    setEmpTelefono(emp.telefono || '');
    setEmpEmail(emp.email || '');
    setEmpFechaAlta(emp.fecha_alta ? emp.fecha_alta.split('T')[0] : new Date().toISOString().split('T')[0]);
    setEmpPin(emp.pin_acceso || emp.codigo_pin || '');
    setEmpRol(emp.rol || 'camarero');
    setEmpHorarioAsignado(emp.horario_asignado || '08:00 - 16:00');
    setEmpDiasTrabajo(emp.dias_trabajo || 'Lunes a Viernes');
    setEmpHorasSemanales(emp.horas_semanales || 40);
    setSubtabEmpleados('plantilla');
  };

  const guardarEmpleado = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empNombre.trim() || !empPin.trim() || guardandoEmpleado) return;

    // Validación de PIN de 4 dígitos
    const pinLimpio = empPin.trim();
    if (!/^\d{4}$/.test(pinLimpio)) {
      notificar('El PIN debe componerse exactamente de 4 dígitos numéricos.', 'error');
      return;
    }

    // Comprobar colisión de PIN con otros empleados activos
    const pinDuplicado = empleados.find(
      (emp) =>
        emp.activo &&
        (!editandoEmpleado || emp.id !== editandoEmpleado.id) &&
        (emp.pin_acceso === pinLimpio || emp.codigo_pin === pinLimpio)
    );
    if (pinDuplicado) {
      notificar(`El PIN ${pinLimpio} ya está asignado a ${pinDuplicado.nombre}. Elige otro PIN.`, 'error');
      return;
    }

    setGuardandoEmpleado(true);
    try {
      const payload: any = {
        nombre: empNombre.trim(),
        apellidos: empApellidos.trim(),
        dni_nie: empDniNie.trim().toUpperCase(),
        telefono: empTelefono.trim(),
        email: empEmail.trim().toLowerCase(),
        fecha_alta: empFechaAlta,
        pin_acceso: pinLimpio,
        rol: empRol,
        horario_asignado: empHorarioAsignado.trim(),
        dias_trabajo: empDiasTrabajo.trim(),
        horas_semanales: Number(empHorasSemanales || 40)
      };

      if (editandoEmpleado) {
        // Modo Edición
        setEmpleados((prev) =>
          prev.map((emp) => (emp.id === editandoEmpleado.id ? { ...emp, ...payload } : emp))
        );

        const { error } = await supabase
          .from('empleados')
          .update(payload)
          .eq('id', editandoEmpleado.id);

        if (error) throw error;
        notificar(`Empleado ${empNombre} actualizado con éxito.`, 'ok');
      } else {
        // Modo Alta Nueva
        payload.activo = true;
        const { data: nuevo, error } = await supabase
          .from('empleados')
          .insert([payload])
          .select()
          .maybeSingle();

        if (error) throw error;
        if (nuevo) {
          setEmpleados((prev) => [...prev, nuevo]);
        }
        notificar(`Empleado ${empNombre} registrado correctamente.`, 'ok');
      }

      limpiarFormEmpleado();
      await cargarEmpleados();
    } catch (err: any) {
      notificar('Error al guardar empleado: ' + err.message, 'error');
    } finally {
      setGuardandoEmpleado(false);
    }
  };

  const alternarEstadoEmpleado = async (emp: any) => {
    try {
      const nuevoEstado = !emp.activo;
      // Actualización optimista inmediata en interfaz para respuesta instantánea
      setEmpleados((prev) =>
        prev.map((e) => (e.id === emp.id ? { ...e, activo: nuevoEstado } : e))
      );

      // Persistir en Supabase
      const { error } = await supabase
        .from('empleados')
        .update({ activo: nuevoEstado })
        .eq('id', emp.id);

      if (error) {
        console.warn('Advertencia al persistir en empleados:', error.message);
      }

      // Guardar caché en almacenamiento local para offline / fallback
      try {
        const actualizados = empleados.map((e) =>
          e.id === emp.id ? { ...e, activo: nuevoEstado } : e
        );
        localStorage.setItem('nexus_empleados_cache', JSON.stringify(actualizados));
      } catch (_) {}

      notificar(
        `Estado de ${emp.nombre} actualizado a ${nuevoEstado ? 'Activo' : 'Inactivo'}.`,
        nuevoEstado ? 'ok' : 'info'
      );
      await cargarEmpleados();
    } catch (err: any) {
      notificar('Error al actualizar estado del empleado: ' + err.message, 'error');
    }
  };

  const cargarFichajes = async () => {
    setCargandoFichajes(true);
    try {
      let query = supabase
        .from('fichajes')
        .select('*, empleados(nombre, apellidos, dni_nie, rol)')
        .order('timestamp_fichaje', { ascending: false });

      if (filtroFichajeEmpleado !== 'TODOS') {
        query = query.eq('empleado_id', filtroFichajeEmpleado);
      }
      if (filtroFichajeDesde) {
        query = query.gte('timestamp_fichaje', `${filtroFichajeDesde}T00:00:00`);
      }
      if (filtroFichajeHasta) {
        query = query.lte('timestamp_fichaje', `${filtroFichajeHasta}T23:59:59`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setFichajesHistorico((data || []).filter((f) => !f.eliminado));
    } catch (err: any) {
      console.error('Error al cargar fichajes:', err);
    } finally {
      setCargandoFichajes(false);
    }
  };

  const guardarFichajeManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualEmpId || !manualFecha || !manualHora || !manualMotivo.trim() || guardandoFichajeManual) return;
    setGuardandoFichajeManual(true);
    try {
      const timestamp = new Date(`${manualFecha}T${manualHora}:00`).toISOString();
      const payload = {
        empleado_id: manualEmpId,
        tipo: manualTipo,
        timestamp_fichaje: timestamp,
        notas: `[MANUAL por ${adminVerificado?.nombre || 'Admin'}] ${manualMotivo.trim()}`,
        modificado_por: adminVerificado?.nombre || 'Admin',
        modificado_el: new Date().toISOString(),
        motivo_modificacion: `Alta manual por olvido: ${manualMotivo.trim()}`
      };

      const { error } = await supabase.from('fichajes').insert([payload]);
      if (error) throw error;

      notificar('Fichaje manual registrado correctamente con auditoría.', 'ok');
      setModalFichajeManual(false);
      setManualMotivo('');
      await cargarFichajes();
    } catch (err: any) {
      notificar('Error al guardar fichaje manual: ' + err.message, 'error');
    } finally {
      setGuardandoFichajeManual(false);
    }
  };

  const confirmarEditarFichaje = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalEditarFichaje || !modalEditarFichaje.motivo.trim() || modalEditarFichaje.procesando) return;
    setModalEditarFichaje({ ...modalEditarFichaje, procesando: true });
    try {
      const timestamp = new Date(`${modalEditarFichaje.fecha}T${modalEditarFichaje.hora}:00`).toISOString();
      const { error } = await supabase
        .from('fichajes')
        .update({
          tipo: modalEditarFichaje.tipo,
          timestamp_fichaje: timestamp,
          modificado_por: adminVerificado?.nombre || 'Admin',
          modificado_el: new Date().toISOString(),
          motivo_modificacion: modalEditarFichaje.motivo.trim()
        })
        .eq('id', modalEditarFichaje.fichaje.id);

      if (error) throw error;

      notificar('Fichaje modificado correctamente con traza de auditoría.', 'ok');
      setModalEditarFichaje(null);
      await cargarFichajes();
    } catch (err: any) {
      notificar('Error al editar fichaje: ' + err.message, 'error');
      setModalEditarFichaje((prev) => (prev ? { ...prev, procesando: false } : null));
    }
  };

  const confirmarEliminarFichaje = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalEliminarFichaje || !modalEliminarFichaje.motivo.trim() || modalEliminarFichaje.procesando) return;
    setModalEliminarFichaje({ ...modalEliminarFichaje, procesando: true });
    try {
      // Soft-delete con traza de auditoría
      const { error } = await supabase
        .from('fichajes')
        .update({
          eliminado: true,
          modificado_por: adminVerificado?.nombre || 'Admin',
          modificado_el: new Date().toISOString(),
          motivo_modificacion: `ELIMINADO: ${modalEliminarFichaje.motivo.trim()}`
        })
        .eq('id', modalEliminarFichaje.fichaje.id);

      if (error) {
        // Fallback si la columna eliminado no estuviese creada en la base de datos
        await supabase.from('fichajes').delete().eq('id', modalEliminarFichaje.fichaje.id);
      }

      notificar('Fichaje eliminado correctamente con registro de auditoría.', 'ok');
      setModalEliminarFichaje(null);
      await cargarFichajes();
    } catch (err: any) {
      notificar('Error al eliminar fichaje: ' + err.message, 'error');
      setModalEliminarFichaje((prev) => (prev ? { ...prev, procesando: false } : null));
    }
  };

  const exportarFichajesCsv = () => {
    if (fichajesHistorico.length === 0) {
      notificar('No hay fichajes en el periodo para exportar.', 'info');
      return;
    }

    const headers = ['Fecha', 'Hora', 'Empleado', 'DNI/NIE', 'Rol', 'Tipo Registro', 'Observaciones / Notas', 'Modificado Por', 'Motivo Modificación'];
    const filas = fichajesHistorico.map((f) => {
      const d = new Date(f.timestamp_fichaje);
      return [
        d.toLocaleDateString('es-ES'),
        d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        `"${f.empleados?.nombre || ''} ${f.empleados?.apellidos || ''}"`,
        `"${f.empleados?.dni_nie || ''}"`,
        f.empleados?.rol || '',
        f.tipo,
        `"${(f.notas || '').replace(/"/g, '""')}"`,
        `"${(f.modificado_por || '').replace(/"/g, '""')}"`,
        `"${(f.motivo_modificacion || '').replace(/"/g, '""')}"`
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...filas.map((r) => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Nexus_Registro_Jornada_${filtroFichajeDesde}_${filtroFichajeHasta}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    notificar('CSV de control horario generado con éxito.', 'ok');
  };

  const lanzarInformeInspeccionLaboral = () => {
    if (fichajesHistorico.length === 0) {
      notificar('No hay registros de fichajes en el periodo para emitir el informe laboral.', 'info');
      return;
    }

    const empSeleccionado = empleados.find((e) => e.id === filtroFichajeEmpleado);
    const nombre = empSeleccionado
      ? `${empSeleccionado.nombre} ${empSeleccionado.apellidos || ''}`
      : filtroFichajeEmpleado === 'TODOS'
      ? 'Toda la Plantilla'
      : 'Empleado';
    const dni = empSeleccionado?.dni_nie || 'Todos';

    imprimirInformeInspeccionLaboral({
      empleadoNombre: nombre,
      empleadoDni: dni,
      empleadoRol: empSeleccionado?.rol,
      fechaDesde: filtroFichajeDesde,
      fechaHasta: filtroFichajeHasta,
      registros: fichajesHistorico
    });
  };

  // Métodos Módulo Ingresos y Gastos Generales
  const cargarMovimientosGenerales = async () => {
    setCargandoMovimientos(true);
    try {
      const primerDia = `${mesGastos}-01`;
      const [anio, mes] = mesGastos.split('-').map(Number);
      const ultimoDiaMes = new Date(anio, mes, 0).getDate();
      const ultimoDia = `${mesGastos}-${String(ultimoDiaMes).padStart(2, '0')}`;

      const { data, error } = await supabase
        .from('movimientos_generales')
        .select('*')
        .gte('fecha', primerDia)
        .lte('fecha', ultimoDia)
        .order('fecha', { ascending: false });

      if (error) {
        console.warn('Tabla movimientos_generales:', error.message);
      }
      setMovimientosGenerales(data || []);
    } catch (err) {
      console.error('Error al cargar movimientos generales:', err);
    } finally {
      setCargandoMovimientos(false);
    }
  };

  const handleCalculoMonto = (
    campo: 'base' | 'total',
    valorStr: string,
    tipoIva: number,
    modo: 'directo' | 'inverso'
  ) => {
    const val = parseFloat(valorStr) || 0;
    if (modo === 'inverso' || campo === 'total') {
      setMovTotal(valorStr);
      const factor = 1 + tipoIva / 100;
      const baseCalc = redondearMoneda(val / factor);
      const cuotaCalc = redondearMoneda(val - baseCalc);
      setMovBase(baseCalc > 0 ? baseCalc.toFixed(2) : '');
      setMovCuotaIva(cuotaCalc > 0 ? cuotaCalc.toFixed(2) : '');
    } else {
      setMovBase(valorStr);
      const cuotaCalc = redondearMoneda(val * (tipoIva / 100));
      const totalCalc = redondearMoneda(val + cuotaCalc);
      setMovCuotaIva(cuotaCalc > 0 ? cuotaCalc.toFixed(2) : '');
      setMovTotal(totalCalc > 0 ? totalCalc.toFixed(2) : '');
    }
  };

  const guardarMovimientoGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!movConcepto.trim() || !movTercero.trim() || !movTotal || guardandoMovimiento) return;
    setGuardandoMovimiento(true);

    try {
      let adjuntoUrl: string | null = null;

      // Subir archivo a facturas_gastos en Supabase Storage si se ha seleccionado
      if (movArchivo) {
        try {
          const extension = movArchivo.name.split('.').pop() || 'bin';
          const nombreArchivo = `${movTipo.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${extension}`;
          const ruta = `${mesGastos}/${nombreArchivo}`;

          const { error: uploadError } = await supabase.storage
            .from('facturas_gastos')
            .upload(ruta, movArchivo, { cacheControl: '3600', upsert: true });

          if (!uploadError) {
            const { data: publicData } = supabase.storage
              .from('facturas_gastos')
              .getPublicUrl(ruta);
            adjuntoUrl = publicData?.publicUrl || ruta;
          } else {
            console.warn('No se pudo subir a facturas_gastos (se guardará sin adjunto):', uploadError);
          }
        } catch (storageErr) {
          console.warn('Excepción en storage upload:', storageErr);
        }
      }

      const totalVal = parseFloat(movTotal) || 0;
      const baseVal = parseFloat(movBase) || redondearMoneda(totalVal / (1 + movTipoIva / 100));
      const cuotaVal = parseFloat(movCuotaIva) || redondearMoneda(totalVal - baseVal);

      const payload = {
        fecha: movFecha,
        tipo: movTipo,
        categoria: movCategoria,
        tercero: movTercero.trim(),
        concepto: movConcepto.trim(),
        numero_factura: movNumeroFactura.trim() || null,
        base_imponible: baseVal,
        tipo_iva: movTipoIva,
        cuota_iva: cuotaVal,
        total: totalVal,
        metodo_pago: movMetodoPago,
        pagado: movPagado,
        adjunto_url: adjuntoUrl
      };

      const { error } = await supabase.from('movimientos_generales').insert([payload]);
      if (error) throw error;

      notificar(`Registro de ${movTipo === 'INGRESO' ? 'ingreso' : 'gasto'} guardado con éxito.`, 'ok');
      setMovConcepto('');
      setMovTercero('');
      setMovNumeroFactura('');
      setMovBase('');
      setMovCuotaIva('');
      setMovTotal('');
      setMovArchivo(null);
      await cargarMovimientosGenerales();
    } catch (err: any) {
      notificar('Error al guardar movimiento: ' + err.message, 'error');
    } finally {
      setGuardandoMovimiento(false);
    }
  };

  const sincronizarCierresCaja = async () => {
    if (sincronizandoCierres) return;
    setSincronizandoCierres(true);
    try {
      const primerDia = `${mesGastos}-01`;
      const [anio, mes] = mesGastos.split('-').map(Number);
      const ultimoDiaMes = new Date(anio, mes, 0).getDate();
      const ultimoDia = `${mesGastos}-${String(ultimoDiaMes).padStart(2, '0')}`;

      // 1. Obtener cierres_caja del mes
      const { data: cierres, error: errCierres } = await supabase
        .from('cierres_caja')
        .select('*')
        .gte('fecha_cierre', `${primerDia}T00:00:00`)
        .lte('fecha_cierre', `${ultimoDia}T23:59:59`);

      if (errCierres) throw errCierres;
      if (!cierres || cierres.length === 0) {
        notificar(`No hay cierres de caja (Z) registrados en el periodo ${mesGastos}.`, 'info');
        return;
      }

      // 2. Comprobar cuáles ya existen en movimientos_generales para no duplicar
      const { data: existentes } = await supabase
        .from('movimientos_generales')
        .select('numero_factura')
        .eq('tipo', 'INGRESO')
        .eq('categoria', 'Ventas TPV');

      const setFacturasExistentes = new Set((existentes || []).map((e) => e.numero_factura));

      const nuevosParaInsertar: any[] = [];
      for (const c of cierres) {
        const numFacturaZ = `Z-${String(c.id).slice(0, 8).toUpperCase()}`;
        if (!setFacturasExistentes.has(numFacturaZ)) {
          const totalVentas = redondearMoneda(
            Number(c.ventas_efectivo_sistema || 0) +
              Number(c.ventas_tarjeta_sistema || 0) -
              Number(c.devoluciones_efectivo || 0)
          );
          if (totalVentas > 0) {
            const baseImponible = redondearMoneda(totalVentas / 1.1);
            const cuotaIva = redondearMoneda(totalVentas - baseImponible);
            const fechaCierreStr = c.fecha_cierre
              ? c.fecha_cierre.split('T')[0]
              : new Date().toISOString().split('T')[0];

            nuevosParaInsertar.push({
              fecha: fechaCierreStr,
              tipo: 'INGRESO',
              categoria: 'Ventas TPV',
              tercero: 'Clientes Cafetería (Cierre Caja TPV)',
              concepto: `Cierre Diario Z (${fechaCierreStr}) - Turno ${c.usuario_nombre || 'TPV'}`,
              numero_factura: numFacturaZ,
              base_imponible: baseImponible,
              tipo_iva: 10,
              cuota_iva: cuotaIva,
              total: totalVentas,
              metodo_pago: 'mixto',
              pagado: true,
              adjunto_url: null
            });
          }
        }
      }

      if (nuevosParaInsertar.length === 0) {
        notificar('Todos los cierres de caja de este periodo ya están sincronizados.', 'info');
      } else {
        const { error: insertErr } = await supabase.from('movimientos_generales').insert(nuevosParaInsertar);
        if (insertErr) throw insertErr;
        notificar(`¡Sincronizados ${nuevosParaInsertar.length} cierres de caja como ingresos sin duplicados!`, 'ok');
        await cargarMovimientosGenerales();
      }
    } catch (err: any) {
      notificar('Error al sincronizar cierres de caja: ' + err.message, 'error');
    } finally {
      setSincronizandoCierres(false);
    }
  };

  const alternarEstadoPagoMovimiento = async (mov: any) => {
    try {
      const nuevoPagado = !mov.pagado;
      setMovimientosGenerales((prev) =>
        prev.map((m) => (m.id === mov.id ? { ...m, pagado: nuevoPagado } : m))
      );
      await supabase.from('movimientos_generales').update({ pagado: nuevoPagado }).eq('id', mov.id);
      notificar(`Movimiento marcado como ${nuevoPagado ? 'Pagado' : 'Pendiente'}.`, 'ok');
    } catch (err: any) {
      notificar('Error al actualizar estado: ' + err.message, 'error');
    }
  };

  const eliminarMovimientoGeneral = async (movId: string) => {
    if (!window.confirm('¿Seguro que deseas eliminar este apunte contable?')) return;
    try {
      setMovimientosGenerales((prev) => prev.filter((m) => m.id !== movId));
      await supabase.from('movimientos_generales').delete().eq('id', movId);
      notificar('Apunte eliminado correctamente.', 'ok');
    } catch (err: any) {
      notificar('Error al eliminar apunte: ' + err.message, 'error');
    }
  };

  const exportarCsvGestoria = () => {
    if (movimientosGenerales.length === 0) {
      notificar('No hay movimientos en este periodo para exportar.', 'info');
      return;
    }

    const headers = [
      'Fecha',
      'Tipo Operación',
      'Nº Factura / Ticket',
      'Tercero / Razón Social',
      'Concepto',
      'Categoría Contable',
      'Base Imponible (€)',
      '% IVA',
      'Cuota IVA (€)',
      'Total Documento (€)',
      'Método de Pago',
      'Estado de Pago'
    ];

    const filas = movimientosGenerales.map((m) => [
      m.fecha,
      m.tipo,
      `"${(m.numero_factura || '').replace(/"/g, '""')}"`,
      `"${(m.tercero || '').replace(/"/g, '""')}"`,
      `"${(m.concepto || '').replace(/"/g, '""')}"`,
      `"${(m.categoria || '').replace(/"/g, '""')}"`,
      Number(m.base_imponible || 0).toFixed(2),
      Number(m.tipo_iva || 0).toFixed(0) + '%',
      Number(m.cuota_iva || 0).toFixed(2),
      Number(m.total || 0).toFixed(2),
      m.metodo_pago || '',
      m.pagado ? 'PAGADO' : 'PENDIENTE'
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...filas.map((f) => f.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Nexus_Libro_Ingresos_Gastos_${mesGastos}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    notificar('CSV para gestoría generado y descargado correctamente.', 'ok');
  };

  const cargarProveedores = async () => {
    try {
      const { data } = await supabase.from('proveedores').select('*').order('nombre', { ascending: true });
      if (data && data.length > 0) {
        setListaProveedores(data);
      } else {
        const { data: movs } = await supabase.from('movimientos_stock').select('proveedor').not('proveedor', 'is', null);
        if (movs) {
          const unicos = Array.from(new Set(movs.map((m) => m.proveedor))).filter(Boolean).map((p) => ({ id: p, nombre: p }));
          setListaProveedores(unicos);
        }
      }
    } catch (err) {
      console.error('Error al cargar proveedores:', err);
    }
  };

  useEffect(() => {
    if (adminVerificado && tabActiva === 'empleados') {
      cargarEmpleados();
      cargarFichajes();
    }
    if (adminVerificado && tabActiva === 'inventario') cargarProveedores();
    if (adminVerificado && tabActiva === 'gastos') cargarMovimientosGenerales();
  }, [tabActiva, adminVerificado, mesGastos, filtroFichajeEmpleado, filtroFichajeDesde, filtroFichajeHasta]);

  useEffect(() => {
    if (adminVerificado) cargarMovimientosInventario(pageMovimientos);
  }, [pageMovimientos, adminVerificado]);

  useEffect(() => {
    const verificarSesionExistente = async () => {
      const cfg = await obtenerConfiguracionFiscal();
      setConfigFiscal(cfg);

      const sesionCamarero = sessionStorage.getItem('nexus_camarero_sesion');
      if (sesionCamarero) {
        try {
          const parsed = JSON.parse(sesionCamarero);
          if (parsed.rol === 'admin' || parsed.rol === 'encargado') {
            setAdminVerificado({ nombre: parsed.nombre, rol: parsed.rol });
          }
        } catch (err) {
          console.error('Error al parsear sesión admin:', err);
        }
      }
    };
    verificarSesionExistente();

    return () => {
      if (alertaTimeoutRef.current !== null) {
        window.clearTimeout(alertaTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!adminVerificado) return;
    cargarTodoBackoffice();
  }, [adminVerificado, filtroFechaInicio, filtroFechaFin]);

  useEffect(() => {
    if (!adminVerificado) return;

    const channel = supabase
      .channel('realtime-backoffice-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'facturas_tickets' }, () => {
        cargarTicketsYVentas();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'caja_diaria' }, () => {
        cargarTicketsYVentas();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'articulos_cafeteria' }, () => {
        cargarArticulosYCategorias();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'productos_carta' }, () => {
        cargarArticulosYCategorias();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'movimientos_stock' }, () => {
        cargarMovimientosInventario(pageMovimientos);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [adminVerificado, filtroFechaInicio, filtroFechaFin, pageMovimientos]);

  const verificarPinAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (procesandoLoginAdmin) return;
    setErrorPin('');
    setProcesandoLoginAdmin(true);

    try {
      const { data, error } = await supabase
        .from('empleados')
        .select('id, nombre, apellidos, rol')
        .eq('pin_acceso', pinAcceso.trim())
        .in('rol', ['admin', 'encargado'])
        .eq('activo', true)
        .maybeSingle();

      if (error) {
        console.error('Error verificando PIN admin en empleados:', error);
      }

      if (data) {
        const userObj = {
          id: data.id,
          nombre: `${data.nombre} ${data.apellidos || ''}`.trim(),
          rol: data.rol || 'admin'
        };
        setAdminVerificado(userObj);
        sessionStorage.setItem('nexus_camarero_sesion', JSON.stringify(userObj));
        return;
      }

      if (pinAcceso.trim() === configFiscal.pin_administrador) {
        setAdminVerificado({ nombre: 'Administrador Fiscal', rol: 'admin' });
        return;
      }

      setErrorPin('Acceso denegado: El PIN no corresponde a un usuario con rol Administrador o Encargado.');
    } catch (err) {
      console.error('Excepción en verificarPinAdmin:', err);
      setErrorPin('Error al verificar credenciales de Administrador.');
    } finally {
      setProcesandoLoginAdmin(false);
    }
  };

  const cargarTodoBackoffice = async () => {
    try {
      await Promise.all([
        cargarTicketsYVentas(),
        cargarArticulosYCategorias(),
        cargarMovimientosInventario(0),
        cargarProveedores()
      ]);
    } catch (err) {
      console.error('Error en cargarTodoBackoffice:', err);
    }
  };

  const cargarTicketsYVentas = async () => {
    try {
      const inicioISO = `${filtroFechaInicio}T00:00:00.000Z`;
      const finISO = `${filtroFechaFin}T23:59:59.999Z`;

      const { data: tData, error: errTickets } = await supabase
        .from('facturas_tickets')
        .select('*')
        .gte('fecha_expedicion', inicioISO)
        .lte('fecha_expedicion', finISO)
        .order('fecha_expedicion', { ascending: false });

      if (errTickets) {
        console.error('Error al cargar facturas_tickets en Backoffice:', errTickets);
      }

      if (tData) {
        setTicketsHistorico(tData);
      }

      const fechaHoy = new Date().toISOString().split('T')[0];
      const { data: cajaAbiertaActiva } = await supabase
        .from('caja_diaria')
        .select('*')
        .eq('estado', 'abierta')
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cajaAbiertaActiva) {
        setCajaHoy(cajaAbiertaActiva);
      } else {
        const { data: ultimaCerradaHoy } = await supabase
          .from('caja_diaria')
          .select('*')
          .eq('fecha', fechaHoy)
          .order('id', { ascending: false })
          .limit(1)
          .maybeSingle();
        setCajaHoy(ultimaCerradaHoy || null);
      }
    } catch (err) {
      console.error('Excepción en cargarTicketsYVentas:', err);
    }
  };

  const abrirCajaDiaria = async () => {
    if (procesandoApertura) return;
    const remanenteNum = parseFloat(fondoInicialInput);
    if (isNaN(remanenteNum) || remanenteNum < 0) {
      notificar('Por favor, introduce un fondo de caja inicial válido.', 'error');
      return;
    }

    setProcesandoApertura(true);
    try {
      const fechaActual = new Date().toISOString().split('T')[0];
      const remanente_apertura = redondearMoneda(remanenteNum);

      const { data: nuevaCaja, error } = await supabase
        .from('caja_diaria')
        .insert([
          {
            fecha: fechaActual,
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

      setCajaHoy(nuevaCaja);
      notificar(`¡Caja / Turno abierto con éxito! Fondo inicial confirmado: ${remanente_apertura.toFixed(2)} €.`, 'ok');
      await cargarTicketsYVentas();
    } catch (err: any) {
      notificar('Error al abrir la caja: ' + err.message, 'error');
    } finally {
      setProcesandoApertura(false);
    }
  };

  const iniciarArqueoYCierreCaja = async () => {
    if (cargandoCierreCaja) return;
    setCargandoCierreCaja(true);
    try {
      const { data, error } = await supabase
        .from('caja_diaria')
        .select('*')
        .eq('estado', 'abierta')
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        notificar('No hay ninguna caja con estado abierta actualmente en el sistema.', 'info');
        return;
      }

      const fondoInicial = redondearMoneda(Number(data.remanente_apertura || 0));
      const ventasEfectivo = redondearMoneda(Number(data.total_efectivo || 0));
      const ventasTarjeta = redondearMoneda(Number(data.total_tarjeta || 0));
      const entradasManuales = redondearMoneda(Number(data.entradas_manuales || 0));
      const salidasManuales = redondearMoneda(Number(data.salidas_manuales || 0));
      const cambiosMetodos = redondearMoneda(Number(data.cambios_metodos || 0));
      const efectivoEsperado = redondearMoneda(
        fondoInicial + ventasEfectivo + entradasManuales + cambiosMetodos - salidasManuales
      );

      setModalCierreZ({
        id: data.id,
        fecha: data.fecha,
        fondoInicial,
        ventasEfectivo,
        ventasTarjeta,
        entradasManuales,
        salidasManuales,
        cambiosMetodos,
        efectivoEsperado,
        efectivoRealInput: '',
        procesando: false
      });
    } catch (err: any) {
      notificar('Error al consultar la caja abierta: ' + err.message, 'error');
    } finally {
      setCargandoCierreCaja(false);
    }
  };

  const confirmarCerrarCajaZ = async () => {
    if (!modalCierreZ || modalCierreZ.procesando) return;

    const efectivo_real = redondearMoneda(parseFloat(modalCierreZ.efectivoRealInput));
    if (isNaN(efectivo_real) || efectivo_real < 0) {
      notificar('Por favor, introduce el importe físico contado en el cajón.', 'error');
      return;
    }

    setModalCierreZ({ ...modalCierreZ, procesando: true });

    try {
      const { id, fondoInicial, ventasEfectivo, ventasTarjeta, efectivoEsperado } = modalCierreZ;
      const descuadre = redondearMoneda(efectivo_real - efectivoEsperado);
      const remanente_cierre = 50.00;
      const efectivo_retirado = redondearMoneda(efectivo_real - remanente_cierre);

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

      try {
        await supabase.from('cierres_caja').insert([
          {
            usuario_nombre: adminVerificado?.nombre || 'Administrador',
            fondo_inicial: fondoInicial,
            ventas_efectivo_sistema: ventasEfectivo,
            ventas_tarjeta_sistema: ventasTarjeta,
            efectivo_esperado_caja: efectivoEsperado,
            efectivo_contado_trabajador: efectivo_real,
            tarjeta_contada_trabajador: ventasTarjeta,
            descuadre_efectivo: descuadre,
            descuadre_tarjeta: 0,
            observaciones: `Cierre de Caja desde Backoffice (${modalCierreZ.fecha || new Date().toISOString().split('T')[0]})`
          }
        ]);
      } catch (histErr) {
        console.warn('No se pudo registrar en cierres_caja:', histErr);
      }

      setCajaHoy((prev: any) => ({
        ...(prev || {}),
        id,
        fecha: modalCierreZ.fecha || prev?.fecha || new Date().toISOString().split('T')[0],
        remanente_apertura: fondoInicial,
        total_efectivo: ventasEfectivo,
        total_tarjeta: ventasTarjeta,
        efectivo_real,
        descuadre,
        remanente_cierre,
        efectivo_retirado,
        estado: 'cerrada'
      }));

      setModalCierreZ(null);

      const cuadrada = Math.abs(descuadre) < 0.01;
      const textoResumen = cuadrada
        ? `¡Cierre de caja completado! La caja ha cuadrado a cero (0.00 €). Efectivo retirado: ${efectivo_retirado.toFixed(2)} € (Fondo dejado: 50.00 €).`
        : `Cierre de caja completado con descuadre de ${descuadre > 0 ? '+' : ''}${descuadre.toFixed(2)} €. Contado: ${efectivo_real.toFixed(2)} € | Retirado: ${efectivo_retirado.toFixed(2)} €.`;

      notificar(textoResumen, cuadrada ? 'ok' : 'info');
      await cargarTicketsYVentas();
    } catch (err: any) {
      notificar('Error al realizar el cierre de caja: ' + err.message, 'error');
      setModalCierreZ((prev) => (prev ? { ...prev, procesando: false } : null));
    }
  };

  const cargarArticulosYCategorias = async () => {
    try {
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
    } catch (err) {
      console.error('Error en cargarArticulosYCategorias:', err);
    }
  };

  const refrescarStockInventario = async () => {
    if (refrescandoStock) return;
    setRefrescandoStock(true);
    try {
      await Promise.all([
        cargarArticulosYCategorias(),
        cargarMovimientosInventario(pageMovimientos)
      ]);
      notificar('Stock e inventario actualizados correctamente desde Supabase.', 'ok');
    } catch (err: any) {
      notificar('Error al refrescar el stock: ' + (err?.message || 'Error desconocido'), 'error');
    } finally {
      setRefrescandoStock(false);
    }
  };

  const cargarMovimientosInventario = async (page: number = 0) => {
    try {
      setPageMovimientos(page);
      const from = page * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      const { data, error } = await supabase
        .from('movimientos_stock')
        .select('*, articulos_cafeteria(nombre, unidad_medida)')
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) {
        console.error('Error al cargar movimientos_stock:', error);
        return;
      }

      if (data) {
        setMovimientosStock(data);
      }
    } catch (err) {
      console.error('Excepción en cargarMovimientosInventario:', err);
    }
  };

  const confirmarFacturaRectificativa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalRectificativa || !adminVerificado || modalRectificativa.procesando) return;

    if (!modalRectificativa.motivo.trim()) {
      notificar('Debes indicar obligatoriamente el motivo de la rectificación/devolución.', 'info');
      return;
    }

    setModalRectificativa({ ...modalRectificativa, procesando: true });

    try {
      const orig = modalRectificativa.factura;
      const cfg = configFiscal;
      const importeNegativo = redondearMoneda(-Math.abs(Number(orig.total_final)));
      const brutoNegativo = redondearMoneda(-Math.abs(Number(orig.subtotal_bruto)));

      const lineasNegativas: LineaTicketFiscal[] = (orig.lineas || []).map((l: any) => ({
        ...l,
        cantidad: -Math.abs(Number(l.cantidad)),
        subtotal_linea: redondearMoneda(-Math.abs(Number(l.subtotal_linea))),
        porcentaje_iva: Number(l.porcentaje_iva ?? l.tipo_iva ?? orig.tipo_iva_aplicado ?? 10) === 21 ? 21 : 10,
        tipo_iva: Number(l.porcentaje_iva ?? l.tipo_iva ?? orig.tipo_iva_aplicado ?? 10) === 21 ? 21 : 10
      }));

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
        console.error('Error al obtener hash_anterior en Rectificativa Backoffice:', errPrevHash);
      }

      const { data: docRect, error: rpcError } = await supabase.rpc('emitir_documento_fiscal', {
        p_serie: 'R',
        p_tipo_documento: 'RECTIFICATIVA',
        p_mesa: orig.mesa,
        p_vendedor: adminVerificado.nombre,
        p_metodo_pago: orig.metodo_pago,
        p_importe_efectivo: orig.metodo_pago === 'efectivo' ? importeNegativo : 0,
        p_importe_tarjeta: orig.metodo_pago !== 'efectivo' ? importeNegativo : 0,
        p_subtotal_bruto: brutoNegativo,
        p_descuento_general_porc: orig.descuento_general_porcentaje || 0,
        p_descuento_total_imp: redondearMoneda(-Math.abs(Number(orig.descuento_total_importe || 0))),
        p_autorizado_por: adminVerificado.nombre,
        p_tipo_iva: orig.tipo_iva_aplicado || cfg.iva_defecto || 10,
        p_total_final: importeNegativo,
        p_lineas: lineasNegativas,
        p_ticket_origen_id: orig.id,
        p_ticket_origen_numero: orig.numero_completo,
        p_motivo_rectificacion: modalRectificativa.motivo.trim(),
        p_cliente_nombre: orig.cliente_nombre_razon || orig.cliente_nombre || null,
        p_cliente_nif: orig.cliente_nif || null,
        p_cliente_direccion: orig.cliente_direccion || null
      });

      if (rpcError) throw rpcError;

      const desgloseNegativo = calcularDesgloseImpuestosLineas(
        lineasNegativas,
        Number(orig.descuento_general_porcentaje || 0),
        importeNegativo
      );
      const fechaRect = String(docRect?.fecha_expedicion || new Date().toISOString());
      const hash_actual = await calcularHashVeriFactu(
        String(docRect.numero_completo),
        fechaRect,
        importeNegativo,
        hash_anterior
      );

      await supabase
        .from('facturas_tickets')
        .update({
          tipo_factura: 'R4',
          base_imponible_10: desgloseNegativo.base_imponible_10,
          iva_10: desgloseNegativo.iva_10,
          base_imponible_21: desgloseNegativo.base_imponible_21,
          iva_21: desgloseNegativo.iva_21,
          base_imponible: desgloseNegativo.baseImponibleTotal,
          cuota_iva: desgloseNegativo.cuotaIvaTotal,
          hash_anterior,
          hash_actual,
          ticket_origen_id: orig.id,
          ticket_origen_numero: orig.numero_completo,
          cliente_nombre_razon: orig.cliente_nombre_razon || orig.cliente_nombre || null,
          cliente_nif: orig.cliente_nif || null,
          cliente_direccion: orig.cliente_direccion || null
        })
        .eq('id', docRect.id);

      // Marcar documento original como rectificado
      await supabase
        .from('facturas_tickets')
        .update({
          estado_fiscal: 'RECTIFICADO'
        })
        .eq('id', orig.id);

      // Devolver stock al anular / rectificar factura
      for (const linea of (orig.lineas || [])) {
        if (linea.articulo_id || linea.producto_id) {
          const artId = linea.articulo_id || linea.producto_id;
          const cantVendida = Math.abs(Number(linea.cantidad || 0));
          const artRef = articulosMaestro.find(a => a.id === artId);
          if (artRef && artRef.controla_stock) {
            const nuevoStock = Number(artRef.stock_actual || 0) + cantVendida;
            await supabase.from('articulos_cafeteria').update({ stock_actual: nuevoStock }).eq('id', artId);
            await supabase.from('productos_carta').update({ stock_actual: nuevoStock }).eq('articulo_inventario_id', artId);
          }
        }
      }

      const fechaHoy = new Date().toISOString().split('T')[0];
      if (cajaHoy && cajaHoy.estado === 'abierta' && String(orig.fecha_expedicion || '').startsWith(fechaHoy)) {
        const nuevoEfectivo = redondearMoneda(
          Number(cajaHoy.total_efectivo) + (orig.metodo_pago === 'efectivo' ? importeNegativo : 0)
        );
        const nuevaTarjeta = redondearMoneda(
          Number(cajaHoy.total_tarjeta) + (orig.metodo_pago === 'tarjeta' ? importeNegativo : 0)
        );

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
        .maybeSingle();

      setModalRectificativa(null);
      if (rectCompleta) {
        imprimirDocumentoFiscalHTML({
          ...rectCompleta,
          cliente_nombre_razon: orig.cliente_nombre_razon || orig.cliente_nombre || rectCompleta.cliente_nombre_razon,
          cliente_nif: orig.cliente_nif || rectCompleta.cliente_nif,
          cliente_direccion: orig.cliente_direccion || rectCompleta.cliente_direccion
        }, cfg);
      }

      notificar(`Factura Rectificativa ${docRect.numero_completo} emitida e impresa.`, 'ok');
      await Promise.all([cargarTicketsYVentas(), cargarArticulosYCategorias()]);
    } catch (err: any) {
      notificar('Error al emitir factura rectificativa: ' + err.message, 'error');
      setModalRectificativa((prev) => (prev ? { ...prev, procesando: false } : null));
    }
  };

  const confirmarFacturaNominativa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalFacturaNominativa || !adminVerificado || modalFacturaNominativa.procesando) return;

    if (!modalFacturaNominativa.razonSocial.trim() || !modalFacturaNominativa.nifCif.trim()) {
      notificar('Nombre/Razón Social y NIF/CIF del cliente son obligatorios por ley.', 'info');
      return;
    }

    setModalFacturaNominativa({ ...modalFacturaNominativa, procesando: true });

    try {
      const orig = modalFacturaNominativa.factura;
      const cfg = configFiscal;

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
        console.error('Error al obtener hash_anterior en Nominativa Backoffice:', errPrevHash);
      }

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

      const desgloseNom = calcularDesgloseImpuestosLineas(
        (orig.lineas || []) as LineaTicketFiscal[],
        Number(orig.descuento_general_porcentaje || 0),
        Number(orig.total_final || 0)
      );
      const fechaNom = String(docNom?.fecha_expedicion || new Date().toISOString());
      const hash_actual = await calcularHashVeriFactu(
        String(docNom.numero_completo),
        fechaNom,
        Number(orig.total_final || 0),
        hash_anterior
      );

      await supabase
        .from('facturas_tickets')
        .update({
          tipo_factura: 'F1',
          base_imponible_10: orig.base_imponible_10 ?? desgloseNom.base_imponible_10,
          iva_10: orig.iva_10 ?? desgloseNom.iva_10,
          base_imponible_21: orig.base_imponible_21 ?? desgloseNom.base_imponible_21,
          iva_21: orig.iva_21 ?? desgloseNom.iva_21,
          base_imponible: orig.base_imponible ?? desgloseNom.baseImponibleTotal,
          cuota_iva: orig.cuota_iva ?? desgloseNom.cuotaIvaTotal,
          hash_anterior,
          hash_actual,
          ticket_origen_id: orig.id,
          ticket_origen_numero: orig.numero_completo,
          cliente_email: modalFacturaNominativa.email?.trim() || null
        })
        .eq('id', docNom.id);

      // Enlace bidireccional: vincular la factura en el ticket origen
      await supabase
        .from('facturas_tickets')
        .update({
          factura_asociada_id: docNom.id,
          factura_asociada_numero: docNom.numero_completo,
          cliente_email: modalFacturaNominativa.email?.trim() || null
        })
        .eq('id', orig.id);

      const { data: nomCompleta } = await supabase
        .from('facturas_tickets')
        .select('*')
        .eq('id', docNom.id)
        .maybeSingle();

      setModalFacturaNominativa(null);
      if (nomCompleta) {
        imprimirDocumentoFiscalHTML(nomCompleta, cfg);
      }

      notificar(`Factura Nominativa ${docNom.numero_completo} generada e impresa correctamente.`, 'ok');
      await cargarTicketsYVentas();
    } catch (err: any) {
      notificar('Error al generar factura nominativa: ' + err.message, 'error');
      setModalFacturaNominativa((prev) => (prev ? { ...prev, procesando: false } : null));
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
    if (campo === 'destino') {
      nuevos[indexPaso].opciones[indexOpcion] = {
        ...nuevos[indexPaso].opciones[indexOpcion],
        destino: valor === 'cocina' ? 'cocina' : 'barra'
      };
    } else {
      nuevos[indexPaso].opciones[indexOpcion] = {
        ...nuevos[indexPaso].opciones[indexOpcion],
        nombre: valor
      };
    }
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
    setArtTipoIva(String(art.porcentaje_iva ?? art.tipo_iva ?? 10));
    setArtUnidadMedida((art.unidad_medida || 'ud') as UnidadMedida);
    setArtControlaStock(Boolean(art.controla_stock));
    setArtStockInicial(String(art.stock_actual || 0));
    setArtStockMinimo(String(art.stock_minimo || 0));
    setArtVendibleTpv(Boolean(art.vendible_tpv));
    setArtEsCombo(Boolean(art.es_combo));
    setPasosCombo(art.opciones_combo || []);
    setArtEsCompuesto(Boolean(art.es_compuesto));

    if (art.es_compuesto) {
      try {
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
      } catch (err) {
        console.error('Error al cargar escandallo del artículo:', err);
      }
    } else {
      setLineasEscandallo([]);
    }
  };

  const manejarSubidaImagen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
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
    } catch (err) {
      console.error('Error al subir imagen:', err);
    }
  };

  const guardarYSincronizarArticulo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!artNombre.trim() || guardandoArticulo) return;

    const precioNum = redondearMoneda(parseFloat(artPrecioVenta) || 0);
    const costeNum = parseFloat(artCosteUnitario) || 0;
    const ivaNum = Number(parseFloat(artTipoIva) || 10) === 21 ? 21 : 10;
    const stockNum = parseFloat(artStockInicial) || 0;
    const minNum = parseFloat(artStockMinimo) || 0;

    setGuardandoArticulo(true);
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
        porcentaje_iva: ivaNum,
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
          porcentaje_iva: ivaNum,
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
      await cargarArticulosYCategorias();
    } catch (err: any) {
      notificar('Error guardando artículo: ' + err.message, 'error');
    } finally {
      setGuardandoArticulo(false);
    }
  };

  const crearNuevaCategoria = async () => {
    if (!nuevaCategoriaInput.trim() || creandoCategoria) return;
    const nombreLimpio = nuevaCategoriaInput.trim();
    setCreandoCategoria(true);
    try {
      const { error } = await supabase.from('categorias_cafeteria').insert([{ nombre: nombreLimpio, orden: categorias.length + 1 }]);
      if (error) throw error;
      setCategorias((prev) => [...prev, nombreLimpio]);
      setArtCategoria(nombreLimpio);
      setNuevaCategoriaInput('');
      notificar(`Categoría visual "${nombreLimpio}" añadida.`);
    } catch (err: any) {
      notificar('Error al crear categoría: ' + (err?.message || 'Error desconocido'), 'error');
    } finally {
      setCreandoCategoria(false);
    }
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
    const cabeceras = "Nombre;Categoria;Destino(barra/cocina);PrecioVenta;CosteUnitario;porcentaje_iva;UnidadMedida;ControlaStock(SI/NO);StockInicial;StockMinimo;VisibleTPV(SI/NO)\n";
    const ejemplo1 = "Café Solo;Cafetería;barra;1.20;0.15;10;ud;SI;100;10;SI\n";
    const ejemplo2 = "Sobre Pokémon TCG;Merchandising;barra;4.50;2.80;21;ud;SI;50;5;SI\n";

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

        const cabecerasRaw = (lineas[0] || '').split(';').map(c => c.trim().toLowerCase());
        const idxIvaCabecera = cabecerasRaw.findIndex(c => c === 'porcentaje_iva' || c === 'iva' || c === 'tipo_iva' || c === 'tipoiva');
        const tieneColumnaIvaEnCabecera = idxIvaCabecera !== -1;

        for (let i = 1; i < lineas.length; i++) {
          const columnas = lineas[i].split(';');
          if (columnas.length < 10) {
            ignorados++;
            continue;
          }

          let nombre = '';
          let categoria = '';
          let destino = '';
          let precio = '';
          let coste = '';
          let ivaRaw = '';
          let unidad = '';
          let controlaStock = '';
          let stockIni = '';
          let stockMin = '';
          let visible = '';

          if (tieneColumnaIvaEnCabecera || columnas.length >= 11) {
            [
              nombre, categoria, destino, precio, coste, ivaRaw,
              unidad, controlaStock, stockIni, stockMin, visible
            ] = columnas;
            if (tieneColumnaIvaEnCabecera && idxIvaCabecera < columnas.length) {
              ivaRaw = columnas[idxIvaCabecera];
            }
          } else {
            [
              nombre, categoria, destino, precio, coste,
              unidad, controlaStock, stockIni, stockMin, visible
            ] = columnas;
            ivaRaw = '10';
          }

          const ivaLimpiado = parseFloat(String(ivaRaw ?? '').replace('%', '').trim());
          const porcentajeIvaFinal = !isNaN(ivaLimpiado) && ivaLimpiado === 21 ? 21 : 10;

          if (!nombre) {
            ignorados++;
            continue;
          }

          const payloadMaestro = {
            nombre: nombre.trim(),
            categoria: categoria.trim() || 'Cafetería',
            destino: destino.trim().toLowerCase() === 'cocina' ? 'cocina' : 'barra',
            precio_venta: redondearMoneda(parseFloat(precio) || 0),
            coste_unitario: parseFloat(coste) || 0,
            porcentaje_iva: porcentajeIvaFinal,
            tipo_iva: porcentajeIvaFinal,
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
                porcentaje_iva: payloadMaestro.porcentaje_iva,
                tipo_iva: payloadMaestro.porcentaje_iva,
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
        
        await cargarArticulosYCategorias();
        notificar(`¡Importación completada! ${importados} artículos importados correctamente con sus respectivos tipos de IVA configurados${ignorados > 0 ? ` (${ignorados} ignorados o duplicados)` : ''}.`, 'ok');
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
    if (!compraArticuloId || registrandoCompra) return;

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

    const nombreProvLimpio = compraProveedor.trim();

    setRegistrandoCompra(true);
    try {
      // Registrar / asegurar proveedor en tabla proveedores si existe
      if (nombreProvLimpio) {
        const { data: provExistente } = await supabase.from('proveedores').select('id').ilike('nombre', nombreProvLimpio).maybeSingle();
        if (!provExistente) {
          await supabase.from('proveedores').insert([{ nombre: nombreProvLimpio }]);
        }
      }

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
          proveedor: nombreProvLimpio,
          numero_albaran_factura: compraAlbaran.trim(),
          usuario_nombre: adminVerificado?.nombre || 'Administrador',
          observaciones: `Entrada compra proveedor ${nombreProvLimpio}`
        }
      ]);

      notificar(
        `Compra registrada: +${cantComprada} ${artActual.unidad_medida} añadidos a "${artActual.nombre}". Nuevo stock: ${nuevoStockReal.toFixed(2)} ${artActual.unidad_medida}.`
      );
      setCompraCantidad('');
      setCompraCosteUnitario('');
      setCompraProveedor('');
      setCompraAlbaran('');
      await Promise.all([
        cargarArticulosYCategorias(),
        cargarMovimientosInventario(pageMovimientos),
        cargarProveedores()
      ]);
    } catch (err: any) {
      notificar('Error al registrar la compra: ' + err.message, 'error');
    } finally {
      setRegistrandoCompra(false);
    }
  };


  const procesarAjusteStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalAjusteStock || modalAjusteStock.procesando) return;

    const { articulo, tipo, cantidad, motivo } = modalAjusteStock;
    const cantNum = parseFloat(cantidad) || 0;

    if (cantNum < 0 || (tipo === 'MERMA' && cantNum <= 0)) {
      notificar('Introduce una cantidad válida.', 'error');
      return;
    }

    setModalAjusteStock({ ...modalAjusteStock, procesando: true });

    try {
      const stockAnterior = Number(articulo.stock_actual || 0);
      let nuevoStock = stockAnterior;
      let deltaMovimiento = 0;

      if (tipo === 'MERMA') {
        nuevoStock = Math.max(0, stockAnterior - cantNum);
        deltaMovimiento = -cantNum;
      } else {
        nuevoStock = cantNum;
        deltaMovimiento = cantNum - stockAnterior;
      }

      await supabase
        .from('articulos_cafeteria')
        .update({ stock_actual: nuevoStock, updated_at: new Date().toISOString() })
        .eq('id', articulo.id);

      await supabase
        .from('productos_carta')
        .update({ stock_actual: nuevoStock })
        .eq('articulo_inventario_id', articulo.id);

      await supabase.from('movimientos_stock').insert([
        {
          articulo_id: articulo.id,
          tipo_movimiento: tipo === 'MERMA' ? 'MERMA' : 'RECUENTO_FISICO',
          cantidad: deltaMovimiento,
          coste_compra_unitario: Number(articulo.coste_unitario || 0),
          usuario_nombre: adminVerificado?.nombre || 'Administrador',
          observaciones: `${motivo} (Stock ant: ${stockAnterior} -> Nuevo: ${nuevoStock})`
        }
      ]);

      notificar(
        tipo === 'MERMA'
          ? `Merma registrada en "${articulo.nombre}". Stock actualizado: ${nuevoStock} ${articulo.unidad_medida}.`
          : `Recuento físico aplicado a "${articulo.nombre}". Stock fijado en: ${nuevoStock} ${articulo.unidad_medida}.`,
        'ok'
      );

      setModalAjusteStock(null);
      await Promise.all([cargarArticulosYCategorias(), cargarMovimientosInventario(pageMovimientos)]);
    } catch (err: any) {
      notificar('Error ajustando stock: ' + err.message, 'error');
      setModalAjusteStock((prev) => (prev ? { ...prev, procesando: false } : null));
    }
  };

  const agregarIngredienteAElaboracion = () => {
    if (!modalElaboracion || !elabIngSelId) return;
    const ingObj = articulosMaestro.find(a => a.id === elabIngSelId);
    if (!ingObj) return;
    const cant = parseFloat(elabIngCant) || 0;
    if (cant <= 0) return;

    const factor = factorConversionUnidades(elabIngUnidad, (ingObj.unidad_medida || 'ud') as UnidadMedida);
    const cantConvertida = cant * factor;
    const costeCalc = cantConvertida * Number(ingObj.coste_unitario || 0);

    setModalElaboracion({
      ...modalElaboracion,
      ingredientesUsados: [
        ...modalElaboracion.ingredientesUsados,
        {
          ingrediente_id: ingObj.id,
          nombre: ingObj.nombre,
          cantidad: cant,
          unidad_uso: elabIngUnidad,
          unidad_base: (ingObj.unidad_medida || 'ud') as UnidadMedida,
          coste_calculado: costeCalc
        }
      ]
    });
    setElabIngCant('1');
  };

  const eliminarIngredienteElaboracion = (idx: number) => {
    if (!modalElaboracion) return;
    setModalElaboracion({
      ...modalElaboracion,
      ingredientesUsados: modalElaboracion.ingredientesUsados.filter((_, i) => i !== idx)
    });
  };

  const confirmarElaboracionLote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalElaboracion || modalElaboracion.procesando) return;

    const cantResultante = parseFloat(modalElaboracion.cantidadResultante) || 0;
    if (!modalElaboracion.articuloDestinoId || cantResultante <= 0) {
      notificar('Selecciona el producto resultante e indica la cantidad producida (> 0).', 'error');
      return;
    }

    if (modalElaboracion.ingredientesUsados.length === 0) {
      notificar('Añade al menos 1 materia prima utilizada en la elaboración.', 'info');
      return;
    }

    setModalElaboracion({ ...modalElaboracion, procesando: true });

    try {
      const artDestino = articulosMaestro.find(a => a.id === modalElaboracion.articuloDestinoId);
      if (!artDestino) throw new Error('Artículo destino no encontrado.');

      const costeTotalLote = modalElaboracion.ingredientesUsados.reduce((acc, i) => acc + i.coste_calculado, 0);
      const costeUnitarioResultante = cantResultante > 0 ? costeTotalLote / cantResultante : 0;

      // 1. Descontar cada materia prima secuencialmente para evitar condiciones de carrera si se repite un ingrediente
      const stockAcumuladoPorIngrediente = new Map<string, number>();
      for (const ing of modalElaboracion.ingredientesUsados) {
        const artIng = articulosMaestro.find(a => a.id === ing.ingrediente_id);
        if (artIng) {
          const factor = factorConversionUnidades(ing.unidad_uso, artIng.unidad_medida as UnidadMedida);
          const cantDescontar = ing.cantidad * factor;
          const stockBase = stockAcumuladoPorIngrediente.has(artIng.id)
            ? stockAcumuladoPorIngrediente.get(artIng.id)!
            : Number(artIng.stock_actual || 0);
          const nuevoStockIng = Math.max(0, stockBase - cantDescontar);
          stockAcumuladoPorIngrediente.set(artIng.id, nuevoStockIng);

          await supabase.from('articulos_cafeteria').update({ stock_actual: nuevoStockIng }).eq('id', artIng.id);
          await supabase.from('productos_carta').update({ stock_actual: nuevoStockIng }).eq('articulo_inventario_id', artIng.id);

          await supabase.from('movimientos_stock').insert([{
            articulo_id: artIng.id,
            tipo_movimiento: 'CONSUMO_ELABORACION',
            cantidad: -cantDescontar,
            coste_compra_unitario: Number(artIng.coste_unitario || 0),
            usuario_nombre: adminVerificado?.nombre || 'Cocina/Barra',
            observaciones: `Usado para elaborar ${cantResultante} ${artDestino.unidad_medida} de ${artDestino.nombre}`
          }]);
        }
      }

      // 2. Sumar el producto elaborado resultante y actualizar su coste unitario
      const nuevoStockDestino = Number(artDestino.stock_actual || 0) + cantResultante;
      await supabase
        .from('articulos_cafeteria')
        .update({
          stock_actual: nuevoStockDestino,
          coste_unitario: costeUnitarioResultante > 0 ? costeUnitarioResultante : artDestino.coste_unitario,
          updated_at: new Date().toISOString()
        })
        .eq('id', artDestino.id);

      await supabase
        .from('productos_carta')
        .update({
          stock_actual: nuevoStockDestino,
          coste_unitario: costeUnitarioResultante > 0 ? costeUnitarioResultante : artDestino.coste_unitario
        })
        .eq('articulo_inventario_id', artDestino.id);

      await supabase.from('movimientos_stock').insert([{
        articulo_id: artDestino.id,
        tipo_movimiento: 'PRODUCCION_INTERNA',
        cantidad: cantResultante,
        coste_compra_unitario: costeUnitarioResultante,
        usuario_nombre: adminVerificado?.nombre || 'Cocina/Barra',
        observaciones: `Lote elaborado (${modalElaboracion.ingredientesUsados.length} ingredientes). Coste lote: ${costeTotalLote.toFixed(2)}€`
      }]);

      notificar(`¡Elaboración registrada! +${cantResultante} ${artDestino.unidad_medida} de "${artDestino.nombre}" añadidos al inventario.`, 'ok');
      setModalElaboracion(null);
      await Promise.all([cargarArticulosYCategorias(), cargarMovimientosInventario(pageMovimientos)]);
    } catch (err: any) {
      notificar('Error en elaboración: ' + err.message, 'error');
      setModalElaboracion(prev => prev ? { ...prev, procesando: false } : null);
    }
  };

  const guardarConfiguracionFiscal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (guardandoConfigFiscal) return;
    setGuardandoConfigFiscal(true);
    try {
      const payload = {
        id: 1,
        ...configFiscal,
        updated_at: new Date().toISOString()
      };
      const { error } = await supabase.from('configuracion_fiscal').upsert([payload]);
      if (error) throw error;
      notificar('Datos fiscales y cabeceras de facturación guardados correctamente.');
    } catch (err: any) {
      notificar('Error guardando datos fiscales: ' + err.message, 'error');
    } finally {
      setGuardandoConfigFiscal(false);
    }
  };

  if (!adminVerificado) {
    return (
      <div className="min-h-screen bg-[#020617] text-white flex items-center justify-center p-4 font-sans">
        <div className="bg-[#0f172a] border border-slate-800 rounded-3xl p-8 max-w-md w-full shadow-2xl">
          <div className="text-center mb-6">
            <span className="text-5xl block mb-3">🔐</span>
            <h1 className="text-2xl font-black text-white tracking-tight">Acceso Backoffice</h1>
            <p className="text-xs text-slate-400 mt-1">
              Introduce un PIN con permisos de <strong className="text-indigo-400">Administrador / Encargado</strong>
            </p>
          </div>

          <form onSubmit={verificarPinAdmin} className="space-y-4">
            <input
              type="password"
              value={pinAcceso}
              onChange={(e) => setPinAcceso(e.target.value)}
              placeholder="••••"
              maxLength={6}
              disabled={procesandoLoginAdmin}
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-center text-3xl font-black tracking-[0.5em] text-indigo-400 outline-none focus:border-indigo-500"
              autoFocus
            />

            {errorPin && (
              <p className="text-xs text-rose-400 font-bold text-center bg-rose-500/10 border border-rose-500/30 p-3 rounded-xl">
                ⚠️ {errorPin}
              </p>
            )}

            <button
              type="submit"
              disabled={procesandoLoginAdmin}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black py-4 rounded-2xl shadow-lg transition-all uppercase tracking-wider text-sm"
            >
              {procesandoLoginAdmin ? 'Verificando...' : 'Entrar al Panel de Gestión'}
            </button>
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="w-full bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white font-bold py-3 rounded-2xl border border-slate-800 transition-all text-xs"
              >
                ← Volver
              </button>
            )}
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-white flex flex-col md:flex-row font-sans">
      {/* NOTIFICACIÓN FLOTANTE */}
      {mensajeToast && (
        <div
          className={`fixed top-5 right-5 z-50 px-5 py-3.5 rounded-2xl font-black text-xs shadow-2xl border flex items-center gap-2 transition-all ${
            mensajeToast.tipo === 'ok'
              ? 'bg-emerald-950/95 border-emerald-500 text-emerald-300'
              : mensajeToast.tipo === 'error'
              ? 'bg-rose-950/95 border-rose-500 text-rose-300'
              : 'bg-indigo-950/95 border-indigo-500 text-indigo-300'
          }`}
        >
          <span>{mensajeToast.tipo === 'ok' ? '✅' : mensajeToast.tipo === 'error' ? '⚠️' : 'ℹ️'}</span>
          <span>{mensajeToast.texto}</span>
        </div>
      )}

      {/* SIDEBAR DE NAVEGACIÓN */}
      <aside className="w-full md:w-64 bg-[#0f172a] border-b md:border-b-0 md:border-r border-slate-800 p-5 flex flex-col justify-between shrink-0">
        <div>
          <div className="flex items-center gap-3 mb-8 pb-4 border-b border-slate-800">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center font-black text-xl shadow-lg">
              N
            </div>
            <div>
              <h1 className="font-black text-base tracking-tight text-white">NEXUS POS</h1>
              <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">
                👤 {adminVerificado.nombre}
              </p>
            </div>
          </div>

          <nav className="space-y-1.5">
            {[
              { id: 'resumen', label: '📊 Resumen y Arqueo Z' },
              { id: 'tickets', label: '🧾 Facturas y Tickets' },
              { id: 'gastos', label: '💶 Ingresos y Gastos' },
              { id: 'articulos', label: '🍔 Artículos y Escandallos' },
              { id: 'inventario', label: '📦 Stock, Compras y Lotes' },
              { id: 'guisos', label: '🍲 Guisos / Preventa' },
              { id: 'mesas', label: '🪑 Mesas y Reservas' },
              { id: 'empleados', label: '👥 Empleados y Turnos' },
              { id: 'configuracion', label: '⚙️ Datos Fiscales' }
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setTabActiva(item.id as any)}
                className={`w-full text-left px-4 py-3 rounded-xl font-bold text-xs transition-all flex items-center gap-2 ${
                  tabActiva === item.id
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-800 space-y-2">
          <button
            onClick={() => {
              setModalElaboracion({
                articuloDestinoId: '',
                cantidadResultante: '1',
                ingredientesUsados: [],
                observaciones: '',
                procesando: false
              });
            }}
            className="w-full py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 font-black text-xs transition-all"
          >
            👨‍🍳 Elaborar Producto / Lote
          </button>
          <button
            onClick={() => setAdminVerificado(null)}
            className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-rose-950/50 text-slate-400 hover:text-rose-300 border border-slate-800 font-bold text-xs transition-all"
          >
            🔒 Bloquear Sesión
          </button>
        </div>
      </aside>

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 p-5 md:p-8 overflow-y-auto space-y-8">
        {/* ================= PESTAÑA 1: RESUMEN Y ARQUEO DE CAJA ================= */}
        {tabActiva === 'resumen' && (
          <div className="space-y-6">
            <div className="flex flex-wrap justify-between items-center gap-4">
              <div>
                <h2 className="text-2xl font-black text-white">Resumen Operativo y Caja Diaria</h2>
                <p className="text-xs text-slate-400">
                  Métricas financieras con desglose de IVA e inventario valorado en tiempo real
                </p>
              </div>
              <button
                onClick={iniciarArqueoYCierreCaja}
                disabled={cargandoCierreCaja || !cajaHoy || cajaHoy.estado === 'cerrada'}
                className="bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg transition-all"
              >
                {cargandoCierreCaja ? '⏳ Calculando Arqueo...' : '🔒 Realizar Cierre de Caja (Z)'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-[#0f172a] border border-slate-800 p-5 rounded-3xl">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Facturación Bruta (Filtro)
                </span>
                <p className="text-3xl font-black text-emerald-400 mt-1">{metricasResumen.ventasBrutas.toFixed(2)}€</p>
                <p className="text-[11px] text-slate-400 mt-2">
                  Base: <strong>{metricasResumen.baseImponible.toFixed(2)}€</strong> · IVA Total:{' '}
                  <strong>{metricasResumen.cuotaIva.toFixed(2)}€</strong>
                </p>
                <div className="mt-2 pt-2 border-t border-slate-800/80 space-y-0.5 text-[10px]">
                  <p className="text-emerald-300/90 flex justify-between">
                    <span>IVA 10% (Base {metricasResumen.base10.toFixed(2)}€):</span>
                    <strong>{metricasResumen.iva10.toFixed(2)}€</strong>
                  </p>
                  <p className="text-amber-300/90 flex justify-between">
                    <span>IVA 21% (Base {metricasResumen.base21.toFixed(2)}€):</span>
                    <strong>{metricasResumen.iva21.toFixed(2)}€</strong>
                  </p>
                </div>
              </div>

              <div className="bg-[#0f172a] border border-slate-800 p-5 rounded-3xl">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Desglose de Cobros
                </span>
                <p className="text-lg font-black text-amber-400 mt-1">
                  💵 Efectivo: {metricasResumen.totalEfectivo.toFixed(2)}€
                </p>
                <p className="text-lg font-black text-sky-400">
                  💳 Tarjeta: {metricasResumen.totalTarjeta.toFixed(2)}€
                </p>
              </div>

              <div className="bg-[#0f172a] border border-slate-800 p-5 rounded-3xl">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Valor de Stock a Coste
                </span>
                <p className="text-3xl font-black text-indigo-400 mt-1">
                  {metricasResumen.valorInventarioCoste.toFixed(2)}€
                </p>
                <p className="text-[11px] text-slate-400 mt-2">
                  Valor PVP estimado: <strong>{metricasResumen.valorInventarioVenta.toFixed(2)}€</strong>
                </p>
              </div>

              <div className="bg-[#0f172a] border border-slate-800 p-5 rounded-3xl">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Alertas de Stock Bajo
                </span>
                <p className="text-3xl font-black text-rose-400 mt-1">{metricasResumen.alertasStock.length}</p>
                <p className="text-[11px] text-slate-400 mt-2">Artículos en o bajo el mínimo</p>
              </div>
            </div>

            {/* PANEL DE APERTURA DE CAJA SI NO EXISTE HOY */}
            {!cajaHoy && (
              <div className="bg-indigo-950/30 border border-indigo-500/40 rounded-3xl p-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-black text-white">Apertura de Caja Diaria</h3>
                  <p className="text-xs text-slate-300">
                    Indica el fondo de maniobra inicial en el cajón portamonedas para iniciar la jornada.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    step="0.01"
                    value={fondoInicialInput}
                    onChange={(e) => setFondoInicialInput(e.target.value)}
                    disabled={procesandoApertura}
                    className="w-32 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-black text-right"
                  />
                  <button
                    onClick={abrirCajaDiaria}
                    disabled={procesandoApertura}
                    className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase"
                  >
                    {procesandoApertura ? 'Abriendo...' : 'Abrir Caja Hoy'}
                  </button>
                </div>
              </div>
            )}

            {/* COMPONENTE DE HISTORIAL DE CAJAS Y MOVIMIENTOS */}
            <HistorialCajas />
          </div>
        )}

        {/* ================= PESTAÑA 2: FACTURAS Y TICKETS LEGALES ================= */}
        {tabActiva === 'tickets' && (
          <div className="space-y-6">
            <div className="flex flex-wrap justify-between items-end gap-4 bg-[#0f172a] border border-slate-800 p-5 rounded-3xl">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Desde</label>
                  <input
                    type="date"
                    value={filtroFechaInicio}
                    onChange={(e) => setFiltroFechaInicio(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Hasta</label>
                  <input
                    type="date"
                    value={filtroFechaFin}
                    onChange={(e) => setFiltroFechaFin(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Serie</label>
                  <select
                    value={filtroSerieTicket}
                    onChange={(e) => setFiltroSerieTicket(e.target.value as any)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white"
                  >
                    <option value="TODAS">Todas (T, R, F)</option>
                    <option value="T">Simplificadas (T)</option>
                    <option value="R">Rectificativas (R)</option>
                    <option value="F">Nominativas (F)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Buscar</label>
                  <input
                    type="text"
                    placeholder="Nº factura, NIF, mesa..."
                    value={busquedaTicket}
                    onChange={(e) => setBusquedaTicket(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() =>
                    exportarTicketsAExcelCSV(ticketsFiltrados, `libro_iva_${filtroFechaInicio}_${filtroFechaFin}`)
                  }
                  className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 px-4 py-2.5 rounded-xl font-black text-xs transition-all"
                >
                  📥 Exportar Libro IVA (Excel CSV)
                </button>
                <button
                  onClick={() =>
                    exportarTicketsAPDF(
                      ticketsFiltrados,
                      configFiscal,
                      `${filtroFechaInicio} a ${filtroFechaFin}`
                    )
                  }
                  className="bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 px-4 py-2.5 rounded-xl font-black text-xs transition-all"
                >
                  🖨️ Imprimir Informe PDF Fiscal
                </button>
              </div>
            </div>

            <div className="bg-[#0f172a] border border-slate-800 rounded-3xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-900/90 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                      <th className="p-3.5">Nº Documento</th>
                      <th className="p-3.5">Tipo</th>
                      <th className="p-3.5">Fecha / Hora</th>
                      <th className="p-3.5">Mesa / Cliente</th>
                      <th className="p-3.5">Pago</th>
                      <th className="p-3.5 text-right">Base 10% / IVA</th>
                      <th className="p-3.5 text-right">Base 21% / IVA</th>
                      <th className="p-3.5 text-right">Total</th>
                      <th className="p-3.5 text-center">Acciones Legales</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {ticketsJerarquicos.map((t: any) => {
                      const d = obtenerDesgloseTicketSeguro(t);
                      const esHija = Boolean(t.esRectificativaHija);

                      return (
                        <tr
                          key={t.id}
                          className={`transition-colors ${
                            esHija
                              ? 'bg-rose-950/20 border-l-4 border-l-rose-500/80 hover:bg-rose-950/30'
                              : t.serie === 'F'
                              ? 'bg-indigo-950/15 hover:bg-indigo-950/25'
                              : 'hover:bg-slate-900/40'
                          }`}
                        >
                          <td className="p-3.5 font-black text-white">
                            {esHija ? (
                              <div className="flex items-start gap-2 pl-3">
                                <CornerDownRight className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                                <div>
                                  <span className="font-mono text-rose-300 font-black">{t.numero_completo}</span>
                                  <span className="block text-[10px] text-rose-400 font-bold">
                                    ↳ Rectifica a {t.ticket_origen_numero || t.padreDocumento?.numero_completo}
                                  </span>
                                  {t.hash_actual && (
                                    <span
                                      title={`VeriFactu SHA-256: ${t.hash_actual}`}
                                      className="block text-[9px] font-mono text-rose-300/60"
                                    >
                                      🔗 {String(t.hash_actual).slice(0, 10)}...
                                    </span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div>
                                <span className="font-mono text-white font-black">{t.numero_completo}</span>
                                {t.serie === 'F' && t.ticket_origen_numero && (
                                  <span className="block text-[10px] text-indigo-400 font-bold">
                                    📄 Generada desde Ticket #{t.ticket_origen_numero}
                                  </span>
                                )}
                                {t.serie === 'T' && (t.factura_asociada_numero || ticketsHistorico.find(x => x.serie === 'F' && (x.ticket_origen_id === t.id || x.ticket_origen_numero === t.numero_completo))) && (
                                  <span className="block text-[10px] text-cyan-400 font-bold">
                                    🏢 Factura asociada #{t.factura_asociada_numero || ticketsHistorico.find(x => x.serie === 'F' && (x.ticket_origen_id === t.id || x.ticket_origen_numero === t.numero_completo))?.numero_completo}
                                  </span>
                                )}
                                {t.hash_actual && (
                                  <span
                                    title={`VeriFactu SHA-256: ${t.hash_actual}`}
                                    className="block text-[9px] font-mono text-indigo-400"
                                  >
                                    🔗 {String(t.hash_actual).slice(0, 10)}...
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="p-3.5">
                            <span
                              className={`px-2 py-0.5 rounded-md font-black text-[10px] border ${
                                t.serie === 'R'
                                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                                  : t.serie === 'F'
                                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              }`}
                            >
                              {t.tipo_factura || (t.serie === 'R' ? 'R4' : t.serie === 'F' ? 'F1' : 'F2')} · {t.tipo_documento}
                            </span>
                          </td>
                          <td className="p-3.5 text-slate-300">
                            <span>{new Date(t.fecha_expedicion).toLocaleString('es-ES')}</span>
                            {t.motivo_rectificacion && (
                              <span className="block text-[10px] text-rose-300/80 italic truncate max-w-xs" title={t.motivo_rectificacion}>
                                Motivo: {t.motivo_rectificacion}
                              </span>
                            )}
                          </td>
                          <td className="p-3.5">
                            <span className="font-bold text-white">Mesa {t.mesa}</span>
                            {(t.cliente_nombre_razon || t.cliente_nombre) && (
                              <span className="block text-[10px] text-indigo-300 font-semibold">
                                {t.cliente_nombre_razon || t.cliente_nombre} {t.cliente_nif ? `(${t.cliente_nif})` : ''}
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 uppercase font-bold text-slate-300">{t.metodo_pago}</td>
                          <td className="p-3.5 text-right text-emerald-300 font-mono text-[11px]">
                            {d.base_imponible_10.toFixed(2)}€ / {d.iva_10.toFixed(2)}€
                          </td>
                          <td className="p-3.5 text-right text-amber-300 font-mono text-[11px]">
                            {d.base_imponible_21.toFixed(2)}€ / {d.iva_21.toFixed(2)}€
                          </td>
                          <td
                            className={`p-3.5 text-right font-black text-sm font-mono ${
                              Number(t.total_final) < 0 ? 'text-rose-400' : 'text-emerald-400'
                            }`}
                          >
                            {Number(t.total_final).toFixed(2)}€
                          </td>
                          <td className="p-3.5 text-center">
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              <button
                                onClick={() => imprimirDocumentoFiscalHTML(t, configFiscal)}
                                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-[11px] transition-colors cursor-pointer"
                                title="Reimprimir Ticket / Factura"
                              >
                                🖨️ Copia
                              </button>
                              {t.serie === 'T' && (
                                (t.factura_asociada_numero || ticketsHistorico.find(x => x.serie === 'F' && (x.ticket_origen_id === t.id || x.ticket_origen_numero === t.numero_completo))) ? (
                                  <span className="px-2 py-1.5 rounded-lg bg-slate-800 text-slate-400 font-bold text-[11px] border border-white/10" title="Factura nominativa ya emitida para este ticket">
                                    ✓ Facturada
                                  </span>
                                ) : (
                                  <button
                                    onClick={() =>
                                      setModalFacturaNominativa({
                                        factura: t,
                                        razonSocial: '',
                                        nifCif: '',
                                        direccion: '',
                                        email: '',
                                        procesando: false
                                      })
                                    }
                                    className="px-2.5 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 font-bold text-[11px] transition-colors cursor-pointer"
                                    title="Canjear por Factura Nominativa con NIF"
                                  >
                                    🏢 Nominativa
                                  </button>
                                )
                              )}
                              {(t.serie === 'T' || t.serie === 'F') && (
                                <button
                                  onClick={() =>
                                    setModalRectificativa({
                                      factura: t,
                                      motivo: '',
                                      procesando: false
                                    })
                                  }
                                  className="px-2.5 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-500/30 font-bold text-[11px] transition-colors cursor-pointer"
                                  title={
                                    t.serie === 'F'
                                      ? 'Emitir Factura Rectificativa de esta Factura Nominativa'
                                      : 'Emitir Factura Rectificativa (Devolución legal)'
                                  }
                                >
                                  ↩️ Rectificar
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================= PESTAÑA 3: ARTÍCULOS, ESCANDALLOS Y COMBOS ================= */}
        {tabActiva === 'articulos' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* FORMULARIO CREAR / EDITAR ARTÍCULO */}
            <form
              onSubmit={guardarYSincronizarArticulo}
              className="lg:col-span-5 bg-[#0f172a] border border-slate-800 rounded-3xl p-6 space-y-4 self-start"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-lg font-black text-white">
                  {editandoArticuloId ? '✏️ Editando Artículo' : '➕ Nuevo Artículo / Receta'}
                </h3>
                {editandoArticuloId && (
                  <button
                    type="button"
                    onClick={limpiarFormularioArticulo}
                    className="text-xs font-bold text-rose-400 hover:underline"
                  >
                    Cancelar edición
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-black uppercase text-slate-400">Nombre del Artículo *</label>
                  <input
                    type="text"
                    required
                    value={artNombre}
                    onChange={(e) => setArtNombre(e.target.value)}
                    placeholder="Ej: Hamburguesa Nexus / Café con Leche"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-bold text-white mt-1"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400">Categoría</label>
                  <select
                    value={artCategoria}
                    onChange={(e) => setArtCategoria(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs font-bold text-white mt-1"
                  >
                    {categorias.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400">Monitor de Destino</label>
                  <select
                    value={artDestino}
                    onChange={(e) => setArtDestino(e.target.value as 'barra' | 'cocina')}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs font-bold text-white mt-1"
                  >
                    <option value="barra">🍹 Monitor de Barra</option>
                    <option value="cocina">🍳 Monitor de Cocina (KDS)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400">Precio Venta PVP (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={artPrecioVenta}
                    onChange={(e) => setArtPrecioVenta(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-black text-emerald-400 mt-1"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400">Coste Unitario (€)</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={artCosteUnitario}
                    disabled={artEsCompuesto}
                    onChange={(e) => setArtCosteUnitario(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-bold text-amber-300 mt-1 disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400">Tipo de IVA Aplicable</label>
                  <select
                    value={artTipoIva}
                    onChange={(e) => setArtTipoIva(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs font-bold text-white mt-1"
                  >
                    <option value="10">10% (Hostelería / Comida y Bebida)</option>
                    <option value="21">21% (Cartas TCG / Merchandising)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400">Unidad de Medida Base</label>
                  <select
                    value={artUnidadMedida}
                    onChange={(e) => setArtUnidadMedida(e.target.value as UnidadMedida)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs font-bold text-white mt-1"
                  >
                    <option value="ud">Unidades (ud)</option>
                    <option value="kg">Kilogramos (kg)</option>
                    <option value="g">Gramos (g)</option>
                    <option value="l">Litros (l)</option>
                    <option value="ml">Mililitros (ml)</option>
                    <option value="cl">Centilitros (cl)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400">Stock Actual</label>
                  <input
                    type="number"
                    step="0.01"
                    value={artStockInicial}
                    onChange={(e) => setArtStockInicial(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-bold text-white mt-1"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400">Alerta Stock Mínimo</label>
                  <input
                    type="number"
                    step="0.01"
                    value={artStockMinimo}
                    onChange={(e) => setArtStockMinimo(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-bold text-rose-300 mt-1"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400">Imagen (URL o Subir)</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={manejarSubidaImagen}
                    className="w-full text-[10px] text-slate-400 mt-1"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-4 pt-2 border-t border-slate-800 text-xs font-bold">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={artVendibleTpv}
                    onChange={(e) => setArtVendibleTpv(e.target.checked)}
                  />
                  <span>Visible en Carta TPV</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={artControlaStock}
                    onChange={(e) => setArtControlaStock(e.target.checked)}
                  />
                  <span>Controlar Stock</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-amber-300">
                  <input
                    type="checkbox"
                    checked={artEsCompuesto}
                    onChange={(e) => setArtEsCompuesto(e.target.checked)}
                  />
                  <span>🧪 Tiene Escandallo (Receta)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-indigo-300">
                  <input
                    type="checkbox"
                    checked={artEsCombo}
                    onChange={(e) => setArtEsCombo(e.target.checked)}
                  />
                  <span>🍱 Es Menú / Combo Guiado</span>
                </label>
              </div>

              {/* CONSTRUCTOR DE ESCANDALLO CON CONVERSIÓN DE UNIDADES */}
              {artEsCompuesto && (
                <div className="bg-slate-950/90 border border-amber-500/30 rounded-2xl p-4 space-y-3">
                  <h4 className="text-xs font-black uppercase text-amber-400">
                    🧪 Escandallo / Ingredientes por Unidad Vendida
                  </h4>
                  <div className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-5">
                      <label className="text-[9px] font-bold text-slate-400">Ingrediente</label>
                      <select
                        value={ingredienteSelId}
                        onChange={(e) => setIngredienteSelId(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                      >
                        <option value="">Elegir ingrediente...</option>
                        {articulosMaestro
                          .filter((a) => a.id !== editandoArticuloId)
                          .map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.nombre} ({a.coste_unitario}€/{a.unidad_medida})
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="col-span-3">
                      <label className="text-[9px] font-bold text-slate-400">Cant.</label>
                      <input
                        type="number"
                        step="0.01"
                        value={ingredienteCantidad}
                        onChange={(e) => setIngredienteCantidad(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[9px] font-bold text-slate-400">Unidad</label>
                      <select
                        value={ingredienteUnidadUso}
                        onChange={(e) => setIngredienteUnidadUso(e.target.value as UnidadMedida)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                      >
                        <option value="ud">ud</option>
                        <option value="g">g</option>
                        <option value="kg">kg</option>
                        <option value="ml">ml</option>
                        <option value="cl">cl</option>
                        <option value="l">l</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <button
                        type="button"
                        onClick={agregarIngredienteAEscandallo}
                        className="w-full bg-amber-600 hover:bg-amber-500 text-white font-black py-2 rounded-lg text-xs"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {lineasEscandallo.length > 0 && (
                    <div className="space-y-1.5 pt-2">
                      {lineasEscandallo.map((l, idx) => (
                        <div
                          key={idx}
                          className="flex justify-between items-center bg-slate-900 px-3 py-2 rounded-lg text-xs"
                        >
                          <span>
                            <strong>{l.nombre_ingrediente}</strong> · {l.cantidad} {l.unidad_uso}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-amber-300 font-bold">{l.coste_calculado.toFixed(3)}€</span>
                            <button
                              type="button"
                              onClick={() => eliminarLineaEscandallo(idx)}
                              className="text-rose-400 font-black"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* CONSTRUCTOR DE PASOS COMBO */}
              {artEsCombo && (
                <div className="bg-slate-950/90 border border-indigo-500/30 rounded-2xl p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-black uppercase text-indigo-400">🍱 Pasos del Combo</h4>
                    <button
                      type="button"
                      onClick={agregarPasoCombo}
                      className="text-[10px] bg-indigo-600 px-2.5 py-1 rounded-lg font-black"
                    >
                      + Añadir Paso
                    </button>
                  </div>
                  {pasosCombo.map((paso, idxP) => (
                    <div key={idxP} className="bg-slate-900 p-3 rounded-xl space-y-2 border border-slate-800">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={paso.titulo}
                          onChange={(e) => actualizarTituloPaso(idxP, e.target.value)}
                          className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-bold"
                        />
                        <button
                          type="button"
                          onClick={() => agregarOpcionAPaso(idxP)}
                          className="text-[10px] bg-emerald-600/30 text-emerald-300 px-2 py-1 rounded-lg font-bold"
                        >
                          + Opción
                        </button>
                        <button
                          type="button"
                          onClick={() => eliminarPasoCombo(idxP)}
                          className="text-rose-400 text-xs px-1"
                        >
                          🗑️
                        </button>
                      </div>
                      {paso.opciones.map((op, idxO) => (
                        <div key={idxO} className="flex gap-2 items-center pl-2">
                          <input
                            type="text"
                            value={op.nombre}
                            onChange={(e) => actualizarOpcion(idxP, idxO, 'nombre', e.target.value)}
                            className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs"
                          />
                          <select
                            value={op.destino}
                            onChange={(e) => actualizarOpcion(idxP, idxO, 'destino', e.target.value)}
                            className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[10px]"
                          >
                            <option value="barra">Barra</option>
                            <option value="cocina">Cocina</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => eliminarOpcionDePaso(idxP, idxO)}
                            className="text-rose-400 text-xs"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              <button
                type="submit"
                disabled={guardandoArticulo}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black py-3.5 rounded-2xl shadow-lg text-xs uppercase tracking-wider transition-all"
              >
                {guardandoArticulo
                  ? 'Guardando...'
                  : editandoArticuloId
                  ? '💾 Guardar Cambios y Sincronizar'
                  : '➕ Crear Artículo en Maestro y Carta'}
              </button>
            </form>

            {/* LISTADO Y GESTIÓN DE CATEGORÍAS Y ARTÍCULOS */}
            <div className="lg:col-span-7 space-y-4">
              {/* GESTIÓN DE CATEGORÍAS + IMPORTAR CSV */}
              <div className="bg-[#0f172a] border border-slate-800 rounded-3xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-xs font-black uppercase text-slate-400">Categorías TPV e Importación CSV</h4>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={descargarPlantillaCSV}
                      className="text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-xl font-bold"
                    >
                      📄 Plantilla CSV
                    </button>
                    <label className="text-[11px] bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 px-3 py-1.5 rounded-xl font-bold cursor-pointer">
                      {isImportingCSV ? 'Importando...' : '📤 Importar CSV'}
                      <input type="file" accept=".csv" onChange={manejarImportacionCSV} className="hidden" disabled={isImportingCSV} />
                    </label>
                  </div>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Nueva categoría (ej. Bollería, Cervezas...)"
                    value={nuevaCategoriaInput}
                    onChange={(e) => setNuevaCategoriaInput(e.target.value)}
                    disabled={creandoCategoria}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white"
                  />
                  <button
                    type="button"
                    onClick={crearNuevaCategoria}
                    disabled={creandoCategoria}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-4 py-2 rounded-xl font-black text-xs"
                  >
                    {creandoCategoria ? '...' : '+ Añadir'}
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {categorias.map((c) => (
                    <span
                      key={c}
                      className="inline-flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-3 py-1 rounded-full text-xs font-bold text-slate-300"
                    >
                      {c}
                      <button
                        type="button"
                        onClick={() => borrarCategoria(c)}
                        className="text-rose-400 hover:text-rose-300 font-black"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* TABLA DE ARTÍCULOS */}
              <div className="bg-[#0f172a] border border-slate-800 rounded-3xl p-5 space-y-4">
                <input
                  type="text"
                  placeholder="🔍 Buscar artículo por nombre o categoría..."
                  value={busquedaArticulo}
                  onChange={(e) => setBusquedaArticulo(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold text-white"
                />

                <div className="overflow-x-auto max-h-[540px]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-900 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                        <th className="p-3">Artículo</th>
                        <th className="p-3">Categoría / Destino</th>
                        <th className="p-3 text-center">IVA</th>
                        <th className="p-3 text-right">PVP / Coste</th>
                        <th className="p-3 text-right">Stock</th>
                        <th className="p-3 text-center">Editar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {articulosMaestro
                        .filter(
                          (a) =>
                            a.nombre.toLowerCase().includes(busquedaArticulo.toLowerCase()) ||
                            (a.categoria || '').toLowerCase().includes(busquedaArticulo.toLowerCase())
                        )
                        .map((art) => {
                          const ivaArt = Number(art.porcentaje_iva ?? art.tipo_iva ?? 10) === 21 ? 21 : 10;
                          return (
                            <tr key={art.id} className="hover:bg-slate-900/40">
                              <td className="p-3 font-black text-white">
                                {art.nombre}
                                {!art.vendible_tpv && (
                                  <span className="ml-2 text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                                    Materia Prima
                                  </span>
                                )}
                              </td>
                              <td className="p-3 text-slate-300">
                                {art.categoria} ·{' '}
                                <span className="uppercase text-[10px] font-bold text-indigo-400">
                                  {art.destino || 'barra'}
                                </span>
                              </td>
                              <td className="p-3 text-center">
                                <span
                                  className={`px-2 py-0.5 rounded font-black text-[10px] ${
                                    ivaArt === 21
                                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  }`}
                                >
                                  {ivaArt}%
                                </span>
                              </td>
                              <td className="p-3 text-right">
                                <span className="font-black text-emerald-400">
                                  {Number(art.precio_venta || 0).toFixed(2)}€
                                </span>
                                <span className="block text-[10px] text-slate-400">
                                  Coste: {Number(art.coste_unitario || 0).toFixed(2)}€
                                </span>
                              </td>
                              <td className="p-3 text-right font-bold">
                                {art.controla_stock ? (
                                  <span
                                    className={
                                      Number(art.stock_actual) <= Number(art.stock_minimo)
                                        ? 'text-rose-400 font-black'
                                        : 'text-white'
                                    }
                                  >
                                    {Number(art.stock_actual || 0).toFixed(2)} {art.unidad_medida}
                                  </span>
                                ) : (
                                  <span className="text-slate-500">Libre</span>
                                )}
                              </td>
                              <td className="p-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => seleccionarArticuloParaEditar(art)}
                                  className="px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 font-bold text-[11px]"
                                >
                                  ✏️ Editar
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
          </div>
        )}

        {/* ================= PESTAÑA 4: INVENTARIO, COMPRAS Y MERMAS ================= */}
        {tabActiva === 'inventario' && (
          <div className="space-y-6">
            {/* RECEPCIÓN DE MERCANCÍA / COMPRAS CON AUTOCOMPLETADO DE PROVEEDORES */}
            <form
              onSubmit={registrarCompraMercancia}
              className="bg-[#0f172a] border border-slate-800 rounded-3xl p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end"
            >
              <div className="lg:col-span-2">
                <label className="text-[10px] font-black uppercase text-slate-400">
                  📦 Entrada de Compra (Artículo)
                </label>
                <select
                  value={compraArticuloId}
                  onChange={(e) => setCompraArticuloId(e.target.value)}
                  disabled={registrandoCompra}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs font-bold text-white mt-1"
                >
                  <option value="">Seleccionar artículo...</option>
                  {articulosMaestro.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nombre} (Stock: {a.stock_actual} {a.unidad_medida})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">Cantidad Recibida</label>
                <input
                  type="number"
                  step="0.01"
                  value={compraCantidad}
                  onChange={(e) => setCompraCantidad(e.target.value)}
                  placeholder="Ej: 24"
                  disabled={registrandoCompra}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs font-bold text-white mt-1"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">Nuevo Coste Unit. (€)</label>
                <input
                  type="number"
                  step="0.0001"
                  value={compraCosteUnitario}
                  onChange={(e) => setCompraCosteUnitario(e.target.value)}
                  placeholder="Opcional"
                  disabled={registrandoCompra}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs font-bold text-amber-300 mt-1"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">Proveedor</label>
                <input
                  type="text"
                  list="lista-proveedores-sugeridos"
                  value={compraProveedor}
                  onChange={(e) => setCompraProveedor(e.target.value)}
                  placeholder="Escribe o elige proveedor..."
                  disabled={registrandoCompra}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs font-bold text-white mt-1"
                />
                <datalist id="lista-proveedores-sugeridos">
                  {proveedoresSugeridos.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </div>

              <button
                type="submit"
                disabled={registrandoCompra}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black py-2.5 px-4 rounded-xl text-xs uppercase shadow-lg"
              >
                {registrandoCompra ? 'Guardando...' : '+ Sumar Stock'}
              </button>
            </form>

            {/* CONTROL RÁPIDO DE MERMAS Y RECUENTO FÍSICO */}
            <div className="bg-[#0f172a] border border-slate-800 rounded-3xl p-6 space-y-4">
              <div className="flex flex-wrap justify-between items-center gap-2">
                <h3 className="text-base font-black text-white">Control de Stock, Mermas y Recuento Físico</h3>
                <button
                  type="button"
                  disabled={refrescandoStock}
                  onClick={refrescarStockInventario}
                  className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 px-3 py-1.5 rounded-xl font-bold text-xs"
                >
                  {refrescandoStock ? '⏳ Actualizando...' : '🔄 Refrescar Stock'}
                </button>
              </div>
              <div className="overflow-x-auto max-h-80">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-900 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                      <th className="p-3">Artículo</th>
                      <th className="p-3 text-right">Stock Actual</th>
                      <th className="p-3 text-right">Mínimo</th>
                      <th className="p-3 text-center">Acciones de Inventario</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {articulosMaestro
                      .filter((a) => a.controla_stock)
                      .map((art) => (
                        <tr key={art.id} className="hover:bg-slate-900/40">
                          <td className="p-3 font-bold text-white">{art.nombre}</td>
                          <td className="p-3 text-right font-black text-emerald-400">
                            {Number(art.stock_actual || 0).toFixed(2)} {art.unidad_medida}
                          </td>
                          <td className="p-3 text-right text-slate-400">
                            {Number(art.stock_minimo || 0).toFixed(2)} {art.unidad_medida}
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex justify-center gap-2">
                              <button
                                onClick={() =>
                                  setModalAjusteStock({
                                    articulo: art,
                                    tipo: 'MERMA',
                                    cantidad: '1',
                                    motivo: 'Rotura / Caducidad',
                                    procesando: false
                                  })
                                }
                                className="px-2.5 py-1 rounded-lg bg-rose-600/20 text-rose-300 border border-rose-500/30 font-bold text-[11px]"
                              >
                                🗑️ Registrar Merma
                              </button>
                              <button
                                onClick={() =>
                                  setModalAjusteStock({
                                    articulo: art,
                                    tipo: 'RECUENTO_FISICO',
                                    cantidad: String(art.stock_actual || 0),
                                    motivo: 'Arqueo de inventario físico',
                                    procesando: false
                                  })
                                }
                                className="px-2.5 py-1 rounded-lg bg-amber-600/20 text-amber-300 border border-amber-500/30 font-bold text-[11px]"
                              >
                                📋 Recuento Físico
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* KARDEX / HISTORIAL DE MOVIMIENTOS DE STOCK */}
            <div className="bg-[#0f172a] border border-slate-800 rounded-3xl p-6 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-black text-white">Kardex · Historial de Movimientos de Stock</h3>
                <div className="flex gap-2">
                  <button
                    disabled={pageMovimientos === 0}
                    onClick={() => cargarMovimientosInventario(pageMovimientos - 1)}
                    className="px-3 py-1 bg-slate-800 rounded-lg text-xs disabled:opacity-40"
                  >
                    ◀ Anterior
                  </button>
                  <button
                    disabled={!hayMasMovimientos}
                    onClick={() => cargarMovimientosInventario(pageMovimientos + 1)}
                    className="px-3 py-1 bg-slate-800 rounded-lg text-xs disabled:opacity-40"
                  >
                    Siguiente ▶
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-900 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                      <th className="p-3">Fecha</th>
                      <th className="p-3">Artículo</th>
                      <th className="p-3">Tipo</th>
                      <th className="p-3 text-right">Cantidad</th>
                      <th className="p-3">Usuario / Proveedor</th>
                      <th className="p-3">Observaciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {movimientosStock.map((m) => (
                      <tr key={m.id}>
                        <td className="p-3 text-slate-400">{new Date(m.created_at).toLocaleString('es-ES')}</td>
                        <td className="p-3 font-bold text-white">{m.articulos_cafeteria?.nombre || 'Artículo'}</td>
                        <td className="p-3 font-black text-indigo-300">{m.tipo_movimiento}</td>
                        <td
                          className={`p-3 text-right font-black ${
                            Number(m.cantidad) < 0 ? 'text-rose-400' : 'text-emerald-400'
                          }`}
                        >
                          {Number(m.cantidad) > 0 ? `+${m.cantidad}` : m.cantidad}{' '}
                          {m.articulos_cafeteria?.unidad_medida || ''}
                        </td>
                        <td className="p-3 text-slate-300">
                          {m.usuario_nombre} {m.proveedor ? `· 🚚 ${m.proveedor}` : ''}
                        </td>
                        <td className="p-3 text-slate-400">{m.observaciones}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================= PESTAÑA: INGRESOS Y GASTOS GENERALES ================= */}
        {tabActiva === 'gastos' && (
          <div className="space-y-6 animate-fade-in">
            {/* CABECERA Y FILTROS PRINCIPALES */}
            <div className="bg-[#0f172a] border border-slate-800 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                  <span>💶 Ingresos y Gastos Generales</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Control económico, previsión trimestral de IVA y exportación para gestoría
                </p>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-xl">
                  <Calendar className="h-4 w-4 text-cyan-400" />
                  <span className="text-[10px] uppercase font-bold text-slate-400">Mes:</span>
                  <input
                    type="month"
                    value={mesGastos}
                    onChange={(e) => setMesGastos(e.target.value)}
                    className="bg-transparent text-xs font-bold text-white outline-none cursor-pointer"
                  />
                </div>

                <button
                  type="button"
                  onClick={sincronizarCierresCaja}
                  disabled={sincronizandoCierres}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 font-bold text-xs transition-all cursor-pointer disabled:opacity-50"
                  title="Importar cierres diarios del TPV (Z) como ingresos sin duplicados"
                >
                  <RefreshCw className={`h-4 w-4 ${sincronizandoCierres ? 'animate-spin' : ''}`} />
                  <span>{sincronizandoCierres ? 'Importando...' : 'Sincronizar Cierres TPV'}</span>
                </button>

                <button
                  type="button"
                  onClick={exportarCsvGestoria}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 font-bold text-xs transition-all cursor-pointer"
                  title="Exportar CSV oficial desglosado para la gestoría fiscal"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  <span>Exportar CSV para Gestoría</span>
                </button>
              </div>
            </div>

            {/* 4 TARJETAS KPI */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* KPI 1: Ingresos Totales */}
              <div className="bg-[#0f172a] border border-emerald-500/30 rounded-3xl p-5 shadow-lg relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider">Ingresos del Mes</span>
                  <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                </div>
                <p className="text-2xl font-black text-white font-mono mt-2">
                  {resumenGastos.totalIngresos.toFixed(2)} €
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Base: <strong className="text-emerald-300 font-mono">{resumenGastos.baseIngresos.toFixed(2)} €</strong> · IVA: <strong className="text-slate-300 font-mono">{resumenGastos.cuotaIvaIngresos.toFixed(2)} €</strong>
                </p>
              </div>

              {/* KPI 2: Gastos Totales */}
              <div className="bg-[#0f172a] border border-rose-500/30 rounded-3xl p-5 shadow-lg relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-rose-400 tracking-wider">Gastos del Mes</span>
                  <div className="h-8 w-8 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
                    <TrendingDown className="h-4 w-4" />
                  </div>
                </div>
                <p className="text-2xl font-black text-white font-mono mt-2">
                  {resumenGastos.totalGastos.toFixed(2)} €
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Base: <strong className="text-rose-300 font-mono">{resumenGastos.baseGastos.toFixed(2)} €</strong> · IVA: <strong className="text-slate-300 font-mono">{resumenGastos.cuotaIvaGastos.toFixed(2)} €</strong>
                </p>
              </div>

              {/* KPI 3: Beneficio Operativo Neto */}
              <div className={`bg-[#0f172a] border rounded-3xl p-5 shadow-lg relative overflow-hidden ${
                resumenGastos.beneficioOperativoNeto >= 0 ? 'border-cyan-500/30' : 'border-amber-500/30'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-cyan-400 tracking-wider">Beneficio Operativo Neto</span>
                  <div className="h-8 w-8 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
                    <DollarSign className="h-4 w-4" />
                  </div>
                </div>
                <p className={`text-2xl font-black font-mono mt-2 ${
                  resumenGastos.beneficioOperativoNeto >= 0 ? 'text-cyan-300' : 'text-amber-400'
                }`}>
                  {resumenGastos.beneficioOperativoNeto.toFixed(2)} €
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Base Ingresos − Base Gastos (sin IVA)
                </p>
              </div>

              {/* KPI 4: Previsión Trimestral de IVA */}
              <div className="bg-[#0f172a] border border-indigo-500/30 rounded-3xl p-5 shadow-lg relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-indigo-400 tracking-wider">Previsión IVA Trimestre</span>
                  <div className="h-8 w-8 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                    <FileText className="h-4 w-4" />
                  </div>
                </div>
                <p className={`text-2xl font-black font-mono mt-2 ${
                  resumenGastos.previsionTrimestralIva >= 0 ? 'text-indigo-300' : 'text-emerald-300'
                }`}>
                  {resumenGastos.previsionTrimestralIva.toFixed(2)} €
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {resumenGastos.previsionTrimestralIva >= 0 ? 'A ingresar (IVA Repercutido > Soportado)' : 'A compensar / devolver'}
                </p>
              </div>
            </div>

            {/* FORMULARIO RÁPIDO DE APUNTE Y TABLA */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* FORMULARIO DE ALTA */}
              <form
                onSubmit={guardarMovimientoGeneral}
                className="lg:col-span-4 bg-[#0f172a] border border-slate-800 rounded-3xl p-6 space-y-4 self-start shadow-xl"
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <Plus className="h-4 w-4 text-cyan-400" />
                    <span>Registrar Ingreso o Gasto</span>
                  </h3>
                  <div className="flex rounded-xl bg-slate-900 p-1 border border-slate-700">
                    <button
                      type="button"
                      onClick={() => { setMovTipo('GASTO'); setMovTipoIva(21); setMovCategoria('Mercancía / Alimentación'); }}
                      className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                        movTipo === 'GASTO' ? 'bg-rose-500 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Gasto
                    </button>
                    <button
                      type="button"
                      onClick={() => { setMovTipo('INGRESO'); setMovTipoIva(10); setMovCategoria('Ventas TPV'); }}
                      className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                        movTipo === 'INGRESO' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Ingreso
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400">Fecha</label>
                    <input
                      type="date"
                      required
                      value={movFecha}
                      onChange={(e) => setMovFecha(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs font-bold text-white mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400">Categoría</label>
                    <select
                      value={movCategoria}
                      onChange={(e) => setMovCategoria(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs font-bold text-white mt-1"
                    >
                      {movTipo === 'GASTO' ? (
                        <>
                          <option value="Mercancía / Alimentación">Mercancía / Alimentación</option>
                          <option value="Bebidas / Cafetería">Bebidas / Cafetería</option>
                          <option value="Suministros (Luz, Agua, Red)">Suministros (Luz, Agua, Red)</option>
                          <option value="Alquiler Local">Alquiler Local</option>
                          <option value="Nóminas / Personal">Nóminas / Personal</option>
                          <option value="Reparaciones y Mantenimiento">Reparaciones y Mantenimiento</option>
                          <option value="Publicidad y Marketing">Publicidad y Marketing</option>
                          <option value="Software y Suscripciones">Software y Suscripciones</option>
                          <option value="Tasas e Impuestos">Tasas e Impuestos</option>
                          <option value="Otros Gastos">Otros Gastos</option>
                        </>
                      ) : (
                        <>
                          <option value="Ventas TPV">Ventas TPV</option>
                          <option value="Eventos / Escape Rooms">Eventos / Escape Rooms</option>
                          <option value="Guisos Bajo Demanda">Guisos Bajo Demanda</option>
                          <option value="Patrocinios / Otros">Patrocinios / Otros</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400">
                    {movTipo === 'GASTO' ? 'Proveedor / Acreedor *' : 'Cliente / Tercero *'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Distribuidora Bebidas S.L. o Endesa"
                    value={movTercero}
                    onChange={(e) => setMovTercero(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs font-bold text-white mt-1"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400">Concepto / Descripción *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Factura café especialidad mes noviembre"
                    value={movConcepto}
                    onChange={(e) => setMovConcepto(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs font-bold text-white mt-1"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400">Nº Factura / Ticket</label>
                    <input
                      type="text"
                      placeholder="Ej: F-2026/982"
                      value={movNumeroFactura}
                      onChange={(e) => setMovNumeroFactura(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs font-mono font-bold text-cyan-300 mt-1 uppercase"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400">Tipo IVA</label>
                    <select
                      value={movTipoIva}
                      onChange={(e) => {
                        const nuevoIva = Number(e.target.value);
                        setMovTipoIva(nuevoIva);
                        handleCalculoMonto(
                          movModoCalculo === 'inverso' ? 'total' : 'base',
                          movModoCalculo === 'inverso' ? movTotal : movBase,
                          nuevoIva,
                          movModoCalculo
                        );
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs font-bold text-white mt-1"
                    >
                      <option value={21}>21% (General / Suministros)</option>
                      <option value={10}>10% (Hostelería / Alimentación)</option>
                      <option value={4}>4% (Superreducido)</option>
                      <option value={0}>0% (Exento)</option>
                    </select>
                  </div>
                </div>

                {/* SELECTOR MODO DE CÁLCULO DIRECTO VS INVERSO */}
                <div className="bg-slate-900/80 p-2.5 rounded-2xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400">Modo de Introducción:</span>
                    <div className="flex gap-1 text-[10px]">
                      <button
                        type="button"
                        onClick={() => setMovModoCalculo('inverso')}
                        className={`px-2 py-0.5 rounded-md font-bold cursor-pointer ${
                          movModoCalculo === 'inverso' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Total con IVA (Inverso)
                      </button>
                      <button
                        type="button"
                        onClick={() => setMovModoCalculo('directo')}
                        className={`px-2 py-0.5 rounded-md font-bold cursor-pointer ${
                          movModoCalculo === 'directo' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Base Imponible
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[9px] font-black uppercase text-slate-400">Base (€)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={movBase}
                        onChange={(e) => handleCalculoMonto('base', e.target.value, movTipoIva, 'directo')}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs font-mono font-bold text-white mt-0.5"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-black uppercase text-slate-400">Cuota IVA (€)</label>
                      <input
                        type="number"
                        step="0.01"
                        readOnly
                        placeholder="0.00"
                        value={movCuotaIva}
                        className="w-full bg-slate-950/50 border border-slate-800 rounded-xl p-2 text-xs font-mono font-bold text-slate-400 mt-0.5"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-black uppercase text-cyan-400">Total (€) *</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        placeholder="0.00"
                        value={movTotal}
                        onChange={(e) => handleCalculoMonto('total', e.target.value, movTipoIva, 'inverso')}
                        className="w-full bg-slate-950 border border-cyan-500/40 rounded-xl p-2 text-xs font-mono font-black text-cyan-300 mt-0.5"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400">Método de Pago</label>
                    <select
                      value={movMetodoPago}
                      onChange={(e) => setMovMetodoPago(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs font-bold text-white mt-1"
                    >
                      <option value="transferencia">Transferencia Bancaria</option>
                      <option value="tarjeta">Tarjeta Bancaria</option>
                      <option value="efectivo">Efectivo</option>
                      <option value="domiciliacion">Domiciliación Recibo</option>
                      <option value="bizum">Bizum</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400">Estado</label>
                    <select
                      value={movPagado ? 'si' : 'no'}
                      onChange={(e) => setMovPagado(e.target.value === 'si')}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs font-bold text-white mt-1"
                    >
                      <option value="si">Pagado / Cobrado</option>
                      <option value="no">Pendiente de Pago</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 flex items-center justify-between">
                    <span>Adjunto Factura / Ticket (PDF o Imagen)</span>
                    <span className="text-[9px] text-slate-500 font-normal">Bucket: facturas_gastos</span>
                  </label>
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    onChange={(e) => setMovArchivo(e.target.files?.[0] || null)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs font-medium text-slate-300 mt-1 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[10px] file:font-black file:bg-indigo-600 file:text-white cursor-pointer"
                  />
                </div>

                <button
                  type="submit"
                  disabled={guardandoMovimiento}
                  className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg"
                >
                  {guardandoMovimiento ? 'Guardando Apunte...' : '💾 Registrar Apunte Contable'}
                </button>
              </form>

              {/* TABLA FILTRABLE DE MOVIMIENTOS */}
              <div className="lg:col-span-8 bg-[#0f172a] border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-white">Libro Diario de Movimientos</h3>
                    <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-xs font-bold font-mono">
                      {movimientosGenerales.length}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="text"
                      placeholder="Buscar por concepto, tercero o nº..."
                      value={busquedaMov}
                      onChange={(e) => setBusquedaMov(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none w-48"
                    />

                    <select
                      value={filtroTipoMov}
                      onChange={(e) => setFiltroTipoMov(e.target.value as any)}
                      className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-300"
                    >
                      <option value="TODOS">Todos (Tipo)</option>
                      <option value="INGRESO">Solo Ingresos</option>
                      <option value="GASTO">Solo Gastos</option>
                    </select>

                    <select
                      value={filtroCategoriaMov}
                      onChange={(e) => setFiltroCategoriaMov(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-300"
                    >
                      <option value="TODAS">Todas las Categorías</option>
                      {Array.from(new Set(movimientosGenerales.map((m) => m.categoria)))
                        .filter(Boolean)
                        .map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                    </select>

                    <select
                      value={filtroEstadoMov}
                      onChange={(e) => setFiltroEstadoMov(e.target.value as any)}
                      className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-300"
                    >
                      <option value="TODOS">Todos (Estado)</option>
                      <option value="pagado">Pagados</option>
                      <option value="pendiente">Pendientes</option>
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] font-black">
                        <th className="p-3">Fecha</th>
                        <th className="p-3">Tipo</th>
                        <th className="p-3">Nº Factura</th>
                        <th className="p-3">Tercero / Concepto</th>
                        <th className="p-3 text-right">Base</th>
                        <th className="p-3 text-center">IVA</th>
                        <th className="p-3 text-right">Total</th>
                        <th className="p-3 text-center">Estado</th>
                        <th className="p-3 text-center">Adjunto</th>
                        <th className="p-3 text-center">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-medium">
                      {cargandoMovimientos ? (
                        <tr>
                          <td colSpan={10} className="p-8 text-center text-slate-500">
                            Cargando movimientos contables...
                          </td>
                        </tr>
                      ) : movimientosGenerales.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="p-8 text-center text-slate-500">
                            No hay movimientos registrados en este periodo. Puedes añadir uno manual o sincronizar los cierres de caja.
                          </td>
                        </tr>
                      ) : (
                        movimientosGenerales
                          .filter((m) => {
                            if (filtroTipoMov !== 'TODOS' && m.tipo !== filtroTipoMov) return false;
                            if (filtroCategoriaMov !== 'TODAS' && m.categoria !== filtroCategoriaMov) return false;
                            if (filtroEstadoMov === 'pagado' && !m.pagado) return false;
                            if (filtroEstadoMov === 'pendiente' && m.pagado) return false;
                            if (busquedaMov.trim()) {
                              const q = busquedaMov.toLowerCase();
                              const coincide =
                                String(m.concepto || '').toLowerCase().includes(q) ||
                                String(m.tercero || '').toLowerCase().includes(q) ||
                                String(m.numero_factura || '').toLowerCase().includes(q) ||
                                String(m.categoria || '').toLowerCase().includes(q);
                              if (!coincide) return false;
                            }
                            return true;
                          })
                          .map((m) => (
                            <tr key={m.id} className="hover:bg-slate-800/30 transition-colors">
                              <td className="p-3 text-slate-300 font-mono text-[11px] whitespace-nowrap">
                                {m.fecha}
                              </td>
                              <td className="p-3">
                                <span
                                  className={`px-2 py-0.5 rounded-md font-black text-[10px] border ${
                                    m.tipo === 'INGRESO'
                                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                      : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                                  }`}
                                >
                                  {m.tipo}
                                </span>
                              </td>
                              <td className="p-3 font-mono text-cyan-300 font-bold text-[11px]">
                                {m.numero_factura || '-'}
                              </td>
                              <td className="p-3">
                                <span className="font-bold text-white block truncate max-w-xs">{m.tercero}</span>
                                <span className="text-[10px] text-slate-400 block truncate max-w-xs">{m.concepto}</span>
                                <span className="text-[9px] text-indigo-400 block uppercase font-semibold">{m.categoria}</span>
                              </td>
                              <td className="p-3 text-right font-mono text-slate-300">
                                {Number(m.base_imponible || 0).toFixed(2)} €
                              </td>
                              <td className="p-3 text-center font-mono text-slate-400 text-[11px]">
                                {Number(m.tipo_iva || 0)}%
                              </td>
                              <td
                                className={`p-3 text-right font-mono font-black text-xs ${
                                  m.tipo === 'INGRESO' ? 'text-emerald-400' : 'text-rose-400'
                                }`}
                              >
                                {Number(m.total || 0).toFixed(2)} €
                              </td>
                              <td className="p-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => alternarEstadoPagoMovimiento(m)}
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-black cursor-pointer transition-all ${
                                    m.pagado
                                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  }`}
                                  title="Pulsa para alternar estado de pago"
                                >
                                  {m.pagado ? 'Pagado' : 'Pendiente'}
                                </button>
                              </td>
                              <td className="p-3 text-center">
                                {m.adjunto_url ? (
                                  <a
                                    href={m.adjunto_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 text-[11px] font-bold"
                                    title="Ver adjunto en Supabase Storage"
                                  >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                  </a>
                                ) : (
                                  <span className="text-slate-600">-</span>
                                )}
                              </td>
                              <td className="p-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => eliminarMovimientoGeneral(m.id)}
                                  className="text-slate-500 hover:text-rose-400 p-1 rounded transition-colors cursor-pointer"
                                  title="Eliminar apunte"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= PESTAÑA 5: EMPLEADOS, HORARIOS Y FICHAJES UNIFICADOS ================= */}
        {tabActiva === 'empleados' && (
          <div className="space-y-6 animate-fade-in">
            {/* SUB-NAVEGACIÓN PLANTILLA VS FICHAJES */}
            <div className="flex items-center justify-between bg-[#0f172a] border border-slate-800 rounded-3xl p-4 flex-wrap gap-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSubtabEmpleados('plantilla')}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                    subtabEmpleados === 'plantilla'
                      ? 'bg-indigo-600 text-white shadow-lg'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  👥 Plantilla y Horarios ({empleados.length})
                </button>
                <button
                  type="button"
                  onClick={() => { setSubtabEmpleados('fichajes'); cargarFichajes(); }}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                    subtabEmpleados === 'fichajes'
                      ? 'bg-indigo-600 text-white shadow-lg'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  ⏱️ Histórico de Fichajes y Registro de Jornada
                </button>
              </div>

              {subtabEmpleados === 'fichajes' && (
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setModalFichajeManual(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 text-xs font-bold transition-all cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Añadir Fichaje Manual</span>
                  </button>
                  <button
                    type="button"
                    onClick={lanzarInformeInspeccionLaboral}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-bold transition-all cursor-pointer"
                    title="Imprimir informe legal oficial de control horario para Inspección de Trabajo"
                  >
                    <Printer className="h-4 w-4" />
                    <span>🖨️ Informe Inspección (Print)</span>
                  </button>
                  <button
                    type="button"
                    onClick={exportarFichajesCsv}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-all cursor-pointer"
                  >
                    <Download className="h-4 w-4" />
                    <span>CSV</span>
                  </button>
                </div>
              )}
            </div>

            {/* SUB-VISTA 1: PLANTILLA Y HORARIOS */}
            {subtabEmpleados === 'plantilla' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* FORMULARIO ALTA Y EDICIÓN COMPLETA */}
                <form
                  onSubmit={guardarEmpleado}
                  className="lg:col-span-5 bg-[#0f172a] border border-slate-800 rounded-3xl p-6 space-y-4 self-start shadow-xl"
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <h3 className="text-base font-black text-white flex items-center gap-2">
                      {editandoEmpleado ? (
                        <>
                          <Edit className="h-4 w-4 text-cyan-400" />
                          <span>Editando Empleado: {editandoEmpleado.nombre}</span>
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 text-indigo-400" />
                          <span>Alta y Edición de Plantilla</span>
                        </>
                      )}
                    </h3>
                    {editandoEmpleado && (
                      <button
                        type="button"
                        onClick={limpiarFormEmpleado}
                        className="text-xs text-rose-400 hover:text-rose-300 font-bold"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400">Nombre *</label>
                      <input
                        type="text"
                        required
                        placeholder="Nombre de pila"
                        value={empNombre}
                        onChange={(e) => setEmpNombre(e.target.value)}
                        disabled={guardandoEmpleado}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs font-bold text-white mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400">Apellidos</label>
                      <input
                        type="text"
                        placeholder="Apellidos"
                        value={empApellidos}
                        onChange={(e) => setEmpApellidos(e.target.value)}
                        disabled={guardandoEmpleado}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs font-bold text-white mt-1"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400">DNI / NIE / CIF *</label>
                      <input
                        type="text"
                        required
                        placeholder="12345678X"
                        value={empDniNie}
                        onChange={(e) => setEmpDniNie(e.target.value)}
                        disabled={guardandoEmpleado}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs font-mono font-bold text-white mt-1 uppercase"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400">Teléfono</label>
                      <input
                        type="tel"
                        placeholder="600 000 000"
                        value={empTelefono}
                        onChange={(e) => setEmpTelefono(e.target.value)}
                        disabled={guardandoEmpleado}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs font-bold text-white mt-1"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400">Email Corporativo</label>
                      <input
                        type="email"
                        placeholder="empleado@nexus.es"
                        value={empEmail}
                        onChange={(e) => setEmpEmail(e.target.value)}
                        disabled={guardandoEmpleado}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs font-bold text-white mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400">Fecha de Alta</label>
                      <input
                        type="date"
                        value={empFechaAlta}
                        onChange={(e) => setEmpFechaAlta(e.target.value)}
                        disabled={guardandoEmpleado}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs font-bold text-white mt-1"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400">PIN Acceso (4 dígitos) *</label>
                      <input
                        type="password"
                        required
                        maxLength={4}
                        placeholder="••••"
                        value={empPin}
                        onChange={(e) => setEmpPin(e.target.value)}
                        disabled={guardandoEmpleado}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs font-black text-indigo-400 mt-1 font-mono tracking-widest text-center"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400">Rol Operativo *</label>
                      <select
                        value={empRol}
                        onChange={(e) => setEmpRol(e.target.value as any)}
                        disabled={guardandoEmpleado}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs font-bold text-white mt-1"
                      >
                        <option value="camarero">Camarero (Sala y Cobro)</option>
                        <option value="cocinero">Cocinero (KDS Cocina)</option>
                        <option value="encargado">Encargado (Descuentos y Arqueos)</option>
                        <option value="admin">Administrador General</option>
                      </select>
                    </div>
                  </div>

                  {/* CONFIGURACIÓN HORARIO Y TURNO PREVISTO */}
                  <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800 space-y-3">
                    <p className="text-[11px] font-black uppercase text-indigo-400 tracking-wider">
                      Turno y Horario Asignado
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400">Días Previstos</label>
                        <input
                          type="text"
                          placeholder="Ej: Lunes a Viernes"
                          value={empDiasTrabajo}
                          onChange={(e) => setEmpDiasTrabajo(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs font-bold text-white mt-0.5"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400">Franja Horaria Prevista</label>
                        <input
                          type="text"
                          placeholder="Ej: 08:00 - 16:00"
                          value={empHorarioAsignado}
                          onChange={(e) => setEmpHorarioAsignado(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs font-bold text-white mt-0.5"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400">Horas Semanales Contratadas</label>
                      <input
                        type="number"
                        min={1}
                        max={60}
                        value={empHorasSemanales}
                        onChange={(e) => setEmpHorasSemanales(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs font-bold text-white mt-0.5"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={guardandoEmpleado}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black py-3 rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg"
                  >
                    {guardandoEmpleado
                      ? 'Guardando...'
                      : editandoEmpleado
                      ? 'Actualizar Empleado'
                      : 'Guardar Nuevo Empleado'}
                  </button>
                </form>

                {/* LISTA Y TARJETAS DE PLANTILLA */}
                <div className="lg:col-span-7 bg-[#0f172a] border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <h3 className="text-base font-black text-white">Plantilla de Empleados ({empleados.length})</h3>
                    <span className="text-xs text-slate-400">Gestión de acceso y estado activo</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {empleados.map((emp) => (
                      <div
                        key={emp.id}
                        className={`border p-4 rounded-2xl flex flex-col justify-between space-y-3 transition-all ${
                          emp.activo
                            ? 'bg-slate-900 border-slate-800'
                            : 'bg-slate-950/70 border-rose-900/30 opacity-75'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-black text-white text-sm">
                                {emp.nombre} {emp.apellidos || ''}
                              </p>
                              <p className="text-[11px] text-indigo-400 uppercase font-black tracking-wider mt-0.5">
                                {emp.rol} · PIN: {emp.pin_acceso || emp.codigo_pin}
                              </p>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                emp.activo
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                              }`}
                            >
                              {emp.activo ? 'Activo' : 'Inactivo'}
                            </span>
                          </div>

                          <div className="mt-3 space-y-1 text-slate-400 text-xs">
                            {emp.dni_nie && (
                              <p className="text-[11px]">
                                DNI/NIE: <strong className="text-slate-200 font-mono">{emp.dni_nie}</strong>
                              </p>
                            )}
                            {emp.telefono && <p className="text-[11px]">Tel: {emp.telefono}</p>}
                            {emp.email && <p className="text-[11px] truncate">Email: {emp.email}</p>}
                            <p className="text-[10px] text-cyan-300/80">
                              🕒 {emp.dias_trabajo || 'L-V'} ({emp.horario_asignado || '08:00 - 16:00'}) · {emp.horas_semanales || 40}h
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                          <button
                            type="button"
                            onClick={() => iniciarEdicionEmpleado(emp)}
                            className="flex-1 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Edit className="h-3.5 w-3.5" />
                            <span>Editar</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => alternarEstadoEmpleado(emp)}
                            className={`flex-1 py-1.5 rounded-xl font-black text-xs transition-colors cursor-pointer ${
                              emp.activo
                                ? 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30'
                                : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30'
                            }`}
                            title={emp.activo ? 'Desactivar acceso a este empleado' : 'Activar acceso a este empleado'}
                          >
                            {emp.activo ? 'Desactivar' : 'Activar'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* SUB-VISTA 2: HISTÓRICO DE FICHAJES Y CONTROL HORARIO */}
            {subtabEmpleados === 'fichajes' && (
              <div className="bg-[#0f172a] border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
                {/* FILTROS Y RESUMEN */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-xl">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Empleado:</span>
                      <select
                        value={filtroFichajeEmpleado}
                        onChange={(e) => setFiltroFichajeEmpleado(e.target.value)}
                        className="bg-transparent text-xs font-bold text-white outline-none cursor-pointer"
                      >
                        <option value="TODOS" className="bg-slate-900">Toda la Plantilla</option>
                        {empleados.map((emp) => (
                          <option key={emp.id} value={emp.id} className="bg-slate-900">
                            {emp.nombre} {emp.apellidos || ''} ({emp.rol})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-xl">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Desde:</span>
                      <input
                        type="date"
                        value={filtroFichajeDesde}
                        onChange={(e) => setFiltroFichajeDesde(e.target.value)}
                        className="bg-transparent text-xs font-bold text-white outline-none cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-xl">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Hasta:</span>
                      <input
                        type="date"
                        value={filtroFichajeHasta}
                        onChange={(e) => setFiltroFichajeHasta(e.target.value)}
                        className="bg-transparent text-xs font-bold text-white outline-none cursor-pointer"
                      />
                    </div>
                  </div>

                  <span className="text-xs text-slate-400 font-mono">
                    {fichajesHistorico.length} registros cargados
                  </span>
                </div>

                {/* TABLA DE FICHAJES */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] font-black">
                        <th className="p-3">Fecha y Hora</th>
                        <th className="p-3">Empleado</th>
                        <th className="p-3">DNI / NIE</th>
                        <th className="p-3">Tipo de Registro</th>
                        <th className="p-3">Observaciones / Auditoría</th>
                        <th className="p-3 text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-medium">
                      {cargandoFichajes ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-slate-500">
                            Cargando registros de jornada...
                          </td>
                        </tr>
                      ) : fichajesHistorico.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-slate-500">
                            No constan registros de fichaje para el periodo y empleado seleccionados.
                          </td>
                        </tr>
                      ) : (
                        fichajesHistorico.map((f) => {
                          const d = new Date(f.timestamp_fichaje);
                          const tipoColor =
                            f.tipo === 'entrada'
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : f.tipo === 'salida'
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                              : f.tipo === 'inicio_descanso'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';

                          const tipoLabel =
                            f.tipo === 'entrada'
                              ? '🟢 Entrada'
                              : f.tipo === 'salida'
                              ? '🔴 Salida'
                              : f.tipo === 'inicio_descanso'
                              ? '☕ Inicio Pausa'
                              : '▶️ Fin Pausa';

                          return (
                            <tr key={f.id} className="hover:bg-slate-800/30 transition-colors">
                              <td className="p-3 font-mono text-slate-200 text-[11px] whitespace-nowrap">
                                <span className="font-bold text-white block">{d.toLocaleDateString('es-ES')}</span>
                                <span className="text-slate-400 text-[10px]">
                                  {d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                </span>
                              </td>
                              <td className="p-3">
                                <span className="font-bold text-white">
                                  {f.empleados?.nombre || 'Empleado'} {f.empleados?.apellidos || ''}
                                </span>
                                <span className="text-[10px] text-indigo-400 block uppercase font-bold">
                                  {f.empleados?.rol || ''}
                                </span>
                              </td>
                              <td className="p-3 font-mono text-slate-300 text-[11px]">
                                {f.empleados?.dni_nie || '-'}
                              </td>
                              <td className="p-3">
                                <span className={`px-2.5 py-1 rounded-xl text-xs font-black border ${tipoColor}`}>
                                  {tipoLabel}
                                </span>
                              </td>
                              <td className="p-3">
                                <span className="text-slate-300 text-xs block">{f.notas || '-'}</span>
                                {f.modificado_por && (
                                  <span className="text-[10px] text-amber-400/90 italic block mt-0.5">
                                    Modificado por: {f.modificado_por} ({f.motivo_modificacion})
                                  </span>
                                )}
                              </td>
                              <td className="p-3 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const dt = new Date(f.timestamp_fichaje);
                                      setModalEditarFichaje({
                                        fichaje: f,
                                        fecha: dt.toISOString().split('T')[0],
                                        hora: dt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
                                        tipo: f.tipo,
                                        motivo: '',
                                        procesando: false
                                      });
                                    }}
                                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 transition-colors cursor-pointer"
                                    title="Modificar registro de jornada"
                                  >
                                    <Edit className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setModalEliminarFichaje({
                                        fichaje: f,
                                        motivo: '',
                                        procesando: false
                                      })
                                    }
                                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/50 text-rose-400 transition-colors cursor-pointer"
                                    title="Eliminar registro erróneo"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= PESTAÑA 6: CONFIGURACIÓN FISCAL ================= */}
        {tabActiva === 'configuracion' && (
          <form
            onSubmit={guardarConfiguracionFiscal}
            className="bg-[#0f172a] border border-slate-800 rounded-3xl p-6 max-w-2xl space-y-4"
          >
            <h3 className="text-lg font-black text-white">⚙️ Datos Fiscales del Emisor (VeriFactu / Facturación)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">Nombre Comercial</label>
                <input
                  type="text"
                  value={configFiscal.nombre_comercial}
                  onChange={(e) => setConfigFiscal({ ...configFiscal, nombre_comercial: e.target.value })}
                  disabled={guardandoConfigFiscal}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-bold text-white mt-1"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">Razón Social</label>
                <input
                  type="text"
                  value={configFiscal.razon_social}
                  onChange={(e) => setConfigFiscal({ ...configFiscal, razon_social: e.target.value })}
                  disabled={guardandoConfigFiscal}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-bold text-white mt-1"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">NIF / CIF</label>
                <input
                  type="text"
                  value={configFiscal.nif_cif}
                  onChange={(e) => setConfigFiscal({ ...configFiscal, nif_cif: e.target.value })}
                  disabled={guardandoConfigFiscal}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-bold text-white mt-1"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">Teléfono</label>
                <input
                  type="text"
                  value={configFiscal.telefono}
                  onChange={(e) => setConfigFiscal({ ...configFiscal, telefono: e.target.value })}
                  disabled={guardandoConfigFiscal}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-bold text-white mt-1"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-[10px] font-black uppercase text-slate-400">Dirección Fiscal</label>
                <input
                  type="text"
                  value={configFiscal.direccion_fiscal}
                  onChange={(e) => setConfigFiscal({ ...configFiscal, direccion_fiscal: e.target.value })}
                  disabled={guardandoConfigFiscal}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-bold text-white mt-1"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={guardandoConfigFiscal}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black px-6 py-3 rounded-xl text-xs uppercase"
            >
              {guardandoConfigFiscal ? 'Guardando...' : '💾 Guardar Configuración Fiscal'}
            </button>
          </form>
        )}

        {/* ================= PESTAÑA 7: GUISOS BAJO DEMANDA / PREVENTA ================= */}
        {tabActiva === 'guisos' && (
          <GuisosAdminPanel articulosCatalogo={articulosMaestro} notificar={notificar} />
        )}

        {/* ================= PESTAÑA 8: MESAS Y RESERVAS ================= */}
        {tabActiva === 'mesas' && (
          <MesasReservasPanel notificar={notificar} />
        )}
      </main>

      {/* ================= MODAL ELABORACIÓN INTERNA DE PRODUCTO / LOTE ================= */}
      {modalElaboracion && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={confirmarElaboracionLote}
            className="bg-[#0f172a] border border-amber-500/40 rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl"
          >
            <h3 className="text-lg font-black text-amber-400">👨‍🍳 Elaborar Producto Compuesto / Lote</h3>
            <p className="text-xs text-slate-300">
              Selecciona las materias primas utilizadas y el producto resultante para descontar ingredientes y sumar el producto elaborado automáticamente.
            </p>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="text-[10px] font-black uppercase text-slate-400">Producto Resultante</label>
                <select
                  value={modalElaboracion.articuloDestinoId}
                  onChange={(e) =>
                    setModalElaboracion({ ...modalElaboracion, articuloDestinoId: e.target.value })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs font-bold text-white mt-1"
                >
                  <option value="">Elegir producto elaborado...</option>
                  {articulosMaestro.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nombre} ({a.unidad_medida})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">Cant. Obtenida</label>
                <input
                  type="number"
                  step="0.01"
                  value={modalElaboracion.cantidadResultante}
                  onChange={(e) =>
                    setModalElaboracion({ ...modalElaboracion, cantidadResultante: e.target.value })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs font-bold text-emerald-400 mt-1"
                />
              </div>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-3">
              <label className="text-[10px] font-black uppercase text-amber-300">
                Añadir Materias Primas Consumidas
              </label>
              <div className="grid grid-cols-12 gap-2">
                <select
                  value={elabIngSelId}
                  onChange={(e) => setElabIngSelId(e.target.value)}
                  className="col-span-6 bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                >
                  <option value="">Materia prima...</option>
                  {articulosMaestro.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nombre} (Stock: {a.stock_actual} {a.unidad_medida})
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.01"
                  value={elabIngCant}
                  onChange={(e) => setElabIngCant(e.target.value)}
                  className="col-span-2 bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                />
                <select
                  value={elabIngUnidad}
                  onChange={(e) => setElabIngUnidad(e.target.value as UnidadMedida)}
                  className="col-span-2 bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                >
                  <option value="ud">ud</option>
                  <option value="g">g</option>
                  <option value="kg">kg</option>
                  <option value="ml">ml</option>
                  <option value="l">l</option>
                </select>
                <button
                  type="button"
                  onClick={agregarIngredienteAElaboracion}
                  className="col-span-2 bg-amber-600 text-white font-black rounded-lg text-xs"
                >
                  +
                </button>
              </div>

              {modalElaboracion.ingredientesUsados.map((ing, i) => (
                <div key={i} className="flex justify-between items-center text-xs bg-slate-900 px-3 py-1.5 rounded-lg">
                  <span>
                    {ing.nombre} · {ing.cantidad} {ing.unidad_uso}
                  </span>
                  <button
                    type="button"
                    onClick={() => eliminarIngredienteElaboracion(i)}
                    className="text-rose-400 font-black"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalElaboracion(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={modalElaboracion.procesando}
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-black text-xs uppercase"
              >
                {modalElaboracion.procesando ? 'Procesando...' : 'Confirmar Elaboración'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ================= MODAL AJUSTE DE STOCK / MERMA / RECUENTO ================= */}
      {modalAjusteStock && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={procesarAjusteStock}
            className="bg-[#0f172a] border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4"
          >
            <h3 className="text-lg font-black text-white">
              {modalAjusteStock.tipo === 'MERMA' ? '🗑️ Registrar Merma' : '📋 Recuento Físico de Stock'}
            </h3>
            <p className="text-xs text-slate-300">
              Artículo: <strong>{modalAjusteStock.articulo.nombre}</strong> (Actual:{' '}
              {modalAjusteStock.articulo.stock_actual} {modalAjusteStock.articulo.unidad_medida})
            </p>
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400">
                {modalAjusteStock.tipo === 'MERMA' ? 'Cantidad a descontar' : 'Stock real contado físicamente'}
              </label>
              <input
                type="number"
                step="0.01"
                value={modalAjusteStock.cantidad}
                onChange={(e) => setModalAjusteStock({ ...modalAjusteStock, cantidad: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm font-black text-white mt-1"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400">Motivo / Observación</label>
              <input
                type="text"
                value={modalAjusteStock.motivo}
                onChange={(e) => setModalAjusteStock({ ...modalAjusteStock, motivo: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-bold text-white mt-1"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalAjusteStock(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={modalAjusteStock.procesando}
                className="px-5 py-2 rounded-xl bg-indigo-600 disabled:opacity-50 text-white text-xs font-black uppercase"
              >
                {modalAjusteStock.procesando ? 'Guardando...' : 'Aplicar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ================= MODAL CIERRE DE CAJA (Z) ================= */}
      {modalCierreZ && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-rose-500/40 rounded-3xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-black text-white">🔒 Arqueo Ciego y Cierre de Caja (Z)</h3>
            <div className="bg-slate-950 p-4 rounded-2xl space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Fondo Inicial:</span>
                <span className="font-bold">{modalCierreZ.fondoInicial.toFixed(2)}€</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Ventas Efectivo:</span>
                <span className="font-bold text-emerald-400">+{modalCierreZ.ventasEfectivo.toFixed(2)}€</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Entradas / Retiradas Manuales:</span>
                <span className="font-bold">
                  +{(modalCierreZ.entradasManuales + modalCierreZ.cambiosMetodos).toFixed(2)}€ / -
                  {modalCierreZ.salidasManuales.toFixed(2)}€
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-800 pt-2 text-sm font-black text-amber-400">
                <span>Efectivo Esperado en Cajón:</span>
                <span>{modalCierreZ.efectivoEsperado.toFixed(2)}€</span>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-slate-400">
                Efectivo Real Contado en Cajón (€)
              </label>
              <input
                type="number"
                step="0.01"
                value={modalCierreZ.efectivoRealInput}
                onChange={(e) => setModalCierreZ({ ...modalCierreZ, efectivoRealInput: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-lg font-black text-white mt-1"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setModalCierreZ(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarCerrarCajaZ}
                disabled={modalCierreZ.procesando}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-black text-xs uppercase"
              >
                {modalCierreZ.procesando ? 'Cerrando...' : 'Confirmar Cierre e Imprimir Z'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL FACTURA RECTIFICATIVA ================= */}
      {modalRectificativa && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={confirmarFacturaRectificativa}
            className="bg-[#0f172a] border border-rose-500/40 rounded-3xl p-6 max-w-md w-full space-y-4"
          >
            <h3 className="text-lg font-black text-rose-400">
              ↩️ Emitir Factura Rectificativa de {modalRectificativa.factura.numero_completo}
            </h3>
            <p className="text-xs text-slate-300">
              Se emitirá un documento serie R con importe negativo y se devolverá el stock de los artículos al almacén.
            </p>
            <input
              type="text"
              required
              placeholder="Motivo legal de la devolución / rectificación..."
              value={modalRectificativa.motivo}
              onChange={(e) => setModalRectificativa({ ...modalRectificativa, motivo: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-bold text-white"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalRectificativa(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={modalRectificativa.procesando}
                className="px-5 py-2 rounded-xl bg-rose-600 disabled:opacity-50 text-white text-xs font-black uppercase"
              >
                {modalRectificativa.procesando ? 'Emitiendo...' : 'Emitir Rectificativa'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ================= MODAL FACTURA NOMINATIVA ================= */}
      {modalFacturaNominativa && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={confirmarFacturaNominativa}
            className="bg-[#0f172a] border border-indigo-500/40 rounded-3xl p-6 max-w-md w-full space-y-4"
          >
            <h3 className="text-lg font-black text-indigo-400">
              🏢 Emitir Factura Nominativa (Canje de {modalFacturaNominativa.factura.numero_completo})
            </h3>
            <input
              type="text"
              required
              placeholder="Razón Social o Nombre Completo *"
              value={modalFacturaNominativa.razonSocial}
              onChange={(e) =>
                setModalFacturaNominativa({ ...modalFacturaNominativa, razonSocial: e.target.value })
              }
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-bold text-white"
            />
            <input
              type="text"
              required
              placeholder="NIF / CIF / NIE *"
              value={modalFacturaNominativa.nifCif}
              onChange={(e) => setModalFacturaNominativa({ ...modalFacturaNominativa, nifCif: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-bold text-white"
            />
            <input
              type="text"
              placeholder="Domicilio Fiscal completo"
              value={modalFacturaNominativa.direccion}
              onChange={(e) =>
                setModalFacturaNominativa({ ...modalFacturaNominativa, direccion: e.target.value })
              }
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-bold text-white"
            />
            <input
              type="email"
              placeholder="Email del cliente (opcional para envío de ticket)"
              value={modalFacturaNominativa.email || ''}
              onChange={(e) =>
                setModalFacturaNominativa({ ...modalFacturaNominativa, email: e.target.value })
              }
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-bold text-white"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalFacturaNominativa(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={modalFacturaNominativa.procesando}
                className="px-5 py-2 rounded-xl bg-indigo-600 disabled:opacity-50 text-white text-xs font-black uppercase"
              >
                {modalFacturaNominativa.procesando ? 'Generando...' : 'Emitir e Imprimir'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ================= MODAL AÑADIR FICHAJE MANUAL ================= */}
      {modalFichajeManual && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={guardarFichajeManual}
            className="bg-[#0f172a] border border-cyan-500/40 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-cyan-400 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>Añadir Fichaje Manual</span>
              </h3>
              <button
                type="button"
                onClick={() => setModalFichajeManual(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-slate-400">Empleado *</label>
              <select
                required
                value={manualEmpId}
                onChange={(e) => setManualEmpId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs font-bold text-white mt-1"
              >
                <option value="">-- Selecciona el empleado --</option>
                {empleados.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.nombre} {emp.apellidos || ''} ({emp.dni_nie || emp.rol})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">Fecha *</label>
                <input
                  type="date"
                  required
                  value={manualFecha}
                  onChange={(e) => setManualFecha(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs font-bold text-white mt-1"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">Hora (HH:mm) *</label>
                <input
                  type="time"
                  required
                  value={manualHora}
                  onChange={(e) => setManualHora(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs font-mono font-bold text-white mt-1"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-slate-400">Tipo de Registro *</label>
              <select
                value={manualTipo}
                onChange={(e) => setManualTipo(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs font-bold text-white mt-1"
              >
                <option value="entrada">🟢 Entrada al turno</option>
                <option value="inicio_descanso">☕ Inicio de Pausa / Café</option>
                <option value="fin_descanso">▶️ Fin de Pausa / Regreso al turno</option>
                <option value="salida">🔴 Salida del turno</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-slate-400">
                Motivo / Justificación del Fichaje Manual *
              </label>
              <input
                type="text"
                required
                placeholder="Ej: Olvido de fichaje al ingresar, confirmado por encargado"
                value={manualMotivo}
                onChange={(e) => setManualMotivo(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs font-bold text-white mt-1"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setModalFichajeManual(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardandoFichajeManual}
                className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-slate-950 font-black text-xs uppercase"
              >
                {guardandoFichajeManual ? 'Registrando...' : 'Registrar Fichaje'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ================= MODAL EDITAR FICHAJE ================= */}
      {modalEditarFichaje && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={confirmarEditarFichaje}
            className="bg-[#0f172a] border border-indigo-500/40 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-indigo-400 flex items-center gap-2">
                <Edit className="h-4 w-4" />
                <span>Modificar Registro de Jornada</span>
              </h3>
              <button
                type="button"
                onClick={() => setModalEditarFichaje(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Empleado:{' '}
              <strong className="text-white">
                {modalEditarFichaje.fichaje.empleados?.nombre} {modalEditarFichaje.fichaje.empleados?.apellidos || ''}
              </strong>
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">Fecha *</label>
                <input
                  type="date"
                  required
                  value={modalEditarFichaje.fecha}
                  onChange={(e) => setModalEditarFichaje({ ...modalEditarFichaje, fecha: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs font-bold text-white mt-1"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">Hora (HH:mm) *</label>
                <input
                  type="time"
                  required
                  value={modalEditarFichaje.hora}
                  onChange={(e) => setModalEditarFichaje({ ...modalEditarFichaje, hora: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs font-mono font-bold text-white mt-1"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-slate-400">Tipo de Registro *</label>
              <select
                value={modalEditarFichaje.tipo}
                onChange={(e) => setModalEditarFichaje({ ...modalEditarFichaje, tipo: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs font-bold text-white mt-1"
              >
                <option value="entrada">🟢 Entrada</option>
                <option value="inicio_descanso">☕ Inicio de Pausa</option>
                <option value="fin_descanso">▶️ Fin de Pausa</option>
                <option value="salida">🔴 Salida</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-slate-400">
                Motivo de la Corrección (Obligatorio por ley para traza de auditoría) *
              </label>
              <input
                type="text"
                required
                placeholder="Ej: Corrección de hora por error en marcaje"
                value={modalEditarFichaje.motivo}
                onChange={(e) => setModalEditarFichaje({ ...modalEditarFichaje, motivo: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs font-bold text-white mt-1"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setModalEditarFichaje(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={modalEditarFichaje.procesando}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black text-xs uppercase"
              >
                {modalEditarFichaje.procesando ? 'Guardando...' : 'Guardar Corrección'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ================= MODAL ELIMINAR FICHAJE ================= */}
      {modalEliminarFichaje && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={confirmarEliminarFichaje}
            className="bg-[#0f172a] border border-rose-500/40 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-rose-400 flex items-center gap-2">
                <Trash2 className="h-4 w-4" />
                <span>Confirmar Eliminación de Fichaje</span>
              </h3>
              <button
                type="button"
                onClick={() => setModalEliminarFichaje(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="bg-rose-950/20 border border-rose-900/40 rounded-2xl p-3 text-xs text-rose-300">
              <p>
                Vas a eliminar el registro de <strong>{modalEliminarFichaje.fichaje.tipo}</strong> del empleado{' '}
                <strong>
                  {modalEliminarFichaje.fichaje.empleados?.nombre} {modalEliminarFichaje.fichaje.empleados?.apellidos || ''}
                </strong>{' '}
                del {new Date(modalEliminarFichaje.fichaje.timestamp_fichaje).toLocaleString('es-ES')}.
              </p>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-slate-400">
                Motivo de la Eliminación (Obligatorio para auditoría) *
              </label>
              <input
                type="text"
                required
                placeholder="Ej: Registro duplicado por error de pulsación"
                value={modalEliminarFichaje.motivo}
                onChange={(e) => setModalEliminarFichaje({ ...modalEliminarFichaje, motivo: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs font-bold text-white mt-1"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setModalEliminarFichaje(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={modalEliminarFichaje.procesando}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-black text-xs uppercase"
              >
                {modalEliminarFichaje.procesando ? 'Eliminando...' : 'Eliminar Registro'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
