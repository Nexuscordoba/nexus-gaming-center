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

// Plantillas por defecto SIN URLs falsas de Unsplash (imagen_url vacío por defecto)
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

  // Estado del formulario de creación / edición
  const hoyInicial = useMemo(() => formatFechaISO(new Date()), []);
  const [editandoGuisoId, setEditandoGuisoId] = useState<string | null>(null);
  const [semanaSelectorOffset, setSemanaSelectorOffset] = useState<number>(0);
  const [fechaPlato, setFechaPlato] = useState<string>(hoyInicial);
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

  // Control de listado y desgloses desplegables
  const [filtroEstadoVista, setFiltroEstadoVista] = useState<'TODOS' | EstadoGuiso>('TODOS');
  const [filtroSemanaListado, setFiltroSemanaListado] = useState<'TODAS' | 'ACTUAL' | 'SIGUIENTE'>('TODAS');
  const [guisoDesplegadoId, setGuisoDesplegadoId] = useState<string | null>(null);
  const [enlacePagoConfig, setEnlacePagoConfig] = useState<string>(() => {
    return (
      localStorage.getItem('nexus_guisos_link_pago') ||
      'Bizum / Pago en Barra (Nexus Chinales 45) · https://www.nexusgamingcenter.es/#guisos'
    );
  });

  const diasSemanaFormulario = useMemo(() => obtenerDiasSemana(semanaSelectorOffset), [semanaSelectorOffset]);
  const fechasSemanaActualSet = useMemo(
    () => new Set(obtenerDiasSemana(0).map((d) => d.fecha)),
    []
  );
  const fechasSemanaSiguienteSet = useMemo(
    () => new Set(obtenerDiasSemana(1).map((d) => d.fecha)),
    []
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

  // Al cambiar la fecha en que se sirve el guiso, autocompletar por defecto fecha_corte (-1 día) y hora_corte ('21:00')
  const cambiarFechaServicio = (nuevaFechaServicio: string) => {
    setFechaPlato(nuevaFechaServicio);
    if (nuevaFechaServicio) {
      setFechaCorte(calcularFechaCorteMenosDias(nuevaFechaServicio, 1));
      setHoraCorte('21:00');
    }
  };

  const aplicarCorteRapido = (diasAntes: number, hora: string = '21:00') => {
    if (!fechaPlato) return;
    setFechaCorte(calcularFechaCorteMenosDias(fechaPlato, diasAntes));
    setHoraCorte(hora);
  };

  const limpiarFormulario = () => {
    setEditandoGuisoId(null);
    setNombrePlato('');
    setDescripcionPlato('');
    setMinRaciones('8');
    setPrecioBarra('9.50');
    setPrecioTakeaway('8.50');
    setImagenUrl('');
    setFechaCorte(calcularFechaCorteMenosDias(fechaPlato, 1));
    setHoraCorte('21:00');
    setEstadoPlato('buscando_minimo');
  };

  // SIEMPRE actualiza descripción, precios, mínimo de raciones y foto (o la deja vacía si no tiene)
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
      imagen_url: imagenUrl.trim()
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

  const guardarGuiso = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombrePlato.trim() || !fechaPlato || guardandoGuiso) return;

    const minNum = Math.max(1, parseInt(minRaciones, 10) || 8);
    const pBarra = Math.max(0, parseFloat(precioBarra) || 0);
    const pTakeaway = Math.max(0, parseFloat(precioTakeaway) || 0);
    const fechaCorteFinal = fechaCorte || calcularFechaCorteMenosDias(fechaPlato, 1);

    setGuardandoGuiso(true);
    try {
      const payloadBase = {
        fecha: fechaPlato,
        hora_corte: (horaCorte || '21:00').trim(),
        nombre_plato: nombrePlato.trim(),
        descripcion: descripcionPlato.trim(),
        min_raciones: minNum,
        precio_barra: Number(pBarra.toFixed(2)),
        precio_takeaway: Number(pTakeaway.toFixed(2)),
        imagen_url: imagenUrl.trim(), // Vacío si no se ha asignado foto real
        estado: estadoPlato
      };

      const payloadConFechaCorte = {
        ...payloadBase,
        fecha_corte: fechaCorteFinal
      };

      if (editandoGuisoId) {
        const { error } = await supabase
          .from('guisos_programados')
          .update(payloadConFechaCorte)
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
        const { error } = await supabase.from('guisos_programados').insert([payloadConFechaCorte]);
        if (error) {
          const { error: fallbackErr } = await supabase.from('guisos_programados').insert([payloadBase]);
          if (fallbackErr) throw fallbackErr;
        }
        notificar(
          `Guiso "${payloadBase.nombre_plato}" programado para el ${formatearFechaHumana(payloadBase.fecha)}.`,
          'ok'
        );
      }

      limpiarFormulario();
      await cargarGuisosYReservas();
    } catch (err: any) {
      notificar('Error al guardar el guiso: ' + (err?.message || 'Revisa la tabla en Supabase'), 'error');
    } finally {
      setGuardandoGuiso(false);
    }
  };

  const cargarParaEditar = (guiso: GuisoProgramado) => {
    setEditandoGuisoId(guiso.id);
    setFechaPlato(guiso.fecha);
    setFechaCorte(obtenerFechaCorteEfectiva(guiso));
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
      notificar(
        `🟢 "${guiso.nombre_plato}" confirmado manualmente. ¡Ya puedes enviar los avisos de WhatsApp a los clientes!`,
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
      `¿Marcar "${guiso.nombre_plato}" como CANCELADO?\n\nEn la web pública (#guisos) se mostrará automáticamente el "Plan B Inteligente" sugiriendo los otros guisos confirmados del día y el menú de sala.`
    );
    if (!ok) return;

    try {
      const { error } = await supabase
        .from('guisos_programados')
        .update({ estado: 'cancelado' })
        .eq('id', guiso.id);
      if (error) throw error;
      notificar(`Plato "${guiso.nombre_plato}" marcado como cancelado (Plan B activo en web).`, 'info');
      await cargarGuisosYReservas();
    } catch (err: any) {
      notificar('Error al cancelar guiso: ' + err.message, 'error');
    }
  };

  const eliminarGuisoDefinitivamente = async (guiso: GuisoProgramado) => {
    const ok = window.confirm(
      `¿Eliminar definitivamente "${guiso.nombre_plato}" (${guiso.fecha}) y todas sus reservas asociadas? Esta acción no se puede deshacer.`
    );
    if (!ok) return;

    try {
      const { error } = await supabase.from('guisos_programados').delete().eq('id', guiso.id);
      if (error) throw error;
      notificar(`Guiso "${guiso.nombre_plato}" eliminado de la base de datos.`, 'ok');
      if (editandoGuisoId === guiso.id) limpiarFormulario();
      await cargarGuisosYReservas();
    } catch (err: any) {
      notificar('Error al eliminar guiso: ' + err.message, 'error');
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

  const guisosFiltrados = useMemo(() => {
    return guisos.filter((g) => {
      if (filtroEstadoVista !== 'TODOS' && g.estado !== filtroEstadoVista) return false;
      if (filtroSemanaListado === 'ACTUAL' && !fechasSemanaActualSet.has(g.fecha)) return false;
      if (filtroSemanaListado === 'SIGUIENTE' && !fechasSemanaSiguienteSet.has(g.fecha)) return false;
      return true;
    });
  }, [guisos, filtroEstadoVista, filtroSemanaListado, fechasSemanaActualSet, fechasSemanaSiguienteSet]);

  return (
    <div className="space-y-6">
      {/* CABECERA Y MÉTRICAS EN TIEMPO REAL */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <span>🍲 Gestión de Guisos Bajo Demanda y Preventa</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Programa los guisos de la semana, controla las raciones reservadas en vivo y avisa por WhatsApp con un toque.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="#guisos"
            target="_blank"
            rel="noreferrer"
            className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 px-4 py-2.5 rounded-2xl font-black text-xs transition-all"
          >
            🌐 Ver Vista Pública (#guisos)
          </a>
          <button
            type="button"
            onClick={cargarGuisosYReservas}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2.5 rounded-2xl font-bold text-xs transition-all cursor-pointer"
          >
            🔄 Sincronizar
          </button>
        </div>
      </div>

      {/* TARJETAS DE RESUMEN DE PREVENTA */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0f172a] border border-slate-800 p-4 rounded-3xl">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Guisos en Preventa / Confirmados
          </span>
          <p className="text-2xl font-black text-white mt-1">
            <span className="text-emerald-400">{metricasGlobales.confirmados} confirmados</span> ·{' '}
            <span className="text-amber-400">{metricasGlobales.buscando} en curso</span>
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Total programados: {metricasGlobales.totalGuisos}</p>
        </div>

        <div className="bg-[#0f172a] border border-slate-800 p-4 rounded-3xl">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Raciones Totales Reservadas
          </span>
          <p className="text-3xl font-black text-cyan-400 mt-1">{metricasGlobales.totalRaciones} raciones</p>
          <p className="text-[11px] text-slate-400 mt-1">{reservas.length} clientes apuntados</p>
        </div>

        <div className="bg-[#0f172a] border border-slate-800 p-4 rounded-3xl">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Importe Ya Abonado (Pagado)
          </span>
          <p className="text-3xl font-black text-emerald-400 mt-1">{metricasGlobales.importePagado.toFixed(2)}€</p>
          <p className="text-[11px] text-slate-400 mt-1">Reservas confirmadas y cobradas</p>
        </div>

        <div className="bg-[#0f172a] border border-slate-800 p-4 rounded-3xl">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Pendiente de Cobro (Preventa)
          </span>
          <p className="text-3xl font-black text-amber-400 mt-1">{metricasGlobales.importePendiente.toFixed(2)}€</p>
          <p className="text-[11px] text-slate-400 mt-1">Por formalizar al confirmar plato</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ================= COLUMNA IZQUIERDA: FORMULARIO ÁGIL DE GUISOS ================= */}
        <form
          onSubmit={guardarGuiso}
          className="lg:col-span-5 bg-[#0f172a] border border-slate-800 rounded-3xl p-5 space-y-4 self-start"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-base font-black text-white">
              {editandoGuisoId ? '✏️ Editando Guiso Programado' : '➕ Programar Guiso del Día'}
            </h3>
            {editandoGuisoId && (
              <button
                type="button"
                onClick={limpiarFormulario}
                className="text-xs font-bold text-rose-400 hover:underline cursor-pointer"
              >
                Cancelar edición
              </button>
            )}
          </div>

          {/* BLOQUE 1: SELECTOR ÁGIL DE DÍA DE LA SEMANA + FECHA Y HORA DE CORTE */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-3">
            {/* TÍTULO ARRIBA Y BOTONES DE NAVEGACIÓN DE SEMANA EN UNA SOLA LÍNEA CON WHITESPACE-NOWRAP */}
            <div className="space-y-2">
              <label className="block text-[10px] font-black uppercase tracking-wider text-amber-400">
                📅 1. Elige Día de la Semana o Fecha Exacta
              </label>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setSemanaSelectorOffset((prev) => prev - 1)}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] font-bold text-slate-300 whitespace-nowrap text-center transition-colors cursor-pointer"
                >
                  ◀ Sem. ant.
                </button>
                <button
                  type="button"
                  onClick={() => setSemanaSelectorOffset(0)}
                  className="px-3 py-1.5 rounded-xl bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-500/40 text-[11px] font-black text-cyan-300 whitespace-nowrap text-center transition-colors cursor-pointer"
                >
                  Actual
                </button>
                <button
                  type="button"
                  onClick={() => setSemanaSelectorOffset((prev) => prev + 1)}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] font-bold text-slate-300 whitespace-nowrap text-center transition-colors cursor-pointer"
                >
                  Sem. sig. ▶
                </button>
              </div>
            </div>

            {/* PÍLDORAS DE LUNES A DOMINGO */}
            <div className="grid grid-cols-7 gap-1">
              {diasSemanaFormulario.map((d) => {
                const activo = fechaPlato === d.fecha;
                return (
                  <button
                    key={d.fecha}
                    type="button"
                    onClick={() => cambiarFechaServicio(d.fecha)}
                    className={`py-2 px-1 rounded-xl text-center transition-all border cursor-pointer ${
                      activo
                        ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-md'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700 font-bold'
                    }`}
                  >
                    <span className="block text-[9px] uppercase">{d.label.slice(0, 3)}</span>
                    <span className="block text-[11px] mt-0.5">{d.corto}</span>
                  </button>
                );
              })}
            </div>

            {/* FECHA DEL GUISO */}
            <div className="pt-1">
              <label className="text-[10px] font-bold text-slate-300 block">
                🍽️ Fecha en que se sirve el Guiso
              </label>
              <input
                type="date"
                required
                value={fechaPlato}
                onChange={(e) => cambiarFechaServicio(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 focus:border-amber-400 rounded-xl px-3 py-2 text-xs font-bold text-white mt-1 outline-none"
              />
            </div>

            {/* FECHA DE CORTE PREVENTA + HORA DE CORTE PREVENTA */}
            <div className="pt-2 border-t border-slate-800/90 space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-amber-300 block">
                    🛑 Fecha de Corte Preventa
                  </label>
                  <input
                    type="date"
                    required
                    value={fechaCorte}
                    onChange={(e) => setFechaCorte(e.target.value)}
                    className="w-full bg-slate-900 border border-amber-500/40 focus:border-amber-400 rounded-xl px-3 py-2 text-xs font-bold text-amber-200 mt-1 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-amber-300 block">
                    ⏰ Hora de Corte Preventa
                  </label>
                  <input
                    type="time"
                    required
                    value={horaCorte}
                    onChange={(e) => setHoraCorte(e.target.value)}
                    className="w-full bg-slate-900 border border-amber-500/40 focus:border-amber-400 rounded-xl px-3 py-2 text-xs font-bold text-amber-200 mt-1 outline-none"
                  />
                </div>
              </div>

              {/* BOTONES RÁPIDOS DE CORTE: -1 DÍA (21:00) y -2 DÍAS (21:00) */}
              <div className="flex items-center justify-between gap-2 pt-0.5">
                <span className="text-[10px] text-slate-400 font-semibold whitespace-nowrap">
                  Ajuste rápido cierre:
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => aplicarCorteRapido(1, '21:00')}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 text-[10px] font-black whitespace-nowrap transition-colors cursor-pointer"
                  >
                    -1 día (21:00)
                  </button>
                  <button
                    type="button"
                    onClick={() => aplicarCorteRapido(2, '21:00')}
                    className="px-2.5 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/30 border border-indigo-500/30 text-indigo-300 text-[10px] font-black whitespace-nowrap transition-colors cursor-pointer"
                  >
                    -2 días (21:00)
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* BLOQUE 2: NOMBRE DEL PLATO, AUTOCOMPLETADO Y PLANTILLAS EDITABLES */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <label className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                🍲 2. Nombre del Guiso / Plato *
              </label>
              <span className="text-[10px] text-indigo-400 font-bold">
                {plantillasGuisos.length} plantillas guardadas
              </span>
            </div>

            {/* DESPLEGABLE DIRECTO DE PLANTILLAS DE GUISOS Y CATÁLOGO */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 block mb-1">
                📋 Elegir de mis Plantillas de Guisos o Catálogo (Autocompleta todo el plato):
              </label>
              <select
                value={
                  opcionesCatalogoUnificadas.some(
                    (op) => op.nombre.toLowerCase() === nombrePlato.trim().toLowerCase()
                  )
                    ? opcionesCatalogoUnificadas.find(
                        (op) => op.nombre.toLowerCase() === nombrePlato.trim().toLowerCase()
                      )?.nombre || ''
                    : ''
                }
                onChange={(e) => {
                  if (e.target.value) {
                    handleSeleccionarPlatoCatalogo(e.target.value);
                  }
                }}
                className="w-full bg-slate-900 border border-slate-700 focus:border-amber-400 rounded-xl px-3 py-2 text-xs font-bold text-amber-300 outline-none"
              >
                <option value="">-- Seleccionar plantilla o plato predefinido --</option>
                <optgroup label="🍲 Mis Plantillas de Guisos">
                  {opcionesCatalogoUnificadas
                    .filter((op) => op.origen === 'plantilla')
                    .map((op) => (
                      <option key={`pl-${op.nombre}`} value={op.nombre}>
                        {op.nombre} ({op.precio_barra.toFixed(2)}€ Barra / {op.precio_takeaway.toFixed(2)}€ Llevar)
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
            </div>

            {/* INPUT DE TEXTO LIBRE CON DATALIST SINCRONIZADO */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 block mb-1">
                Nombre del plato (puedes escribir uno nuevo o modificar el seleccionado):
              </label>
              <input
                type="text"
                required
                list="catalogo-platos-nexus"
                value={nombrePlato}
                onChange={(e) => handleSeleccionarPlatoCatalogo(e.target.value)}
                placeholder="Ej: Rabo de Toro Cordobés, Lentejas Estofadas..."
                className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-xl px-3.5 py-2 text-xs font-bold text-white outline-none"
              />
              <datalist id="catalogo-platos-nexus">
                {opcionesCatalogoUnificadas.map((op) => (
                  <option
                    key={op.nombre}
                    value={op.nombre}
                    label={`${op.origen === 'plantilla' ? '🍲 Plantilla' : '📋 Catálogo TPV'} · ${op.precio_barra.toFixed(2)}€`}
                  />
                ))}
              </datalist>
            </div>

            {/* DESCRIPCIÓN */}
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400">
                Descripción / Ingredientes / Guarnición
              </label>
              <textarea
                rows={2}
                value={descripcionPlato}
                onChange={(e) => setDescripcionPlato(e.target.value)}
                placeholder="Ej: Cocinado a fuego lento con vino de la tierra, acompañado de patatas fritas caseras y pan..."
                className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-xl px-3.5 py-2 text-xs text-white mt-1 outline-none"
              />
            </div>

            {/* BOTONES DE GESTIÓN DE PLANTILLAS DE GUISOS */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
              <button
                type="button"
                onClick={guardarPlatoActualComoPlantilla}
                className="flex-1 px-3 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/35 border border-emerald-500/40 text-emerald-300 text-[11px] font-black whitespace-nowrap transition-all cursor-pointer"
                title="Guarda el nombre, descripción, precios, mínimo de raciones y foto actuales como plantilla reutilizable"
              >
                💾 Guardar plato actual como plantilla
              </button>

              {existeComoPlantilla && (
                <button
                  type="button"
                  onClick={quitarPlatoActualDePlantillas}
                  className="px-3 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/35 border border-rose-500/40 text-rose-300 text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer"
                  title="Quitar este plato del listado de plantillas predefinidas"
                >
                  🗑️ Quitar de plantillas
                </button>
              )}
            </div>
          </div>

          {/* MÍNIMO DE RACIONES Y PRECIOS BARRA / TAKEAWAY */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-black uppercase text-amber-400">
                Mín. Raciones *
              </label>
              <input
                type="number"
                min={1}
                required
                value={minRaciones}
                onChange={(e) => setMinRaciones(e.target.value)}
                className="w-full bg-slate-950 border border-amber-500/40 rounded-xl px-3 py-2 text-sm font-black text-amber-300 mt-1 text-center"
              />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-emerald-400">
                🪑 Precio Barra (€) *
              </label>
              <input
                type="number"
                step="0.01"
                min={0}
                required
                value={precioBarra}
                onChange={(e) => setPrecioBarra(e.target.value)}
                className="w-full bg-slate-950 border border-emerald-500/40 rounded-xl px-3 py-2 text-sm font-black text-emerald-400 mt-1 text-right"
              />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-cyan-400">
                🛍️ Takeaway (€) *
              </label>
              <input
                type="number"
                step="0.01"
                min={0}
                required
                value={precioTakeaway}
                onChange={(e) => setPrecioTakeaway(e.target.value)}
                className="w-full bg-slate-950 border border-cyan-500/40 rounded-xl px-3 py-2 text-sm font-black text-cyan-300 mt-1 text-right"
              />
            </div>
          </div>

          {/* ESTADO INICIAL / ACTUAL */}
          <div>
            <label className="text-[10px] font-black uppercase text-slate-400">Estado del Plato</label>
            <select
              value={estadoPlato}
              onChange={(e) => setEstadoPlato(e.target.value as EstadoGuiso)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white mt-1"
            >
              <option value="buscando_minimo">🟡 Buscando mínimo (Preventa abierta sin pago previo)</option>
              <option value="confirmado">🟢 ¡Confirmado para cocinar! (Pago inmediato activado)</option>
              <option value="cancelado">🔴 Cancelado (Muestra Plan B inteligente en la web)</option>
            </select>
          </div>

          {/* FOTO DEL PLATO: OPCIONAL (SIN FOTOS INVENTADAS) + BOTÓN PARA QUITAR IMAGEN */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-[10px] font-black uppercase text-slate-400">
                📸 Fotografía del Plato (Opcional)
              </label>
              <div className="flex items-center gap-1.5">
                {imagenUrl.trim() !== '' && (
                  <button
                    type="button"
                    onClick={() => setImagenUrl('')}
                    className="text-[10px] bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-500/40 px-2.5 py-1 rounded-lg font-bold cursor-pointer whitespace-nowrap"
                  >
                    🗑️ Quitar imagen / Dejar sin foto
                  </button>
                )}
                {fotosDisponiblesCatalogo.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setMostrarGaleriaCatalogo((prev) => !prev)}
                    className="text-[10px] bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 px-2.5 py-1 rounded-lg font-bold cursor-pointer whitespace-nowrap"
                  >
                    {mostrarGaleriaCatalogo ? 'Cerrar galería' : '🖼️ Fotos de mi carta'}
                  </button>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={imagenUrl}
                onChange={(e) => setImagenUrl(e.target.value)}
                placeholder="Sin foto (se mostrará icono 🍲 elegante) o pega URL / sube archivo..."
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
              />
              {imagenUrl.trim() !== '' && (
                <button
                  type="button"
                  onClick={() => setImagenUrl('')}
                  className="px-3 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/60 border border-rose-500/40 text-rose-300 text-xs font-black cursor-pointer"
                  title="Borrar imagen"
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
                className="text-[10px] text-slate-400 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-slate-800 file:text-slate-200"
              />
              {imagenUrl.trim() !== '' ? (
                <img
                  src={imagenUrl}
                  alt="Preview"
                  className="h-10 w-14 rounded-lg object-cover border border-slate-700 shrink-0"
                />
              ) : (
                <span className="text-[10px] text-slate-500 italic whitespace-nowrap">
                  🍲 Sin imagen asignada
                </span>
              )}
            </div>

            {mostrarGaleriaCatalogo && fotosDisponiblesCatalogo.length > 0 && (
              <div className="bg-slate-950 border border-indigo-500/30 rounded-2xl p-3 space-y-2 max-h-56 overflow-y-auto">
                <p className="text-[10px] font-bold text-indigo-300">
                  Fotos reales vinculadas en tu carta (`productos_carta` / `articulos_cafeteria`):
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {fotosDisponiblesCatalogo.map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setImagenUrl(item.url);
                        setMostrarGaleriaCatalogo(false);
                      }}
                      className="group relative rounded-xl overflow-hidden border border-slate-800 hover:border-amber-400 text-left h-16 cursor-pointer"
                    >
                      <img src={item.url} alt={item.nombre} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent p-1.5 flex items-end">
                        <span className="text-[9px] font-bold text-white leading-tight line-clamp-2">
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
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-50 text-slate-950 font-black py-3 rounded-2xl shadow-lg text-xs uppercase tracking-wider transition-all cursor-pointer"
          >
            {guardandoGuiso
              ? 'Guardando en Supabase...'
              : editandoGuisoId
              ? '💾 Guardar Cambios del Guiso'
              : '🍲 Publicar Guiso en el Calendario Semanal'}
          </button>
        </form>

        {/* ================= COLUMNA DERECHA: LISTADO / CALENDARIO Y CONTROL DE RESERVAS ================= */}
        <div className="lg:col-span-7 space-y-4">
          {/* CONFIGURACIÓN RÁPIDA DE ENLACE DE PAGO WHATSAPP Y FILTROS */}
          <div className="bg-[#0f172a] border border-slate-800 rounded-3xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'TODOS', label: '📋 Todos' },
                  { id: 'buscando_minimo', label: '🟡 Buscando Mínimo' },
                  { id: 'confirmado', label: '🟢 Confirmados' },
                  { id: 'cancelado', label: '🔴 Cancelados' }
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFiltroEstadoVista(f.id as any)}
                    className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                      filtroEstadoVista === f.id
                        ? 'bg-indigo-600 text-white shadow'
                        : 'bg-slate-900 text-slate-400 hover:text-white'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                {[
                  { id: 'TODAS', label: 'Todas las fechas' },
                  { id: 'ACTUAL', label: 'Esta semana' },
                  { id: 'SIGUIENTE', label: 'Próxima semana' }
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setFiltroSemanaListado(s.id as any)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black whitespace-nowrap transition-all cursor-pointer ${
                      filtroSemanaListado === s.id
                        ? 'bg-amber-500 text-slate-950'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center gap-2">
              <label className="text-[10px] font-black uppercase text-emerald-400 shrink-0">
                💳 Enlace / Instrucciones de Pago en WhatsApp:
              </label>
              <input
                type="text"
                value={enlacePagoConfig}
                onChange={(e) => {
                  setEnlacePagoConfig(e.target.value);
                  localStorage.setItem('nexus_guisos_link_pago', e.target.value);
                }}
                placeholder="Ej: Bizum al 600000000 o enlace de Stripe..."
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200"
              />
            </div>
          </div>

          {/* LISTA COMPACTA DE GUISOS PROGRAMADOS */}
          {cargando ? (
            <div className="bg-[#0f172a] border border-slate-800 rounded-3xl p-8 text-center text-xs text-slate-400">
              Cargando programación de guisos y reservas en tiempo real...
            </div>
          ) : guisosFiltrados.length === 0 ? (
            <div className="bg-[#0f172a] border border-slate-800 rounded-3xl p-8 text-center space-y-2">
              <p className="text-sm font-black text-white">No hay guisos en este filtro</p>
              <p className="text-xs text-slate-400">
                Utiliza el formulario de la izquierda para programar los guisos de la semana.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
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

                return (
                  <div
                    key={guiso.id}
                    className={`bg-[#0f172a] border rounded-2xl overflow-hidden transition-all ${
                      guiso.estado === 'confirmado'
                        ? 'border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.08)]'
                        : guiso.estado === 'cancelado'
                        ? 'border-rose-500/40 opacity-85'
                        : 'border-slate-800'
                    }`}
                  >
                    <div className="p-4 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-3">
                          {fotoReal ? (
                            <img
                              src={fotoReal}
                              alt={guiso.nombre_plato}
                              className="w-12 h-12 rounded-xl object-cover border border-slate-700 shrink-0"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-slate-900 border border-amber-500/30 flex items-center justify-center text-xl shrink-0">
                              🍲
                            </div>
                          )}
                          <div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-amber-300">
                                📅 {formatearFechaHumana(guiso.fecha)} · 🛑 Corte: {formatearFechaCorteHumana(guiso)}
                              </span>
                              {guiso.estado === 'confirmado' && (
                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
                                  🟢 Confirmado
                                </span>
                              )}
                              {guiso.estado === 'buscando_minimo' && (
                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300">
                                  🟡 Preventa ({racionesApuntadas}/{minReq})
                                </span>
                              )}
                              {guiso.estado === 'cancelado' && (
                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300">
                                  🔴 Cancelado
                                </span>
                              )}
                            </div>

                            <h4 className="text-sm font-black text-white mt-1">{guiso.nombre_plato}</h4>
                            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-300 mt-0.5">
                              <span>
                                🪑 Barra: <strong className="text-emerald-400">{Number(guiso.precio_barra).toFixed(2)}€</strong>
                              </span>
                              <span>
                                🛍️ Llevar: <strong className="text-cyan-300">{Number(guiso.precio_takeaway).toFixed(2)}€</strong>
                              </span>
                              <span className="text-slate-400">
                                ({racionesBarra} barra · {racionesTakeaway} llevar)
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* BOTONES DE ACCIÓN RÁPIDA EN CADA GUISO */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          {guiso.estado !== 'confirmado' && (
                            <button
                              type="button"
                              onClick={() => forzarConfirmacionGuiso(guiso)}
                              className="px-2.5 py-1 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/40 font-black text-[10px] transition-all cursor-pointer"
                            >
                              🟢 Confirmar
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => cargarParaEditar(guiso)}
                            className="px-2.5 py-1 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 font-bold text-[10px] transition-all cursor-pointer"
                          >
                            ✏️ Editar
                          </button>
                          {guiso.estado !== 'cancelado' && (
                            <button
                              type="button"
                              onClick={() => cancelarGuisoPlanB(guiso)}
                              className="px-2.5 py-1 rounded-xl bg-amber-600/20 hover:bg-amber-600/40 text-amber-300 border border-amber-500/30 font-bold text-[10px] transition-all cursor-pointer"
                            >
                              🚫 Cancelar
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => eliminarGuisoDefinitivamente(guiso)}
                            className="px-2.5 py-1 rounded-xl bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-500/30 font-bold text-[10px] transition-all cursor-pointer"
                          >
                            🗑️ Eliminar
                          </button>
                        </div>
                      </div>

                      {/* BARRA DE PROGRESO COMPACTA */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="font-black text-white">
                            🔥 {racionesApuntadas} / {minReq} raciones reservadas
                          </span>
                          <span className="font-bold text-slate-400">
                            {racionesApuntadas >= minReq
                              ? '¡Objetivo alcanzado!'
                              : `Faltan ${minReq - racionesApuntadas} raciones`}
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                          <div
                            className={`h-full transition-all duration-500 rounded-full ${
                              guiso.estado === 'confirmado' || racionesApuntadas >= minReq
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                                : guiso.estado === 'cancelado'
                                ? 'bg-rose-600'
                                : 'bg-gradient-to-r from-amber-500 to-orange-500'
                            }`}
                            style={{ width: `${porcentaje}%` }}
                          />
                        </div>
                      </div>

                      {/* BOTÓN PARA DESPLEGAR CLIENTES APUNTADOS */}
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => setGuisoDesplegadoId(desplegado ? null : guiso.id)}
                          className="text-[11px] font-black text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>
                            {desplegado ? '▼ Ocultar' : '▶ Ver'} clientes apuntados ({listaReservasGuiso.length})
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* DESGLOSE DESPLEGABLE DE CLIENTES APUNTADOS */}
                    {desplegado && (
                      <div className="border-t border-slate-800 bg-slate-950/80 p-3.5 space-y-2">
                        {listaReservasGuiso.length === 0 ? (
                          <p className="text-xs text-slate-400 text-center py-2">
                            Aún no hay clientes apuntados a este guiso.
                          </p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="text-[10px] uppercase text-slate-400 border-b border-slate-800">
                                  <th className="p-2">Cliente</th>
                                  <th className="p-2">Contacto</th>
                                  <th className="p-2 text-center">Raciones</th>
                                  <th className="p-2 text-right">Total</th>
                                  <th className="p-2 text-center">Pago</th>
                                  <th className="p-2 text-right">Acciones</th>
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
                                      <td className="p-2 font-black text-white">{res.nombre_cliente}</td>
                                      <td className="p-2">
                                        <span className="font-bold text-slate-200 block">{res.telefono}</span>
                                        {res.email && (
                                          <span className="text-[10px] text-cyan-400 block">{res.email}</span>
                                        )}
                                      </td>
                                      <td className="p-2 text-center">
                                        <span className="font-black text-white">{res.raciones}</span> ·{' '}
                                        <span className="text-[10px] text-amber-300">
                                          {res.modalidad === 'takeaway' ? '🛍️ Llevar' : '🪑 Barra'}
                                        </span>
                                      </td>
                                      <td className="p-2 text-right font-black text-emerald-400">
                                        {importeCliente.toFixed(2)}€
                                      </td>
                                      <td className="p-2 text-center">
                                        <button
                                          type="button"
                                          onClick={() => alternarEstadoPagoReserva(res)}
                                          className={`px-2 py-0.5 rounded-lg font-black text-[10px] uppercase cursor-pointer ${
                                            res.estado_pago === 'pagado'
                                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                          }`}
                                        >
                                          {res.estado_pago === 'pagado' ? '✅ Pagado' : '⏳ Pendiente'}
                                        </button>
                                      </td>
                                      <td className="p-2 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                          <a
                                            href={waUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px]"
                                          >
                                            📲 WhatsApp
                                          </a>
                                          <button
                                            type="button"
                                            onClick={() => eliminarReservaCliente(res)}
                                            className="px-2 py-1 rounded-lg bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 text-[10px] font-bold cursor-pointer"
                                          >
                                            ✕
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
