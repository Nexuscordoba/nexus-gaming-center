// src/GuisosAdminPanel.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabase';
import {
  generarEnlaceWhatsAppAdminAClienteConfirmacion,
  calcularImporteReserva,
  calcularFechaCorteMenosDias,
  obtenerFechaCorteEfectiva,
  formatearFechaHumana,
  formatearFechaCorteHumana,
  obtenerConfiguracionPagoGuisos,
  guardarConfiguracionPagoGuisos,
  dispararEmailGuiso,
  type ConfiguracionPagoGuisos,
  type GuisoProgramado,
  type ReservaGuiso,
  type EstadoGuiso,
  type EstadoPagoReservaGuiso
} from './notificacionesGuisos';

interface ArticuloCatalogo {
  id: string | number;
  nombre: string;
  descripcion?: string;
  categoria?: string;
  precio_venta?: number;
  precio?: number;
  imagen_url?: string;
}

export interface PlantillaGuiso {
  nombre: string;
  descripcion: string;
  precio_barra: number;
  precio_takeaway: number;
  min_raciones: number;
  imagen_url: string;
}

interface GuisosAdminPanelProps {
  articulosCatalogo: ArticuloCatalogo[];
  notificar: (texto: string, tipo?: 'ok' | 'error' | 'info') => void;
}

const STORAGE_KEY_PLANTILLAS = 'nexus_plantillas_guisos_v2';

// Plantillas por defecto SIN URLs falsas de Unsplash (imagen_url: '' vacío por defecto)
const PLANTILLAS_GUISOS_INICIALES: PlantillaGuiso[] = [
  {
    nombre: 'Rabo de Toro Cordobés Tradicional',
    descripcion: 'Estofado a fuego lento en vino Montilla-Moriles con verduras de la huerta y patatas fritas en dados.',
    precio_barra: 11.5,
    precio_takeaway: 10.5,
    min_raciones: 8,
    imagen_url: ''
  },
  {
    nombre: 'Carrillada Ibérica al Pedro Ximénez',
    descripcion: 'Carrillada melosa reducida en salsa casera de PX con parmentier trufado o patatas panaderas.',
    precio_barra: 10.5,
    precio_takeaway: 9.5,
    min_raciones: 8,
    imagen_url: ''
  },
  {
    nombre: 'Potaje de Garbanzos con Chocos y Langostinos',
    descripcion: 'Guiso marinero de cuchara con garbanzo lechoso, choco fresco, langostinos y sofrito casero.',
    precio_barra: 8.5,
    precio_takeaway: 7.9,
    min_raciones: 10,
    imagen_url: ''
  },
  {
    nombre: 'Arroz Caldoso con Costillejas y Setas',
    descripcion: 'Arroz artesano con fondo de carne tostada, costillejas ibéricas y boletus de temporada.',
    precio_barra: 9.0,
    precio_takeaway: 8.2,
    min_raciones: 8,
    imagen_url: ''
  },
  {
    nombre: 'Lentejas Estofadas con Chorizo Ibérico y Morcilla',
    descripcion: 'Lenteja pardina cocinada a fuego lento con verduras naturales, chorizo de bellota y punta de jamón.',
    precio_barra: 7.5,
    precio_takeaway: 6.9,
    min_raciones: 10,
    imagen_url: ''
  },
  {
    nombre: 'Albóndigas de Choco y Gambas en Salsa Verde',
    descripcion: 'Albóndigas caseras artesanas en salsa marinera de vino blanco, ajo y perejil fresco.',
    precio_barra: 9.5,
    precio_takeaway: 8.5,
    min_raciones: 8,
    imagen_url: ''
  }
];

const DIAS_SEMANA_LABELS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

const formatFechaISO = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const obtenerDiasSemana = (offsetSemanas: number = 0): Array<{ label: string; fecha: string; corto: string }> => {
  const hoy = new Date();
  const dayOfWeek = hoy.getDay(); // 0 domingo, 1 lunes...
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() + diffToMonday + offsetSemanas * 7);

  return DIAS_SEMANA_LABELS.map((label, idx) => {
    const fechaDia = new Date(lunes);
    fechaDia.setDate(lunes.getDate() + idx);
    return {
      label,
      fecha: formatFechaISO(fechaDia),
      corto: `${fechaDia.getDate()}/${fechaDia.getMonth() + 1}`
    };
  });
};

// Dado cualquier fecha ISO (YYYY-MM-DD), devuelve los 7 días (Lunes a Domingo) de esa misma semana
const obtenerDiasDeLaSemanaDeFecha = (fechaISO: string): string[] => {
  const base = new Date(`${fechaISO}T12:00:00`);
  if (isNaN(base.getTime())) return [];
  const dayOfWeek = base.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const lunes = new Date(base);
  lunes.setDate(base.getDate() + diffToMonday);

  return DIAS_SEMANA_LABELS.map((_, idx) => {
    const d = new Date(lunes);
    d.setDate(lunes.getDate() + idx);
    return formatFechaISO(d);
  });
};

// Calcula la diferencia en días entre fechaServicio y fechaCorte (por defecto 1)
const calcularDiferenciaDiasCorte = (fechaServicio: string, fechaCorte: string): number => {
  const dServ = new Date(`${fechaServicio}T12:00:00`);
  const dCorte = new Date(`${fechaCorte}T12:00:00`);
  if (isNaN(dServ.getTime()) || isNaN(dCorte.getTime())) return 1;
  const diff = Math.round((dServ.getTime() - dCorte.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
};

const limpiarUrlUnsplashFalsa = (url?: string | null): string => {
  const limpia = String(url || '').trim();
  if (!limpia || limpia.includes('images.unsplash.com')) return '';
  return limpia;
};

export default function GuisosAdminPanel({ articulosCatalogo, notificar }: GuisosAdminPanelProps) {
  const [guisos, setGuisos] = useState<GuisoProgramado[]>([]);
  const [reservas, setReservas] = useState<ReservaGuiso[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);
  const [guardandoGuiso, setGuardandoGuiso] = useState<boolean>(false);

  // Plantillas de guisos editables y persistidas en localStorage (sin URLs falsas de Unsplash)
  const [plantillasGuisos, setPlantillasGuisos] = useState<PlantillaGuiso[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PLANTILLAS) || localStorage.getItem('nexus_plantillas_guisos_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((p: PlantillaGuiso) => ({
            ...p,
            imagen_url: limpiarUrlUnsplashFalsa(p.imagen_url)
          }));
        }
      }
    } catch (e) {
      console.warn('Error leyendo plantillas de guisos de localStorage:', e);
    }
    return PLANTILLAS_GUISOS_INICIALES;
  });

  const guardarPlantillasEnStorage = (nuevas: PlantillaGuiso[]) => {
    setPlantillasGuisos(nuevas);
    try {
      localStorage.setItem(STORAGE_KEY_PLANTILLAS, JSON.stringify(nuevas));
    } catch (e) {
      console.warn('No se pudieron guardar las plantillas en localStorage:', e);
    }
  };

  // Estado del formulario de creación / edición y selección múltiple de días
  const hoyInicial = useMemo(() => formatFechaISO(new Date()), []);
  const [editandoGuisoId, setEditandoGuisoId] = useState<string | null>(null);
  const [semanaSelectorOffset, setSemanaSelectorOffset] = useState<number>(0);
  const [fechaPlato, setFechaPlato] = useState<string>(hoyInicial);
  const [fechasSeleccionadas, setFechasSeleccionadas] = useState<string[]>([hoyInicial]);
  const [margenDiasCorte, setMargenDiasCorte] = useState<number>(1);
  const [fechaCorte, setFechaCorte] = useState<string>(() => calcularFechaCorteMenosDias(hoyInicial, 1));
  const [horaCorte, setHoraCorte] = useState<string>('21:00');
  const [nombrePlato, setNombrePlato] = useState<string>('');
  const [descripcionPlato, setDescripcionPlato] = useState<string>('');
  const [minRaciones, setMinRaciones] = useState<string>('8');
  const [precioBarra, setPrecioBarra] = useState<string>('9.50');
  const [precioTakeaway, setPrecioTakeaway] = useState<string>('8.50');
  const [imagenUrl, setImagenUrl] = useState<string>('');
  const [estadoPlato, setEstadoPlato] = useState<EstadoGuiso>('buscando_minimo');

  // Selector visual de fotos reales del catálogo existente
  const [mostrarGaleriaCatalogo, setMostrarGaleriaCatalogo] = useState<boolean>(false);

  // Control de listado, filtro estricto de semana y desgloses desplegables
  const [filtroEstadoVista, setFiltroEstadoVista] = useState<'TODOS' | EstadoGuiso>('TODOS');
  const [semanaListadoOffset, setSemanaListadoOffset] = useState<number>(0);
  const [modoFiltroSemana, setModoFiltroSemana] = useState<'SEMANA_COMPLETA' | 'DIA_CONCRETO' | 'TODAS'>('SEMANA_COMPLETA');
  const [diaFiltroListado, setDiaFiltroListado] = useState<string>('');
  const [guisoDesplegadoId, setGuisoDesplegadoId] = useState<string | null>(null);

  // Estado de Selección Múltiple (Checkboxes) y Edición/Borrado Masivo en Bloque
  const [idsSeleccionados, setIdsSeleccionados] = useState<string[]>([]);
  const [loteMinRaciones, setLoteMinRaciones] = useState<string>('');
  const [lotePrecioBarra, setLotePrecioBarra] = useState<string>('');
  const [lotePrecioTakeaway, setLotePrecioTakeaway] = useState<string>('');
  const [loteEstado, setLoteEstado] = useState<'' | EstadoGuiso>('');
  const [loteMargenCorte, setLoteMargenCorte] = useState<'' | '0' | '1' | '2'>('');
  const [loteHoraCorte, setLoteHoraCorte] = useState<string>('');
  const [ejecutandoLote, setEjecutandoLote] = useState<boolean>(false);

  // Estado del panel desplegable "🗑️ Borrar por días..."
  const [mostrarPanelBorrarPorDias, setMostrarPanelBorrarPorDias] = useState<boolean>(false);
  const [diasMarcadosParaBorrar, setDiasMarcadosParaBorrar] = useState<string[]>([]);

  // Configuración de WhatsApp y Datos de Pago
  const [configPago, setConfigPago] = useState<ConfiguracionPagoGuisos>(() => obtenerConfiguracionPagoGuisos());
  const [mostrarModalConfigPago, setMostrarModalConfigPago] = useState<boolean>(false);
  const [tempTelefonoWA, setTempTelefonoWA] = useState<string>(() => configPago.telefonoWhatsAppBar);
  const [tempBizum, setTempBizum] = useState<string>(() => configPago.numeroBizum);
  const [tempEnlacePago, setTempEnlacePago] = useState<string>(() => configPago.enlacePago);
  const [tempInstruccionesPago, setTempInstruccionesPago] = useState<string>(() => configPago.instruccionesPago);

  const [enlacePagoConfig, setEnlacePagoConfig] = useState<string>(() => configPago.enlacePago);

  const diasSemanaFormulario = useMemo(() => obtenerDiasSemana(semanaSelectorOffset), [semanaSelectorOffset]);
  const diasSemanaListado = useMemo(() => obtenerDiasSemana(semanaListadoOffset), [semanaListadoOffset]);
  const fechasSemanaListadoSet = useMemo(
    () => new Set(diasSemanaListado.map((d) => d.fecha)),
    [diasSemanaListado]
  );

  // Combinar plantillas personalizadas de guisos + catálogo de artículos reales del TPV
  const opcionesCatalogoUnificadas = useMemo(() => {
    const mapa = new Map<
      string,
      PlantillaGuiso & {
        origen: 'plantilla' | 'catalogo';
      }
    >();

    for (const p of plantillasGuisos) {
      if (!p?.nombre) continue;
      mapa.set(p.nombre.trim().toLowerCase(), {
        nombre: p.nombre.trim(),
        descripcion: p.descripcion || '',
        precio_barra: Number(p.precio_barra ?? 9.5),
        precio_takeaway: Number(p.precio_takeaway ?? 8.5),
        min_raciones: Number(p.min_raciones || 8),
        imagen_url: limpiarUrlUnsplashFalsa(p.imagen_url),
        origen: 'plantilla'
      });
    }

    for (const art of articulosCatalogo) {
      if (!art?.nombre) continue;
      const clave = art.nombre.trim().toLowerCase();
      if (!mapa.has(clave)) {
        const pvp = Number(art.precio_venta ?? art.precio ?? 8.5);
        mapa.set(clave, {
          nombre: art.nombre.trim(),
          descripcion: art.descripcion
            ? String(art.descripcion)
            : art.categoria
            ? `Especialidad de nuestra carta (${art.categoria}).`
            : '',
          precio_barra: pvp > 0 ? pvp : 8.5,
          precio_takeaway: pvp > 1 ? Number((pvp - 0.8).toFixed(2)) : pvp,
          min_raciones: 8,
          imagen_url: limpiarUrlUnsplashFalsa(art.imagen_url),
          origen: 'catalogo'
        });
      }
    }

    return Array.from(mapa.values());
  }, [plantillasGuisos, articulosCatalogo]);

  const existeComoPlantilla = useMemo(() => {
    const limpio = nombrePlato.trim().toLowerCase();
    if (!limpio) return false;
    return plantillasGuisos.some((p) => p.nombre.trim().toLowerCase() === limpio);
  }, [nombrePlato, plantillasGuisos]);

  // Solo fotos reales subidas en articulos_cafeteria / productos_carta o plantillas propias
  const fotosDisponiblesCatalogo = useMemo(() => {
    const lista: Array<{ nombre: string; url: string }> = [];
    const vistas = new Set<string>();

    for (const op of opcionesCatalogoUnificadas) {
      const url = limpiarUrlUnsplashFalsa(op.imagen_url);
      if (url && !vistas.has(url)) {
        vistas.add(url);
        lista.push({ nombre: op.nombre, url });
      }
    }
    return lista;
  }, [opcionesCatalogoUnificadas]);

  const cargarGuisosYReservas = async () => {
    try {
      const [resGuisos, resReservas] = await Promise.all([
        supabase.from('guisos_programados').select('*').order('fecha', { ascending: true }),
        supabase.from('reservas_guisos').select('*').order('created_at', { ascending: false })
      ]);

      if (resGuisos.error) {
        console.error('Error cargando guisos_programados:', resGuisos.error);
      } else if (resGuisos.data) {
        setGuisos(resGuisos.data as GuisoProgramado[]);
      }

      if (resReservas.error) {
        console.error('Error cargando reservas_guisos:', resReservas.error);
      } else if (resReservas.data) {
        setReservas(resReservas.data as ReservaGuiso[]);
      }
    } catch (err) {
      console.error('Excepción en cargarGuisosYReservas:', err);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarGuisosYReservas();

    const channel = supabase
      .channel('realtime-admin-guisos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'guisos_programados' }, () => {
        cargarGuisosYReservas();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservas_guisos' }, () => {
        cargarGuisosYReservas();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const reservasPorGuiso = useMemo(() => {
    const map = new Map<string, ReservaGuiso[]>();
    for (const r of reservas) {
      const arr = map.get(r.guiso_id) || [];
      arr.push(r);
      map.set(r.guiso_id, arr);
    }
    return map;
  }, [reservas]);

  const metricasGlobales = useMemo(() => {
    const totalGuisos = guisos.length;
    const confirmados = guisos.filter((g) => g.estado === 'confirmado').length;
    const buscando = guisos.filter((g) => g.estado === 'buscando_minimo').length;
    const totalRaciones = reservas.reduce((acc, r) => acc + Number(r.raciones || 0), 0);
    let importePagado = 0;
    let importePendiente = 0;

    for (const r of reservas) {
      const g = guisos.find((item) => item.id === r.guiso_id);
      if (!g || g.estado === 'cancelado') continue;
      const imp = calcularImporteReserva(g, r.raciones, r.modalidad);
      if (r.estado_pago === 'pagado') {
        importePagado += imp;
      } else {
        importePendiente += imp;
      }
    }

    return {
      totalGuisos,
      confirmados,
      buscando,
      totalRaciones,
      importePagado: Number(importePagado.toFixed(2)),
      importePendiente: Number(importePendiente.toFixed(2))
    };
  }, [guisos, reservas]);

  // Navegar de semana en el formulario sincronizando también el listado para ver la semana en la que trabajamos
  const cambiarSemanaFormulario = (nuevoOffset: number) => {
    setSemanaSelectorOffset(nuevoOffset);
    setSemanaListadoOffset(nuevoOffset);
    const diasNuevaSemana = obtenerDiasSemana(nuevoOffset);
    if (!editandoGuisoId && diasNuevaSemana.length > 0) {
      const primeraFecha = diasNuevaSemana[0].fecha;
      setFechaPlato(primeraFecha);
      setFechasSeleccionadas([primeraFecha]);
      setFechaCorte(calcularFechaCorteMenosDias(primeraFecha, margenDiasCorte));
    }
  };

  // Alternar un día en el selector múltiple (LUN a DOM)
  const toggleDiaSeleccionMultiple = (fechaDia: string) => {
    if (editandoGuisoId) {
      setFechaPlato(fechaDia);
      setFechasSeleccionadas([fechaDia]);
      setFechaCorte(calcularFechaCorteMenosDias(fechaDia, margenDiasCorte));
      return;
    }

    setFechasSeleccionadas((prev) => {
      const existe = prev.includes(fechaDia);
      let siguiente: string[];
      if (existe) {
        siguiente = prev.length > 1 ? prev.filter((f) => f !== fechaDia) : prev;
      } else {
        siguiente = [...prev, fechaDia].sort();
      }
      const fechaRef = siguiente[0] || fechaDia;
      setFechaPlato(fechaRef);
      setFechaCorte(calcularFechaCorteMenosDias(fechaRef, margenDiasCorte));
      return siguiente;
    });
  };

  // Atajos rápidos de selección múltiple de días
  const seleccionarLunesAViernes = () => {
    const lunVie = diasSemanaFormulario.slice(0, 5).map((d) => d.fecha);
    setEditandoGuisoId(null);
    setFechasSeleccionadas(lunVie);
    if (lunVie[0]) {
      setFechaPlato(lunVie[0]);
      setFechaCorte(calcularFechaCorteMenosDias(lunVie[0], margenDiasCorte));
    }
  };

  const seleccionarTodaLaSemana = () => {
    const todos = diasSemanaFormulario.map((d) => d.fecha);
    setEditandoGuisoId(null);
    setFechasSeleccionadas(todos);
    if (todos[0]) {
      setFechaPlato(todos[0]);
      setFechaCorte(calcularFechaCorteMenosDias(todos[0], margenDiasCorte));
    }
  };

  const seleccionarSoloUnDia = () => {
    const unico = fechasSeleccionadas[0] || fechaPlato || diasSemanaFormulario[0]?.fecha || hoyInicial;
    setFechasSeleccionadas([unico]);
    setFechaPlato(unico);
    setFechaCorte(calcularFechaCorteMenosDias(unico, margenDiasCorte));
  };

  // Al cambiar la fecha exacta manualmente en el input date
  const cambiarFechaServicioManual = (nuevaFechaServicio: string) => {
    setFechaPlato(nuevaFechaServicio);
    setFechasSeleccionadas([nuevaFechaServicio]);
    if (nuevaFechaServicio) {
      setFechaCorte(calcularFechaCorteMenosDias(nuevaFechaServicio, margenDiasCorte));
    }
  };

  // Aplicar margen de corte rápido (1 día antes a las 21:00, 2 días antes a las 21:00)
  const aplicarCorteRapido = (diasAntes: number, hora: string = '21:00') => {
    setMargenDiasCorte(diasAntes);
    setHoraCorte(hora);
    const ref = fechasSeleccionadas[0] || fechaPlato;
    if (ref) {
      setFechaCorte(calcularFechaCorteMenosDias(ref, diasAntes));
    }
  };

  const limpiarFormulario = () => {
    setEditandoGuisoId(null);
    setNombrePlato('');
    setDescripcionPlato('');
    setMinRaciones('8');
    setPrecioBarra('9.50');
    setPrecioTakeaway('8.50');
    setImagenUrl('');
    setMargenDiasCorte(1);
    const ref = fechasSeleccionadas[0] || fechaPlato || hoyInicial;
    setFechasSeleccionadas([ref]);
    setFechaPlato(ref);
    setFechaCorte(calcularFechaCorteMenosDias(ref, 1));
    setHoraCorte('21:00');
    setEstadoPlato('buscando_minimo');
  };

  // SIEMPRE actualiza descripción, precios, mínimo de raciones y foto (sin dejar pegado el texto anterior)
  const handleSeleccionarPlatoCatalogo = (nombreInput: string) => {
    setNombrePlato(nombreInput);
    const encontrado = opcionesCatalogoUnificadas.find(
      (op) => op.nombre.toLowerCase() === nombreInput.trim().toLowerCase()
    );
    if (encontrado) {
      setDescripcionPlato(encontrado.descripcion || '');
      setPrecioBarra(Number(encontrado.precio_barra || 0).toFixed(2));
      setPrecioTakeaway(Number(encontrado.precio_takeaway || 0).toFixed(2));
      setMinRaciones(String(encontrado.min_raciones || 8));
      setImagenUrl(limpiarUrlUnsplashFalsa(encontrado.imagen_url));
    }
  };

  const guardarPlatoActualComoPlantilla = () => {
    const nombreLimpio = nombrePlato.trim();
    if (!nombreLimpio) {
      notificar('Escribe primero el nombre del guiso para guardarlo como plantilla.', 'info');
      return;
    }

    const nuevaPlantilla: PlantillaGuiso = {
      nombre: nombreLimpio,
      descripcion: descripcionPlato.trim(),
      precio_barra: Math.max(0, parseFloat(precioBarra) || 0),
      precio_takeaway: Math.max(0, parseFloat(precioTakeaway) || 0),
      min_raciones: Math.max(1, parseInt(minRaciones, 10) || 8),
      imagen_url: limpiarUrlUnsplashFalsa(imagenUrl)
    };

    const idxExistente = plantillasGuisos.findIndex(
      (p) => p.nombre.trim().toLowerCase() === nombreLimpio.toLowerCase()
    );

    if (idxExistente >= 0) {
      const actualizadas = [...plantillasGuisos];
      actualizadas[idxExistente] = nuevaPlantilla;
      guardarPlantillasEnStorage(actualizadas);
      notificar(`Plantilla "${nombreLimpio}" actualizada correctamente.`, 'ok');
    } else {
      guardarPlantillasEnStorage([nuevaPlantilla, ...plantillasGuisos]);
      notificar(`Plato "${nombreLimpio}" guardado en tus plantillas predefinidas.`, 'ok');
    }
  };

  const quitarPlatoActualDePlantillas = () => {
    const nombreLimpio = nombrePlato.trim();
    if (!nombreLimpio) return;

    const filtradas = plantillasGuisos.filter(
      (p) => p.nombre.trim().toLowerCase() !== nombreLimpio.toLowerCase()
    );

    if (filtradas.length === plantillasGuisos.length) {
      notificar(`"${nombreLimpio}" no está en las plantillas personalizadas.`, 'info');
      return;
    }

    guardarPlantillasEnStorage(filtradas);
    notificar(`"${nombreLimpio}" eliminado del catálogo de plantillas.`, 'info');
  };

  const manejarSubidaImagenGuiso = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const ext = file.name.split('.').pop();
      const fileName = `guiso_${Date.now()}.${ext}`;
      const { data, error } = await supabase.storage.from('productos').upload(fileName, file, { upsert: true });

      if (!error && data) {
        const { data: pubUrl } = supabase.storage.from('productos').getPublicUrl(fileName);
        setImagenUrl(pubUrl.publicUrl);
        notificar('Foto del guiso subida correctamente a Supabase Storage.', 'ok');
      } else {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            setImagenUrl(reader.result);
            notificar('Imagen cargada y lista para guardar.', 'ok');
          }
        };
        reader.readAsDataURL(file);
      }
    } catch (err) {
      console.error('Error subiendo imagen de guiso:', err);
    }
  };

  // Guardar guiso (Soporta edición individual o inserción masiva en varios días seleccionados)
  const guardarGuiso = async (e: React.FormEvent) => {
    e.preventDefault();
    const diasDestino =
      editandoGuisoId || fechasSeleccionadas.length === 0
        ? [fechaPlato]
        : [...fechasSeleccionadas].sort();

    if (!nombrePlato.trim() || diasDestino.length === 0 || guardandoGuiso) return;

    const minNum = Math.max(1, parseInt(minRaciones, 10) || 8);
    const pBarra = Math.max(0, parseFloat(precioBarra) || 0);
    const pTakeaway = Math.max(0, parseFloat(precioTakeaway) || 0);
    const refFecha = diasDestino[0];
    const diffDiasCalculado = fechaCorte
      ? calcularDiferenciaDiasCorte(refFecha, fechaCorte)
      : margenDiasCorte;

    setGuardandoGuiso(true);
    try {
      if (editandoGuisoId) {
        const fechaCorteFinal = fechaCorte || calcularFechaCorteMenosDias(fechaPlato, 1);
        const payloadBase = {
          fecha: fechaPlato,
          hora_corte: (horaCorte || '21:00').trim(),
          nombre_plato: nombrePlato.trim(),
          descripcion: descripcionPlato.trim(),
          min_raciones: minNum,
          precio_barra: Number(pBarra.toFixed(2)),
          precio_takeaway: Number(pTakeaway.toFixed(2)),
          imagen_url: limpiarUrlUnsplashFalsa(imagenUrl),
          estado: estadoPlato
        };

        const { error } = await supabase
          .from('guisos_programados')
          .update({ ...payloadBase, fecha_corte: fechaCorteFinal })
          .eq('id', editandoGuisoId);

        if (error) {
          const { error: fallbackErr } = await supabase
            .from('guisos_programados')
            .update(payloadBase)
            .eq('id', editandoGuisoId);
          if (fallbackErr) throw fallbackErr;
        }
        notificar(`Guiso "${payloadBase.nombre_plato}" actualizado correctamente.`, 'ok');
      } else {
        // Inserción masiva para todos los días seleccionados con cálculo automático de fecha_corte
        const filasConFechaCorte = diasDestino.map((fDia) => ({
          fecha: fDia,
          fecha_corte:
            diasDestino.length === 1 && fechaCorte
              ? fechaCorte
              : calcularFechaCorteMenosDias(fDia, diffDiasCalculado),
          hora_corte: (horaCorte || '21:00').trim(),
          nombre_plato: nombrePlato.trim(),
          descripcion: descripcionPlato.trim(),
          min_raciones: minNum,
          precio_barra: Number(pBarra.toFixed(2)),
          precio_takeaway: Number(pTakeaway.toFixed(2)),
          imagen_url: limpiarUrlUnsplashFalsa(imagenUrl),
          estado: estadoPlato
        }));

        const { error } = await supabase.from('guisos_programados').insert(filasConFechaCorte);
        if (error) {
          const filasSinFechaCorte = filasConFechaCorte.map(({ fecha_corte: _fc, ...resto }) => resto);
          const { error: fallbackErr } = await supabase
            .from('guisos_programados')
            .insert(filasSinFechaCorte);
          if (fallbackErr) throw fallbackErr;
        }

        if (diasDestino.length === 1) {
          notificar(
            `Guiso "${nombrePlato.trim()}" programado para el ${formatearFechaHumana(diasDestino[0])}.`,
            'ok'
          );
        } else {
          notificar(
            `🍲 "${nombrePlato.trim()}" publicado en ${diasDestino.length} días de la semana correctamente.`,
            'ok'
          );
        }
      }

      limpiarFormulario();
      await cargarGuisosYReservas();
    } catch (err: any) {
      notificar('Error al guardar el guiso: ' + (err?.message || 'Revisa la tabla en Supabase'), 'error');
    } finally {
      setGuardandoGuiso(false);
    }
  };

  // Botón "📋 Copiar sem.": Clona un guiso existente en el resto de días de esa misma semana (Lun-Dom)
  const copiarGuisoRestoSemana = async (guiso: GuisoProgramado) => {
    const diasDeSuSemana = obtenerDiasDeLaSemanaDeFecha(guiso.fecha);
    const diasRestantes = diasDeSuSemana.filter((f) => {
      if (f === guiso.fecha) return false;
      const yaExisteMismoPlato = guisos.some(
        (existente) =>
          existente.fecha === f &&
          existente.nombre_plato.trim().toLowerCase() === guiso.nombre_plato.trim().toLowerCase()
      );
      return !yaExisteMismoPlato;
    });

    if (diasRestantes.length === 0) {
      notificar(
        `"${guiso.nombre_plato}" ya está programado en todos los días de esa semana.`,
        'info'
      );
      return;
    }

    const ok = window.confirm(
      `¿Clonar "${guiso.nombre_plato}" en los otros ${diasRestantes.length} días libres de esa semana (Lunes a Domingo)?`
    );
    if (!ok) return;

    const fechaCorteOrig = obtenerFechaCorteEfectiva(guiso);
    const margenOriginal = calcularDiferenciaDiasCorte(guiso.fecha, fechaCorteOrig);

    try {
      const clonesConCorte = diasRestantes.map((fDestino) => ({
        fecha: fDestino,
        fecha_corte: calcularFechaCorteMenosDias(fDestino, margenOriginal),
        hora_corte: guiso.hora_corte || '21:00',
        nombre_plato: guiso.nombre_plato,
        descripcion: guiso.descripcion || '',
        min_raciones: Number(guiso.min_raciones || 8),
        precio_barra: Number(guiso.precio_barra || 0),
        precio_takeaway: Number(guiso.precio_takeaway || 0),
        imagen_url: limpiarUrlUnsplashFalsa(guiso.imagen_url),
        estado: 'buscando_minimo' as EstadoGuiso
      }));

      const { error } = await supabase.from('guisos_programados').insert(clonesConCorte);
      if (error) {
        const clonesBase = clonesConCorte.map(({ fecha_corte: _fc, ...resto }) => resto);
        const { error: fallbackErr } = await supabase.from('guisos_programados').insert(clonesBase);
        if (fallbackErr) throw fallbackErr;
      }

      notificar(
        `📋 "${guiso.nombre_plato}" copiado en ${diasRestantes.length} días de la semana.`,
        'ok'
      );
      await cargarGuisosYReservas();
    } catch (err: any) {
      notificar('Error al copiar en la semana: ' + err.message, 'error');
    }
  };

  const cargarParaEditar = (guiso: GuisoProgramado) => {
    const fCorteEfectiva = obtenerFechaCorteEfectiva(guiso);
    const diff = calcularDiferenciaDiasCorte(guiso.fecha, fCorteEfectiva);
    setEditandoGuisoId(guiso.id);
    setFechaPlato(guiso.fecha);
    setFechasSeleccionadas([guiso.fecha]);
    setMargenDiasCorte(diff);
    setFechaCorte(fCorteEfectiva);
    setHoraCorte(guiso.hora_corte || '21:00');
    setNombrePlato(guiso.nombre_plato);
    setDescripcionPlato(guiso.descripcion || '');
    setMinRaciones(String(guiso.min_raciones || 8));
    setPrecioBarra(Number(guiso.precio_barra || 0).toFixed(2));
    setPrecioTakeaway(Number(guiso.precio_takeaway || 0).toFixed(2));
    setImagenUrl(limpiarUrlUnsplashFalsa(guiso.imagen_url));
    setEstadoPlato(guiso.estado);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const forzarConfirmacionGuiso = async (guiso: GuisoProgramado) => {
    try {
      const { error } = await supabase
        .from('guisos_programados')
        .update({ estado: 'confirmado' })
        .eq('id', guiso.id);
      if (error) throw error;

      // Disparar envío automático de email con datos de pago a los clientes inscritos
      const clientesDeEsteGuiso = reservas.filter((r) => r.guiso_id === guiso.id);
      let emailsEnviados = 0;
      for (const res of clientesDeEsteGuiso) {
        if (res.email && res.email.includes('@')) {
          dispararEmailGuiso({
            tipo: 'plato_confirmado_pago',
            reserva: res,
            guiso
          }).catch((e) => console.warn('Error enviando email confirmacion guiso:', e));
          emailsEnviados++;
        }
      }

      notificar(
        `🟢 "${guiso.nombre_plato}" confirmado.${emailsEnviados > 0 ? ` Enviados ${emailsEnviados} emails con instrucciones de pago.` : ''} ¡Ya puedes enviar WhatsApp con un toque!`,
        'ok'
      );
      setGuisoDesplegadoId(guiso.id);
      await cargarGuisosYReservas();
    } catch (err: any) {
      notificar('Error al confirmar el guiso: ' + err.message, 'error');
    }
  };

  const cancelarGuisoPlanB = async (guiso: GuisoProgramado) => {
    const ok = window.confirm(
      `¿Marcar "${guiso.nombre_plato}" como CANCELADO?\n\nEn la web pública (#guisos) se mostrará automáticamente el "Plan B Inteligente" y se notificará por email a los clientes apuntados.`
    );
    if (!ok) return;

    try {
      const { error } = await supabase
        .from('guisos_programados')
        .update({ estado: 'cancelado' })
        .eq('id', guiso.id);
      if (error) throw error;

      // Notificar a los clientes apuntados sobre el Plan B y opciones alternativas
      const clientesDeEsteGuiso = reservas.filter((r) => r.guiso_id === guiso.id);
      const otrosConfirmados = guisos.filter(
        (g) => g.fecha === guiso.fecha && g.id !== guiso.id && g.estado === 'confirmado'
      );
      let emailsEnviados = 0;
      for (const res of clientesDeEsteGuiso) {
        if (res.email && res.email.includes('@')) {
          dispararEmailGuiso({
            tipo: 'plato_cancelado_plan_b',
            reserva: res,
            guiso,
            platosAlternativos: otrosConfirmados.map((g) => ({ nombre_plato: g.nombre_plato }))
          }).catch((e) => console.warn('Error enviando email cancelación guiso:', e));
          emailsEnviados++;
        }
      }

      notificar(
        `Plato "${guiso.nombre_plato}" marcado como cancelado (Plan B activo).${emailsEnviados > 0 ? ` Se enviaron ${emailsEnviados} avisos.` : ''}`,
        'info'
      );
      await cargarGuisosYReservas();
    } catch (err: any) {
      notificar('Error al cancelar guiso: ' + err.message, 'error');
    }
  };

  const eliminarGuisoDefinitivamente = async (guiso: GuisoProgramado) => {
    const ok = window.confirm(
      `¿Eliminar definitivamente "${guiso.nombre_plato}" (${guiso.fecha}) y sus reservas asociadas?`
    );
    if (!ok) return;

    try {
      const { error } = await supabase.from('guisos_programados').delete().eq('id', guiso.id);
      if (error) throw error;
      notificar(`Guiso "${guiso.nombre_plato}" eliminado.`, 'ok');
      setIdsSeleccionados((prev) => prev.filter((id) => id !== guiso.id));
      if (editandoGuisoId === guiso.id) limpiarFormulario();
      await cargarGuisosYReservas();
    } catch (err: any) {
      notificar('Error al eliminar guiso: ' + err.message, 'error');
    }
  };

  // FILTRO ESTRICTO DE SEMANA COMPLETA (Lunes a Domingo de la semana seleccionada, sin mezclar semanas)
  const guisosFiltrados = useMemo(() => {
    return guisos.filter((g) => {
      if (filtroEstadoVista !== 'TODOS' && g.estado !== filtroEstadoVista) return false;
      if (modoFiltroSemana === 'SEMANA_COMPLETA' && !fechasSemanaListadoSet.has(g.fecha)) {
        return false;
      }
      if (modoFiltroSemana === 'DIA_CONCRETO' && g.fecha !== diaFiltroListado) {
        return false;
      }
      return true;
    });
  }, [guisos, filtroEstadoVista, modoFiltroSemana, fechasSemanaListadoSet, diaFiltroListado]);

  // Gestión de Checkboxes y Selección en Lote
  const toggleSeleccionGuiso = (id: string) => {
    setIdsSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const todosVisiblesSeleccionados = useMemo(() => {
    if (guisosFiltrados.length === 0) return false;
    return guisosFiltrados.every((g) => idsSeleccionados.includes(g.id));
  }, [guisosFiltrados, idsSeleccionados]);

  const toggleSeleccionarTodosVisibles = () => {
    if (todosVisiblesSeleccionados) {
      const idsVisiblesSet = new Set(guisosFiltrados.map((g) => g.id));
      setIdsSeleccionados((prev) => prev.filter((id) => !idsVisiblesSet.has(id)));
    } else {
      const nuevos = new Set([...idsSeleccionados, ...guisosFiltrados.map((g) => g.id)]);
      setIdsSeleccionados(Array.from(nuevos));
    }
  };

  // EDICIÓN MASIVA EN BLOQUE (.update().in('id', idsSeleccionados))
  const aplicarEdicionMasivaEnBloque = async () => {
    if (idsSeleccionados.length === 0 || ejecutandoLote) return;

    const camposActualizar: Record<string, any> = {};
    if (loteMinRaciones.trim() !== '') {
      camposActualizar.min_raciones = Math.max(1, parseInt(loteMinRaciones, 10) || 8);
    }
    if (lotePrecioBarra.trim() !== '') {
      camposActualizar.precio_barra = Number(Math.max(0, parseFloat(lotePrecioBarra) || 0).toFixed(2));
    }
    if (lotePrecioTakeaway.trim() !== '') {
      camposActualizar.precio_takeaway = Number(
        Math.max(0, parseFloat(lotePrecioTakeaway) || 0).toFixed(2)
      );
    }
    if (loteEstado !== '') {
      camposActualizar.estado = loteEstado;
    }
    if (loteHoraCorte.trim() !== '') {
      camposActualizar.hora_corte = loteHoraCorte.trim();
    }

    const tieneMargenCorte = loteMargenCorte !== '';

    if (Object.keys(camposActualizar).length === 0 && !tieneMargenCorte) {
      notificar('Rellena al menos un campo en la barra de edición en bloque para aplicarlo.', 'info');
      return;
    }

    setEjecutandoLote(true);
    try {
      if (Object.keys(camposActualizar).length > 0) {
        const { error } = await supabase
          .from('guisos_programados')
          .update(camposActualizar)
          .in('id', idsSeleccionados);
        if (error) throw error;
      }

      if (tieneMargenCorte) {
        const diasAntes = parseInt(loteMargenCorte, 10) || 0;
        const seleccionadosObjs = guisos.filter((g) => idsSeleccionados.includes(g.id));
        for (const g of seleccionadosObjs) {
          const nuevaFechaCorte = calcularFechaCorteMenosDias(g.fecha, diasAntes);
          await supabase
            .from('guisos_programados')
            .update({ fecha_corte: nuevaFechaCorte })
            .eq('id', g.id);
        }
      }

      notificar(
        `✅ Cambios aplicados en bloque a ${idsSeleccionados.length} guiso(s) seleccionado(s).`,
        'ok'
      );
      setLoteMinRaciones('');
      setLotePrecioBarra('');
      setLotePrecioTakeaway('');
      setLoteEstado('');
      setLoteMargenCorte('');
      setLoteHoraCorte('');
      await cargarGuisosYReservas();
    } catch (err: any) {
      notificar('Error en edición masiva: ' + err.message, 'error');
    } finally {
      setEjecutandoLote(false);
    }
  };

  // BORRADO MASIVO POR SELECCIÓN (.delete().in('id', idsSeleccionados))
  const eliminarSeleccionadosEnBloque = async () => {
    if (idsSeleccionados.length === 0 || ejecutandoLote) return;
    const ok = window.confirm(
      `¿Eliminar definitivamente los ${idsSeleccionados.length} guisos seleccionados y sus reservas?`
    );
    if (!ok) return;

    setEjecutandoLote(true);
    try {
      const { error } = await supabase
        .from('guisos_programados')
        .delete()
        .in('id', idsSeleccionados);
      if (error) throw error;

      notificar(`🗑️ Se han eliminado ${idsSeleccionados.length} guisos seleccionados.`, 'ok');
      setIdsSeleccionados([]);
      await cargarGuisosYReservas();
    } catch (err: any) {
      notificar('Error al eliminar seleccionados: ' + err.message, 'error');
    } finally {
      setEjecutandoLote(false);
    }
  };

  // BORRADO RÁPIDO POR DÍAS DE LA SEMANA ACTIVA
  const toggleDiaParaBorrar = (fechaISO: string) => {
    setDiasMarcadosParaBorrar((prev) =>
      prev.includes(fechaISO) ? prev.filter((d) => d !== fechaISO) : [...prev, fechaISO]
    );
  };

  const ejecutarBorradoPorDias = async (fechasABorrar: string[], etiquetaConfirmacion: string) => {
    const guisosAfectados = guisos.filter((g) => fechasABorrar.includes(g.fecha));
    if (guisosAfectados.length === 0) {
      notificar('No hay guisos programados en los días seleccionados para borrar.', 'info');
      return;
    }

    const ok = window.confirm(
      `¿Eliminar los ${guisosAfectados.length} guisos programados en ${etiquetaConfirmacion}? Esta acción no se puede deshacer.`
    );
    if (!ok) return;

    const idsABorrar = guisosAfectados.map((g) => g.id);
    setEjecutandoLote(true);
    try {
      const { error } = await supabase.from('guisos_programados').delete().in('id', idsABorrar);
      if (error) throw error;

      notificar(`🗑️ Eliminados ${idsABorrar.length} guisos (${etiquetaConfirmacion}).`, 'ok');
      setDiasMarcadosParaBorrar([]);
      setMostrarPanelBorrarPorDias(false);
      setIdsSeleccionados((prev) => prev.filter((id) => !idsABorrar.includes(id)));
      await cargarGuisosYReservas();
    } catch (err: any) {
      notificar('Error borrando guisos por días: ' + err.message, 'error');
    } finally {
      setEjecutandoLote(false);
    }
  };

  const alternarEstadoPagoReserva = async (reserva: ReservaGuiso) => {
    const nuevoEstado: EstadoPagoReservaGuiso =
      reserva.estado_pago === 'pagado' ? 'pendiente' : 'pagado';
    try {
      const { error } = await supabase
        .from('reservas_guisos')
        .update({ estado_pago: nuevoEstado })
        .eq('id', reserva.id);
      if (error) throw error;
      notificar(
        `Reserva de ${reserva.nombre_cliente} marcada como ${nuevoEstado.toUpperCase()}.`,
        nuevoEstado === 'pagado' ? 'ok' : 'info'
      );
      await cargarGuisosYReservas();
    } catch (err: any) {
      notificar('Error actualizando estado de pago: ' + err.message, 'error');
    }
  };

  const eliminarReservaCliente = async (reserva: ReservaGuiso) => {
    const ok = window.confirm(
      `¿Eliminar la reserva de ${reserva.nombre_cliente} (${reserva.raciones} raciones)?`
    );
    if (!ok) return;

    try {
      const { error } = await supabase.from('reservas_guisos').delete().eq('id', reserva.id);
      if (error) throw error;
      notificar(`Reserva de ${reserva.nombre_cliente} eliminada.`, 'info');
      await cargarGuisosYReservas();
    } catch (err: any) {
      notificar('Error al eliminar reserva: ' + err.message, 'error');
    }
  };

  const rangoSemanaListadoTexto = useMemo(() => {
    if (diasSemanaListado.length < 7) return '';
    return `${diasSemanaListado[0].corto} al ${diasSemanaListado[6].corto}`;
  }, [diasSemanaListado]);

  return (
    <div className="space-y-4">
      {/* CABECERA COMPACTA Y MÉTRICAS EN UNA SOLA FILA */}
      <div className="flex flex-wrap justify-between items-center gap-3 bg-[#0f172a] border border-slate-800 px-4 py-3 rounded-2xl">
        <div>
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <span>🍲 Gestión de Guisos Bajo Demanda y Preventa</span>
          </h2>
          <p className="text-[11px] text-slate-400">
            Programación multi-día, control de raciones en vivo, edición en lote y avisos por WhatsApp.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3 text-xs bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl">
            <span>
              🟢 <strong className="text-emerald-400">{metricasGlobales.confirmados}</strong> conf.
            </span>
            <span className="text-slate-700">|</span>
            <span>
              🟡 <strong className="text-amber-400">{metricasGlobales.buscando}</strong> prev.
            </span>
            <span className="text-slate-700">|</span>
            <span>
              🔥 <strong className="text-cyan-400">{metricasGlobales.totalRaciones}</strong> rac.
            </span>
            <span className="text-slate-700">|</span>
            <span>
              💶 <strong className="text-emerald-400">{metricasGlobales.importePagado.toFixed(2)}€</strong> cobrado
            </span>
          </div>

          <a
            href="#guisos"
            target="_blank"
            rel="noreferrer"
            className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 px-3 py-1.5 rounded-xl font-black text-xs transition-all whitespace-nowrap"
          >
            🌐 Vista Pública (#guisos)
          </a>
          <button
            type="button"
            onClick={cargarGuisosYReservas}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer whitespace-nowrap"
          >
            🔄 Sincronizar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* ================= COLUMNA IZQUIERDA (4 cols): FORMULARIO ÁGIL MULTI-DÍA ================= */}
        <form
          onSubmit={guardarGuiso}
          className="lg:col-span-4 bg-[#0f172a] border border-slate-800 rounded-2xl p-4 space-y-3.5"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <h3 className="text-sm font-black text-white">
              {editandoGuisoId ? '✏️ Editando Guiso Programado' : '➕ Programar Guiso (1 o varios días)'}
            </h3>
            {editandoGuisoId && (
              <button
                type="button"
                onClick={limpiarFormulario}
                className="text-[11px] font-bold text-rose-400 hover:underline cursor-pointer"
              >
                Cancelar edición
              </button>
            )}
          </div>

          {/* BLOQUE 1: SELECTOR DE SEMANA, ATAJOS MULTI-DÍA Y FECHA/HORA DE CORTE */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 space-y-2.5">
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black uppercase tracking-wider text-amber-400">
                📅 1. Elige Día de la Semana o Fecha Exacta
              </label>

              {/* NAVEGACIÓN DE SEMANA EN UNA SOLA LÍNEA CON WHITESPACE-NOWRAP */}
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => cambiarSemanaFormulario(semanaSelectorOffset - 1)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] font-bold text-slate-300 whitespace-nowrap text-center transition-colors cursor-pointer"
                >
                  ◀ Sem. ant.
                </button>
                <button
                  type="button"
                  onClick={() => cambiarSemanaFormulario(0)}
                  className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-black whitespace-nowrap text-center transition-colors cursor-pointer ${
                    semanaSelectorOffset === 0
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  Actual
                </button>
                <button
                  type="button"
                  onClick={() => cambiarSemanaFormulario(semanaSelectorOffset + 1)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] font-bold text-slate-300 whitespace-nowrap text-center transition-colors cursor-pointer"
                >
                  Sem. sig. ▶
                </button>
              </div>
            </div>

            {/* 3 ATAJOS RÁPIDOS ENCIMA DE LOS DÍAS: LUNES A VIERNES, TODA LA SEMANA, SOLO 1 DÍA */}
            {!editandoGuisoId && (
              <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={seleccionarLunesAViernes}
                  className={`px-2 py-1 rounded-lg border text-[10px] font-black whitespace-nowrap transition-all cursor-pointer ${
                    fechasSeleccionadas.length === 5
                      ? 'bg-amber-500/25 border-amber-400 text-amber-200'
                      : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300'
                  }`}
                >
                  💼 Lunes a Viernes
                </button>
                <button
                  type="button"
                  onClick={seleccionarTodaLaSemana}
                  className={`px-2 py-1 rounded-lg border text-[10px] font-black whitespace-nowrap transition-all cursor-pointer ${
                    fechasSeleccionadas.length === 7
                      ? 'bg-amber-500/25 border-amber-400 text-amber-200'
                      : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300'
                  }`}
                >
                  🗓️ Toda la semana
                </button>
                <button
                  type="button"
                  onClick={seleccionarSoloUnDia}
                  className={`px-2 py-1 rounded-lg border text-[10px] font-black whitespace-nowrap transition-all cursor-pointer ${
                    fechasSeleccionadas.length === 1
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                      : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300'
                  }`}
                >
                  🔄 Solo 1 día
                </button>
              </div>
            )}

            {/* PÍLDORAS DE LOS 7 DÍAS (LUN A DOM) CON SELECCIÓN MÚLTIPLE */}
            <div className="grid grid-cols-7 gap-1">
              {diasSemanaFormulario.map((d) => {
                const marcado = editandoGuisoId
                  ? fechaPlato === d.fecha
                  : fechasSeleccionadas.includes(d.fecha);
                return (
                  <button
                    key={d.fecha}
                    type="button"
                    onClick={() => toggleDiaSeleccionMultiple(d.fecha)}
                    className={`py-1.5 px-1 rounded-lg text-center transition-all border cursor-pointer ${
                      marcado
                        ? 'bg-amber-500 text-slate-950 border-amber-300 font-black shadow'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700 font-bold'
                    }`}
                  >
                    <span className="block text-[9px] uppercase">{d.label.slice(0, 3)}</span>
                    <span className="block text-[10px] mt-0.5">{d.corto}</span>
                  </button>
                );
              })}
            </div>

            {/* RESUMEN DE DÍAS SELECCIONADOS O SELECTOR DE FECHA EXACTA */}
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <span className="text-[10px] font-bold text-slate-400">
                {fechasSeleccionadas.length > 1 && !editandoGuisoId
                  ? `✅ ${fechasSeleccionadas.length} días marcados para publicar`
                  : '🍽️ Fecha exacta de servicio:'}
              </span>
              <input
                type="date"
                required
                value={fechaPlato}
                onChange={(e) => cambiarFechaServicioManual(e.target.value)}
                className="bg-slate-900 border border-slate-700 focus:border-amber-400 rounded-lg px-2.5 py-1 text-xs font-bold text-white outline-none"
              />
            </div>

            {/* FECHA Y HORA DE CORTE PREVENTA + BOTONES DE MARGEN RÁPIDO */}
            <div className="pt-2 border-t border-slate-800/90 space-y-2">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-black uppercase text-amber-300">
                  🛑 Cierre de Preventa ({fechasSeleccionadas.length > 1 ? 'Automático por día' : 'Fecha y Hora'})
                </span>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => aplicarCorteRapido(1, '21:00')}
                  className={`px-2 py-1.5 rounded-lg border text-[10px] font-black whitespace-nowrap transition-colors cursor-pointer ${
                    margenDiasCorte === 1 && horaCorte === '21:00'
                      ? 'bg-amber-500/25 border-amber-400 text-amber-200'
                      : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300'
                  }`}
                >
                  1 día antes a las 21:00
                </button>
                <button
                  type="button"
                  onClick={() => aplicarCorteRapido(2, '21:00')}
                  className={`px-2 py-1.5 rounded-lg border text-[10px] font-black whitespace-nowrap transition-colors cursor-pointer ${
                    margenDiasCorte === 2 && horaCorte === '21:00'
                      ? 'bg-indigo-500/25 border-indigo-400 text-indigo-200'
                      : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300'
                  }`}
                >
                  2 días antes a las 21:00
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block">
                    Fecha corte {fechasSeleccionadas.length > 1 ? '(1er día)' : ''}
                  </label>
                  <input
                    type="date"
                    required
                    value={fechaCorte}
                    onChange={(e) => {
                      setFechaCorte(e.target.value);
                      if (fechaPlato && e.target.value) {
                        setMargenDiasCorte(calcularDiferenciaDiasCorte(fechaPlato, e.target.value));
                      }
                    }}
                    className="w-full bg-slate-900 border border-amber-500/40 focus:border-amber-400 rounded-lg px-2.5 py-1 text-xs font-bold text-amber-200 mt-0.5 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block">Hora corte</label>
                  <input
                    type="time"
                    required
                    value={horaCorte}
                    onChange={(e) => setHoraCorte(e.target.value)}
                    className="w-full bg-slate-900 border border-amber-500/40 focus:border-amber-400 rounded-lg px-2.5 py-1 text-xs font-bold text-amber-200 mt-0.5 outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* BLOQUE 2: NOMBRE DEL PLATO, AUTOCOMPLETADO Y PLANTILLAS EDITABLES */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                🍲 2. Nombre del Guiso / Plato *
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={guardarPlatoActualComoPlantilla}
                  className="px-2 py-0.5 rounded-md bg-emerald-600/20 hover:bg-emerald-600/35 border border-emerald-500/40 text-emerald-300 text-[10px] font-black whitespace-nowrap cursor-pointer"
                  title="Guardar plato actual como plantilla predefinida"
                >
                  💾 Guardar como plantilla
                </button>
                {existeComoPlantilla && (
                  <button
                    type="button"
                    onClick={quitarPlatoActualDePlantillas}
                    className="px-2 py-0.5 rounded-md bg-rose-600/20 hover:bg-rose-600/35 border border-rose-500/40 text-rose-300 text-[10px] font-bold whitespace-nowrap cursor-pointer"
                    title="Quitar plato de las plantillas"
                  >
                    🗑️ Quitar plantilla
                  </button>
                )}
              </div>
            </div>

            {/* DESPLEGABLE QUE SIEMPRE ACTUALIZA DESCRIPCIÓN, PRECIOS, MÍNIMO Y FOTO */}
            <select
              value={
                opcionesCatalogoUnificadas.find(
                  (op) => op.nombre.toLowerCase() === nombrePlato.trim().toLowerCase()
                )?.nombre || ''
              }
              onChange={(e) => {
                if (e.target.value) {
                  handleSeleccionarPlatoCatalogo(e.target.value);
                }
              }}
              className="w-full bg-slate-900 border border-slate-700 focus:border-amber-400 rounded-lg px-2.5 py-1.5 text-xs font-bold text-amber-300 outline-none"
            >
              <option value="">-- Elegir de mis Plantillas ({plantillasGuisos.length}) o Carta --</option>
              <optgroup label="🍲 Mis Plantillas de Guisos">
                {opcionesCatalogoUnificadas
                  .filter((op) => op.origen === 'plantilla')
                  .map((op) => (
                    <option key={`pl-${op.nombre}`} value={op.nombre}>
                      {op.nombre} ({op.precio_barra.toFixed(2)}€ / {op.precio_takeaway.toFixed(2)}€)
                    </option>
                  ))}
              </optgroup>
              {opcionesCatalogoUnificadas.some((op) => op.origen === 'catalogo') && (
                <optgroup label="📋 Artículos de Carta / TPV">
                  {opcionesCatalogoUnificadas
                    .filter((op) => op.origen === 'catalogo')
                    .map((op) => (
                      <option key={`cat-${op.nombre}`} value={op.nombre}>
                        {op.nombre} ({op.precio_barra.toFixed(2)}€)
                      </option>
                    ))}
                </optgroup>
              )}
            </select>

            <input
              type="text"
              required
              list="catalogo-platos-nexus"
              value={nombrePlato}
              onChange={(e) => handleSeleccionarPlatoCatalogo(e.target.value)}
              placeholder="Escribe el nombre del plato o elige arriba..."
              className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-lg px-3 py-1.5 text-xs font-bold text-white outline-none"
            />
            <datalist id="catalogo-platos-nexus">
              {opcionesCatalogoUnificadas.map((op) => (
                <option
                  key={op.nombre}
                  value={op.nombre}
                  label={`${op.origen === 'plantilla' ? '🍲 Plantilla' : '📋 Carta'} · ${op.precio_barra.toFixed(2)}€`}
                />
              ))}
            </datalist>

            <textarea
              rows={2}
              value={descripcionPlato}
              onChange={(e) => setDescripcionPlato(e.target.value)}
              placeholder="Descripción del guiso, ingredientes o guarnición..."
              className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-lg px-3 py-1.5 text-xs text-white outline-none"
            />
          </div>

          {/* BLOQUE 3: MÍNIMO DE RACIONES, PRECIOS Y ESTADO */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] font-black uppercase text-amber-400">Mín. Rac. *</label>
              <input
                type="number"
                min={1}
                required
                value={minRaciones}
                onChange={(e) => setMinRaciones(e.target.value)}
                className="w-full bg-slate-950 border border-amber-500/40 rounded-lg px-2 py-1.5 text-xs font-black text-amber-300 mt-0.5 text-center"
              />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-emerald-400">🪑 Barra (€)</label>
              <input
                type="number"
                step="0.01"
                min={0}
                required
                value={precioBarra}
                onChange={(e) => setPrecioBarra(e.target.value)}
                className="w-full bg-slate-950 border border-emerald-500/40 rounded-lg px-2 py-1.5 text-xs font-black text-emerald-400 mt-0.5 text-right"
              />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-cyan-400">🛍️ Takeaway (€)</label>
              <input
                type="number"
                step="0.01"
                min={0}
                required
                value={precioTakeaway}
                onChange={(e) => setPrecioTakeaway(e.target.value)}
                className="w-full bg-slate-950 border border-cyan-500/40 rounded-lg px-2 py-1.5 text-xs font-black text-cyan-300 mt-0.5 text-right"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <select
              value={estadoPlato}
              onChange={(e) => setEstadoPlato(e.target.value as EstadoGuiso)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white"
            >
              <option value="buscando_minimo">🟡 Buscando mínimo (Preventa abierta)</option>
              <option value="confirmado">🟢 ¡Confirmado para cocinar! (Pago activo)</option>
              <option value="cancelado">🔴 Cancelado (Muestra Plan B en web)</option>
            </select>
          </div>

          {/* BLOQUE 4: FOTOGRAFÍA OPCIONAL (SIN FOTOS INVENTADAS) + BOTÓN QUITAR IMAGEN */}
          <div className="space-y-1.5 pt-1.5 border-t border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <label className="text-[10px] font-black uppercase text-slate-400">
                📸 Foto (Opcional · 🍲 si vacío)
              </label>
              <div className="flex items-center gap-1">
                {imagenUrl.trim() !== '' && (
                  <button
                    type="button"
                    onClick={() => setImagenUrl('')}
                    className="text-[10px] bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded-md font-bold cursor-pointer whitespace-nowrap"
                  >
                    🗑️ Quitar imagen
                  </button>
                )}
                {fotosDisponiblesCatalogo.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setMostrarGaleriaCatalogo((prev) => !prev)}
                    className="text-[10px] bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-md font-bold cursor-pointer whitespace-nowrap"
                  >
                    {mostrarGaleriaCatalogo ? 'Cerrar galería' : '🖼️ Fotos carta'}
                  </button>
                )}
              </div>
            </div>

            <div className="flex gap-1.5">
              <input
                type="text"
                value={imagenUrl}
                onChange={(e) => setImagenUrl(e.target.value)}
                placeholder="Sin foto (icono 🍲 elegante) o pega URL..."
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
              />
              {imagenUrl.trim() !== '' && (
                <button
                  type="button"
                  onClick={() => setImagenUrl('')}
                  className="px-2.5 py-1 rounded-lg bg-rose-950/60 hover:bg-rose-900/60 border border-rose-500/40 text-rose-300 text-xs font-black cursor-pointer"
                  title="Quitar imagen"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex items-center justify-between gap-2">
              <input
                type="file"
                accept="image/*"
                onChange={manejarSubidaImagenGuiso}
                className="text-[10px] text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:font-bold file:bg-slate-800 file:text-slate-200"
              />
              {imagenUrl.trim() !== '' ? (
                <img
                  src={imagenUrl}
                  alt="Preview"
                  className="h-8 w-11 rounded-md object-cover border border-slate-700 shrink-0"
                />
              ) : (
                <span className="text-[10px] text-slate-500 italic whitespace-nowrap">🍲 Sin foto</span>
              )}
            </div>

            {mostrarGaleriaCatalogo && fotosDisponiblesCatalogo.length > 0 && (
              <div className="bg-slate-950 border border-indigo-500/30 rounded-xl p-2 space-y-1.5 max-h-44 overflow-y-auto">
                <div className="grid grid-cols-3 gap-1.5">
                  {fotosDisponiblesCatalogo.map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setImagenUrl(item.url);
                        setMostrarGaleriaCatalogo(false);
                      }}
                      className="group relative rounded-lg overflow-hidden border border-slate-800 hover:border-amber-400 text-left h-14 cursor-pointer"
                    >
                      <img src={item.url} alt={item.nombre} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent p-1 flex items-end">
                        <span className="text-[9px] font-bold text-white leading-tight line-clamp-1">
                          {item.nombre}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={guardandoGuiso}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-50 text-slate-950 font-black py-2.5 rounded-xl shadow-lg text-xs uppercase tracking-wider transition-all cursor-pointer"
          >
            {guardandoGuiso
              ? 'Guardando en Supabase...'
              : editandoGuisoId
              ? '💾 Guardar Cambios del Guiso'
              : fechasSeleccionadas.length > 1
              ? `🍲 Publicar Guiso en ${fechasSeleccionadas.length} Días`
              : '🍲 Publicar Guiso en el Calendario'}
          </button>
        </form>

        {/* ================= COLUMNA DERECHA (8 cols): LISTADO ULTRACOMPACTO Y ACCIONES MASIVAS ================= */}
        <div className="lg:col-span-8 space-y-3">
          {/* BARRA SUPERIOR DE FILTRO ESTRICTO DE SEMANA, SELECCIÓN Y BORRADO POR DÍAS */}
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-3 space-y-2.5">
            {/* FILA 1: NAVEGACIÓN ESTRICTA DE SEMANA (LUNES A DOMINGO) + FILTROS DE ESTADO */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setSemanaListadoOffset((prev) => prev - 1);
                    setModoFiltroSemana('SEMANA_COMPLETA');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] font-bold text-slate-300 whitespace-nowrap cursor-pointer"
                >
                  ◀ Sem. ant.
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSemanaListadoOffset(0);
                    setModoFiltroSemana('SEMANA_COMPLETA');
                  }}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-black whitespace-nowrap cursor-pointer ${
                    modoFiltroSemana !== 'TODAS' && semanaListadoOffset === 0
                      ? 'bg-amber-500 text-slate-950 border-amber-400'
                      : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  Esta semana
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSemanaListadoOffset(1);
                    setModoFiltroSemana('SEMANA_COMPLETA');
                  }}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-black whitespace-nowrap cursor-pointer ${
                    modoFiltroSemana !== 'TODAS' && semanaListadoOffset === 1
                      ? 'bg-amber-500 text-slate-950 border-amber-400'
                      : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  Próxima sem. ▶
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setModoFiltroSemana((prev) =>
                      prev === 'TODAS' ? 'SEMANA_COMPLETA' : 'TODAS'
                    )
                  }
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold whitespace-nowrap cursor-pointer ${
                    modoFiltroSemana === 'TODAS'
                      ? 'bg-indigo-600 text-white border-indigo-400'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  📋 Todas las fechas
                </button>
              </div>

              {/* FILTRO POR ESTADO */}
              <div className="flex flex-wrap gap-1">
                {[
                  { id: 'TODOS', label: 'Todos' },
                  { id: 'buscando_minimo', label: '🟡 Preventa' },
                  { id: 'confirmado', label: '🟢 Confirmados' },
                  { id: 'cancelado', label: '🔴 Cancelados' }
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFiltroEstadoVista(f.id as any)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                      filtroEstadoVista === f.id
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-900 text-slate-400 hover:text-white'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* FILA 2: PESTAÑAS ESTRICTAS DE LA SEMANA ACTIVA (SEMANA COMPLETA LUN-DOM + 7 DÍAS) */}
            {modoFiltroSemana !== 'TODAS' && (
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-1">
                <button
                  type="button"
                  onClick={() => setModoFiltroSemana('SEMANA_COMPLETA')}
                  className={`p-1.5 rounded-lg border text-left transition-all cursor-pointer ${
                    modoFiltroSemana === 'SEMANA_COMPLETA'
                      ? 'bg-amber-500/20 border-amber-400 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="block text-[9px] font-black uppercase text-amber-400">
                    Semana completa
                  </span>
                  <span className="block text-[10px] font-bold truncate">
                    {rangoSemanaListadoTexto}
                  </span>
                </button>

                {diasSemanaListado.map((dia) => {
                  const countDia = guisos.filter((g) => g.fecha === dia.fecha).length;
                  const activo =
                    modoFiltroSemana === 'DIA_CONCRETO' && diaFiltroListado === dia.fecha;
                  return (
                    <button
                      key={dia.fecha}
                      type="button"
                      onClick={() => {
                        setModoFiltroSemana('DIA_CONCRETO');
                        setDiaFiltroListado(dia.fecha);
                      }}
                      className={`p-1.5 rounded-lg border text-left transition-all cursor-pointer ${
                        activo
                          ? 'bg-cyan-500/20 border-cyan-400 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black uppercase">{dia.label.slice(0, 3)}</span>
                        <span className="text-[9px] font-bold text-slate-400">{dia.corto}</span>
                      </div>
                      <span
                        className={`block text-[10px] font-black mt-0.5 ${
                          countDia > 0 ? 'text-amber-300' : 'text-slate-600'
                        }`}
                      >
                        {countDia} {countDia === 1 ? 'plato' : 'platos'}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* FILA 3: SELECCIONAR TODOS LOS VISIBLES + BOTÓN "🗑️ BORRAR POR DÍAS..." + CONFIG PAGO WA */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={toggleSeleccionarTodosVisibles}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] font-bold text-slate-200 cursor-pointer whitespace-nowrap"
                >
                  {todosVisiblesSeleccionados
                    ? '⬜ Desmarcar visibles'
                    : `☑️ Seleccionar todos los visibles (${guisosFiltrados.length})`}
                </button>

                <button
                  type="button"
                  onClick={() => setMostrarPanelBorrarPorDias((prev) => !prev)}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold cursor-pointer whitespace-nowrap transition-colors ${
                    mostrarPanelBorrarPorDias
                      ? 'bg-rose-600 text-white border-rose-400'
                      : 'bg-rose-950/40 hover:bg-rose-900/50 border-rose-500/40 text-rose-300'
                  }`}
                >
                  🗑️ Borrar por días...
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setTempTelefonoWA(configPago.telefonoWhatsAppBar);
                    setTempBizum(configPago.numeroBizum);
                    setTempEnlacePago(configPago.enlacePago);
                    setTempInstruccionesPago(configPago.instruccionesPago);
                    setMostrarModalConfigPago(true);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/50 text-emerald-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-sm"
                  title="Configurar teléfono WhatsApp de cobro, Bizum y enlaces de pago"
                >
                  <span>⚙️ Configurar WhatsApp y Datos de Pago</span>
                  <span className="text-[10px] bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-500/40 text-emerald-200">
                    Bizum: {configPago.numeroBizum}
                  </span>
                </button>
              </div>
            </div>

            {/* MODAL / PANEL DESPLEGABLE: ⚙️ CONFIGURACIÓN DE WHATSAPP Y DATOS DE PAGO */}
            {mostrarModalConfigPago && (
              <div className="bg-slate-900/95 border-2 border-emerald-500/60 rounded-2xl p-4 sm:p-5 space-y-4 shadow-2xl backdrop-blur-md animate-in fade-in-50">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">⚙️</span>
                    <div>
                      <h4 className="text-sm font-black text-white">
                        Configuración de WhatsApp y Datos de Pago
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Estos datos se inyectan automáticamente en los emails de Resend y en los mensajes redactados de WhatsApp.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMostrarModalConfigPago(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-[10px] font-black uppercase text-emerald-400 block mb-1">
                      📱 Teléfono WhatsApp del Bar (recepción de justificantes)
                    </label>
                    <input
                      type="text"
                      value={tempTelefonoWA}
                      onChange={(e) => setTempTelefonoWA(e.target.value)}
                      placeholder="Ej: 34624454242 o 624 45 42 42"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:border-emerald-400 outline-none"
                    />
                    <span className="text-[10px] text-slate-500 mt-0.5 block">
                      Número donde los clientes enviarán su confirmación o captura de Bizum.
                    </span>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-emerald-400 block mb-1">
                      💳 Número de Bizum para pagos
                    </label>
                    <input
                      type="text"
                      value={tempBizum}
                      onChange={(e) => setTempBizum(e.target.value)}
                      placeholder="Ej: 624 45 42 42"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-amber-300 font-bold font-mono focus:border-emerald-400 outline-none"
                    />
                    <span className="text-[10px] text-slate-500 mt-0.5 block">
                      Aparecerá en el bloque destacado de pago en emails y WhatsApp.
                    </span>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-300 block mb-1">
                      🌐 Enlace de Pago Web / Tarjeta (Opcional)
                    </label>
                    <input
                      type="url"
                      value={tempEnlacePago}
                      onChange={(e) => setTempEnlacePago(e.target.value)}
                      placeholder="https://www.nexusgamingcenter.es/#guisos"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-emerald-400 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-300 block mb-1">
                      📝 Instrucciones adicionales de pago
                    </label>
                    <input
                      type="text"
                      value={tempInstruccionesPago}
                      onChange={(e) => setTempInstruccionesPago(e.target.value)}
                      placeholder="Ej: Indicar en el concepto GUISO y tu Nombre completo"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-emerald-400 outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setMostrarModalConfigPago(false)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const guardado = guardarConfiguracionPagoGuisos({
                        telefonoWhatsAppBar: tempTelefonoWA,
                        numeroBizum: tempBizum,
                        enlacePago: tempEnlacePago,
                        instruccionesPago: tempInstruccionesPago
                      });
                      setConfigPago(guardado);
                      setEnlacePagoConfig(guardado.enlacePago);
                      notificar('⚙️ Configuración de WhatsApp y Datos de Pago guardada.', 'ok');
                      setMostrarModalConfigPago(false);
                    }}
                    className="px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs cursor-pointer shadow-lg"
                  >
                    💾 Guardar Configuración
                  </button>
                </div>
              </div>
            )}

            {/* PANEL DESPLEGABLE: BORRADO RÁPIDO POR DÍAS DE LA SEMANA ACTIVA */}
            {mostrarPanelBorrarPorDias && (
              <div className="bg-rose-950/25 border border-rose-500/40 rounded-xl p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-black text-rose-300">
                    🗑️ Marca los días de la semana ({rangoSemanaListadoTexto}) que deseas vaciar:
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      ejecutarBorradoPorDias(
                        diasSemanaListado.map((d) => d.fecha),
                        `toda la semana (${rangoSemanaListadoTexto})`
                      )
                    }
                    className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-black cursor-pointer whitespace-nowrap"
                  >
                    🗓️ Vaciar semana completa
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {diasSemanaListado.map((d) => {
                    const cant = guisos.filter((g) => g.fecha === d.fecha).length;
                    const marcado = diasMarcadosParaBorrar.includes(d.fecha);
                    return (
                      <button
                        key={d.fecha}
                        type="button"
                        onClick={() => toggleDiaParaBorrar(d.fecha)}
                        className={`p-1.5 rounded-lg border text-center cursor-pointer transition-all ${
                          marcado
                            ? 'bg-rose-600 text-white border-rose-300 font-black'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-rose-500/40'
                        }`}
                      >
                        <span className="block text-[9px] uppercase">{d.label.slice(0, 3)}</span>
                        <span className="block text-[10px]">{d.corto}</span>
                        <span className="block text-[9px] opacity-80">({cant})</span>
                      </button>
                    );
                  })}
                </div>

                {diasMarcadosParaBorrar.length > 0 && (
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      disabled={ejecutandoLote}
                      onClick={() =>
                        ejecutarBorradoPorDias(
                          diasMarcadosParaBorrar,
                          `${diasMarcadosParaBorrar.length} día(s) seleccionado(s)`
                        )
                      }
                      className="px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-400 text-slate-950 font-black text-xs cursor-pointer"
                    >
                      🗑️ Eliminar guisos de los días marcados ({diasMarcadosParaBorrar.length})
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* BARRA DE ACCIONES EN LOTE (APARECE AL TENER 1 O MÁS GUISOS MARCADOS) */}
            {idsSeleccionados.length > 0 && (
              <div className="bg-indigo-950/40 border border-indigo-500/50 rounded-xl p-3 space-y-2.5 shadow-lg">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-black text-indigo-200">
                    ⚡ {idsSeleccionados.length} guiso(s) seleccionado(s) — Edición Masiva en Bloque:
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={ejecutandoLote}
                      onClick={eliminarSeleccionadosEnBloque}
                      className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-black text-[11px] cursor-pointer whitespace-nowrap"
                    >
                      🗑️ Eliminar seleccionados ({idsSeleccionados.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setIdsSeleccionados([])}
                      className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-[11px] font-bold cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-6 gap-1.5 items-end">
                  <div>
                    <label className="text-[9px] font-bold uppercase text-slate-400 block">
                      Mín. Raciones
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={loteMinRaciones}
                      onChange={(e) => setLoteMinRaciones(e.target.value)}
                      placeholder="Sin cambio"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-bold uppercase text-slate-400 block">
                      🪑 Barra (€)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      value={lotePrecioBarra}
                      onChange={(e) => setLotePrecioBarra(e.target.value)}
                      placeholder="Sin cambio"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-bold uppercase text-slate-400 block">
                      🛍️ Llevar (€)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      value={lotePrecioTakeaway}
                      onChange={(e) => setLotePrecioTakeaway(e.target.value)}
                      placeholder="Sin cambio"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-bold uppercase text-slate-400 block">
                      Margen Corte
                    </label>
                    <select
                      value={loteMargenCorte}
                      onChange={(e) => setLoteMargenCorte(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
                    >
                      <option value="">Sin cambio</option>
                      <option value="1">-1 día antes</option>
                      <option value="2">-2 días antes</option>
                      <option value="0">Mismo día</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[9px] font-bold uppercase text-slate-400 block">
                      Hora Corte
                    </label>
                    <input
                      type="time"
                      value={loteHoraCorte}
                      onChange={(e) => setLoteHoraCorte(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-bold uppercase text-slate-400 block">
                      Estado
                    </label>
                    <select
                      value={loteEstado}
                      onChange={(e) => setLoteEstado(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
                    >
                      <option value="">Sin cambio</option>
                      <option value="buscando_minimo">🟡 Preventa</option>
                      <option value="confirmado">🟢 Confirmado</option>
                      <option value="cancelado">🔴 Cancelado</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={ejecutandoLote}
                    onClick={aplicarEdicionMasivaEnBloque}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs cursor-pointer transition-all"
                  >
                    {ejecutandoLote
                      ? 'Aplicando cambios...'
                      : `💾 Aplicar cambios a los ${idsSeleccionados.length} seleccionados`}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* GRID ULTRACOMPACTO DE GUISOS PROGRAMADOS (grid-cols-1 xl:grid-cols-2 gap-2.5 con p-3) */}
          {cargando ? (
            <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 text-center text-xs text-slate-400">
              Cargando programación de guisos y reservas en tiempo real...
            </div>
          ) : guisosFiltrados.length === 0 ? (
            <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 text-center space-y-2">
              <p className="text-sm font-black text-white">
                No hay guisos programados en este rango ({rangoSemanaListadoTexto})
              </p>
              <p className="text-xs text-slate-400">
                Usa el formulario de la izquierda (con selección múltiple de días) o cambia de semana arriba.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-2.5">
              {guisosFiltrados.map((guiso) => {
                const listaReservasGuiso = reservasPorGuiso.get(guiso.id) || [];
                const racionesApuntadas = listaReservasGuiso.reduce(
                  (acc, r) => acc + Number(r.raciones || 0),
                  0
                );
                const racionesBarra = listaReservasGuiso
                  .filter((r) => r.modalidad === 'barra')
                  .reduce((acc, r) => acc + Number(r.raciones || 0), 0);
                const racionesTakeaway = listaReservasGuiso
                  .filter((r) => r.modalidad === 'takeaway')
                  .reduce((acc, r) => acc + Number(r.raciones || 0), 0);
                const minReq = Math.max(1, Number(guiso.min_raciones || 1));
                const porcentaje = Math.min(100, Math.round((racionesApuntadas / minReq) * 100));
                const desplegado = guisoDesplegadoId === guiso.id;
                const fotoReal = limpiarUrlUnsplashFalsa(guiso.imagen_url);
                const seleccionado = idsSeleccionados.includes(guiso.id);

                return (
                  <div
                    key={guiso.id}
                    className={`bg-[#0f172a] border rounded-xl overflow-hidden transition-all ${
                      seleccionado
                        ? 'border-indigo-400 ring-1 ring-indigo-400/50'
                        : guiso.estado === 'confirmado'
                        ? 'border-emerald-500/50'
                        : guiso.estado === 'cancelado'
                        ? 'border-rose-500/40 opacity-80'
                        : 'border-slate-800'
                    }`}
                  >
                    <div className="p-3 space-y-2">
                      {/* LÍNEA SUPERIOR: CHECKBOX + MINIATURA (w-10 h-10) + NOMBRE + PÍLDORA FECHA/CORTE + PRECIOS EN LÍNEA */}
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={seleccionado}
                          onChange={() => toggleSeleccionGuiso(guiso.id)}
                          className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-amber-500 focus:ring-0 cursor-pointer shrink-0"
                        />

                        {fotoReal ? (
                          <img
                            src={fotoReal}
                            alt={guiso.nombre_plato}
                            className="w-10 h-10 rounded-lg object-cover border border-slate-700 shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500/20 to-slate-900 border border-amber-500/30 flex items-center justify-center text-base shrink-0">
                            🍲
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-1">
                            <h4 className="text-sm font-bold text-white truncate">
                              {guiso.nombre_plato}
                            </h4>
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-amber-300 whitespace-nowrap">
                              📅 {formatearFechaHumana(guiso.fecha)} · 🛑 {formatearFechaCorteHumana(guiso)}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300 mt-0.5">
                            <span className="whitespace-nowrap">
                              Barra: <strong className="text-emerald-400">{Number(guiso.precio_barra).toFixed(2)}€</strong>
                              {' · '}
                              Takeaway: <strong className="text-cyan-300">{Number(guiso.precio_takeaway).toFixed(2)}€</strong>
                            </span>
                            {guiso.descripcion && (
                              <span className="text-[10px] text-slate-500 truncate max-w-[180px]">
                                {guiso.descripcion}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* LÍNEA INFERIOR: EN UNA MISMA FILA HORIZONTAL -> BADGE ESTADO + PROGRESO + CLIENTES + ACCIONES COMPACTAS */}
                      <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1.5 border-t border-slate-800/80">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          {guiso.estado === 'confirmado' && (
                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 whitespace-nowrap">
                              🟢 Conf.
                            </span>
                          )}
                          {guiso.estado === 'buscando_minimo' && (
                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 whitespace-nowrap">
                              🟡 Prev.
                            </span>
                          )}
                          {guiso.estado === 'cancelado' && (
                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-rose-500/20 border border-rose-500/40 text-rose-300 whitespace-nowrap">
                              🔴 Canc.
                            </span>
                          )}

                          {/* BARRA DE PROGRESO COMPACTA + DESGLOSE SALA/LLEVAR */}
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <div className="w-14 h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800 shrink-0">
                              <div
                                className={`h-full rounded-full ${
                                  guiso.estado === 'confirmado' || racionesApuntadas >= minReq
                                    ? 'bg-emerald-400'
                                    : guiso.estado === 'cancelado'
                                    ? 'bg-rose-500'
                                    : 'bg-amber-400'
                                }`}
                                style={{ width: `${porcentaje}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-bold text-slate-300 whitespace-nowrap">
                              <strong className="text-white">
                                {racionesApuntadas}/{minReq}
                              </strong>{' '}
                              rac. · {racionesBarra} sala / {racionesTakeaway} llevar
                            </span>
                          </div>
                        </div>

                        {/* BOTÓN DESPLEGABLE CLIENTES + BOTONES DE ACCIÓN COMPACTOS */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => setGuisoDesplegadoId(desplegado ? null : guiso.id)}
                            className="text-xs px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-300 font-bold cursor-pointer whitespace-nowrap"
                          >
                            {desplegado ? '▼' : '▶'} Clientes ({listaReservasGuiso.length})
                          </button>

                          {guiso.estado !== 'confirmado' && (
                            <button
                              type="button"
                              onClick={() => forzarConfirmacionGuiso(guiso)}
                              className="text-xs px-2 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/40 font-black cursor-pointer whitespace-nowrap"
                              title="Forzar confirmación del plato"
                            >
                              ✓ Confirmar
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => copiarGuisoRestoSemana(guiso)}
                            className="text-xs px-2 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 font-bold cursor-pointer whitespace-nowrap"
                            title="Clonar este plato en el resto de días libres de esa semana"
                          >
                            📋 Copiar sem.
                          </button>

                          <button
                            type="button"
                            onClick={() => cargarParaEditar(guiso)}
                            className="text-xs px-2 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 font-bold cursor-pointer"
                            title="Editar guiso"
                          >
                            ✏️
                          </button>

                          {guiso.estado !== 'cancelado' && (
                            <button
                              type="button"
                              onClick={() => cancelarGuisoPlanB(guiso)}
                              className="text-xs px-2 py-1 rounded-lg bg-amber-600/20 hover:bg-amber-600/40 text-amber-300 border border-amber-500/30 font-bold cursor-pointer"
                              title="Cancelar plato (activar Plan B)"
                            >
                              🚫
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => eliminarGuisoDefinitivamente(guiso)}
                            className="text-xs px-2 py-1 rounded-lg bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-500/30 font-bold cursor-pointer"
                            title="Eliminar definitivamente"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* DESGLOSE DESPLEGABLE DE CLIENTES APUNTADOS */}
                    {desplegado && (
                      <div className="border-t border-slate-800 bg-slate-950/90 p-2.5 space-y-2">
                        {listaReservasGuiso.length === 0 ? (
                          <p className="text-[11px] text-slate-400 text-center py-1.5">
                            Aún no hay clientes apuntados a este guiso.
                          </p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-[11px]">
                              <thead>
                                <tr className="text-[9px] uppercase text-slate-400 border-b border-slate-800">
                                  <th className="p-1.5">Cliente</th>
                                  <th className="p-1.5">Tel / Email</th>
                                  <th className="p-1.5 text-center">Rac.</th>
                                  <th className="p-1.5 text-right">Total</th>
                                  <th className="p-1.5 text-center">Pago</th>
                                  <th className="p-1.5 text-right">Acciones</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800/60">
                                {listaReservasGuiso.map((res) => {
                                  const importeCliente = calcularImporteReserva(
                                    guiso,
                                    res.raciones,
                                    res.modalidad
                                  );
                                  const waUrl = generarEnlaceWhatsAppAdminAClienteConfirmacion(
                                    res,
                                    guiso,
                                    enlacePagoConfig
                                  );

                                  return (
                                    <tr key={res.id} className="hover:bg-slate-900/50">
                                      <td className="p-1.5 font-bold text-white">{res.nombre_cliente}</td>
                                      <td className="p-1.5">
                                        <span className="font-bold text-slate-200">{res.telefono}</span>
                                        {res.email && (
                                          <span className="text-[9px] text-cyan-400 block">{res.email}</span>
                                        )}
                                      </td>
                                      <td className="p-1.5 text-center whitespace-nowrap">
                                        <span className="font-black text-white">{res.raciones}</span>{' '}
                                        <span className="text-[10px] text-amber-300">
                                          {res.modalidad === 'takeaway' ? '🛍️' : '🪑'}
                                        </span>
                                      </td>
                                      <td className="p-1.5 text-right font-black text-emerald-400">
                                        {importeCliente.toFixed(2)}€
                                      </td>
                                      <td className="p-1.5 text-center">
                                        <button
                                          type="button"
                                          onClick={() => alternarEstadoPagoReserva(res)}
                                          className={`px-1.5 py-0.5 rounded font-black text-[9px] uppercase cursor-pointer ${
                                            res.estado_pago === 'pagado'
                                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                          }`}
                                        >
                                          {res.estado_pago === 'pagado' ? '✅ Pagado' : '⏳ Pend.'}
                                        </button>
                                      </td>
                                      <td className="p-1.5 text-right">
                                          <div className="flex items-center justify-end gap-1.5">
                                            <a
                                              href={waUrl}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] whitespace-nowrap shadow-sm flex items-center gap-1 cursor-pointer"
                                              title="Abrir WhatsApp para enviar instrucciones de pago y Bizum"
                                            >
                                              <span>📲</span>
                                              <span>WhatsApp Pago</span>
                                            </a>
                                            <button
                                              type="button"
                                              onClick={() => eliminarReservaCliente(res)}
                                              className="px-1.5 py-1 rounded-lg bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 text-[10px] font-bold cursor-pointer"
                                              title="Eliminar reserva"
                                            >
                                              🗑️
                                            </button>
                                          </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
