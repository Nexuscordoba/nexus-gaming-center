// src/GuisosPublicView.tsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  ChefHat,
  Clock,
  CheckCircle2,
  Flame,
  UtensilsCrossed,
  ShoppingBag,
  Sparkles,
  ArrowRight,
  CalendarDays,
  Phone,
  Mail,
  User,
  Minus,
  Plus,
  X,
  AlertTriangle,
  MessageCircle,
  CreditCard,
  Lock
} from 'lucide-react';
import { supabase } from './supabase';
import {
  estaEnPlanB,
  haSuperadoFechaHoraCorte,
  calcularImporteReserva,
  formatearFechaHumana,
  formatearFechaCorteHumana,
  generarEnlaceWhatsAppClienteABar,
  enviarEmailConfirmacionReservaGuiso,
  type GuisoProgramado,
  type ReservaGuiso,
  type ModalidadReservaGuiso
} from './notificacionesGuisos';

interface GuisosPublicViewProps {
  onIrACartaBar: () => void;
}

const NOMBRES_DIAS_SEMANA = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo'
];

const formatFechaISO = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const construirDiasSemana = (
  offsetSemanas: number = 0
): Array<{ nombre: string; fecha: string; diaMes: string; esHoy: boolean }> => {
  const hoy = new Date();
  const hoyISO = formatFechaISO(hoy);
  const dayOfWeek = hoy.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() + diffToMonday + offsetSemanas * 7);

  return NOMBRES_DIAS_SEMANA.map((nombre, idx) => {
    const d = new Date(lunes);
    d.setDate(lunes.getDate() + idx);
    const iso = formatFechaISO(d);
    return {
      nombre,
      fecha: iso,
      diaMes: d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
      esHoy: iso === hoyISO
    };
  });
};

export default function GuisosPublicView({ onIrACartaBar }: GuisosPublicViewProps) {
  const [guisos, setGuisos] = useState<GuisoProgramado[]>([]);
  const [reservas, setReservas] = useState<ReservaGuiso[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Navegación del Calendario Semanal (Lunes a Domingo)
  const [semanaOffset, setSemanaOffset] = useState<number>(0);
  const [diaSeleccionado, setDiaSeleccionado] = useState<string>('TODOS');

  // Estado del Modal de Reserva
  const [guisoActivoModal, setGuisoActivoModal] = useState<GuisoProgramado | null>(null);
  const [nombreCliente, setNombreCliente] = useState<string>('');
  const [telefonoCliente, setTelefonoCliente] = useState<string>('');
  const [emailCliente, setEmailCliente] = useState<string>('');
  const [racionesReserva, setRacionesReserva] = useState<number>(2);
  const [modalidadReserva, setModalidadReserva] = useState<ModalidadReservaGuiso>('barra');
  const [enviandoReserva, setEnviandoReserva] = useState<boolean>(false);
  const [errorReserva, setErrorReserva] = useState<string | null>(null);

  // Paso de confirmación post-reserva dentro del modal
  const [reservaCompletada, setReservaCompletada] = useState<{
    reserva: ReservaGuiso;
    guiso: GuisoProgramado;
    yaEstabaConfirmado: boolean;
    recienConfirmadoConEstaReserva: boolean;
    racionesTotalesAhora: number;
    enlaceWhatsApp: string;
  } | null>(null);

  const diasSemana = useMemo(() => construirDiasSemana(semanaOffset), [semanaOffset]);

  const cargarDatos = async () => {
    try {
      const [resGuisos, resReservas] = await Promise.all([
        supabase.from('guisos_programados').select('*').order('fecha', { ascending: true }),
        supabase.from('reservas_guisos').select('*')
      ]);

      if (!resGuisos.error && resGuisos.data) {
        setGuisos(resGuisos.data as GuisoProgramado[]);
      }
      if (!resReservas.error && resReservas.data) {
        setReservas(resReservas.data as ReservaGuiso[]);
      }
    } catch (err) {
      console.error('Error cargando guisos públicos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();

    const channel = supabase
      .channel('public-guisos-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'guisos_programados' }, () => {
        cargarDatos();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservas_guisos' }, () => {
        cargarDatos();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Mapa de raciones reservadas en vivo por cada guiso_id
  const racionesPorGuiso = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const r of reservas) {
      const prev = mapa.get(r.guiso_id) || 0;
      mapa.set(r.guiso_id, prev + Number(r.raciones || 0));
    }
    return mapa;
  }, [reservas]);

  const fechasDeLaSemanaSet = useMemo(() => {
    return new Set(diasSemana.map((d) => d.fecha));
  }, [diasSemana]);

  const guisosSemanaActiva = useMemo(() => {
    const enSemana = guisos.filter((g) => fechasDeLaSemanaSet.has(g.fecha));
    const base = enSemana.length > 0 || semanaOffset !== 0 ? enSemana : guisos;
    if (diaSeleccionado === 'TODOS') return base;
    return base.filter((g) => g.fecha === diaSeleccionado);
  }, [guisos, fechasDeLaSemanaSet, diaSeleccionado, semanaOffset]);

  const abrirModalReserva = (guiso: GuisoProgramado) => {
    if (haSuperadoFechaHoraCorte(guiso)) {
      return;
    }
    setGuisoActivoModal(guiso);
    setReservaCompletada(null);
    setErrorReserva(null);
    setRacionesReserva(2);
    setModalidadReserva('barra');
  };

  const cerrarModalReserva = () => {
    setGuisoActivoModal(null);
    setReservaCompletada(null);
    setErrorReserva(null);
  };

  const handleConfirmarReserva = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guisoActivoModal || enviandoReserva) return;

    if (haSuperadoFechaHoraCorte(guisoActivoModal)) {
      setErrorReserva(
        `El plazo de preventa para este plato finalizó (${formatearFechaCorteHumana(guisoActivoModal)}).`
      );
      return;
    }

    if (nombreCliente.trim().length < 2) {
      setErrorReserva('Por favor, indica tu nombre para anotar tu ración.');
      return;
    }
    if (telefonoCliente.replace(/\D+/g, '').length < 9) {
      setErrorReserva('Introduce un teléfono / WhatsApp válido (mínimo 9 dígitos) para avisarte.');
      return;
    }

    setEnviandoReserva(true);
    setErrorReserva(null);

    try {
      const racionesPrevias = racionesPorGuiso.get(guisoActivoModal.id) || 0;
      const yaEstabaConfirmado = guisoActivoModal.estado === 'confirmado';
      const racionesNuevas = Math.max(1, Number(racionesReserva || 1));
      const nuevoTotalRaciones = racionesPrevias + racionesNuevas;
      const alcanzaMinimoAhora =
        guisoActivoModal.estado === 'buscando_minimo' &&
        nuevoTotalRaciones >= Number(guisoActivoModal.min_raciones || 1);

      const nuevaReservaPayload = {
        guiso_id: guisoActivoModal.id,
        nombre_cliente: nombreCliente.trim(),
        telefono: telefonoCliente.trim(),
        email: emailCliente.trim() ? emailCliente.trim() : null,
        raciones: racionesNuevas,
        modalidad: modalidadReserva,
        estado_pago: 'pendiente' as const
      };

      const { data: reservaInsertada, error: insertError } = await supabase
        .from('reservas_guisos')
        .insert([nuevaReservaPayload])
        .select()
        .single();

      if (insertError) throw insertError;

      let guisoActualizado: GuisoProgramado = { ...guisoActivoModal };

      // LÓGICA HÍBRIDA: Si estaba en 'buscando_minimo' y al sumar las raciones alcanza o supera min_raciones,
      // cambia automáticamente su estado a 'confirmado' en Supabase.
      if (alcanzaMinimoAhora) {
        const { error: updateErr } = await supabase
          .from('guisos_programados')
          .update({ estado: 'confirmado' })
          .eq('id', guisoActivoModal.id);

        if (!updateErr) {
          guisoActualizado = { ...guisoActivoModal, estado: 'confirmado' };
        }
      }

      const reservaFinalObj: ReservaGuiso = (reservaInsertada as ReservaGuiso) || {
        id: crypto.randomUUID(),
        ...nuevaReservaPayload
      };

      const platoConfirmadoFinal = yaEstabaConfirmado || alcanzaMinimoAhora;
      const enlaceWA = generarEnlaceWhatsAppClienteABar(
        reservaFinalObj,
        guisoActualizado,
        platoConfirmadoFinal
      );

      enviarEmailConfirmacionReservaGuiso({
        reserva: reservaFinalObj,
        guiso: guisoActualizado,
        platoConfirmado: platoConfirmadoFinal,
        recienConfirmadoPorEstaReserva: alcanzaMinimoAhora
      }).catch((err) => console.warn('Aviso notificación email:', err));

      await cargarDatos();

      setReservaCompletada({
        reserva: reservaFinalObj,
        guiso: guisoActualizado,
        yaEstabaConfirmado,
        recienConfirmadoConEstaReserva: alcanzaMinimoAhora,
        racionesTotalesAhora: nuevoTotalRaciones,
        enlaceWhatsApp: enlaceWA
      });
    } catch (err: any) {
      setErrorReserva(
        'No se pudo registrar la reserva en este momento: ' + (err?.message || 'Inténtalo de nuevo')
      );
    } finally {
      setEnviandoReserva(false);
    }
  };

  return (
    <main className="flex-grow">
      {/* HERO DE GUISOS DE LA CASA (#guisos) */}
      <section className="relative overflow-hidden py-14 sm:py-20 border-b border-white/[0.06]">
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=2000&q=80"
            alt="Guisos Caseros Bajo Demanda Nexus"
            className="w-full h-full object-cover object-center opacity-35"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#08090d] via-[#08090d]/85 to-[#08090d]/60" />
        </div>

        <div className="max-w-5xl mx-auto px-5 text-center relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-950/80 backdrop-blur-md px-4 py-1.5 text-xs font-bold text-amber-300 mb-5 shadow-[0_0_25px_rgba(245,158,11,0.25)]">
            <Flame className="w-4 h-4 text-amber-400 animate-pulse" />
            <span>Cocina Casera Bajo Demanda · Cero Desperdicio · Chinales 45</span>
          </div>

          <h1 className="text-3xl sm:text-6xl font-black text-white tracking-tight uppercase leading-tight">
            🍲 Guisos de la <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-400 to-yellow-300">Casa</span>
          </h1>

          <p className="mt-4 text-sm sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Cada día proponemos nuestros mejores guisos tradicionales de cuchara.{' '}
            <strong className="text-amber-300">Apúntate gratis a tu plato favorito:</strong> en cuanto alcanzamos el mínimo de raciones, encendemos los fogones y te avisamos.
          </p>

          {/* PASOS EXPLICATIVOS RÁPIDOS */}
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-3xl mx-auto text-left">
            <div className="rounded-2xl border border-white/10 bg-[#0c0d14]/85 backdrop-blur p-4 flex items-start gap-3">
              <div className="h-8 w-8 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center font-black text-xs shrink-0">
                1
              </div>
              <div>
                <h3 className="text-xs font-black text-white uppercase">Elige día y plato</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Reserva tus raciones para tomar en el bar o para llevar en tupper.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0c0d14]/85 backdrop-blur p-4 flex items-start gap-3">
              <div className="h-8 w-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center font-black text-xs shrink-0">
                2
              </div>
              <div>
                <h3 className="text-xs font-black text-white uppercase">Alcanzamos el mínimo</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  No pagas nada al apuntarte mientras esté buscando el mínimo.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0c0d14]/85 backdrop-blur p-4 flex items-start gap-3">
              <div className="h-8 w-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-black text-xs shrink-0">
                3
              </div>
              <div>
                <h3 className="text-xs font-black text-white uppercase">¡A los fogones!</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Al confirmarse el guiso, formalizas tu reserva y lo disfrutas recién hecho.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CALENDARIO SEMANAL INTERACTIVO (LUNES A DOMINGO) */}
      <section className="max-w-6xl mx-auto px-5 py-12 space-y-8">
        <div className="bg-[#0c0d14] border border-white/10 rounded-3xl p-5 sm:p-6 shadow-xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 text-amber-400 text-xs font-black uppercase tracking-wider">
                <CalendarDays className="h-4 w-4" />
                <span>Calendario Semanal en Vivo</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white mt-0.5">
                Programación de Lunes a Domingo
              </h2>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => {
                  setSemanaOffset(0);
                  setDiaSeleccionado('TODOS');
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer border ${
                  semanaOffset === 0
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                    : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                }`}
              >
                Esta Semana
              </button>
              <button
                type="button"
                onClick={() => {
                  setSemanaOffset(1);
                  setDiaSeleccionado('TODOS');
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer border ${
                  semanaOffset === 1
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                    : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                }`}
              >
                Próxima Semana ▶
              </button>
            </div>
          </div>

          {/* PESTAÑAS INTERACTIVAS: VER TODA LA SEMANA + LUNES A DOMINGO */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            <button
              type="button"
              onClick={() => setDiaSeleccionado('TODOS')}
              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                diaSeleccionado === 'TODOS'
                  ? 'bg-gradient-to-br from-amber-500/25 to-orange-500/10 border-amber-400 text-white shadow-[0_0_20px_rgba(245,158,11,0.2)]'
                  : 'bg-[#131722]/80 border-white/10 text-slate-300 hover:border-white/25'
              }`}
            >
              <span className="text-[10px] font-black uppercase text-amber-400">Semana Completa</span>
              <span className="text-sm font-black mt-1 block">Lunes - Domingo</span>
            </button>

            {diasSemana.map((dia) => {
              const guisosDelDia = guisos.filter((g) => g.fecha === dia.fecha);
              const confirmadosDia = guisosDelDia.filter((g) => g.estado === 'confirmado').length;
              const seleccionado = diaSeleccionado === dia.fecha;

              return (
                <button
                  key={dia.fecha}
                  type="button"
                  onClick={() => setDiaSeleccionado(dia.fecha)}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between relative ${
                    seleccionado
                      ? 'bg-gradient-to-br from-cyan-500/25 to-blue-600/15 border-cyan-400 text-white shadow-[0_0_20px_rgba(0,242,254,0.2)]'
                      : 'bg-[#131722]/80 border-white/10 text-slate-300 hover:border-white/25'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      {dia.nombre}
                    </span>
                    {dia.esHoy && (
                      <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-cyan-500 text-slate-950">
                        Hoy
                      </span>
                    )}
                  </div>
                  <div className="mt-1">
                    <span className="text-xs font-bold block text-white">{dia.diaMes}</span>
                    {guisosDelDia.length > 0 ? (
                      <span
                        className={`text-[10px] font-black mt-0.5 block ${
                          confirmadosDia > 0 ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      >
                        {guisosDelDia.length} {guisosDelDia.length === 1 ? 'guiso' : 'guisos'}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500 mt-0.5 block">Sin programar</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* LISTADO DE TARJETAS DE GUISOS O BLOQUES "PLAN B" */}
        {loading ? (
          <div className="rounded-3xl border border-white/10 bg-[#0c0d14] p-16 text-center space-y-3">
            <ChefHat className="h-10 w-10 text-amber-400 mx-auto animate-bounce" />
            <p className="text-sm font-bold text-slate-300">
              Consultando el estado de los fogones en tiempo real...
            </p>
          </div>
        ) : guisosSemanaActiva.length === 0 ? (
          <div className="rounded-3xl border border-amber-500/25 bg-gradient-to-b from-[#131722] to-[#0c0d14] p-10 sm:p-14 text-center space-y-5">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <ChefHat className="h-7 w-7" />
            </div>
            <h3 className="text-2xl font-black text-white">
              No hay guisos programados para este filtro de fecha
            </h3>
            <p className="text-sm text-slate-400 max-w-xl mx-auto">
              Puedes consultar el resto de días de la semana o descubrir directamente nuestra carta habitual de sala y desayunos en Café Bar Nexus.
            </p>
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              {diaSeleccionado !== 'TODOS' && (
                <button
                  type="button"
                  onClick={() => setDiaSeleccionado('TODOS')}
                  className="px-5 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-black uppercase tracking-wider cursor-pointer"
                >
                  Ver toda la semana
                </button>
              )}
              <button
                type="button"
                onClick={onIrACartaBar}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 text-xs font-black uppercase tracking-wider shadow-[0_0_25px_rgba(245,158,11,0.3)] hover:opacity-95 cursor-pointer flex items-center gap-2"
              >
                <UtensilsCrossed className="h-4 w-4" />
                <span>Ir a la Carta Principal de Sala (#bar)</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {guisosSemanaActiva.map((guiso) => {
              const racionesActuales = racionesPorGuiso.get(guiso.id) || 0;
              const minRequerido = Math.max(1, Number(guiso.min_raciones || 1));
              const porcentajeProgreso = Math.min(
                100,
                Math.round((racionesActuales / minRequerido) * 100)
              );
              const mostrarPlanB = estaEnPlanB(guiso, racionesActuales);
              const preventaCerradaPorFecha = haSuperadoFechaHoraCorte(guiso);

              // Otros guisos de ese mismo día que SÍ están confirmados (para el Plan B Inteligente)
              const otrosGuisosConfirmadosHoy = guisos.filter(
                (otro) =>
                  otro.id !== guiso.id &&
                  otro.fecha === guiso.fecha &&
                  otro.estado === 'confirmado'
              );

              if (mostrarPlanB) {
                /* ================= BLOQUE "PLAN B" INTELIGENTE ================= */
                return (
                  <div
                    key={guiso.id}
                    className="rounded-3xl border border-amber-500/40 bg-gradient-to-b from-[#16131f] to-[#0c0d14] p-6 sm:p-7 flex flex-col justify-between shadow-2xl space-y-5 relative overflow-hidden"
                  >
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] font-black uppercase px-3 py-1 rounded-full bg-white/5 border border-white/10 text-slate-300">
                          📅 {formatearFechaHumana(guiso.fecha)}
                        </span>
                        <span className="text-[11px] font-black uppercase px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Preventa cerrada sin mínimo
                        </span>
                      </div>

                      <div>
                        <h3 className="text-lg font-black text-slate-300 line-through decoration-rose-500/70">
                          {guiso.nombre_plato}
                        </h3>
                        <p className="text-xs text-slate-400 mt-1">
                          Este guiso no alcanzó el mínimo de raciones antes de la fecha y hora de corte ({formatearFechaCorteHumana(guiso)}) o ha sido sustituido hoy.
                        </p>
                      </div>

                      {/* 1º ALTERNATIVA DINÁMICA: OTROS GUISOS DE ESE MISMO DÍA QUE SÍ ESTÁN CONFIRMADOS */}
                      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-4 space-y-3">
                        <p className="text-xs font-black text-emerald-300 flex items-center gap-1.5">
                          <Flame className="h-4 w-4 text-emerald-400 shrink-0" />
                          <span>
                            ¡No te quedes con hambre! Estos guisos de hoy ya están confirmados y en los fogones:
                          </span>
                        </p>

                        {otrosGuisosConfirmadosHoy.length > 0 ? (
                          <div className="space-y-2.5">
                            {otrosGuisosConfirmadosHoy.map((alt) => {
                              const cerradoAlt = haSuperadoFechaHoraCorte(alt);
                              return (
                                <div
                                  key={alt.id}
                                  className="flex items-center justify-between gap-3 bg-[#0c0d14]/90 border border-emerald-500/30 rounded-xl p-3"
                                >
                                  <div className="flex items-center gap-3">
                                    <img
                                      src={
                                        alt.imagen_url ||
                                        'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=300&q=80'
                                      }
                                      alt={alt.nombre_plato}
                                      className="w-12 h-12 rounded-xl object-cover shrink-0 border border-white/10"
                                    />
                                    <div>
                                      <h4 className="text-xs font-black text-white">{alt.nombre_plato}</h4>
                                      <p className="text-[11px] text-emerald-400 font-bold">
                                        🪑 {Number(alt.precio_barra).toFixed(2)}€ · 🛍️{' '}
                                        {Number(alt.precio_takeaway).toFixed(2)}€
                                      </p>
                                    </div>
                                  </div>
                                  {!cerradoAlt ? (
                                    <button
                                      type="button"
                                      onClick={() => abrirModalReserva(alt)}
                                      className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[11px] shrink-0 cursor-pointer transition-all"
                                    >
                                      ⚡ Reservar
                                    </button>
                                  ) : (
                                    <span className="text-[10px] font-bold text-amber-300 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 shrink-0">
                                      En barra
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-300">
                            Hoy tenemos nuestra cocina de sala a pleno rendimiento con todos los platos habituales de nuestra carta.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* 2º BOTÓN DESTACADO DE REDIRECCIÓN DIRECTA AL MENÚ GENERAL DE SALA (#bar) */}
                    <div className="pt-2 border-t border-white/10">
                      <button
                        type="button"
                        onClick={onIrACartaBar}
                        className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-95 text-slate-950 font-black text-xs uppercase tracking-wider shadow-[0_0_25px_rgba(245,158,11,0.3)] flex items-center justify-center gap-2 cursor-pointer transition-all"
                      >
                        <UtensilsCrossed className="h-4 w-4" />
                        <span>Ver Menú General de Sala y Carta Principal (#bar)</span>
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              }

              const esConfirmado = guiso.estado === 'confirmado';

              /* ================= TARJETA DE GUISO ACTIVO ================= */
              return (
                <div
                  key={guiso.id}
                  className={`rounded-3xl border bg-[#0c0d14]/95 overflow-hidden flex flex-col justify-between transition-all shadow-2xl group ${
                    esConfirmado
                      ? 'border-emerald-500/50 shadow-[0_0_35px_rgba(16,185,129,0.12)]'
                      : 'border-white/10 hover:border-amber-400/50'
                  }`}
                >
                  <div>
                    {/* IMAGEN Y BADGES DE ESTADO EN VIVO */}
                    <div className="relative h-56 overflow-hidden bg-slate-900">
                      <img
                        src={
                          guiso.imagen_url ||
                          'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80'
                        }
                        alt={guiso.nombre_plato}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0c0d14] via-[#0c0d14]/25 to-transparent" />

                      <div className="absolute top-3.5 left-3.5 right-3.5 flex flex-wrap items-center justify-between gap-2">
                        <span className="px-3 py-1 rounded-full bg-black/80 backdrop-blur-md border border-white/15 text-[11px] font-black text-white capitalize">
                          📅 {formatearFechaHumana(guiso.fecha)}
                        </span>

                        {esConfirmado ? (
                          <span className="px-3.5 py-1 rounded-full bg-emerald-500 text-slate-950 text-xs font-black shadow-[0_0_20px_rgba(16,185,129,0.6)] flex items-center gap-1">
                            🟢 ¡Confirmado para cocinar!
                          </span>
                        ) : (
                          <span className="px-3.5 py-1 rounded-full bg-amber-400 text-slate-950 text-xs font-black shadow-[0_0_20px_rgba(251,191,36,0.5)] flex items-center gap-1">
                            🟡 Buscando mínimo
                          </span>
                        )}
                      </div>

                      <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-[11px] text-slate-300">
                        <span className="inline-flex items-center gap-1.5 bg-black/75 backdrop-blur px-3 py-1 rounded-lg border border-white/10">
                          <Clock className="h-3.5 w-3.5 text-amber-400" />
                          <span>
                            Cierre preventa: <strong className="text-amber-300">{formatearFechaCorteHumana(guiso)}</strong>
                          </span>
                        </span>
                      </div>
                    </div>

                    {/* CONTENIDO DEL PLATO */}
                    <div className="p-6 space-y-5">
                      <div>
                        <h3 className="text-xl sm:text-2xl font-black text-white leading-snug">
                          {guiso.nombre_plato}
                        </h3>
                        {guiso.descripcion && (
                          <p className="text-xs sm:text-sm text-slate-400 mt-1.5 leading-relaxed">
                            {guiso.descripcion}
                          </p>
                        )}
                      </div>

                      {/* PRECIOS: EN BARRA vs PARA LLEVAR */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-amber-500/25 bg-amber-950/20 p-3.5">
                          <span className="text-[10px] font-black uppercase text-amber-300 block">
                            🪑 Para tomar en el Bar
                          </span>
                          <span className="text-2xl font-black text-white mt-0.5 block">
                            {Number(guiso.precio_barra).toFixed(2)} €
                          </span>
                          <span className="text-[10px] text-slate-400">Servicio en mesa o barra</span>
                        </div>

                        <div className="rounded-2xl border border-cyan-500/25 bg-cyan-950/20 p-3.5">
                          <span className="text-[10px] font-black uppercase text-cyan-300 block">
                            🛍️ Para llevar / Takeaway
                          </span>
                          <span className="text-2xl font-black text-white mt-0.5 block">
                            {Number(guiso.precio_takeaway).toFixed(2)} €
                          </span>
                          <span className="text-[10px] text-slate-400">Listo para recoger</span>
                        </div>
                      </div>

                      {/* BARRA DE PROGRESO DE DEMANDA EN VIVO */}
                      <div className="rounded-2xl bg-[#131722] border border-white/10 p-4 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-black text-white flex items-center gap-1.5">
                            <Flame
                              className={`h-4 w-4 ${
                                esConfirmado ? 'text-emerald-400' : 'text-amber-400'
                              }`}
                            />
                            {racionesActuales} de {minRequerido} raciones reservadas
                          </span>
                          <span
                            className={`font-black text-[11px] ${
                              esConfirmado ? 'text-emerald-400' : 'text-amber-300'
                            }`}
                          >
                            {esConfirmado
                              ? '¡Fogones en marcha!'
                              : `Faltan ${Math.max(0, minRequerido - racionesActuales)} raciones`}
                          </span>
                        </div>

                        <div className="w-full h-3 bg-black/60 rounded-full overflow-hidden border border-white/10">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${
                              esConfirmado
                                ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400'
                                : 'bg-gradient-to-r from-amber-500 to-orange-500'
                            }`}
                            style={{ width: `${Math.max(8, porcentajeProgreso)}%` }}
                          />
                        </div>

                        <p className="text-[11px] text-slate-400">
                          {preventaCerradaPorFecha
                            ? '🔒 El plazo online de preventa ha finalizado. Consulta disponibilidad de raciones directamente en barra.'
                            : esConfirmado
                            ? '⚡ Este plato ya ha alcanzado el mínimo y sale seguro. ¡Asegura tu ración antes del cierre!'
                            : '💡 Apúntate gratis sin pagar ahora. Si llegamos al mínimo, pasa automáticamente a confirmado.'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* BOTÓN DE RESERVA (BLOQUEADO SI SE SUPERÓ LA FECHA Y HORA DE CORTE) */}
                  <div className="px-6 pb-6">
                    {preventaCerradaPorFecha ? (
                      <div className="w-full py-4 px-5 rounded-2xl bg-slate-900 border border-white/10 text-slate-400 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2">
                        <Lock className="h-4 w-4 text-rose-400" />
                        <span>Preventa Cerrada ({formatearFechaCorteHumana(guiso)})</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => abrirModalReserva(guiso)}
                        className={`w-full py-4 px-5 rounded-2xl font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all shadow-lg ${
                          esConfirmado
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 shadow-[0_0_25px_rgba(16,185,129,0.35)] hover:opacity-95'
                            : 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-[0_0_25px_rgba(245,158,11,0.3)] hover:opacity-95'
                        }`}
                      >
                        {esConfirmado ? (
                          <>
                            <Sparkles className="h-4 w-4" />
                            <span>⚡ Reservar Ración Asegurada</span>
                          </>
                        ) : (
                          <>
                            <ChefHat className="h-4 w-4" />
                            <span>🍲 Apuntarme Gratis (0 € ahora)</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ================= MODAL DE RESERVA SIN FRICCIÓN Y LÓGICA HÍBRIDA ================= */}
      {guisoActivoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto"
          onClick={cerrarModalReserva}
        >
          <div
            className="w-full max-w-lg rounded-3xl border border-amber-500/40 bg-[#0c0d14] p-6 sm:p-8 shadow-2xl space-y-5 my-8"
            onClick={(e) => e.stopPropagation()}
          >
            {/* CABECERA DEL MODAL */}
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-white/10">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 block">
                  📅 {formatearFechaHumana(guisoActivoModal.fecha)} · 🛑 Corte: {formatearFechaCorteHumana(guisoActivoModal)}
                </span>
                <h3 className="text-xl font-black text-white mt-0.5">
                  {guisoActivoModal.nombre_plato}
                </h3>
              </div>
              <button
                type="button"
                onClick={cerrarModalReserva}
                className="text-slate-400 hover:text-white p-1.5 rounded-xl bg-white/5 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {!reservaCompletada ? (
              /* FORMULARIO DE RESERVA SIN FRICCIÓN */
              <form onSubmit={handleConfirmarReserva} className="space-y-4">
                {/* AVISO DESTACADO SI EL GUISO YA ESTÁ CONFIRMADO */}
                {guisoActivoModal.estado === 'confirmado' ? (
                  <div className="rounded-2xl border border-emerald-500/50 bg-emerald-950/40 p-4 text-xs text-emerald-200 leading-relaxed shadow-[0_0_25px_rgba(16,185,129,0.15)]">
                    <p className="font-bold">
                      ⚡ ¡Plato Confirmado y en marcha! Este guiso ya ha alcanzado su mínimo y se cocinará sin falta. Al apuntarte ahora, tu ración queda asegurada inmediatamente, por lo que en el siguiente paso formalizaremos el abono directo de tu reserva.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-amber-500/30 bg-amber-950/30 p-3.5 text-xs text-amber-200/90">
                    🟡 <strong>Preventa sin compromiso de pago inmediato:</strong> Te apuntas gratis hoy y solo abonas tu reserva cuando el plato alcance las{' '}
                    <strong>{guisoActivoModal.min_raciones} raciones mínimas</strong>.
                  </div>
                )}

                {/* 1. MODALIDAD: BARRA vs TAKEAWAY */}
                <div>
                  <label className="text-xs font-black uppercase text-slate-300 block mb-2">
                    1. ¿Cómo prefieres disfrutarlo?
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setModalidadReserva('barra')}
                      className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                        modalidadReserva === 'barra'
                          ? 'bg-amber-500/20 border-amber-400 text-white shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                          : 'bg-white/[0.03] border-white/10 text-slate-400 hover:text-white'
                      }`}
                    >
                      <span className="text-sm font-black block">🪑 Para tomar en el bar</span>
                      <span className="text-xs text-amber-400 font-bold mt-1 block">
                        {Number(guisoActivoModal.precio_barra).toFixed(2)} € / ración
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setModalidadReserva('takeaway')}
                      className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                        modalidadReserva === 'takeaway'
                          ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-[0_0_15px_rgba(0,242,254,0.2)]'
                          : 'bg-white/[0.03] border-white/10 text-slate-400 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        <ShoppingBag className="h-3.5 w-3.5 text-cyan-400" />
                        <span className="text-sm font-black">🛍️ Para llevar / Delivery</span>
                      </div>
                      <span className="text-xs text-cyan-400 font-bold mt-1 block">
                        {Number(guisoActivoModal.precio_takeaway).toFixed(2)} € / ración
                      </span>
                    </button>
                  </div>
                </div>

                {/* 2. SELECTOR NUMÉRICO DE RACIONES */}
                <div>
                  <label className="text-xs font-black uppercase text-slate-300 block mb-2">
                    2. Número de raciones
                  </label>
                  <div className="flex items-center justify-between bg-[#131722] border border-white/10 rounded-2xl p-3">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setRacionesReserva((prev) => Math.max(1, prev - 1))}
                        className="h-10 w-10 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center text-white cursor-pointer"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="text-2xl font-black text-white w-10 text-center">
                        {racionesReserva}
                      </span>
                      <button
                        type="button"
                        onClick={() => setRacionesReserva((prev) => Math.min(25, prev + 1))}
                        className="h-10 w-10 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center font-black cursor-pointer"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Total Reserva
                      </span>
                      <span className="text-xl font-black text-emerald-400">
                        {calcularImporteReserva(
                          guisoActivoModal,
                          racionesReserva,
                          modalidadReserva
                        ).toFixed(2)}{' '}
                        €
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. DATOS DEL CLIENTE SIN FRICCIÓN */}
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5 mb-1">
                      <User className="h-3.5 w-3.5 text-amber-400" />
                      <span>Nombre y Apellidos *</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={nombreCliente}
                      onChange={(e) => setNombreCliente(e.target.value)}
                      placeholder="Ej: Carlos Rodríguez"
                      className="w-full bg-[#131722] border border-white/15 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-xs font-bold text-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5 mb-1">
                      <Phone className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Teléfono / WhatsApp *</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={telefonoCliente}
                      onChange={(e) => setTelefonoCliente(e.target.value)}
                      placeholder="Ej: 600 123 456"
                      className="w-full bg-[#131722] border border-white/15 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-xs font-bold text-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5 mb-1">
                      <Mail className="h-3.5 w-3.5 text-cyan-400" />
                      <span>Correo electrónico (Opcional)</span>
                    </label>
                    <input
                      type="email"
                      value={emailCliente}
                      onChange={(e) => setEmailCliente(e.target.value)}
                      placeholder="tu@email.com"
                      className="w-full bg-[#131722] border border-white/15 focus:border-cyan-400 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
                    />
                    <span className="text-[11px] text-cyan-300/90 mt-1 block">
                      ✨ Recibe avisos de nuestros guisos especiales y novedades de la casa
                    </span>
                  </div>
                </div>

                {errorReserva && (
                  <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-300 font-bold">
                    ⚠️ {errorReserva}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={enviandoReserva}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-95 disabled:opacity-50 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider shadow-[0_0_25px_rgba(245,158,11,0.35)] cursor-pointer transition-all"
                >
                  {enviandoReserva
                    ? 'Registrando tu reserva...'
                    : guisoActivoModal.estado === 'confirmado'
                    ? '⚡ Confirmar Ración y Pasar al Abono Directo'
                    : '🍲 Apuntarme Ahora a la Preventa'}
                </button>
              </form>
            ) : (
              /* ================= PASO POST-CONFIRMACIÓN (PAGO DIRECTO / WHATSAPP) ================= */
              <div className="space-y-5">
                <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/30 p-5 text-center space-y-2">
                  <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto" />
                  <h4 className="text-lg font-black text-white">
                    {reservaCompletada.yaEstabaConfirmado ||
                    reservaCompletada.recienConfirmadoConEstaReserva
                      ? '¡Tu ración está 100% asegurada en fogones!'
                      : '¡Te has apuntado correctamente a la preventa!'}
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {reservaCompletada.recienConfirmadoConEstaReserva
                      ? '🎉 ¡Increíble! Con tus raciones acabamos de alcanzar el mínimo requerido y el guiso ha pasado automáticamente a CONFIRMADO.'
                      : reservaCompletada.yaEstabaConfirmado
                      ? 'El guiso ya está confirmado para cocinar. Formaliza a continuación el abono directo de tu reserva.'
                      : `Ya sumamos ${reservaCompletada.racionesTotalesAhora} de ${reservaCompletada.guiso.min_raciones} raciones. Te avisaremos por WhatsApp en cuanto alcancemos el mínimo.`}
                  </p>
                </div>

                {/* INSTRUCCIONES Y BOTÓN DE PAGO RÁPIDO + WHATSAPP */}
                {(reservaCompletada.yaEstabaConfirmado ||
                  reservaCompletada.recienConfirmadoConEstaReserva) && (
                  <div className="rounded-2xl border border-amber-500/40 bg-[#131722] p-4 space-y-3">
                    <div className="flex items-center gap-2 text-amber-400 font-black text-xs uppercase">
                      <CreditCard className="h-4 w-4" />
                      <span>Formalización de Abono Directo</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Importe a abonar por tus <strong>{reservaCompletada.reserva.raciones} raciones</strong>:{' '}
                      <strong className="text-emerald-400 text-sm">
                        {calcularImporteReserva(
                          reservaCompletada.guiso,
                          reservaCompletada.reserva.raciones,
                          reservaCompletada.reserva.modalidad
                        ).toFixed(2)}{' '}
                        €
                      </strong>
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Pulsa el botón de WhatsApp inferior para recibir/confirmar el enlace de pago rápido (Bizum / Tarjeta) o confirmar tu hora de recogida/mesa con barra.
                    </p>
                  </div>
                )}

                <div className="space-y-2.5">
                  <a
                    href={reservaCompletada.enlaceWhatsApp}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-4 px-5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(16,185,129,0.4)] transition-all"
                  >
                    <MessageCircle className="h-5 w-5" />
                    <span>
                      {reservaCompletada.yaEstabaConfirmado ||
                      reservaCompletada.recienConfirmadoConEstaReserva
                        ? '📲 Formalizar Abono y Confirmar por WhatsApp'
                        : '📲 Enviar mi Resguardo de Reserva por WhatsApp'}
                    </span>
                  </a>

                  <button
                    type="button"
                    onClick={cerrarModalReserva}
                    className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300 cursor-pointer"
                  >
                    Volver al Calendario de Guisos
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
