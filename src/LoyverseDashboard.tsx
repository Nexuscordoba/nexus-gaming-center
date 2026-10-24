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
  TrendingUp,
  DollarSign,
  CreditCard,
  Wallet,
  ArrowLeft,
  CheckCircle2,
  Receipt,
  Package,
  BarChart3,
  Clock,
  Search,
  Users,
  Plus,
  Trash2,
  Edit3,
  FileSpreadsheet,
  FileText,
  Printer,
  ShieldAlert,
  ShoppingCart,
  Layers,
  Scale,
  Barcode,
  Image as ImageIcon,
  Save,
  Building2
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

export default function LoyverseDashboard({ onBack }: BackofficeProps) {
  const [adminVerificado, setAdminVerificado] = useState<{ nombre: string; rol: string } | null>(null);
  const [pinAdminLogin, setPinAdminLogin] = useState('');
  const [errorLoginAdmin, setErrorLoginAdmin] = useState('');

  const [pestanaActiva, setPestanaActiva] = useState<
    'ventas_dia' | 'historico_tickets' | 'articulos_escandallos' | 'inventario_compras' | 'datos_fiscales'
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

  const [mensajeAlerta, setMensajeAlerta] = useState<{ texto: string; tipo: 'ok' | 'error' } | null>(null);

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

  const [ingredienteSelId, setIngredienteSelId] = useState('');
  const [ingredienteCantidad, setIngredienteCantidad] = useState('1');
  const [ingredienteUnidadUso, setIngredienteUnidadUso] = useState<UnidadMedida>('g');
  const [ingredienteMerma, setIngredienteMerma] = useState('0');

  const [movimientosStock, setMovimientosStock] = useState<any[]>([]);
  const [compraArticuloId, setCompraArticuloId] = useState('');
  const [compraCantidad, setCompraCantidad] = useState('');
  const [compraCosteUnitario, setCompraCosteUnitario] = useState('');
  const [compraProveedor, setCompraProveedor] = useState('');
  const [compraAlbaran, setCompraAlbaran] = useState('');

  const notificar = (texto: string, tipo: 'ok' | 'error' = 'ok') => {
    setMensajeAlerta({ texto, tipo });
    setTimeout(() => setMensajeAlerta(null), 4500);
  };

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
      cargarMovimientosInventario()
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

  const cargarMovimientosInventario = async () => {
    const { data } = await supabase
      .from('movimientos_stock')
      .select('*, articulos_cafeteria(nombre, unidad_medida)')
      .order('created_at', { ascending: false })
      .limit(40);

    if (data) {
      setMovimientosStock(data);
    }
  };

  useEffect(() => {
    if (artEsCompuesto) {
      const sumaCosteEscandallo = lineasEscandallo.reduce((acc, l) => acc + l.coste_calculado, 0);
      setArtCosteUnitario(sumaCosteEscandallo.toFixed(4));
    }
  }, [artEsCompuesto, lineasEscandallo]);

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
      cargarMovimientosInventario();
    } catch (err: any) {
      notificar('Error al registrar la compra: ' + err.message, 'error');
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

  const margenBeneficioArticulo =
    parseFloat(artPrecioVenta) > 0
      ? (((parseFloat(artPrecioVenta) - parseFloat(artCosteUnitario)) / parseFloat(artPrecioVenta)) * 100).toFixed(1)
      : '0.0';

  return (
    <div className="min-h-screen bg-[#050609] text-slate-100 p-4 sm:p-6 flex flex-col justify-between font-sans">
      <header className="border-b border-white/10 pb-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 sticky top-0 bg-[#050609]/95 backdrop-blur-md z-30">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center">
            <TrendingUp className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black tracking-wide text-white">
              CAFETERÍA · BACKOFFICE ADMINISTRADOR
            </h1>
            <p className="text-xs text-slate-400">
              Admin activo: <strong className="text-cyan-400">{adminVerificado.nombre}</strong> · Cumplimiento RD 1619/2012 y Ley 11/2021
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => (onBack ? onBack() : (window.location.hash = ''))}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-bold text-white cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Volver a TPV Cafetería</span>
          </button>
        </div>
      </header>

      <div className="max-w-7xl w-full mx-auto mb-6 flex flex-wrap gap-2 border-b border-white/10 pb-4">
        <button
          onClick={() => setPestanaActiva('ventas_dia')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            pestanaActiva === 'ventas_dia' ? 'bg-cyan-500 text-slate-950 shadow-md' : 'bg-white/5 text-slate-400 hover:text-white'
          }`}
        >
          <BarChart3 className="h-4 w-4" /> Ventas del Día, Vendedores y Cuadre Caja
        </button>

        <button
          onClick={() => setPestanaActiva('historico_tickets')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            pestanaActiva === 'historico_tickets' ? 'bg-cyan-500 text-slate-950 shadow-md' : 'bg-white/5 text-slate-400 hover:text-white'
          }`}
        >
          <Receipt className="h-4 w-4" /> Histórico de Tickets (PDF / Excel)
        </button>

        <button
          onClick={() => setPestanaActiva('articulos_escandallos')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            pestanaActiva === 'articulos_escandallos' ? 'bg-cyan-500 text-slate-950 shadow-md' : 'bg-white/5 text-slate-400 hover:text-white'
          }`}
        >
          <Layers className="h-4 w-4" /> Creación de Artículos y Escandallos
        </button>

        <button
          onClick={() => setPestanaActiva('inventario_compras')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            pestanaActiva === 'inventario_compras' ? 'bg-cyan-500 text-slate-950 shadow-md' : 'bg-white/5 text-slate-400 hover:text-white'
          }`}
        >
          <Package className="h-4 w-4" /> Inventario / Stock y Compras ({articulosMaestro.length})
        </button>

        <button
          onClick={() => setPestanaActiva('datos_fiscales')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            pestanaActiva === 'datos_fiscales' ? 'bg-cyan-500 text-slate-950 shadow-md' : 'bg-white/5 text-slate-400 hover:text-white'
          }`}
        >
          <Building2 className="h-4 w-4" /> Datos Fiscales Ticket & PIN
        </button>
      </div>

      <main className="flex-1 max-w-7xl w-full mx-auto space-y-6 pb-16">
        {mensajeAlerta && (
          <div
            className={`p-4 rounded-2xl border text-xs font-bold flex items-center gap-2 ${
              mensajeAlerta.tipo === 'ok'
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
            }`}
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{mensajeAlerta.texto}</span>
          </div>
        )}

        {pestanaActiva === 'ventas_dia' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-[#0d0f17] p-4 rounded-2xl border border-white/10">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-300 uppercase">Consultar Fecha:</span>
                <input
                  type="date"
                  value={fechaFiltroInicio}
                  onChange={(e) => {
                    setFechaFiltroInicio(e.target.value);
                    setFechaFiltroFin(e.target.value);
                  }}
                  className="bg-black/60 border border-white/20 rounded-xl px-3 py-1.5 text-xs text-white"
                />
              </div>
              <span className="text-xs text-slate-400">
                Operaciones registradas en el día seleccionado: <strong>{ticketsFiltrados.length}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-3xl bg-[#0d0f17] border border-white/10 space-y-1">
                <div className="flex justify-between text-xs text-slate-400 font-bold uppercase">
                  <span>Facturación Neta Día</span>
                  <TrendingUp className="h-4 w-4 text-cyan-400" />
                </div>
                <div className="text-2xl font-black text-white font-mono">{totalFacturadoPeriodo.toFixed(2)} €</div>
                <p className="text-[11px] text-slate-500">{ticketsFiltrados.length} documentos fiscales emitidos</p>
              </div>

              <div className="p-5 rounded-3xl bg-[#0d0f17] border border-white/10 space-y-1">
                <div className="flex justify-between text-xs text-slate-400 font-bold uppercase">
                  <span>Total Efectivo</span>
                  <DollarSign className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-black text-emerald-400 font-mono">{totalEfectivoPeriodo.toFixed(2)} €</div>
                <p className="text-[11px] text-slate-500">Cobros netos en metálico</p>
              </div>

              <div className="p-5 rounded-3xl bg-[#0d0f17] border border-white/10 space-y-1">
                <div className="flex justify-between text-xs text-slate-400 font-bold uppercase">
                  <span>Total Tarjeta</span>
                  <CreditCard className="h-4 w-4 text-sky-400" />
                </div>
                <div className="text-2xl font-black text-sky-400 font-mono">{totalTarjetaPeriodo.toFixed(2)} €</div>
                <p className="text-[11px] text-slate-500">Cobros por datáfono bancario</p>
              </div>

              <div className="p-5 rounded-3xl bg-[#0d0f17] border border-white/10 space-y-1">
                <div className="flex justify-between text-xs text-slate-400 font-bold uppercase">
                  <span>Ticket Medio</span>
                  <Wallet className="h-4 w-4 text-amber-400" />
                </div>
                <div className="text-2xl font-black text-amber-400 font-mono">{ticketMedioPeriodo.toFixed(2)} €</div>
                <p className="text-[11px] text-slate-500">Promedio por operación de venta</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="p-6 rounded-3xl bg-[#0d0f17] border border-white/10 space-y-4">
                <div className="flex items-center gap-2 text-amber-400 border-b border-white/10 pb-3">
                  <Users className="h-5 w-5" />
                  <h3 className="font-bold text-white text-sm">Ventas por Vendedor y Ticket Medio</h3>
                </div>
                {ventasPorVendedor.length === 0 ? (
                  <p className="text-xs text-slate-500 py-6 text-center">No hay ventas en esta fecha.</p>
                ) : (
                  <div className="space-y-2.5">
                    {ventasPorVendedor.map((v, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-white/5 text-xs"
                      >
                        <div>
                          <span className="font-black text-amber-400 mr-2">#{i + 1}</span>
                          <span className="font-bold text-white uppercase">{v.nombre}</span>
                          <span className="text-slate-400 ml-2">({v.operaciones} tickets)</span>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-black text-cyan-400 text-sm block">
                            {v.total.toFixed(2)} €
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            Ticket medio: {(v.total / Math.max(1, v.operaciones)).toFixed(2)} €
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-6 rounded-3xl bg-[#0d0f17] border border-white/10 space-y-4">
                <div className="flex items-center gap-2 text-cyan-400 border-b border-white/10 pb-3">
                  <Clock className="h-5 w-5" />
                  <h3 className="font-bold text-white text-sm">Distribución de Ventas por Horas</h3>
                </div>
                {ventasPorHora.length === 0 ? (
                  <p className="text-xs text-slate-500 py-6 text-center">Sin actividad horaria registrada.</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {ventasPorHora.map((h, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-black/40 border border-white/5 text-xs"
                      >
                        <span className="font-mono font-bold text-white bg-white/5 px-2.5 py-1 rounded-lg">
                          Tramo {h.hora}
                        </span>
                        <span className="text-slate-400">{h.operaciones} operaciones</span>
                        <span className="font-mono font-bold text-emerald-400">{h.total.toFixed(2)} €</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-[#0d0f17] border border-white/10 space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2 text-emerald-400">
                  <Wallet className="h-5 w-5" />
                  <h3 className="font-bold text-white text-sm">
                    Comprobación de Cuadres y Cierres de Caja de los Trabajadores
                  </h3>
                </div>
                {cajaHoy && (
                  <span className="text-xs font-mono text-amber-400">
                    Estado Caja Hoy: <strong>{String(cajaHoy.estado).toUpperCase()}</strong> | Fondo:{' '}
                    {Number(cajaHoy.remanente_apertura).toFixed(2)} €
                  </span>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/5 text-slate-400 uppercase">
                    <tr>
                      <th className="p-3">Fecha / Hora Cierre</th>
                      <th className="p-3">Trabajador</th>
                      <th className="p-3 text-right">Fondo Inicial</th>
                      <th className="p-3 text-right">Efectivo Sistema</th>
                      <th className="p-3 text-right">Tarjeta Sistema</th>
                      <th className="p-3 text-right">Esperado en Cajón</th>
                      <th className="p-3 text-right">Contado Trabajador</th>
                      <th className="p-3 text-right">Descuadre</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {cierresTrabajadores.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-6 text-center text-slate-500">
                          No hay cierres de turno registrados todavía.
                        </td>
                      </tr>
                    ) : (
                      cierresTrabajadores.map((c) => (
                        <tr key={c.id} className="hover:bg-white/[0.02]">
                          <td className="p-3">{new Date(c.fecha_cierre).toLocaleString('es-ES')}</td>
                          <td className="p-3 font-bold text-white">{c.usuario_nombre}</td>
                          <td className="p-3 text-right font-mono">{Number(c.fondo_inicial).toFixed(2)} €</td>
                          <td className="p-3 text-right font-mono text-emerald-400">
                            {Number(c.ventas_efectivo_sistema).toFixed(2)} €
                          </td>
                          <td className="p-3 text-right font-mono text-sky-400">
                            {Number(c.ventas_tarjeta_sistema).toFixed(2)} €
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-white">
                            {Number(c.efectivo_esperado_caja).toFixed(2)} €
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-amber-400">
                            {Number(c.efectivo_contado_trabajador).toFixed(2)} €
                          </td>
                          <td className="p-3 text-right font-mono font-black">
                            <span
                              className={`px-2 py-0.5 rounded ${
                                Math.abs(Number(c.descuadre_efectivo)) < 0.05
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : 'bg-rose-500/20 text-rose-400'
                              }`}
                            >
                              {Number(c.descuadre_efectivo).toFixed(2)} €
                            </span>
                          </td>
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
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block">Desde</label>
                  <input
                    type="date"
                    value={fechaFiltroInicio}
                    onChange={(e) => setFechaFiltroInicio(e.target.value)}
                    className="bg-black/60 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block">Hasta</label>
                  <input
                    type="date"
                    value={fechaFiltroFin}
                    onChange={(e) => setFechaFiltroFin(e.target.value)}
                    className="bg-black/60 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block">Serie Fiscal</label>
                  <select
                    value={filtroSerie}
                    onChange={(e) => setFiltroSerie(e.target.value)}
                    className="bg-black/60 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white"
                  >
                    <option value="TODAS">Todas (T, R, F)</option>
                    <option value="T">Serie T (Simplificadas)</option>
                    <option value="R">Serie R (Rectificativas)</option>
                    <option value="F">Serie F (Nominativas)</option>
                  </select>
                </div>
                <div className="relative">
                  <label className="text-[10px] uppercase font-bold text-slate-400 block">Buscar</label>
                  <input
                    type="text"
                    placeholder="Nº, NIF, Camarero..."
                    value={busquedaTicket}
                    onChange={(e) => setBusquedaTicket(e.target.value)}
                    className="bg-black/60 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => exportarTicketsAExcelCSV(ticketsFiltrados, 'libro_facturas_nexus')}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <FileSpreadsheet className="h-4 w-4" /> Exportar Excel (.CSV)
                </button>
                <button
                  type="button"
                  onClick={() => exportarTicketsAPDF(ticketsFiltrados, configFiscal)}
                  className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <FileText className="h-4 w-4" /> Exportar PDF Oficial
                </button>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[520px]">
              <table className="w-full text-left text-xs">
                <thead className="bg-white/5 text-slate-400 uppercase sticky top-0 backdrop-blur-md">
                  <tr>
                    <th className="p-3">Nº Oficial</th>
                    <th className="p-3">Tipo</th>
                    <th className="p-3">Fecha y Hora</th>
                    <th className="p-3">Mesa / Vendedor</th>
                    <th className="p-3">Pago</th>
                    <th className="p-3 text-right">Dto.</th>
                    <th className="p-3 text-right">Base Imp.</th>
                    <th className="p-3 text-right">IVA</th>
                    <th className="p-3 text-right">Total</th>
                    <th className="p-3">Huella SHA-256</th>
                    <th className="p-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {ticketsFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="p-8 text-center text-slate-500">
                        No hay documentos fiscales en el rango seleccionado.
                      </td>
                    </tr>
                  ) : (
                    ticketsFiltrados.map((t) => (
                      <tr key={t.id} className="hover:bg-white/[0.02]">
                        <td className="p-3 font-mono font-bold text-cyan-400">{t.numero_completo}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              t.serie === 'R'
                                ? 'bg-rose-500/20 text-rose-300'
                                : t.serie === 'F'
                                ? 'bg-purple-500/20 text-purple-300'
                                : 'bg-emerald-500/20 text-emerald-300'
                            }`}
                          >
                            {t.tipo_documento}
                          </span>
                        </td>
                        <td className="p-3">{new Date(t.fecha_expedicion).toLocaleString('es-ES')}</td>
                        <td className="p-3">
                          {t.mesa} · <strong>{t.vendedor_nombre}</strong>
                          {t.cliente_nif && (
                            <span className="block text-[10px] text-cyan-300">
                              Cliente: {t.cliente_nombre_razon} ({t.cliente_nif})
                            </span>
                          )}
                        </td>
                        <td className="p-3 uppercase font-bold">{t.metodo_pago}</td>
                        <td className="p-3 text-right font-mono text-amber-400">
                          {Number(t.descuento_total_importe || 0) > 0
                            ? `-${Number(t.descuento_total_importe).toFixed(2)} €`
                            : '-'}
                        </td>
                        <td className="p-3 text-right font-mono">{Number(t.base_imponible).toFixed(2)} €</td>
                        <td className="p-3 text-right font-mono">{Number(t.cuota_iva).toFixed(2)} €</td>
                        <td className="p-3 text-right font-mono font-black text-white">
                          {Number(t.total_final).toFixed(2)} €
                        </td>
                        <td className="p-3 font-mono text-[10px] text-slate-500">
                          {t.hash_actual ? `${t.hash_actual.slice(0, 12)}...` : ''}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => imprimirDocumentoFiscalHTML(t, configFiscal)}
                            className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Printer className="h-3.5 w-3.5" /> Imprimir
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {pestanaActiva === 'articulos_escandallos' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <form
              onSubmit={guardarYSincronizarArticulo}
              className="lg:col-span-7 p-6 rounded-3xl bg-[#0d0f17] border border-white/10 space-y-5"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="font-black text-white text-base">
                  {editandoArticuloId ? '✏️ Editando Artículo' : '➕ Crear Nuevo Artículo / Receta'}
                </h3>
                {editandoArticuloId && (
                  <button
                    type="button"
                    onClick={limpiarFormularioArticulo}
                    className="text-xs text-amber-400 hover:underline cursor-pointer"
                  >
                    Cancelar edición y crear nuevo
                  </button>
                )}
              </div>

              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2 text-xs">
                <span className="font-bold text-slate-300 block">Categorías Visuales Existentes (Pestañas TPV):</span>
                <div className="flex flex-wrap gap-1.5">
                  {categorias.map((cat) => (
                    <span
                      key={cat}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-black/50 border border-white/15 text-slate-200 font-bold text-xs"
                    >
                      {cat}
                      <button
                        type="button"
                        onClick={() => borrarCategoria(cat)}
                        className="text-rose-400 hover:text-rose-300 ml-1 p-0.5 cursor-pointer"
                        title={`Borrar categoría ${cat}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Nombre del Artículo *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Café con Leche / Tapa Salmorejo"
                    value={artNombre}
                    onChange={(e) => setArtNombre(e.target.value)}
                    className="w-full bg-black/60 border border-white/20 rounded-xl px-3.5 py-2.5 text-white font-bold"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-300 block mb-1">Categoría Visual (Pestaña TPV)</label>
                  <div className="flex gap-1.5">
                    <select
                      value={artCategoria}
                      onChange={(e) => setArtCategoria(e.target.value)}
                      className="flex-1 bg-black/60 border border-white/20 rounded-xl px-3 py-2.5 text-white"
                    >
                      {categorias.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="+ Nueva"
                      value={nuevaCategoriaInput}
                      onChange={(e) => setNuevaCategoriaInput(e.target.value)}
                      className="w-24 bg-black/60 border border-white/20 rounded-xl px-2 text-white"
                    />
                    <button
                      type="button"
                      onClick={crearNuevaCategoria}
                      className="px-2.5 rounded-xl bg-cyan-500 text-slate-950 font-bold cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-300 block mb-1">Destino KDS (Pantalla de Impresión)</label>
                  <select
                    value={artDestino}
                    onChange={(e) => setArtDestino(e.target.value as 'barra' | 'cocina')}
                    className="w-full bg-black/60 border border-cyan-500/40 rounded-xl px-3.5 py-2.5 text-cyan-300 font-bold"
                  >
                    <option value="barra">Barra</option>
                    <option value="cocina">Cocina</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-300 block mb-1">Unidad de Medida Base</label>
                  <select
                    value={artUnidadMedida}
                    onChange={(e) => setArtUnidadMedida(e.target.value as UnidadMedida)}
                    className="w-full bg-black/60 border border-amber-500/40 rounded-xl px-3.5 py-2.5 text-amber-300 font-bold"
                  >
                    <option value="ud">Unidad (ud)</option>
                    <option value="kg">Kilogramos (kg)</option>
                    <option value="g">Gramos (g)</option>
                    <option value="l">Litros (l)</option>
                    <option value="ml">Mililitros (ml)</option>
                    <option value="m">Metros (m)</option>
                    <option value="cm">Centímetros (cm)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-300 block mb-1">Código de Barras (EAN / SKU)</label>
                  <div className="relative">
                    <Barcode className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Escanea o escribe el código..."
                      value={artCodigoBarras}
                      onChange={(e) => setArtCodigoBarras(e.target.value)}
                      className="w-full bg-black/60 border border-white/20 rounded-xl pl-9 pr-3 py-2.5 text-white font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-300 block mb-1">Precio de Venta PVP con IVA (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={artPrecioVenta}
                    onChange={(e) => setArtPrecioVenta(e.target.value)}
                    className="w-full bg-black/60 border border-white/20 rounded-xl px-3.5 py-2.5 text-emerald-400 font-mono font-bold text-sm"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-300 block mb-1">
                    Coste por {artUnidadMedida} (€) {artEsCompuesto && '(Auto por Escandallo)'}
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    readOnly={artEsCompuesto}
                    value={artCosteUnitario}
                    onChange={(e) => setArtCosteUnitario(e.target.value)}
                    className="w-full bg-black/60 border border-white/20 rounded-xl px-3.5 py-2.5 text-amber-400 font-mono font-bold text-sm"
                  />
                  <span className="text-[10px] text-slate-400">Margen bruto estimado: {margenBeneficioArticulo}%</span>
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <label className="font-bold text-slate-300 block">Imagen del Producto (URL o Subir Archivo)</label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      placeholder="https://... o sube una foto desde tu equipo"
                      value={artImagenUrl}
                      onChange={(e) => setArtImagenUrl(e.target.value)}
                      className="flex-1 bg-black/60 border border-white/20 rounded-xl px-3.5 py-2 text-white"
                    />
                    <label className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold flex items-center gap-1.5 cursor-pointer shrink-0">
                      <ImageIcon className="h-4 w-4 text-cyan-400" /> Subir Foto
                      <input type="file" accept="image/*" onChange={manejarSubidaImagen} className="hidden" />
                    </label>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-2xl bg-black/40 border border-white/10 text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={artControlaStock}
                    onChange={(e) => setArtControlaStock(e.target.checked)}
                    className="h-4 w-4 accent-cyan-400"
                  />
                  <span className="font-bold text-white">Lleva Control de Stock</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={artEsCompuesto}
                    onChange={(e) => setArtEsCompuesto(e.target.checked)}
                    className="h-4 w-4 accent-amber-400"
                  />
                  <span className="font-bold text-amber-300">Compuesto (Con Escandallo)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={artVendibleTpv}
                    onChange={(e) => setArtVendibleTpv(e.target.checked)}
                    className="h-4 w-4 accent-emerald-400"
                  />
                  <span className="font-bold text-emerald-300">Visible en TPV / Carta</span>
                </label>
              </div>

              {artControlaStock && !artEsCompuesto && (
                <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-cyan-950/20 border border-cyan-500/30 text-xs">
                  <div>
                    <label className="font-bold text-cyan-300 block mb-1">
                      Stock Inicial / Actual ({artUnidadMedida})
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      value={artStockInicial}
                      onChange={(e) => setArtStockInicial(e.target.value)}
                      className="w-full bg-black/60 border border-white/20 rounded-xl px-3 py-2 text-white font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-300 block mb-1">Stock Mínimo Alerta</label>
                    <input
                      type="number"
                      step="0.001"
                      value={artStockMinimo}
                      onChange={(e) => setArtStockMinimo(e.target.value)}
                      className="w-full bg-black/60 border border-white/20 rounded-xl px-3 py-2 text-white font-mono"
                    />
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
                      <select
                        value={ingredienteSelId}
                        onChange={(e) => setIngredienteSelId(e.target.value)}
                        className="w-full bg-black/70 border border-white/20 rounded-xl px-2.5 py-2 text-white"
                      >
                        <option value="">-- Seleccionar ingrediente --</option>
                        {articulosMaestro
                          .filter((a) => a.id !== editandoArticuloId)
                          .map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.nombre} ({Number(a.coste_unitario).toFixed(2)}€/{a.unidad_medida})
                            </option>
                          ))}
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-[10px] text-slate-300 block mb-1">Cantidad</label>
                      <input
                        type="number"
                        step="0.001"
                        value={ingredienteCantidad}
                        onChange={(e) => setIngredienteCantidad(e.target.value)}
                        className="w-full bg-black/70 border border-white/20 rounded-xl px-2.5 py-2 text-white font-mono"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-[10px] text-slate-300 block mb-1">Unidad Receta</label>
                      <select
                        value={ingredienteUnidadUso}
                        onChange={(e) => setIngredienteUnidadUso(e.target.value as UnidadMedida)}
                        className="w-full bg-black/70 border border-white/20 rounded-xl px-2 py-2 text-amber-300 font-bold"
                      >
                        <option value="g">g (gramos)</option>
                        <option value="kg">kg (kilos)</option>
                        <option value="ml">ml (mililitros)</option>
                        <option value="l">l (litros)</option>
                        <option value="ud">ud (unidades)</option>
                        <option value="cm">cm</option>
                        <option value="m">m</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-[10px] text-slate-300 block mb-1">% Merma</label>
                      <input
                        type="number"
                        step="0.5"
                        value={ingredienteMerma}
                        onChange={(e) => setIngredienteMerma(e.target.value)}
                        className="w-full bg-black/70 border border-white/20 rounded-xl px-2 py-2 text-white font-mono"
                      />
                    </div>

                    <div className="sm:col-span-1">
                      <button
                        type="button"
                        onClick={agregarIngredienteAEscandallo}
                        className="w-full py-2 rounded-xl bg-amber-500 text-slate-950 font-black flex items-center justify-center cursor-pointer"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {lineasEscandallo.length > 0 && (
                    <div className="space-y-1.5 pt-2">
                      {lineasEscandallo.map((l, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between bg-black/50 px-3 py-2 rounded-xl border border-white/10"
                        >
                          <div>
                            <strong className="text-white">{l.nombre_ingrediente}</strong>:{' '}
                            <span className="text-amber-300 font-mono">
                              {l.cantidad} {l.unidad_uso}
                            </span>
                            {l.merma_porcentaje > 0 && (
                              <span className="text-slate-400 ml-1.5">(Merma: {l.merma_porcentaje}%)</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-bold text-emerald-400">
                              {l.coste_calculado.toFixed(4)} €
                            </span>
                            <button
                              type="button"
                              onClick={() => eliminarLineaEscandallo(idx)}
                              className="text-rose-400 hover:text-rose-300 cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg"
              >
                <Save className="h-4 w-4" />
                {editandoArticuloId
                  ? 'Guardar Cambios y Sincronizar en Supabase'
                  : 'Confirmar Creación y Sincronizar con TPV'}
              </button>
            </form>

            <div className="lg:col-span-5 p-6 rounded-3xl bg-[#0d0f17] border border-white/10 space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="font-bold text-white text-sm">Catálogo Sincronizado ({articulosMaestro.length})</h3>
                <div className="relative w-44">
                  <Search className="h-3.5 w-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="Buscar artículo..."
                    value={filtroArticulos}
                    onChange={(e) => setFiltroArticulos(e.target.value)}
                    className="w-full bg-black/60 border border-white/15 rounded-xl pl-8 pr-2.5 py-1.5 text-xs text-white"
                  />
                </div>
              </div>

              <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
                {articulosMaestro
                  .filter((a) => a.nombre.toLowerCase().includes(filtroArticulos.toLowerCase()))
                  .map((art) => (
                    <div
                      key={art.id}
                      className="p-3.5 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-3">
                        {art.imagen_url ? (
                          <img
                            src={art.imagen_url}
                            alt={art.nombre}
                            className="h-11 w-11 rounded-xl object-cover border border-white/10"
                          />
                        ) : (
                          <div className="h-11 w-11 rounded-xl bg-white/5 flex items-center justify-center text-slate-500">
                            <Package className="h-5 w-5" />
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-white flex items-center gap-1.5">
                            <span>{art.nombre}</span>
                            {art.es_compuesto && (
                              <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">
                                Escandallo
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Pestaña: <strong className="text-cyan-300">{art.categoria}</strong> · Destino:{' '}
                            <strong className="text-amber-300 uppercase">{art.destino || 'barra'}</strong> · PVP:{' '}
                            <strong className="text-emerald-400">{Number(art.precio_venta).toFixed(2)}€</strong>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => seleccionarArticuloParaEditar(art)}
                        className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-cyan-500 hover:text-slate-950 text-white font-bold flex items-center gap-1 cursor-pointer transition-all"
                      >
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
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <form
                onSubmit={registrarCompraMercancia}
                className="lg:col-span-5 p-6 rounded-3xl bg-[#0d0f17] border border-emerald-500/30 space-y-4 text-xs"
              >
                <div className="flex items-center gap-2 text-emerald-400 border-b border-white/10 pb-3">
                  <ShoppingCart className="h-5 w-5" />
                  <h3 className="font-black text-white text-sm">Registrar Compra y Sumar al Stock Real</h3>
                </div>

                <div>
                  <label className="font-bold text-slate-300 block mb-1">Seleccionar Artículo / Materia Prima *</label>
                  <select
                    required
                    value={compraArticuloId}
                    onChange={(e) => {
                      setCompraArticuloId(e.target.value);
                      const sel = articulosMaestro.find((a) => a.id === e.target.value);
                      if (sel) setCompraCosteUnitario(String(sel.coste_unitario || ''));
                    }}
                    className="w-full bg-black/60 border border-white/20 rounded-xl px-3.5 py-2.5 text-white"
                  >
                    <option value="">-- Elige artículo comprado --</option>
                    {articulosMaestro.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nombre} (Stock actual: {Number(a.stock_actual).toFixed(2)} {a.unidad_medida})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-emerald-400 block mb-1">Cantidad Comprada a Sumar *</label>
                    <input
                      type="number"
                      step="0.001"
                      required
                      placeholder="Ej: 10 o 2.500"
                      value={compraCantidad}
                      onChange={(e) => setCompraCantidad(e.target.value)}
                      className="w-full bg-black/60 border border-emerald-500/40 rounded-xl px-3.5 py-2.5 text-white font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-300 block mb-1">Coste Compra Unitario (€)</label>
                    <input
                      type="number"
                      step="0.0001"
                      placeholder="Coste por ud/kg/l"
                      value={compraCosteUnitario}
                      onChange={(e) => setCompraCosteUnitario(e.target.value)}
                      className="w-full bg-black/60 border border-white/20 rounded-xl px-3.5 py-2.5 text-amber-400 font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-300 block mb-1">Proveedor</label>
                    <input
                      type="text"
                      placeholder="Ej: Distribuciones Córdoba"
                      value={compraProveedor}
                      onChange={(e) => setCompraProveedor(e.target.value)}
                      className="w-full bg-black/60 border border-white/20 rounded-xl px-3.5 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-300 block mb-1">Nº Albarán / Factura</label>
                    <input
                      type="text"
                      placeholder="ALB-2026-..."
                      value={compraAlbaran}
                      onChange={(e) => setCompraAlbaran(e.target.value)}
                      className="w-full bg-black/60 border border-white/20 rounded-xl px-3.5 py-2 text-white font-mono"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black uppercase tracking-wider cursor-pointer shadow-lg"
                >
                  Añadir Compra y Sumar al Inventario
                </button>
              </form>

              <div className="lg:col-span-7 p-6 rounded-3xl bg-[#0d0f17] border border-white/10 space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <h3 className="font-bold text-white text-sm">Estado del Stock Real por Artículo</h3>
                  <span className="text-xs text-slate-400">
                    Valoración total en almacén:{' '}
                    <strong className="text-emerald-400 font-mono">
                      {articulosMaestro
                        .reduce((acc, a) => acc + Math.max(0, Number(a.stock_actual)) * Number(a.coste_unitario || 0), 0)
                        .toFixed(2)}{' '}
                      €
                    </strong>
                  </span>
                </div>

                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-white/5 text-slate-400 uppercase sticky top-0 backdrop-blur-md">
                      <tr>
                        <th className="p-2.5">Artículo</th>
                        <th className="p-2.5">Pestaña TPV</th>
                        <th className="p-2.5 text-right">Coste Unit.</th>
                        <th className="p-2.5 text-right">Stock Real Actual</th>
                        <th className="p-2.5 text-right">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {articulosMaestro.map((a) => {
                        const bajoMinimo = a.controla_stock && Number(a.stock_actual) <= Number(a.stock_minimo);
                        return (
                          <tr key={a.id} className="hover:bg-white/[0.02]">
                            <td className="p-2.5 font-bold text-white">{a.nombre}</td>
                            <td className="p-2.5 text-slate-400">{a.categoria}</td>
                            <td className="p-2.5 text-right font-mono">
                              {Number(a.coste_unitario).toFixed(3)} € / {a.unidad_medida}
                            </td>
                            <td className="p-2.5 text-right font-mono font-black text-sm text-cyan-400">
                              {a.es_compuesto
                                ? 'Por Escandallo'
                                : `${Number(a.stock_actual).toFixed(2)} ${a.unidad_medida}`}
                            </td>
                            <td className="p-2.5 text-right">
                              {a.es_compuesto ? (
                                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                                  Receta
                                </span>
                              ) : bajoMinimo ? (
                                <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 text-[10px] font-bold">
                                  ⚠️ Reponer
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                                  OK
                                </span>
                              )}
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
              <h3 className="font-bold text-white text-sm">Últimos Movimientos de Inventario (Compras, Ventas y Escandallos)</h3>
              <div className="overflow-x-auto max-h-60">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/5 text-slate-400 uppercase">
                    <tr>
                      <th className="p-2.5">Fecha</th>
                      <th className="p-2.5">Artículo</th>
                      <th className="p-2.5">Tipo</th>
                      <th className="p-2.5 text-right">Cantidad</th>
                      <th className="p-2.5">Proveedor / Albarán / Detalle</th>
                      <th className="p-2.5">Usuario</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {movimientosStock.map((m) => (
                      <tr key={m.id}>
                        <td className="p-2.5">{new Date(m.created_at).toLocaleString('es-ES')}</td>
                        <td className="p-2.5 font-bold text-white">{m.articulos_cafeteria?.nombre || '-'}</td>
                        <td className="p-2.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              Number(m.cantidad) >= 0
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-amber-500/20 text-amber-300'
                            }`}
                          >
                            {m.tipo_movimiento}
                          </span>
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold">
                          {Number(m.cantidad) > 0 ? `+${Number(m.cantidad).toFixed(3)}` : Number(m.cantidad).toFixed(3)}{' '}
                          {m.articulos_cafeteria?.unidad_medida || ''}
                        </td>
                        <td className="p-2.5 text-slate-400">
                          {m.proveedor ? `${m.proveedor} (${m.numero_albaran_factura || ''}) ` : ''}
                          {m.observaciones}
                        </td>
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
          <form
            onSubmit={guardarConfiguracionFiscal}
            className="max-w-2xl mx-auto p-6 rounded-3xl bg-[#0d0f17] border border-white/10 space-y-4 text-xs"
          >
            <div className="flex items-center gap-2 text-cyan-400 border-b border-white/10 pb-3">
              <Building2 className="h-5 w-5" />
              <h3 className="font-bold text-white text-base">
                Textos Legales Obligatorios del Ticket (RD 1619/2012) y PIN Maestro
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="font-bold text-slate-300 block mb-1">Nombre Comercial (Cabecera Ticket)</label>
                <input
                  type="text"
                  required
                  value={configFiscal.nombre_comercial}
                  onChange={(e) => setConfigFiscal({ ...configFiscal, nombre_comercial: e.target.value })}
                  className="w-full bg-black/60 border border-white/20 rounded-xl px-3.5 py-2.5 text-white"
                />
              </div>
              <div>
                <label className="font-bold text-slate-300 block mb-1">Razón Social Completa *</label>
                <input
                  type="text"
                  required
                  value={configFiscal.razon_social}
                  onChange={(e) => setConfigFiscal({ ...configFiscal, razon_social: e.target.value })}
                  className="w-full bg-black/60 border border-white/20 rounded-xl px-3.5 py-2.5 text-white"
                />
              </div>
              <div>
                <label className="font-bold text-slate-300 block mb-1">NIF / CIF del Emisor *</label>
                <input
                  type="text"
                  required
                  value={configFiscal.nif_cif}
                  onChange={(e) => setConfigFiscal({ ...configFiscal, nif_cif: e.target.value })}
                  className="w-full bg-black/60 border border-white/20 rounded-xl px-3.5 py-2.5 text-white font-mono uppercase"
                />
              </div>
              <div>
                <label className="font-bold text-slate-300 block mb-1">Teléfono del Local</label>
                <input
                  type="text"
                  value={configFiscal.telefono}
                  onChange={(e) => setConfigFiscal({ ...configFiscal, telefono: e.target.value })}
                  className="w-full bg-black/60 border border-white/20 rounded-xl px-3.5 py-2.5 text-white"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="font-bold text-slate-300 block mb-1">Domicilio Fiscal Completo *</label>
                <input
                  type="text"
                  required
                  value={configFiscal.direccion_fiscal}
                  onChange={(e) => setConfigFiscal({ ...configFiscal, direccion_fiscal: e.target.value })}
                  className="w-full bg-black/60 border border-white/20 rounded-xl px-3.5 py-2.5 text-white"
                />
              </div>
              <div>
                <label className="font-bold text-slate-300 block mb-1">IVA Hostelería por Defecto (%)</label>
                <input
                  type="number"
                  step="0.5"
                  value={configFiscal.iva_defecto}
                  onChange={(e) => setConfigFiscal({ ...configFiscal, iva_defecto: parseFloat(e.target.value) || 10 })}
                  className="w-full bg-black/60 border border-white/20 rounded-xl px-3.5 py-2.5 text-white font-mono"
                />
              </div>
              <div>
                <label className="font-bold text-amber-400 block mb-1">
                  PIN Maestro Autorización Descuentos / Rectificativas
                </label>
                <input
                  type="text"
                  required
                  value={configFiscal.pin_administrador}
                  onChange={(e) => setConfigFiscal({ ...configFiscal, pin_administrador: e.target.value })}
                  className="w-full bg-black/60 border border-amber-500/40 rounded-xl px-3.5 py-2.5 text-amber-400 font-mono font-bold"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black uppercase cursor-pointer"
            >
              Guardar Configuración Fiscal
            </button>
          </form>
        )}
      </main>
    </div>
  );
}