// src/GuisosAdminPanel.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabase';
import {
  generarEnlaceWhatsAppAdminAClienteConfirmacion,
  calcularImporteReserva,
  formatearFechaHumana,
  type GuisoProgramado,
  type ReservaGuiso,
  type EstadoGuiso,
  type EstadoPagoReservaGuiso
} from './notificacionesGuisos';

interface ArticuloCatalogo {
  id: string | number;
  nombre: string;
  categoria?: string;
  precio_venta?: number;
  precio?: number;
  imagen_url?: string;
}

interface GuisosAdminPanelProps {
  articulosCatalogo: ArticuloCatalogo[];
  notificar: (texto: string, tipo?: 'ok' | 'error' | 'info') => void;
}

const SUGERENCIAS_GUISOS_CASA: Array<{
  nombre: string;
  descripcion: string;
  precio_barra: number;
  precio_takeaway: number;
  min_raciones: number;
  imagen_url: string;
}> = [
  {
    nombre: 'Rabo de Toro Cordobés Tradicional',
    descripcion: 'Estofado a fuego lento en vino Montilla-Moriles con verduras de la huerta y patatas fritas en dados.',
    precio_barra: 11.5,
    precio_takeaway: 10.5,
    min_raciones: 8,
    imagen_url: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80'
  },
  {
    nombre: 'Carrillada Ibérica al Pedro Ximénez',
    descripcion: 'Carrillada melosa reducida en salsa casera de PX con parmentier trufado o patatas panaderas.',
    precio_barra: 10.5,
    precio_takeaway: 9.5,
    min_raciones: 8,
    imagen_url: 'https://images.unsplash.com/photo-1534939561126-855b8675edd7?auto=format&fit=crop&w=900&q=80'
  },
  {
    nombre: 'Potaje de Garbanzos con Chocos y Langostinos',
    descripcion: 'Guiso marinero de cuchara con garbanzo lechoso, choco fresco, langostinos y sofrito casero.',
    precio_barra: 8.5,
    precio_takeaway: 7.9,
    min_raciones: 10,
    imagen_url: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=900&q=80'
  },
  {
    nombre: 'Arroz Caldoso con Costillejas y Setas',
    descripcion: 'Arroz artesano con fondo de carne tostada, costillejas ibéricas y boletus de temporada.',
    precio_barra: 9.0,
    precio_takeaway: 8.2,
    min_raciones: 8,
    imagen_url: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=900&q=80'
  },
  {
    nombre: 'Lentejas Estofadas con Chorizo Ibérico y Morcilla',
    descripcion: 'Lenteja pardina cocinada a fuego lento con verduras naturales, chorizo de bellota y punta de jamón.',
    precio_barra: 7.5,
    precio_takeaway: 6.9,
    min_raciones: 10,
    imagen_url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=900&q=80'
  },
  {
    nombre: 'Albóndigas de Choco y Gambas en Salsa Verde',
    descripcion: 'Albóndigas caseras artesanas en salsa marinera de vino blanco, ajo y perejil fresco.',
    precio_barra: 9.5,
    precio_takeaway: 8.5,
    min_raciones: 8,
    imagen_url: 'https://images.unsplash.com/photo-1529042410759-befb1204b468?auto=format&fit=crop&w=900&q=80'
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

export default function GuisosAdminPanel({ articulosCatalogo, notificar }: GuisosAdminPanelProps) {
  const [guisos, setGuisos] = useState<GuisoProgramado[]>([]);
  const [reservas, setReservas] = useState<ReservaGuiso[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);
  const [guardandoGuiso, setGuardandoGuiso] = useState<boolean>(false);

  // Estado del formulario de creación / edición
  const [editandoGuisoId, setEditandoGuisoId] = useState<string | null>(null);
  const [semanaSelectorOffset, setSemanaSelectorOffset] = useState<number>(0);
  const [fechaPlato, setFechaPlato] = useState<string>(() => formatFechaISO(new Date()));
  const [nombrePlato, setNombrePlato] = useState<string>('');
  const [descripcionPlato, setDescripcionPlato] = useState<string>('');
  const [minRaciones, setMinRaciones] = useState<string>('8');
  const [precioBarra, setPrecioBarra] = useState<string>('9.50');
  const [precioTakeaway, setPrecioTakeaway] = useState<string>('8.50');
  const [imagenUrl, setImagenUrl] = useState<string>('');
  const [horaCorte, setHoraCorte] = useState<string>('21:00');
  const [estadoPlato, setEstadoPlato] = useState<EstadoGuiso>('buscando_minimo');

  // Selector visual de fotos del catálogo existente
  const [mostrarGaleriaCatalogo, setMostrarGaleriaCatalogo] = useState<boolean>(false);

  // Control de listado y desgloses desplegables
  const [filtroEstadoVista, setFiltroEstadoVista] = useState<'TODOS' | EstadoGuiso>('TODOS');
  const [guisoDesplegadoId, setGuisoDesplegadoId] = useState<string | null>(null);
  const [enlacePagoConfig, setEnlacePagoConfig] = useState<string>(() => {
    return (
      localStorage.getItem('nexus_guisos_link_pago') ||
      'Bizum / Pago en Barra (Nexus Chinales 45) · https://www.nexusgamingcenter.es/#guisos'
    );
  });

  const diasSemanaFormulario = useMemo(() => obtenerDiasSemana(semanaSelectorOffset), [semanaSelectorOffset]);

  // Combinar catálogo de artículos reales con sugerencias de guisos para autocompletar y fotos
  const opcionesCatalogoUnificadas = useMemo(() => {
    const mapa = new Map<
      string,
      {
        nombre: string;
        descripcion: string;
        precio_barra: number;
        precio_takeaway: number;
        min_raciones: number;
        imagen_url: string;
        origen: 'catalogo' | 'recetario';
      }
    >();

    for (const art of articulosCatalogo) {
      if (!art?.nombre) continue;
      const pvp = Number(art.precio_venta ?? art.precio ?? 8.5);
      mapa.set(art.nombre.toLowerCase(), {
        nombre: art.nombre,
        descripcion: art.categoria ? `Especialidad de nuestra carta (${art.categoria}).` : '',
        precio_barra: pvp > 0 ? pvp : 8.5,
        precio_takeaway: pvp > 1 ? Number((pvp - 0.8).toFixed(2)) : pvp,
        min_raciones: 8,
        imagen_url: art.imagen_url || '',
        origen: 'catalogo'
      });
    }

    for (const sug of SUGERENCIAS_GUISOS_CASA) {
      if (!mapa.has(sug.nombre.toLowerCase())) {
        mapa.set(sug.nombre.toLowerCase(), {
          ...sug,
          origen: 'recetario'
        });
      }
    }

    return Array.from(mapa.values());
  }, [articulosCatalogo]);

  const fotosDisponiblesCatalogo = useMemo(() => {
    const lista: Array<{ nombre: string; url: string }> = [];
    const vistas = new Set<string>();

    for (const op of opcionesCatalogoUnificadas) {
      const url = (op.imagen_url || '').trim();
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

  const limpiarFormulario = () => {
    setEditandoGuisoId(null);
    setNombrePlato('');
    setDescripcionPlato('');
    setMinRaciones('8');
    setPrecioBarra('9.50');
    setPrecioTakeaway('8.50');
    setImagenUrl('');
    setHoraCorte('21:00');
    setEstadoPlato('buscando_minimo');
  };

  const handleSeleccionarPlatoCatalogo = (nombreInput: string) => {
    setNombrePlato(nombreInput);
    const encontrado = opcionesCatalogoUnificadas.find(
      (op) => op.nombre.toLowerCase() === nombreInput.trim().toLowerCase()
    );
    if (encontrado) {
      if (!descripcionPlato.trim() && encontrado.descripcion) {
        setDescripcionPlato(encontrado.descripcion);
      }
      if (encontrado.precio_barra > 0) {
        setPrecioBarra(encontrado.precio_barra.toFixed(2));
      }
      if (encontrado.precio_takeaway > 0) {
        setPrecioTakeaway(encontrado.precio_takeaway.toFixed(2));
      }
      if (encontrado.min_raciones > 0) {
        setMinRaciones(String(encontrado.min_raciones));
      }
      if (encontrado.imagen_url) {
        setImagenUrl(encontrado.imagen_url);
      }
    }
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

    setGuardandoGuiso(true);
    try {
      const payload = {
        fecha: fechaPlato,
        nombre_plato: nombrePlato.trim(),
        descripcion: descripcionPlato.trim(),
        min_raciones: minNum,
        precio_barra: Number(pBarra.toFixed(2)),
        precio_takeaway: Number(pTakeaway.toFixed(2)),
        imagen_url:
          imagenUrl.trim() ||
          'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80',
        estado: estadoPlato,
        hora_corte: (horaCorte || '21:00').trim()
      };

      if (editandoGuisoId) {
        const { error } = await supabase
          .from('guisos_programados')
          .update(payload)
          .eq('id', editandoGuisoId);
        if (error) throw error;
        notificar(`Guiso "${payload.nombre_plato}" actualizado correctamente.`, 'ok');
      } else {
        const { error } = await supabase.from('guisos_programados').insert([payload]);
        if (error) throw error;
        notificar(`Guiso "${payload.nombre_plato}" programado para el ${formatearFechaHumana(payload.fecha)}.`, 'ok');
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
    setNombrePlato(guiso.nombre_plato);
    setDescripcionPlato(guiso.descripcion || '');
    setMinRaciones(String(guiso.min_raciones || 8));
    setPrecioBarra(Number(guiso.precio_barra || 0).toFixed(2));
    setPrecioTakeaway(Number(guiso.precio_takeaway || 0).toFixed(2));
    setImagenUrl(guiso.imagen_url || '');
    setHoraCorte(guiso.hora_corte || '21:00');
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
      if (filtroEstadoVista === 'TODOS') return true;
      return g.estado === filtroEstadoVista;
    });
  }, [guisos, filtroEstadoVista]);

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
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2.5 rounded-2xl font-bold text-xs transition-all"
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
          className="lg:col-span-5 bg-[#0f172a] border border-slate-800 rounded-3xl p-6 space-y-4 self-start"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-lg font-black text-white">
              {editandoGuisoId ? '✏️ Editando Guiso Programado' : '➕ Programar Guiso del Día'}
            </h3>
            {editandoGuisoId && (
              <button
                type="button"
                onClick={limpiarFormulario}
                className="text-xs font-bold text-rose-400 hover:underline"
              >
                Cancelar edición
              </button>
            )}
          </div>

          {/* SELECTOR ÁGIL DE DÍA DE LA SEMANA + FECHA */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase text-amber-400">
                📅 1. Elige Día de la Semana o Fecha Exacta
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setSemanaSelectorOffset((prev) => prev - 1)}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300"
                >
                  ◀ Sem. ant.
                </button>
                <button
                  type="button"
                  onClick={() => setSemanaSelectorOffset(0)}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-cyan-300"
                >
                  Actual
                </button>
                <button
                  type="button"
                  onClick={() => setSemanaSelectorOffset((prev) => prev + 1)}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300"
                >
                  Sem. sig. ▶
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1">
              {diasSemanaFormulario.map((d) => {
                const activo = fechaPlato === d.fecha;
                return (
                  <button
                    key={d.fecha}
                    type="button"
                    onClick={() => setFechaPlato(d.fecha)}
                    className={`py-2 px-1 rounded-xl text-center transition-all border ${
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

            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <label className="text-[10px] font-bold text-slate-400">Fecha seleccionada</label>
                <input
                  type="date"
                  required
                  value={fechaPlato}
                  onChange={(e) => setFechaPlato(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white mt-0.5"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400">Hora de Corte Preventa</label>
                <input
                  type="time"
                  required
                  value={horaCorte}
                  onChange={(e) => setHoraCorte(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-amber-300 mt-0.5"
                />
              </div>
            </div>
          </div>

          {/* NOMBRE DEL PLATO CON AUTOCOMPLETADO DEL CATÁLOGO */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase text-slate-400">
                🍲 2. Nombre del Guiso / Plato *
              </label>
              <span className="text-[10px] text-indigo-400 font-bold">
                Autocompletado desde catálogo activo
              </span>
            </div>
            <input
              type="text"
              required
              list="catalogo-platos-nexus"
              value={nombrePlato}
              onChange={(e) => handleSeleccionarPlatoCatalogo(e.target.value)}
              placeholder="Escribe o elige del catálogo (ej: Rabo de Toro, Carrillada...)"
              className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-xs font-bold text-white mt-1 outline-none"
            />
            <datalist id="catalogo-platos-nexus">
              {opcionesCatalogoUnificadas.map((op) => (
                <option
                  key={op.nombre}
                  value={op.nombre}
                  label={`${op.origen === 'catalogo' ? '📋 Catálogo TPV' : '🍲 Recetario'} · ${op.precio_barra.toFixed(2)}€`}
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
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white mt-1"
            />
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
                className="w-full bg-slate-950 border border-amber-500/40 rounded-xl px-3 py-2.5 text-sm font-black text-amber-300 mt-1 text-center"
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
                className="w-full bg-slate-950 border border-emerald-500/40 rounded-xl px-3 py-2.5 text-sm font-black text-emerald-400 mt-1 text-right"
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
                className="w-full bg-slate-950 border border-cyan-500/40 rounded-xl px-3 py-2.5 text-sm font-black text-cyan-300 mt-1 text-right"
              />
            </div>
          </div>

          {/* ESTADO INICIAL / ACTUAL */}
          <div>
            <label className="text-[10px] font-black uppercase text-slate-400">Estado del Plato</label>
            <select
              value={estadoPlato}
              onChange={(e) => setEstadoPlato(e.target.value as EstadoGuiso)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs font-bold text-white mt-1"
            >
              <option value="buscando_minimo">🟡 Buscando mínimo (Preventa abierta sin pago previo)</option>
              <option value="confirmado">🟢 ¡Confirmado para cocinar! (Pago inmediato activado)</option>
              <option value="cancelado">🔴 Cancelado (Muestra Plan B inteligente en la web)</option>
            </select>
          </div>

          {/* FOTO DEL PLATO: URL, SUBIDA O ELEGIR DESDE CATÁLOGO EXISTENTE */}
          <div className="space-y-2 pt-1 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase text-slate-400">
                📸 Fotografía del Plato
              </label>
              <button
                type="button"
                onClick={() => setMostrarGaleriaCatalogo((prev) => !prev)}
                className="text-[10px] bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 px-2.5 py-1 rounded-lg font-bold"
              >
                {mostrarGaleriaCatalogo ? 'Cerrar galería' : '🖼️ Elegir foto del catálogo'}
              </button>
            </div>

            <input
              type="text"
              value={imagenUrl}
              onChange={(e) => setImagenUrl(e.target.value)}
              placeholder="URL de imagen o elige desde el catálogo / sube archivo..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
            />

            <div className="flex items-center justify-between gap-2">
              <input
                type="file"
                accept="image/*"
                onChange={manejarSubidaImagenGuiso}
                className="text-[10px] text-slate-400 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-slate-800 file:text-slate-200"
              />
              {imagenUrl && (
                <img
                  src={imagenUrl}
                  alt="Preview"
                  className="h-10 w-14 rounded-lg object-cover border border-slate-700 shrink-0"
                />
              )}
            </div>

            {mostrarGaleriaCatalogo && (
              <div className="bg-slate-950 border border-indigo-500/30 rounded-2xl p-3 space-y-2 max-h-56 overflow-y-auto">
                <p className="text-[10px] font-bold text-indigo-300">
                  Haz clic en cualquier plato de tu catálogo o recetario para usar su foto:
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {fotosDisponiblesCatalogo.map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setImagenUrl(item.url);
                        if (!nombrePlato.trim()) {
                          handleSeleccionarPlatoCatalogo(item.nombre);
                        }
                        setMostrarGaleriaCatalogo(false);
                      }}
                      className="group relative rounded-xl overflow-hidden border border-slate-800 hover:border-amber-400 text-left h-20"
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
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-50 text-slate-950 font-black py-3.5 rounded-2xl shadow-lg text-xs uppercase tracking-wider transition-all cursor-pointer"
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
          <div className="bg-[#0f172a] border border-slate-800 rounded-3xl p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'TODOS', label: '📋 Todos' },
                  { id: 'buscando_minimo', label: '🟡 Buscando Mínimo' },
                  { id: 'confirmado', label: '🟢 Confirmados' },
                  { id: 'cancelado', label: '🔴 Cancelados (Plan B)' }
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFiltroEstadoVista(f.id as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      filtroEstadoVista === f.id
                        ? 'bg-indigo-600 text-white shadow'
                        : 'bg-slate-900 text-slate-400 hover:text-white'
                    }`}
                  >
                    {f.label}
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

          {/* LISTA DE TARJETAS DE GUISOS PROGRAMADOS */}
          {cargando ? (
            <div className="bg-[#0f172a] border border-slate-800 rounded-3xl p-10 text-center text-xs text-slate-400">
              Cargando programación de guisos y reservas en tiempo real...
            </div>
          ) : guisosFiltrados.length === 0 ? (
            <div className="bg-[#0f172a] border border-slate-800 rounded-3xl p-10 text-center space-y-2">
              <p className="text-base font-black text-white">No hay guisos en este filtro</p>
              <p className="text-xs text-slate-400">
                Utiliza el formulario de la izquierda para programar los guisos de la semana.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
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

                return (
                  <div
                    key={guiso.id}
                    className={`bg-[#0f172a] border rounded-3xl overflow-hidden transition-all ${
                      guiso.estado === 'confirmado'
                        ? 'border-emerald-500/50 shadow-[0_0_25px_rgba(16,185,129,0.1)]'
                        : guiso.estado === 'cancelado'
                        ? 'border-rose-500/40 opacity-85'
                        : 'border-slate-800'
                    }`}
                  >
                    <div className="p-5 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-3.5">
                          <img
                            src={
                              guiso.imagen_url ||
                              'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=400&q=80'
                            }
                            alt={guiso.nombre_plato}
                            className="w-16 h-16 rounded-2xl object-cover border border-slate-700 shrink-0"
                          />
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-amber-300">
                                📅 {formatearFechaHumana(guiso.fecha)} · ⏰ Corte {guiso.hora_corte}h
                              </span>
                              {guiso.estado === 'confirmado' && (
                                <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
                                  🟢 ¡Confirmado para cocinar!
                                </span>
                              )}
                              {guiso.estado === 'buscando_minimo' && (
                                <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300">
                                  🟡 Buscando mínimo ({racionesApuntadas}/{minReq})
                                </span>
                              )}
                              {guiso.estado === 'cancelado' && (
                                <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300">
                                  🔴 Cancelado (Plan B activo)
                                </span>
                              )}
                            </div>

                            <h4 className="text-base font-black text-white mt-1">{guiso.nombre_plato}</h4>
                            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300 mt-1">
                              <span>
                                🪑 Barra: <strong className="text-emerald-400">{Number(guiso.precio_barra).toFixed(2)}€</strong>
                              </span>
                              <span>
                                🛍️ Takeaway: <strong className="text-cyan-300">{Number(guiso.precio_takeaway).toFixed(2)}€</strong>
                              </span>
                              <span className="text-slate-400">
                                ({racionesBarra} en sala · {racionesTakeaway} para llevar)
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
                              className="px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/40 font-black text-[11px] transition-all cursor-pointer"
                              title="Activar el plato manualmente aunque no haya llegado al mínimo"
                            >
                              🟢 Forzar Confirmación
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => cargarParaEditar(guiso)}
                            className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 font-bold text-[11px] transition-all cursor-pointer"
                          >
                            ✏️ Editar
                          </button>
                          {guiso.estado !== 'cancelado' && (
                            <button
                              type="button"
                              onClick={() => cancelarGuisoPlanB(guiso)}
                              className="px-3 py-1.5 rounded-xl bg-amber-600/20 hover:bg-amber-600/40 text-amber-300 border border-amber-500/30 font-bold text-[11px] transition-all cursor-pointer"
                              title="Marcar como cancelado y activar Plan B en la web"
                            >
                              🚫 Cancelar
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => eliminarGuisoDefinitivamente(guiso)}
                            className="px-3 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-500/30 font-bold text-[11px] transition-all cursor-pointer"
                            title="Eliminar guiso de la base de datos"
                          >
                            🗑️ Eliminar
                          </button>
                        </div>
                      </div>

                      {/* BARRA DE PROGRESO EN TIEMPO REAL */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-black text-white">
                            🔥 {racionesApuntadas} / {minReq} raciones reservadas
                          </span>
                          <span className="font-bold text-slate-400">
                            {racionesApuntadas >= minReq
                              ? '¡Objetivo mínimo superado!'
                              : `Faltan ${minReq - racionesApuntadas} raciones para el mínimo`}
                          </span>
                        </div>
                        <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
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
                      <div className="flex items-center justify-between pt-1">
                        <button
                          type="button"
                          onClick={() => setGuisoDesplegadoId(desplegado ? null : guiso.id)}
                          className="text-xs font-black text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>
                            {desplegado ? '▼ Ocultar' : '▶ Ver'} desglose de clientes apuntados ({listaReservasGuiso.length})
                          </span>
                        </button>

                        {guiso.estado === 'confirmado' && listaReservasGuiso.length > 0 && (
                          <span className="text-[11px] text-emerald-400 font-bold">
                            📲 Pulsa el botón de WhatsApp de cada cliente para enviarle el enlace de pago
                          </span>
                        )}
                      </div>
                    </div>

                    {/* DESGLOSE DESPLEGABLE DE CLIENTES APUNTADOS */}
                    {desplegado && (
                      <div className="border-t border-slate-800 bg-slate-950/80 p-4 space-y-3">
                        {listaReservasGuiso.length === 0 ? (
                          <p className="text-xs text-slate-400 text-center py-3">
                            Aún no hay clientes apuntados a este guiso.
                          </p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="text-[10px] uppercase text-slate-400 border-b border-slate-800">
                                  <th className="p-2.5">Cliente</th>
                                  <th className="p-2.5">Contacto (Tel / Email)</th>
                                  <th className="p-2.5 text-center">Raciones / Modalidad</th>
                                  <th className="p-2.5 text-right">Total</th>
                                  <th className="p-2.5 text-center">Estado Pago</th>
                                  <th className="p-2.5 text-right">Acciones Rápidas</th>
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
                                      <td className="p-2.5 font-black text-white">
                                        {res.nombre_cliente}
                                        {res.created_at && (
                                          <span className="block text-[10px] font-normal text-slate-500">
                                            {new Date(res.created_at).toLocaleString('es-ES', {
                                              day: '2-digit',
                                              month: '2-digit',
                                              hour: '2-digit',
                                              minute: '2-digit'
                                            })}
                                          </span>
                                        )}
                                      </td>
                                      <td className="p-2.5">
                                        <span className="font-bold text-slate-200 block">{res.telefono}</span>
                                        {res.email ? (
                                          <span className="text-[10px] text-cyan-400 block">{res.email}</span>
                                        ) : (
                                          <span className="text-[10px] text-slate-500">Sin email</span>
                                        )}
                                      </td>
                                      <td className="p-2.5 text-center">
                                        <span className="font-black text-white">{res.raciones} rac.</span>
                                        <span
                                          className={`block text-[10px] font-bold ${
                                            res.modalidad === 'takeaway' ? 'text-cyan-300' : 'text-amber-300'
                                          }`}
                                        >
                                          {res.modalidad === 'takeaway' ? '🛍️ Takeaway' : '🪑 En Barra/Sala'}
                                        </span>
                                      </td>
                                      <td className="p-2.5 text-right font-black text-emerald-400">
                                        {importeCliente.toFixed(2)}€
                                      </td>
                                      <td className="p-2.5 text-center">
                                        <button
                                          type="button"
                                          onClick={() => alternarEstadoPagoReserva(res)}
                                          className={`px-2.5 py-1 rounded-lg font-black text-[10px] uppercase cursor-pointer transition-all ${
                                            res.estado_pago === 'pagado'
                                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-emerald-500/20 hover:text-emerald-300'
                                          }`}
                                          title="Haz clic para cambiar entre Pendiente y Pagado"
                                        >
                                          {res.estado_pago === 'pagado' ? '✅ Pagado' : '⏳ Marcar Pagado'}
                                        </button>
                                      </td>
                                      <td className="p-2.5 text-right">
                                        <div className="flex items-center justify-end gap-1.5">
                                          <a
                                            href={waUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] inline-flex items-center gap-1 shadow transition-all"
                                            title="Enviar aviso de confirmación y enlace de pago por WhatsApp"
                                          >
                                            <span>📲 WhatsApp Pago</span>
                                          </a>
                                          <button
                                            type="button"
                                            onClick={() => eliminarReservaCliente(res)}
                                            className="px-2 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 text-[10px] font-bold cursor-pointer"
                                            title="Eliminar reserva"
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
