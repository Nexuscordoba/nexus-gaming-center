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
  dispararEmailGuiso,
  cargarConfiguracionGuisosDB,
  limpiarReservasExpiradasEnDB,
  calcularExpiraPagoAt,
  formatearHoraLimiteHumana,
  generarEnlaceGestionCliente,
  type ConfiguracionPagoGuisos,
  type GuisoProgramado,
  type ReservaGuiso,
  type ModalidadReservaGuiso,
  type MesaLocal,
  type ReservaMesa
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

// URLs genéricas de Unsplash antiguas para descartar y no mostrar fotos falsas
const URLS_UNSPLASH_DESCARTADAS = new Set([
  'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=300&q=80',
  'https://images.unsplash.com/photo-1534939561126-855b8675edd7?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1574484284002-952d92456975?auto=format&fit=crop&w=900&q=80'
]);

const obtenerImagenRealGuiso = (url?: string | null): string => {
  if (!url) return '';
  const limpia = url.trim();
  if (!limpia || URLS_UNSPLASH_DESCARTADAS.has(limpia)) return '';
  return limpia;
};

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

function RelojCuentaAtras({ expiraISO }: { expiraISO?: string | null }) {
  const [segundosRestantes, setSegundosRestantes] = useState<number | null>(() => {
    if (!expiraISO) return null;
    const diff = new Date(expiraISO).getTime() - Date.now();
    return Math.max(0, Math.floor(diff / 1000));
  });

  useEffect(() => {
    if (!expiraISO) return;
    const tick = () => {
      const diff = new Date(expiraISO).getTime() - Date.now();
      setSegundosRestantes(Math.max(0, Math.floor(diff / 1000)));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [expiraISO]);

  if (segundosRestantes === null) return null;

  if (segundosRestantes <= 0) {
    return (
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 font-mono text-xs font-black border border-rose-500/40">
        <span>⌛</span>
        <span>PLAZO DE PAGO EXPIRADO</span>
      </div>
    );
  }

  const horas = Math.floor(segundosRestantes / 3600);
  const minutos = Math.floor((segundosRestantes % 3600) / 60);
  const segundos = segundosRestantes % 60;
  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 font-mono text-xs font-black shadow-inner">
      <Clock className="w-3.5 h-3.5 text-amber-400 animate-spin" style={{ animationDuration: '4s' }} />
      <span>
        {horas > 0 ? `${horas}h ` : ''}
        {pad(minutos)}m {pad(segundos)}s restantes para abonar
      </span>
    </div>
  );
}

export default function GuisosPublicView({ onIrACartaBar }: GuisosPublicViewProps) {
  const [guisos, setGuisos] = useState<GuisoProgramado[]>([]);
  const [reservas, setReservas] = useState<ReservaGuiso[]>([]);
  const [mesasLocal, setMesasLocal] = useState<MesaLocal[]>([]);
  const [reservasMesas, setReservasMesas] = useState<ReservaMesa[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [configPago, setConfigPago] = useState<ConfiguracionPagoGuisos | null>(null);

  // Portal / Modal de Autogestión de Reservas
  const [mostrarModalGestion, setMostrarModalGestion] = useState<boolean>(false);
  const [telBusqueda, setTelBusqueda] = useState<string>('');
  const [busquedaRealizada, setBusquedaRealizada] = useState<boolean>(false);
  const [idReservaEnURL, setIdReservaEnURL] = useState<string | null>(null);
  const [reservaSeleccionada, setReservaSeleccionada] = useState<ReservaGuiso | null>(null);
  const [modoCambiarGuiso, setModoCambiarGuiso] = useState<boolean>(false);
  const [confirmandoCancelacion, setConfirmandoCancelacion] = useState<boolean>(false);
  const [procesandoGestion, setProcesandoGestion] = useState<boolean>(false);
  const [mensajeGestionOk, setMensajeGestionOk] = useState<string | null>(null);
  const [mensajeGestionError, setMensajeGestionError] = useState<string | null>(null);

  // Navegación estricta del Calendario Semanal (0 = Esta semana, 1 = Próxima semana)
  const [semanaOffset, setSemanaOffset] = useState<number>(0);
  const [diaSeleccionado, setDiaSeleccionado] = useState<string>('TODOS');

  // Estado del Modal de Reserva
  const [guisoActivoModal, setGuisoActivoModal] = useState<GuisoProgramado | null>(null);
  const [nombreCliente, setNombreCliente] = useState<string>('');
  const [telefonoCliente, setTelefonoCliente] = useState<string>('');
  const [emailCliente, setEmailCliente] = useState<string>('');
  const [racionesReserva, setRacionesReserva] = useState<number>(1);
  const [modalidadReserva, setModalidadReserva] = useState<ModalidadReservaGuiso>('barra');
  const [horaServicio, setHoraServicio] = useState<string>('14:00');
  const [zonaPreferida, setZonaPreferida] = useState<'interior' | 'terraza'>('interior');
  const [comensalesMesa, setComensalesMesa] = useState<number>(1);
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
    horaLimiteHumana?: string;
    enlaceGestion?: string;
  } | null>(null);

  const diasSemana = useMemo(() => construirDiasSemana(semanaOffset), [semanaOffset]);
  const diasEstaSemana = useMemo(() => construirDiasSemana(0), []);
  const diasProximaSemana = useMemo(() => construirDiasSemana(1), []);

  const cargarDatos = async () => {
    try {
      const [resGuisos, resReservas, resMesas, resReservasMesas] = await Promise.all([
        supabase.from('guisos_programados').select('*').order('fecha', { ascending: true }),
        supabase.from('reservas_guisos').select('*'),
        supabase.from('mesas_local').select('*'),
        supabase.from('reservas_mesas').select('*')
      ]);

      if (!resGuisos.error && resGuisos.data) {
        setGuisos(resGuisos.data as GuisoProgramado[]);
      }
      if (!resReservas.error && resReservas.data) {
        setReservas(resReservas.data as ReservaGuiso[]);
      }
      if (!resMesas.error && resMesas.data) {
        setMesasLocal(resMesas.data as MesaLocal[]);
      }
      if (!resReservasMesas.error && resReservasMesas.data) {
        setReservasMesas(resReservasMesas.data as ReservaMesa[]);
      }
    } catch (err) {
      console.error('Error cargando guisos y mesas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Detectar enlace de autogestión de reserva directa desde URL (?reserva=UUID#guisos)
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const paramReserva = urlParams.get('reserva');
      if (paramReserva && paramReserva.trim()) {
        setIdReservaEnURL(paramReserva.trim());
        setMostrarModalGestion(true);
      }
    } catch {}

    // Cargar configuración de plazos y pagos
    cargarConfiguracionGuisosDB()
      .then(setConfigPago)
      .catch((e) => console.warn('Aviso cargando config_guisos:', e));

    // Limpieza de reservas con plazo de pago expirado
    limpiarReservasExpiradasEnDB().catch((e) =>
      console.warn('Aviso limpiando reservas expiradas:', e)
    );

    cargarDatos();

    const channel = supabase
      .channel('public-guisos-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'guisos_programados' }, () => {
        cargarDatos();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservas_guisos' }, () => {
        cargarDatos();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mesas_local' }, () => {
        cargarDatos();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservas_mesas' }, () => {
        cargarDatos();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Autoseleccionar la reserva si el cliente entró con ?reserva=UUID
  useEffect(() => {
    if (idReservaEnURL && reservas.length > 0) {
      const encontrada = reservas.find((r) => r.id === idReservaEnURL);
      if (encontrada) {
        setReservaSeleccionada(encontrada);
      }
    }
  }, [idReservaEnURL, reservas]);

  // Mapa de raciones reservadas en vivo por cada guiso_id (ignora expiradas y canceladas)
  const racionesPorGuiso = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const r of reservas) {
      if (r.estado_pago === 'expirado' || r.estado_pago === 'cancelado') continue;
      const prev = mapa.get(r.guiso_id) || 0;
      mapa.set(r.guiso_id, prev + Number(r.raciones || 0));
    }
    return mapa;
  }, [reservas]);

  // Conjuntos estrictos de los 7 días (Lunes a Domingo) para no mezclar semanas nunca
  const fechasDeLaSemanaSet = useMemo(() => {
    return new Set(diasSemana.map((d) => d.fecha));
  }, [diasSemana]);

  const cantidadGuisosEstaSemana = useMemo(() => {
    const setActual = new Set(diasEstaSemana.map((d) => d.fecha));
    return guisos.filter((g) => setActual.has(g.fecha)).length;
  }, [guisos, diasEstaSemana]);

  const cantidadGuisosProximaSemana = useMemo(() => {
    const setSig = new Set(diasProximaSemana.map((d) => d.fecha));
    return guisos.filter((g) => setSig.has(g.fecha)).length;
  }, [guisos, diasProximaSemana]);

  // FILTRO ESTRICTO: "Semana completa" muestra ÚNICAMENTE los guisos entre Lunes y Domingo de la semana seleccionada
  const guisosSemanaActiva = useMemo(() => {
    const enSemana = guisos.filter((g) => fechasDeLaSemanaSet.has(g.fecha));
    if (diaSeleccionado === 'TODOS') return enSemana;
    return enSemana.filter((g) => g.fecha === diaSeleccionado);
  }, [guisos, fechasDeLaSemanaSet, diaSeleccionado]);

  const rangoSemanaTexto = useMemo(() => {
    if (diasSemana.length < 7) return '';
    return `${diasSemana[0].diaMes} — ${diasSemana[6].diaMes}`;
  }, [diasSemana]);

  // Disponibilidad de mesas activas en tiempo real por franja horaria para el modal de reserva
  const disponibilidadMesasModal = useMemo(() => {
    if (!guisoActivoModal) {
      return {
        interiorLibres: 0,
        interiorTotal: 0,
        terrazaLibres: 0,
        terrazaTotal: 0,
        hayMesasEnZonaElegida: false,
        hayAlgunaMesaEnLocal: false
      };
    }

    const fechaPlato = guisoActivoModal.fecha;
    // Reservas confirmadas de mesa en esa misma fecha y hora
    const reservasEnTurno = reservasMesas.filter(
      (r) => r.fecha === fechaPlato && r.hora_servicio === horaServicio && r.estado === 'confirmada'
    );
    const mesasOcupadasIds = new Set(reservasEnTurno.map((r) => r.mesa_id).filter(Boolean));

    const activasInterior = mesasLocal.filter((m) => m.zona === 'interior' && m.activa);
    const activasTerraza = mesasLocal.filter((m) => m.zona === 'terraza' && m.activa);

    const interiorLibres = activasInterior.filter((m) => !mesasOcupadasIds.has(m.id)).length;
    const terrazaLibres = activasTerraza.filter((m) => !mesasOcupadasIds.has(m.id)).length;

    const hayAlgunaMesaEnLocal = interiorLibres > 0 || terrazaLibres > 0;
    const hayMesasEnZonaElegida =
      zonaPreferida === 'interior' ? interiorLibres > 0 : terrazaLibres > 0;

    return {
      interiorLibres,
      interiorTotal: activasInterior.length,
      terrazaLibres,
      terrazaTotal: activasTerraza.length,
      hayMesasEnZonaElegida,
      hayAlgunaMesaEnLocal
    };
  }, [guisoActivoModal, horaServicio, zonaPreferida, mesasLocal, reservasMesas]);

  const abrirModalReserva = (guiso: GuisoProgramado) => {
    if (haSuperadoFechaHoraCorte(guiso)) {
      return;
    }
    setGuisoActivoModal(guiso);
    setReservaCompletada(null);
    setErrorReserva(null);
    setRacionesReserva(1);
    setComensalesMesa(1);
    setHoraServicio('14:00');
    setZonaPreferida('interior');
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
      const cfg = configPago || (await cargarConfiguracionGuisosDB());
      const racionesPrevias = racionesPorGuiso.get(guisoActivoModal.id) || 0;
      const yaEstabaConfirmado = guisoActivoModal.estado === 'confirmado';
      const racionesNuevas = Math.max(1, Number(racionesReserva || 1));
      const nuevoTotalRaciones = racionesPrevias + racionesNuevas;
      const alcanzaMinimoAhora =
        guisoActivoModal.estado === 'buscando_minimo' &&
        nuevoTotalRaciones >= Number(guisoActivoModal.min_raciones || 1);

      // Calcular fecha/hora exacta en la que expira el pago si el plato está o pasa a confirmado
      let expiraISO: string | null = null;
      if (yaEstabaConfirmado) {
        expiraISO = calcularExpiraPagoAt(
          guisoActivoModal,
          cfg.horas_limite_directo || 1,
          new Date()
        );
      } else if (alcanzaMinimoAhora) {
        expiraISO = calcularExpiraPagoAt(
          guisoActivoModal,
          cfg.horas_limite_preventa || 4,
          new Date()
        );
      }

      // Si es comer en el local, buscar y asignar mesa libre en la zona elegida
      let mesaAsignadaId: string | null = null;
      if (modalidadReserva === 'barra') {
        const reservasEnTurno = reservasMesas.filter(
          (r) =>
            r.fecha === guisoActivoModal.fecha &&
            r.hora_servicio === horaServicio &&
            r.estado === 'confirmada'
        );
        const ocupadasIds = new Set(reservasEnTurno.map((r) => r.mesa_id).filter(Boolean));
        const mesasLibresEnZona = mesasLocal.filter(
          (m) => m.activa && m.zona === zonaPreferida && !ocupadasIds.has(m.id)
        );

        if (mesasLibresEnZona.length > 0) {
          mesaAsignadaId = mesasLibresEnZona[0].id;
        } else {
          // Si en esa zona no hay pero en la otra sí, usar la otra zona
          const mesasLibresOtra = mesasLocal.filter(
            (m) => m.activa && !ocupadasIds.has(m.id)
          );
          if (mesasLibresOtra.length > 0) {
            mesaAsignadaId = mesasLibresOtra[0].id;
          }
        }
      }

      const nuevaReservaPayload = {
        guiso_id: guisoActivoModal.id,
        nombre_cliente: nombreCliente.trim(),
        telefono: telefonoCliente.trim(),
        email: emailCliente.trim() ? emailCliente.trim() : null,
        raciones: racionesNuevas,
        modalidad: modalidadReserva,
        estado_pago: 'pendiente' as const,
        expira_pago_at: expiraISO,
        hora_servicio: horaServicio,
        zona_preferida: modalidadReserva === 'barra' ? zonaPreferida : 'interior',
        comensales: modalidadReserva === 'barra' ? comensalesMesa : racionesNuevas,
        mesa_id: mesaAsignadaId
      };

      const { data: reservaInsertada, error: insertError } = await supabase
        .from('reservas_guisos')
        .insert([nuevaReservaPayload])
        .select()
        .single();

      if (insertError) {
        // Fallback si la tabla no tuviera las nuevas columnas aún
        const payloadMinimo = {
          guiso_id: guisoActivoModal.id,
          nombre_cliente: nombreCliente.trim(),
          telefono: telefonoCliente.trim(),
          email: emailCliente.trim() ? emailCliente.trim() : null,
          raciones: racionesNuevas,
          modalidad: modalidadReserva,
          estado_pago: 'pendiente' as const,
          expira_pago_at: expiraISO
        };
        const { error: errFallback } = await supabase
          .from('reservas_guisos')
          .insert([payloadMinimo])
          .select()
          .single();
        if (errFallback) throw errFallback;
      }

      const idReservaGuisoFinal =
        (reservaInsertada as any)?.id || crypto.randomUUID();

      // Si es comer en el local, registrar también en reservas_mesas
      if (modalidadReserva === 'barra') {
        try {
          await supabase.from('reservas_mesas').insert([
            {
              mesa_id: mesaAsignadaId,
              reserva_guiso_id: idReservaGuisoFinal,
              fecha: guisoActivoModal.fecha,
              hora_servicio: horaServicio,
              zona_preferida: zonaPreferida,
              comensales: comensalesMesa,
              nombre_cliente: nombreCliente.trim(),
              telefono: telefonoCliente.trim(),
              estado: 'confirmada',
              observaciones: `Reserva con ${racionesNuevas} raciones de "${guisoActivoModal.nombre_plato}"`
            }
          ]);
        } catch (errMesa) {
          console.warn('Aviso guardando en reservas_mesas:', errMesa);
        }
      }

      let guisoActualizado: GuisoProgramado = { ...guisoActivoModal };

      // LÓGICA HÍBRIDA: Si estaba en 'buscando_minimo' y al sumar las raciones alcanza o supera min_raciones,
      // cambia automáticamente su estado a 'confirmado' en Supabase y asigna plazo de pago a los clientes anteriores.
      if (alcanzaMinimoAhora) {
        const { error: updateErr } = await supabase
          .from('guisos_programados')
          .update({ estado: 'confirmado' })
          .eq('id', guisoActivoModal.id);

        if (!updateErr) {
          guisoActualizado = { ...guisoActivoModal, estado: 'confirmado' };

          // Actualizar expira_pago_at a las reservas que ya estaban inscritas
          if (expiraISO) {
            await supabase
              .from('reservas_guisos')
              .update({ expira_pago_at: expiraISO })
              .eq('guiso_id', guisoActivoModal.id)
              .eq('estado_pago', 'pendiente');
          }

          // Disparar aviso 'plato_confirmado_pago' a todos los clientes que ya estaban en lista de espera
          const inscritosPrevios = reservas.filter(
            (r) =>
              r.guiso_id === guisoActivoModal.id &&
              r.email &&
              r.email.includes('@') &&
              r.estado_pago !== 'cancelado' &&
              r.estado_pago !== 'expirado'
          );
          for (const prevRes of inscritosPrevios) {
            dispararEmailGuiso({
              tipo: 'plato_confirmado_pago',
              reserva: { ...prevRes, expira_pago_at: expiraISO },
              guiso: guisoActualizado,
              horaLimiteHumana: formatearHoraLimiteHumana(expiraISO),
              enlaceGestion: generarEnlaceGestionCliente(prevRes.id)
            }).catch((e) => console.warn('Error enviando email confirmacion guiso en cola:', e));
          }
        }
      }

      const reservaFinalObj: ReservaGuiso = (reservaInsertada as ReservaGuiso) || {
        id: idReservaGuisoFinal,
        ...nuevaReservaPayload
      };

      const platoConfirmadoFinal = yaEstabaConfirmado || alcanzaMinimoAhora;
      const enlaceWA = generarEnlaceWhatsAppClienteABar(
        reservaFinalObj,
        guisoActualizado,
        platoConfirmadoFinal
      );

      const horaHumana = formatearHoraLimiteHumana(expiraISO);
      const enlaceGestionFinal = generarEnlaceGestionCliente(idReservaGuisoFinal);

      // Enviar correo al nuevo cliente (reserva_en_cola o plato_confirmado_pago con datos de Bizum)
      dispararEmailGuiso({
        tipo: platoConfirmadoFinal ? 'plato_confirmado_pago' : 'reserva_en_cola',
        reserva: reservaFinalObj,
        guiso: guisoActualizado,
        horaLimiteHumana: horaHumana,
        enlaceGestion: enlaceGestionFinal,
        zonaMesa:
          modalidadReserva === 'barra'
            ? `${zonaPreferida === 'terraza' ? '☀️ Terraza' : '🏠 Salón Interior'} (Mesa asignada)`
            : `🛍️ Para llevar (Recogida ${horaServicio})`
      }).catch((err) => console.warn('Aviso notificación email:', err));

      await cargarDatos();

      setReservaCompletada({
        reserva: reservaFinalObj,
        guiso: guisoActualizado,
        yaEstabaConfirmado,
        recienConfirmadoConEstaReserva: alcanzaMinimoAhora,
        racionesTotalesAhora: nuevoTotalRaciones,
        enlaceWhatsApp: enlaceWA,
        horaLimiteHumana: horaHumana,
        enlaceGestion: enlaceGestionFinal
      });
    } catch (err: any) {
      setErrorReserva(
        'No se pudo registrar la reserva en este momento: ' + (err?.message || 'Inténtalo de nuevo')
      );
    } finally {
      setEnviandoReserva(false);
    }
  };

  // MÉTODOS DE AUTOGESTIÓN DE RESERVAS PARA EL CLIENTE
  const handleBuscarReservasPorTelefono = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setBusquedaRealizada(true);
    setMensajeGestionError(null);
    setMensajeGestionOk(null);

    const limpio = telBusqueda.replace(/\D/g, '');
    if (limpio.length < 6 && telBusqueda.trim().length < 8) {
      setMensajeGestionError('Por favor, introduce al menos 6 dígitos de tu número de teléfono.');
      return;
    }

    const encontradas = reservas.filter((r) => {
      const tel = (r.telefono || '').replace(/\D/g, '');
      return tel.endsWith(limpio) || tel === limpio || r.id === telBusqueda.trim();
    });

    if (encontradas.length === 1) {
      setReservaSeleccionada(encontradas[0]);
    } else if (encontradas.length === 0) {
      setReservaSeleccionada(null);
    }
  };

  const reservasEncontradasPorTelefono = useMemo(() => {
    if (!busquedaRealizada) return [];
    const limpio = telBusqueda.replace(/\D/g, '');
    if (!limpio && !telBusqueda.trim()) return [];
    return reservas.filter((r) => {
      const tel = (r.telefono || '').replace(/\D/g, '');
      return tel.endsWith(limpio) || tel === limpio || r.id === telBusqueda.trim();
    });
  }, [busquedaRealizada, telBusqueda, reservas]);

  const handleCambiarGuiso = async (nuevoGuiso: GuisoProgramado) => {
    if (!reservaSeleccionada || procesandoGestion) return;
    if (haSuperadoFechaHoraCorte(nuevoGuiso)) {
      setMensajeGestionError(`El plazo para apuntarse a "${nuevoGuiso.nombre_plato}" ha finalizado.`);
      return;
    }

    setProcesandoGestion(true);
    setMensajeGestionError(null);
    setMensajeGestionOk(null);

    try {
      const cfg = configPago || (await cargarConfiguracionGuisosDB());
      const nuevoPlatoConfirmado = nuevoGuiso.estado === 'confirmado';
      let nuevoExpiraISO: string | null = null;

      if (nuevoPlatoConfirmado) {
        nuevoExpiraISO = calcularExpiraPagoAt(
          nuevoGuiso,
          cfg.horas_limite_directo || 1,
          new Date()
        );
      }

      // 1. Actualizar reserva_guiso
      const { error: errUpdateRes } = await supabase
        .from('reservas_guisos')
        .update({
          guiso_id: nuevoGuiso.id,
          expira_pago_at: nuevoExpiraISO,
          estado_pago: 'pendiente'
        })
        .eq('id', reservaSeleccionada.id);

      if (errUpdateRes) throw errUpdateRes;

      // 2. Si tenía mesa asignada en local, actualizar fecha y observaciones en reservas_mesas
      try {
        await supabase
          .from('reservas_mesas')
          .update({
            fecha: nuevoGuiso.fecha,
            observaciones: `Reserva cambiada al plato: ${nuevoGuiso.nombre_plato}`
          })
          .eq('reserva_guiso_id', reservaSeleccionada.id);
      } catch {}

      // 3. Comprobar si el nuevo guiso alcanza el mínimo ahora
      const racionesPreviasNuevo = racionesPorGuiso.get(nuevoGuiso.id) || 0;
      const totalNuevo = racionesPreviasNuevo + Number(reservaSeleccionada.raciones || 1);
      if (
        nuevoGuiso.estado === 'buscando_minimo' &&
        totalNuevo >= Number(nuevoGuiso.min_raciones || 1)
      ) {
        await supabase
          .from('guisos_programados')
          .update({ estado: 'confirmado' })
          .eq('id', nuevoGuiso.id);
      }

      // 4. Enviar email de plato_cambiado
      const reservaActualizada: ReservaGuiso = {
        ...reservaSeleccionada,
        guiso_id: nuevoGuiso.id,
        expira_pago_at: nuevoExpiraISO,
        estado_pago: 'pendiente'
      };

      if (reservaActualizada.email && reservaActualizada.email.includes('@')) {
        dispararEmailGuiso({
          tipo: 'plato_cambiado',
          reserva: reservaActualizada,
          guiso: nuevoGuiso,
          horaLimiteHumana: formatearHoraLimiteHumana(nuevoExpiraISO),
          enlaceGestion: generarEnlaceGestionCliente(reservaActualizada.id)
        }).catch((e) => console.warn('Error enviando email plato cambiado:', e));
      }

      setReservaSeleccionada(reservaActualizada);
      setModoCambiarGuiso(false);
      setMensajeGestionOk(
        `✅ Has cambiado tu reserva con éxito al plato "${nuevoGuiso.nombre_plato}" (${formatearFechaHumana(nuevoGuiso.fecha)}).`
      );
      await cargarDatos();
    } catch (err: any) {
      setMensajeGestionError('Error al cambiar de guiso: ' + (err.message || String(err)));
    } finally {
      setProcesandoGestion(false);
    }
  };

  const handleCancelarReserva = async () => {
    if (!reservaSeleccionada || procesandoGestion) return;

    setProcesandoGestion(true);
    setMensajeGestionError(null);
    setMensajeGestionOk(null);

    try {
      // 1. Marcar reserva como cancelada
      const { error: errRes } = await supabase
        .from('reservas_guisos')
        .update({ estado_pago: 'cancelado' })
        .eq('id', reservaSeleccionada.id);

      if (errRes) throw errRes;

      // 2. Liberar mesa en reservas_mesas
      try {
        await supabase
          .from('reservas_mesas')
          .update({ estado: 'cancelada' })
          .eq('reserva_guiso_id', reservaSeleccionada.id);
      } catch {}

      // 3. Enviar email de cancelación si tenía correo
      const guisoActual = guisos.find((g) => g.id === reservaSeleccionada.guiso_id);
      if (guisoActual && reservaSeleccionada.email && reservaSeleccionada.email.includes('@')) {
        dispararEmailGuiso({
          tipo: 'reserva_cancelada',
          reserva: reservaSeleccionada,
          guiso: guisoActual
        }).catch((e) => console.warn('Error enviando email cancelacion:', e));
      }

      setReservaSeleccionada({
        ...reservaSeleccionada,
        estado_pago: 'cancelado'
      });
      setConfirmandoCancelacion(false);
      setMensajeGestionOk(
        'Tu reserva ha sido cancelada correctamente. Se han liberado tus raciones y tu mesa.'
      );
      await cargarDatos();
    } catch (err: any) {
      setMensajeGestionError('Error al cancelar tu reserva: ' + (err.message || String(err)));
    } finally {
      setProcesandoGestion(false);
    }
  };

  return (
    <main className="flex-grow">
      {/* HERO COMPACTO DE GUISOS DE LA CASA (#guisos) */}
      <section className="relative overflow-hidden py-10 sm:py-14 border-b border-white/[0.06] bg-gradient-to-b from-[#12101b] via-[#0c0d14] to-[#08090d]">
        <div className="max-w-5xl mx-auto px-5 text-center relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-950/80 backdrop-blur-md px-3.5 py-1 text-[11px] font-bold text-amber-300 mb-4 shadow-[0_0_25px_rgba(245,158,11,0.2)]">
            <Flame className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span>Cocina Casera Bajo Demanda · Cero Desperdicio · Chinales 45</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight uppercase leading-tight">
            🍲 Guisos de la{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-400 to-yellow-300">
              Casa
            </span>
          </h1>

          <p className="mt-3 text-xs sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Cada día proponemos nuestros mejores guisos tradicionales de cuchara.{' '}
            <strong className="text-amber-300">Apúntate gratis a tu plato favorito:</strong> en cuanto alcanzamos el mínimo de raciones, encendemos los fogones y te avisamos.
          </p>

          {/* PASOS EXPLICATIVOS COMPACTOS */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-2.5 max-w-3xl mx-auto text-left">
            <div className="rounded-2xl border border-white/10 bg-[#0c0d14]/85 backdrop-blur p-3 flex items-start gap-2.5">
              <div className="h-7 w-7 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center font-black text-xs shrink-0">
                1
              </div>
              <div>
                <h3 className="text-[11px] font-black text-white uppercase">Elige día y plato</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Reserva para tomar en el bar o para llevar.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0c0d14]/85 backdrop-blur p-3 flex items-start gap-2.5">
              <div className="h-7 w-7 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center font-black text-xs shrink-0">
                2
              </div>
              <div>
                <h3 className="text-[11px] font-black text-white uppercase">Alcanzamos el mínimo</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  No pagas nada al apuntarte mientras busca mínimo.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0c0d14]/85 backdrop-blur p-3 flex items-start gap-2.5">
              <div className="h-7 w-7 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-black text-xs shrink-0">
                3
              </div>
              <div>
                <h3 className="text-[11px] font-black text-white uppercase">¡A los fogones!</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Al confirmarse, formalizas tu reserva y lo disfrutas.
                </p>
              </div>
            </div>
          </div>

          {/* BOTÓN RÁPIDO PARA GESTIONAR O CONSULTAR RESERVA */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setMostrarModalGestion(true);
                setMensajeGestionOk(null);
                setMensajeGestionError(null);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-cyan-950/80 hover:bg-cyan-900/90 border border-cyan-500/50 text-cyan-300 font-bold text-xs sm:text-sm shadow-[0_0_20px_rgba(6,182,212,0.2)] transition-all cursor-pointer"
            >
              <span>🔍</span>
              <span>Gestionar / Cambiar mi reserva</span>
            </button>
          </div>
        </div>
      </section>

      {/* CALENDARIO SEMANAL INTERACTIVO ESTRICTO (LUNES A DOMINGO) */}
      <section className="max-w-6xl mx-auto px-5 py-8 space-y-6">
        <div className="bg-[#0c0d14] border border-white/10 rounded-3xl p-4 sm:p-5 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2 text-amber-400 text-[11px] font-black uppercase tracking-wider">
                <CalendarDays className="h-3.5 w-3.5" />
                <span>
                  {semanaOffset === 0 ? 'Esta Semana' : 'Próxima Semana'} ({rangoSemanaTexto})
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-white mt-0.5">
                Programación de Lunes a Domingo
              </h2>
            </div>

            {/* SELECTOR LIMPIO ESTA SEMANA / PRÓXIMA SEMANA + BOTÓN MI RESERVA */}
            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => {
                  setMostrarModalGestion(true);
                  setMensajeGestionOk(null);
                  setMensajeGestionError(null);
                }}
                className="px-3 py-2 rounded-xl text-xs font-bold text-cyan-300 bg-cyan-950/50 hover:bg-cyan-900/60 border border-cyan-500/40 cursor-pointer flex items-center gap-1.5"
                title="Buscar o modificar mi reserva existente"
              >
                <span>🔍</span>
                <span>Mi reserva</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSemanaOffset(0);
                  setDiaSeleccionado('TODOS');
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer border flex items-center gap-1.5 ${
                  semanaOffset === 0
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                    : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                }`}
              >
                <span>Esta semana</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                    semanaOffset === 0
                      ? 'bg-slate-950/20 text-slate-950'
                      : 'bg-white/10 text-amber-300'
                  }`}
                >
                  {cantidadGuisosEstaSemana}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSemanaOffset(1);
                  setDiaSeleccionado('TODOS');
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer border flex items-center gap-1.5 ${
                  semanaOffset === 1
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                    : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                }`}
              >
                <span>Próxima semana ▶</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                    semanaOffset === 1
                      ? 'bg-slate-950/20 text-slate-950'
                      : 'bg-white/10 text-amber-300'
                  }`}
                >
                  {cantidadGuisosProximaSemana}
                </span>
              </button>
            </div>
          </div>

          {/* PESTAÑAS INTERACTIVAS: SEMANA COMPLETA (ESTRICTA 7 DÍAS) + LUNES A DOMINGO */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            <button
              type="button"
              onClick={() => setDiaSeleccionado('TODOS')}
              className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                diaSeleccionado === 'TODOS'
                  ? 'bg-gradient-to-br from-amber-500/25 to-orange-500/10 border-amber-400 text-white shadow-[0_0_20px_rgba(245,158,11,0.2)]'
                  : 'bg-[#131722]/80 border-white/10 text-slate-300 hover:border-white/25'
              }`}
            >
              <span className="text-[10px] font-black uppercase text-amber-400">Semana completa</span>
              <div>
                <span className="text-xs font-black mt-0.5 block">Lun - Dom</span>
                <span className="text-[10px] text-slate-400 block">{rangoSemanaTexto}</span>
              </div>
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
                  className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between relative ${
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

        {/* LISTADO COMPACTO DE TARJETAS DE GUISOS O BLOQUES "PLAN B" */}
        {loading ? (
          <div className="rounded-3xl border border-white/10 bg-[#0c0d14] p-12 text-center space-y-3">
            <ChefHat className="h-9 w-9 text-amber-400 mx-auto animate-bounce" />
            <p className="text-xs font-bold text-slate-300">
              Consultando el estado de los fogones en tiempo real...
            </p>
          </div>
        ) : guisosSemanaActiva.length === 0 ? (
          <div className="rounded-3xl border border-amber-500/25 bg-gradient-to-b from-[#131722] to-[#0c0d14] p-8 sm:p-10 text-center space-y-4">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <ChefHat className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-black text-white">
              {diaSeleccionado === 'TODOS'
                ? semanaOffset === 0
                  ? 'No hay guisos programados para esta semana (Lunes a Domingo)'
                  : 'No hay guisos programados para la próxima semana'
                : 'No hay guisos programados para este día'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
              {semanaOffset === 0 && cantidadGuisosProximaSemana > 0
                ? `Tenemos ${cantidadGuisosProximaSemana} ${
                    cantidadGuisosProximaSemana === 1 ? 'guiso programado' : 'guisos programados'
                  } para la próxima semana. Puedes cambiar a "Próxima semana" o visitar nuestra carta principal.`
                : 'Puedes consultar otros días de la semana o descubrir nuestra carta habitual de sala y desayunos en Café Bar Nexus.'}
            </p>
            <div className="flex flex-wrap justify-center gap-2.5 pt-1">
              {diaSeleccionado !== 'TODOS' && (
                <button
                  type="button"
                  onClick={() => setDiaSeleccionado('TODOS')}
                  className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-black uppercase tracking-wider cursor-pointer"
                >
                  Ver semana completa
                </button>
              )}
              {semanaOffset === 0 && cantidadGuisosProximaSemana > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSemanaOffset(1);
                    setDiaSeleccionado('TODOS');
                  }}
                  className="px-4 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-300 text-xs font-black uppercase tracking-wider cursor-pointer"
                >
                  Ver Próxima Semana ({cantidadGuisosProximaSemana}) ▶
                </button>
              )}
              <button
                type="button"
                onClick={onIrACartaBar}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 text-xs font-black uppercase tracking-wider shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:opacity-95 cursor-pointer flex items-center gap-2"
              >
                <UtensilsCrossed className="h-3.5 w-3.5" />
                <span>Ir a la Carta Principal (#bar)</span>
              </button>
            </div>
          </div>
        ) : (
          /* GRID COMPACTO (grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4) Y ANCHO MÁXIMO ESTRICTO (max-w-[360px]) */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 justify-items-center sm:justify-items-start">
            {guisosSemanaActiva.map((guiso) => {
              const racionesActuales = racionesPorGuiso.get(guiso.id) || 0;
              const minRequerido = Math.max(1, Number(guiso.min_raciones || 1));
              const porcentajeProgreso = Math.min(
                100,
                Math.round((racionesActuales / minRequerido) * 100)
              );
              const mostrarPlanB = estaEnPlanB(guiso, racionesActuales);
              const preventaCerradaPorFecha = haSuperadoFechaHoraCorte(guiso);
              const imagenReal = obtenerImagenRealGuiso(guiso.imagen_url);

              // Otros guisos de ese mismo día que SÍ están confirmados (para el Plan B Inteligente)
              const otrosGuisosConfirmadosHoy = guisos.filter(
                (otro) =>
                  otro.id !== guiso.id &&
                  otro.fecha === guiso.fecha &&
                  otro.estado === 'confirmado'
              );

              if (mostrarPlanB) {
                /* ================= BLOQUE "PLAN B" INTELIGENTE COMPACTO ================= */
                return (
                  <div
                    key={guiso.id}
                    className="w-full max-w-[360px] rounded-2xl border border-amber-500/40 bg-gradient-to-b from-[#16131f] to-[#0c0d14] p-4 flex flex-col justify-between shadow-xl space-y-3.5 relative overflow-hidden"
                  >
                    <div className="space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-300">
                          📅 {formatearFechaHumana(guiso.fecha)}
                        </span>
                        <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Sin mínimo
                        </span>
                      </div>

                      <div>
                        <h3 className="text-base font-black text-slate-300 line-through decoration-rose-500/70">
                          {guiso.nombre_plato}
                        </h3>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          No alcanzó el mínimo antes del cierre ({formatearFechaCorteHumana(guiso)}).
                        </p>
                      </div>

                      {/* 1º ALTERNATIVA DINÁMICA: OTROS GUISOS DE ESE MISMO DÍA QUE SÍ ESTÁN CONFIRMADOS */}
                      <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3 space-y-2">
                        <p className="text-[11px] font-black text-emerald-300 flex items-center gap-1">
                          <Flame className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                          <span>¡No te quedes con hambre! Guisos confirmados hoy:</span>
                        </p>

                        {otrosGuisosConfirmadosHoy.length > 0 ? (
                          <div className="space-y-2">
                            {otrosGuisosConfirmadosHoy.map((alt) => {
                              const cerradoAlt = haSuperadoFechaHoraCorte(alt);
                              const fotoAlt = obtenerImagenRealGuiso(alt.imagen_url);
                              return (
                                <div
                                  key={alt.id}
                                  className="flex items-center justify-between gap-2 bg-[#0c0d14]/90 border border-emerald-500/30 rounded-xl p-2"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    {fotoAlt ? (
                                      <img
                                        src={fotoAlt}
                                        alt={alt.nombre_plato}
                                        className="w-9 h-9 rounded-lg object-cover shrink-0 border border-white/10"
                                      />
                                    ) : (
                                      <div className="w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-sm shrink-0">
                                        🍲
                                      </div>
                                    )}
                                    <div className="min-w-0">
                                      <h4 className="text-[11px] font-black text-white truncate">
                                        {alt.nombre_plato}
                                      </h4>
                                      <p className="text-[10px] text-emerald-400 font-bold">
                                        🪑 {Number(alt.precio_barra).toFixed(2)}€ · 🛍️{' '}
                                        {Number(alt.precio_takeaway).toFixed(2)}€
                                      </p>
                                    </div>
                                  </div>
                                  {!cerradoAlt ? (
                                    <button
                                      type="button"
                                      onClick={() => abrirModalReserva(alt)}
                                      className="px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[10px] shrink-0 cursor-pointer transition-all"
                                    >
                                      ⚡ Reservar
                                    </button>
                                  ) : (
                                    <span className="text-[9px] font-bold text-amber-300 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 shrink-0">
                                      En barra
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-300">
                            Tenemos nuestra cocina de sala a pleno rendimiento con toda la carta principal.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* 2º BOTÓN DESTACADO DE REDIRECCIÓN DIRECTA AL MENÚ GENERAL DE SALA (#bar) */}
                    <div className="pt-2 border-t border-white/10">
                      <button
                        type="button"
                        onClick={onIrACartaBar}
                        className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-95 text-slate-950 font-black text-[11px] uppercase tracking-wider shadow-[0_0_20px_rgba(245,158,11,0.25)] flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                      >
                        <UtensilsCrossed className="h-3.5 w-3.5" />
                        <span>Ver Carta Principal (#bar)</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              }

              const esConfirmado = guiso.estado === 'confirmado';

              /* ================= TARJETA COMPACTA DE GUISO ACTIVO (max-w-[360px]) ================= */
              return (
                <div
                  key={guiso.id}
                  className={`w-full max-w-[360px] rounded-2xl border bg-[#0c0d14]/95 overflow-hidden flex flex-col justify-between transition-all shadow-xl group ${
                    esConfirmado
                      ? 'border-emerald-500/50 shadow-[0_0_25px_rgba(16,185,129,0.12)]'
                      : 'border-white/10 hover:border-amber-400/50'
                  }`}
                >
                  <div>
                    {/* CABECERA CON IMAGEN REAL (h-36) O ENCABEZADO ELEGANTE CON ICONO 🍲 SIN FOTO INVENTADA */}
                    {imagenReal ? (
                      <div className="relative h-36 overflow-hidden bg-slate-900">
                        <img
                          src={imagenReal}
                          alt={guiso.nombre_plato}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0c0d14] via-[#0c0d14]/25 to-transparent" />

                        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-1.5">
                          <span className="px-2.5 py-0.5 rounded-full bg-black/80 backdrop-blur-md border border-white/15 text-[10px] font-black text-white capitalize">
                            📅 {formatearFechaHumana(guiso.fecha)}
                          </span>

                          {esConfirmado ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-black shadow flex items-center gap-1">
                              🟢 Confirmado
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black shadow flex items-center gap-1">
                              🟡 Preventa
                            </span>
                          )}
                        </div>

                        <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between text-[10px] text-slate-200">
                          <span className="inline-flex items-center gap-1 bg-black/75 backdrop-blur px-2 py-0.5 rounded-md border border-white/10">
                            <Clock className="h-3 w-3 text-amber-400" />
                            <span>
                              Corte: <strong className="text-amber-300">{formatearFechaCorteHumana(guiso)}</strong>
                            </span>
                          </span>
                        </div>
                      </div>
                    ) : (
                      /* ENCABEZADO LIMPIO Y COMPACTO SIN FOTO INVENTADA */
                      <div className="relative px-4 pt-3.5 pb-3 bg-gradient-to-br from-[#171926] via-[#10131e] to-[#0c0d14] border-b border-white/[0.07]">
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="px-2.5 py-0.5 rounded-full bg-white/[0.06] border border-white/10 text-[10px] font-black text-amber-300 capitalize">
                            📅 {formatearFechaHumana(guiso.fecha)}
                          </span>

                          {esConfirmado ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-black shadow flex items-center gap-1">
                              🟢 Confirmado
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black shadow flex items-center gap-1">
                              🟡 Buscando mínimo
                            </span>
                          )}
                        </div>

                        <div className="mt-2.5 flex items-center justify-between gap-2">
                          <div className="inline-flex items-center gap-1.5 text-[10px] text-slate-300 bg-black/40 px-2.5 py-1 rounded-lg border border-white/10">
                            <Clock className="h-3 w-3 text-amber-400 shrink-0" />
                            <span>
                              Cierre preventa:{' '}
                              <strong className="text-amber-300">{formatearFechaCorteHumana(guiso)}</strong>
                            </span>
                          </div>
                          <div className="h-8 w-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-base shrink-0">
                            🍲
                          </div>
                        </div>
                      </div>
                    )}

                    {/* CONTENIDO COMPACTO DEL PLATO (p-4) */}
                    <div className="p-4 space-y-3">
                      <div>
                        <h3 className="text-base font-black text-white leading-snug line-clamp-1">
                          {guiso.nombre_plato}
                        </h3>
                        {guiso.descripcion && (
                          <p className="text-xs text-slate-400 mt-1 leading-relaxed line-clamp-2">
                            {guiso.descripcion}
                          </p>
                        )}
                      </div>

                      {/* BLOQUES DE PRECIO COMPACTOS Y ESTILIZADOS */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-xl border border-amber-500/25 bg-amber-950/20 px-2.5 py-2 flex flex-col justify-between">
                          <span className="text-[9px] font-black uppercase text-amber-300 tracking-wide">
                            🪑 En el Bar
                          </span>
                          <div className="flex items-baseline justify-between mt-0.5">
                            <span className="text-base font-black text-white">
                              {Number(guiso.precio_barra).toFixed(2)}€
                            </span>
                            <span className="text-[9px] text-slate-400">Sala/Mesa</span>
                          </div>
                        </div>

                        <div className="rounded-xl border border-cyan-500/25 bg-cyan-950/20 px-2.5 py-2 flex flex-col justify-between">
                          <span className="text-[9px] font-black uppercase text-cyan-300 tracking-wide">
                            🛍️ Para llevar
                          </span>
                          <div className="flex items-baseline justify-between mt-0.5">
                            <span className="text-base font-black text-white">
                              {Number(guiso.precio_takeaway).toFixed(2)}€
                            </span>
                            <span className="text-[9px] text-slate-400">Takeaway</span>
                          </div>
                        </div>
                      </div>

                      {/* BARRA DE RACIONES ESTILIZADA Y PEQUEÑA */}
                      <div className="rounded-xl bg-[#131722] border border-white/10 p-2.5 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-black text-white flex items-center gap-1">
                            <Flame
                              className={`h-3.5 w-3.5 ${
                                esConfirmado ? 'text-emerald-400' : 'text-amber-400'
                              }`}
                            />
                            {racionesActuales}/{minRequerido} raciones
                          </span>
                          <span
                            className={`font-black text-[10px] ${
                              esConfirmado ? 'text-emerald-400' : 'text-amber-300'
                            }`}
                          >
                            {esConfirmado
                              ? '¡En fogones!'
                              : `Faltan ${Math.max(0, minRequerido - racionesActuales)}`}
                          </span>
                        </div>

                        <div className="w-full h-2 bg-black/60 rounded-full overflow-hidden border border-white/10">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${
                              esConfirmado
                                ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400'
                                : 'bg-gradient-to-r from-amber-500 to-orange-500'
                            }`}
                            style={{ width: `${Math.max(8, porcentajeProgreso)}%` }}
                          />
                        </div>

                        <p className="text-[10px] text-slate-400 leading-tight">
                          {preventaCerradaPorFecha
                            ? '🔒 Preventa online finalizada. Consulta en barra.'
                            : esConfirmado
                            ? '⚡ Mínimo alcanzado: tu ración queda asegurada.'
                            : '💡 Apúntate gratis (0€). Se confirma al llegar al mínimo.'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* BOTÓN DE RESERVA COMPACTO */}
                  <div className="px-4 pb-4">
                    {preventaCerradaPorFecha ? (
                      <div className="w-full py-2.5 px-3 rounded-xl bg-slate-900 border border-white/10 text-slate-400 font-black text-[11px] uppercase tracking-wider flex items-center justify-center gap-1.5">
                        <Lock className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                        <span className="truncate">Cerrado ({formatearFechaCorteHumana(guiso)})</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => abrirModalReserva(guiso)}
                        className={`w-full py-2.5 px-4 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-md ${
                          esConfirmado
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.25)] hover:opacity-95'
                            : 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.25)] hover:opacity-95'
                        }`}
                      >
                        {esConfirmado ? (
                          <>
                            <Sparkles className="h-3.5 w-3.5" />
                            <span>⚡ Reservar Ración</span>
                          </>
                        ) : (
                          <>
                            <ChefHat className="h-3.5 w-3.5" />
                            <span>🍲 Apuntarme Gratis (0€)</span>
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
          className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto"
          onClick={cerrarModalReserva}
        >
          <div
            className="w-full max-w-lg rounded-3xl border border-amber-500/40 bg-[#0c0d14] p-5 sm:p-7 shadow-2xl space-y-4 my-auto max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* CABECERA DEL MODAL */}
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-white/10">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 block">
                  📅 {formatearFechaHumana(guisoActivoModal.fecha)} · 🛑 Corte:{' '}
                  {formatearFechaCorteHumana(guisoActivoModal)}
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

                {/* 1. MODALIDAD: BARRA vs TAKEAWAY Y CONTROL DE AFORO */}
                <div>
                  <label className="text-xs font-black uppercase text-slate-300 block mb-2">
                    1. ¿Cómo prefieres disfrutarlo?
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      disabled={!disponibilidadMesasModal.hayAlgunaMesaEnLocal}
                      onClick={() => setModalidadReserva('barra')}
                      className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer relative ${
                        modalidadReserva === 'barra'
                          ? 'bg-amber-500/20 border-amber-400 text-white shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                          : !disponibilidadMesasModal.hayAlgunaMesaEnLocal
                          ? 'bg-white/[0.02] border-white/5 text-slate-500 opacity-60 cursor-not-allowed'
                          : 'bg-white/[0.03] border-white/10 text-slate-400 hover:text-white'
                      }`}
                    >
                      <span className="text-sm font-black block">🪑 Comer en el local</span>
                      <span className="text-xs text-amber-400 font-bold mt-1 block">
                        {Number(guisoActivoModal.precio_barra).toFixed(2)} € / ración
                      </span>
                      {!disponibilidadMesasModal.hayAlgunaMesaEnLocal && (
                        <span className="text-[10px] text-rose-400 font-black block mt-1">
                          ⚠️ Aforo completo a las {horaServicio}
                        </span>
                      )}
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
                        <span className="text-sm font-black">🛍️ Pasar a recoger</span>
                      </div>
                      <span className="text-xs text-cyan-400 font-bold mt-1 block">
                        {Number(guisoActivoModal.precio_takeaway).toFixed(2)} € / ración
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-1">
                        Listo a la hora indicada
                      </span>
                    </button>
                  </div>
                </div>

                {/* AVISO AUTOMÁTICO SI TODAS LAS MESAS ESTÁN COMPLETAS */}
                {!disponibilidadMesasModal.hayAlgunaMesaEnLocal && modalidadReserva === 'takeaway' && (
                  <div className="rounded-2xl border border-amber-500/40 bg-amber-950/30 p-3.5 text-xs text-amber-200">
                    <p className="font-bold flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                      <span>
                        Todas nuestras mesas están reservadas para esa franja horaria. Solo está disponible la opción de <strong>Pasar a recoger (Takeaway)</strong> (o elige otra hora con mesas libres).
                      </span>
                    </p>
                  </div>
                )}

                {/* 2. SELECCIÓN DE HORA Y CONFIGURACIÓN DE MESA/ZONA */}
                <div className="bg-[#131722] border border-white/10 rounded-2xl p-3.5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-xs font-black uppercase text-amber-400 block">
                      {modalidadReserva === 'barra' ? '2. Turno y Zona en el Local' : '2. Hora de Recogida'}
                    </label>
                  </div>

                  {/* SELECTOR DE HORA (Tramos de 13:00 a 16:00 o cena) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block mb-1">
                        ⏰ {modalidadReserva === 'barra' ? 'Hora deseada de comida:' : 'Hora para pasar a recoger:'}
                      </span>
                      <select
                        value={horaServicio}
                        onChange={(e) => {
                          const nuevaHora = e.target.value;
                          setHoraServicio(nuevaHora);
                        }}
                        className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3 py-2 text-xs font-bold text-amber-300 outline-none"
                      >
                        {['13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00'].map((h) => (
                          <option key={h} value={h}>
                            {h} h
                          </option>
                        ))}
                      </select>
                    </div>

                    {modalidadReserva === 'barra' && (
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block mb-1">
                          👥 Comensales en mesa:
                        </span>
                        <div className="flex items-center bg-slate-950 border border-slate-700 rounded-xl p-1 justify-between">
                          <button
                            type="button"
                            onClick={() => setComensalesMesa((p) => Math.max(1, p - 1))}
                            className="h-7 w-7 rounded-lg bg-white/5 text-white flex items-center justify-center font-bold"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="text-xs font-black text-white">{comensalesMesa} pers.</span>
                          <button
                            type="button"
                            onClick={() => setComensalesMesa((p) => Math.min(25, p + 1))}
                            className="h-7 w-7 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* SI ELIGE COMER EN EL LOCAL: ELECCIÓN DE ZONA Y MESAS LIBRES EN TIEMPO REAL */}
                  {modalidadReserva === 'barra' && (
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block mb-1.5">
                        📍 Elige Zona Preferida (Disponibilidad en vivo a las {horaServicio}):
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        {/* BOTÓN INTERIOR */}
                        <button
                          type="button"
                          disabled={disponibilidadMesasModal.interiorLibres === 0}
                          onClick={() => setZonaPreferida('interior')}
                          className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                            zonaPreferida === 'interior'
                              ? 'bg-indigo-600/30 border-indigo-400 text-white font-black shadow-md'
                              : disponibilidadMesasModal.interiorLibres === 0
                              ? 'bg-slate-950/40 border-slate-800 text-slate-600 opacity-60 cursor-not-allowed'
                              : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <span className="text-xs font-bold block">🏠 Salón Interior</span>
                          <span
                            className={`text-[10px] block mt-0.5 ${
                              disponibilidadMesasModal.interiorLibres > 0
                                ? 'text-emerald-400'
                                : 'text-rose-400'
                            }`}
                          >
                            {disponibilidadMesasModal.interiorLibres > 0
                              ? `🟢 ${disponibilidadMesasModal.interiorLibres} mesas libres`
                              : '🔴 Zona llena / cerrada'}
                          </span>
                        </button>

                        {/* BOTÓN TERRAZA */}
                        <button
                          type="button"
                          disabled={disponibilidadMesasModal.terrazaLibres === 0}
                          onClick={() => setZonaPreferida('terraza')}
                          className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                            zonaPreferida === 'terraza'
                              ? 'bg-amber-500/30 border-amber-400 text-white font-black shadow-md'
                              : disponibilidadMesasModal.terrazaLibres === 0
                              ? 'bg-slate-950/40 border-slate-800 text-slate-600 opacity-60 cursor-not-allowed'
                              : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <span className="text-xs font-bold block">☀️ Terraza</span>
                          <span
                            className={`text-[10px] block mt-0.5 ${
                              disponibilidadMesasModal.terrazaLibres > 0
                                ? 'text-amber-400'
                                : 'text-rose-400'
                            }`}
                          >
                            {disponibilidadMesasModal.terrazaLibres > 0
                              ? `🟢 ${disponibilidadMesasModal.terrazaLibres} mesas libres`
                              : '🔴 Zona llena / cerrada'}
                          </span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. SELECTOR NUMÉRICO DE RACIONES */}
                <div>
                  <label className="text-xs font-black uppercase text-slate-300 block mb-2">
                    3. Número de raciones
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

                {/* 4. DATOS DEL CLIENTE SIN FRICCIÓN */}
                <div className="space-y-3 pt-1">
                  <label className="text-xs font-black uppercase text-slate-300 block mb-1">
                    4. Tus datos de contacto
                  </label>
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

                    {/* CUENTA ATRÁS DEL PLAZO DE PAGO */}
                    {reservaCompletada.reserva.expira_pago_at && (
                      <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/30 text-center space-y-2">
                        <div className="flex justify-center">
                          <RelojCuentaAtras expiraISO={reservaCompletada.reserva.expira_pago_at} />
                        </div>
                        <p className="text-xs text-amber-200">
                          ⏳ Tienes hasta las{' '}
                          <strong>{reservaCompletada.horaLimiteHumana || 'la hora de corte'}</strong>{' '}
                          para abonar tu reserva (Bizum o Tarjeta). Si no se abona antes de esa hora, la reserva y tu mesa se liberarán automáticamente.
                        </p>
                      </div>
                    )}

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
                    onClick={() => {
                      const res = reservaCompletada.reserva;
                      cerrarModalReserva();
                      setReservaSeleccionada(res);
                      setMostrarModalGestion(true);
                    }}
                    className="w-full py-2.5 rounded-xl bg-cyan-950/60 hover:bg-cyan-900/70 border border-cyan-500/40 text-xs font-bold text-cyan-300 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>🔍</span>
                    <span>Acceder a la autogestión de mi reserva</span>
                  </button>

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

      {/* ================= MODAL / PORTAL DE AUTOGESTIÓN DE RESERVAS PARA EL CLIENTE ================= */}
      {mostrarModalGestion && (
        <div
          className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto"
          onClick={() => setMostrarModalGestion(false)}
        >
          <div
            className="w-full max-w-xl rounded-3xl border border-cyan-500/40 bg-[#0c0d14] p-5 sm:p-7 shadow-2xl space-y-4 my-auto max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* CABECERA DEL MODAL */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300 font-bold text-base shrink-0">
                  🔍
                </div>
                <div>
                  <h3 className="text-lg font-black text-white leading-tight">
                    Gestión de mi Reserva
                  </h3>
                  <p className="text-xs text-slate-400">
                    Consulta el estado de tu plato, cambia de guiso o cancela tu reserva.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMostrarModalGestion(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-xl bg-white/5 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* AVISOS DE MENSAJE OK O ERROR */}
            {mensajeGestionOk && (
              <div className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-500/50 text-xs text-emerald-200 leading-relaxed font-bold animate-in fade-in-50">
                {mensajeGestionOk}
              </div>
            )}
            {mensajeGestionError && (
              <div className="p-3.5 rounded-2xl bg-rose-950/60 border border-rose-500/50 text-xs text-rose-200 leading-relaxed font-bold animate-in fade-in-50">
                ⚠️ {mensajeGestionError}
              </div>
            )}

            {/* CASO A: SI NO HAY RESERVA SELECCIONADA -> FORMULARIO DE BÚSQUEDA POR TELÉFONO */}
            {!reservaSeleccionada ? (
              <div className="space-y-4">
                <form onSubmit={handleBuscarReservasPorTelefono} className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1.5">
                      Introduce tu número de teléfono / WhatsApp para localizar tu reserva:
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Phone className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                        <input
                          type="tel"
                          required
                          value={telBusqueda}
                          onChange={(e) => setTelBusqueda(e.target.value)}
                          placeholder="Ej: 600 123 456"
                          className="w-full bg-[#131722] border border-white/15 focus:border-cyan-400 rounded-xl pl-10 pr-3.5 py-2.5 text-xs font-bold text-white outline-none"
                        />
                      </div>
                      <button
                        type="submit"
                        className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs cursor-pointer shadow-md whitespace-nowrap"
                      >
                        Buscar
                      </button>
                    </div>
                  </div>
                </form>

                {/* RESULTADOS DE BÚSQUEDA */}
                {busquedaRealizada && (
                  <div className="space-y-2 pt-2 border-t border-white/10">
                    <h4 className="text-xs font-bold uppercase text-slate-400">
                      Reservas encontradas ({reservasEncontradasPorTelefono.length})
                    </h4>

                    {reservasEncontradasPorTelefono.length === 0 ? (
                      <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-center space-y-1">
                        <p className="text-xs font-bold text-slate-300">
                          No encontramos reservas con el número indicado.
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Revisa que hayas escrito el mismo teléfono con el que te apuntaste al guiso.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {reservasEncontradasPorTelefono.map((res) => {
                          const guisoObj = guisos.find((g) => g.id === res.guiso_id);
                          return (
                            <div
                              key={res.id}
                              className="p-3 rounded-2xl border border-white/10 bg-[#131722] hover:border-cyan-500/50 flex items-center justify-between gap-3 transition-colors"
                            >
                              <div className="min-w-0">
                                <h5 className="text-xs font-black text-white truncate">
                                  {guisoObj?.nombre_plato || 'Guiso'}
                                </h5>
                                <p className="text-[11px] text-slate-400 mt-0.5">
                                  📅 {guisoObj ? formatearFechaHumana(guisoObj.fecha) : ''} ·{' '}
                                  {res.raciones} {res.raciones === 1 ? 'ración' : 'raciones'} ·{' '}
                                  {res.modalidad === 'takeaway' ? '🛍️ Llevar' : '🏠 Sala'}
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={() => setReservaSeleccionada(res)}
                                className="px-3 py-1.5 rounded-xl bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-300 font-bold text-xs whitespace-nowrap cursor-pointer"
                              >
                                Ver y Gestionar →
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* CASO B: DETALLE Y ACCIONES DE LA RESERVA SELECCIONADA */
              (() => {
                const guisoActual = guisos.find((g) => g.id === reservaSeleccionada.guiso_id);
                const precioTotal = guisoActual
                  ? calcularImporteReserva(
                      guisoActual,
                      reservaSeleccionada.raciones,
                      reservaSeleccionada.modalidad
                    )
                  : 0;

                const waUrl = guisoActual
                  ? generarEnlaceWhatsAppClienteABar(
                      reservaSeleccionada,
                      guisoActual,
                      guisoActual.estado === 'confirmado'
                    )
                  : `https://wa.me/${configPago?.telefonoWhatsAppBar || '34624454242'}`;

                const esCancelada = reservaSeleccionada.estado_pago === 'cancelado';
                const esExpirada = reservaSeleccionada.estado_pago === 'expirado';
                const esPagada = reservaSeleccionada.estado_pago === 'pagado';
                const esPendiente = reservaSeleccionada.estado_pago === 'pendiente';

                const otrosGuisosDisponibles = guisos.filter(
                  (g) =>
                    g.id !== reservaSeleccionada.guiso_id &&
                    g.estado !== 'cancelado' &&
                    !haSuperadoFechaHoraCorte(g)
                );

                return (
                  <div className="space-y-4">
                    {/* BOTÓN VOLVER A LA BÚSQUEDA */}
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => {
                          setReservaSeleccionada(null);
                          setModoCambiarGuiso(false);
                          setConfirmandoCancelacion(false);
                        }}
                        className="text-xs text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                      >
                        <span>◀</span>
                        <span>Buscar otra reserva</span>
                      </button>

                      <span className="text-[10px] font-mono text-slate-500">
                        ID: {reservaSeleccionada.id.slice(0, 8)}...
                      </span>
                    </div>

                    {/* TARJETA DE RESUMEN DE LA RESERVA */}
                    <div className="p-4 rounded-2xl border border-white/10 bg-[#131722] space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
                        <div>
                          <span className="text-[10px] font-black uppercase text-amber-400 block">
                            📅 {guisoActual ? formatearFechaHumana(guisoActual.fecha) : ''}
                          </span>
                          <h4 className="text-base font-black text-white">
                            {guisoActual?.nombre_plato || 'Guiso'}
                          </h4>
                        </div>

                        <div className="text-right">
                          <span className="text-sm font-black text-emerald-400 font-mono">
                            {precioTotal.toFixed(2)} €
                          </span>
                          <span className="text-[10px] text-slate-400 block">
                            {reservaSeleccionada.raciones}{' '}
                            {reservaSeleccionada.raciones === 1 ? 'ración' : 'raciones'} ·{' '}
                            {reservaSeleccionada.modalidad === 'takeaway' ? '🛍️ Llevar' : '🏠 Sala'}
                          </span>
                        </div>
                      </div>

                      {/* ESTADO DEL PLATO Y ESTADO DE PAGO */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 space-y-0.5">
                          <span className="text-[10px] uppercase text-slate-400 block">Estado del Plato</span>
                          <p className="font-bold text-white">
                            {guisoActual?.estado === 'confirmado'
                              ? '🟢 Confirmado en fogones'
                              : guisoActual?.estado === 'cancelado'
                              ? '🚫 Cancelado (Plan B activo)'
                              : '🟡 Preventa (Buscando mínimo)'}
                          </p>
                        </div>

                        <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 space-y-0.5">
                          <span className="text-[10px] uppercase text-slate-400 block">Estado de tu Reserva</span>
                          <p className="font-bold">
                            {esPagada ? (
                              <span className="text-emerald-300">✅ Pagada y 100% asegurada</span>
                            ) : esCancelada ? (
                              <span className="text-rose-400">❌ Cancelada</span>
                            ) : esExpirada ? (
                              <span className="text-rose-400">⌛ Plazo expirado</span>
                            ) : (
                              <span className="text-amber-300">⏳ Pendiente de abono</span>
                            )}
                          </p>
                        </div>
                      </div>

                      {/* BLOQUE INFORMATIVO DE PAGO CON CUENTA ATRÁS SI ESTÁ CONFIRMADO Y PENDIENTE */}
                      {esPendiente && guisoActual?.estado === 'confirmado' && (
                        <div className="p-3.5 rounded-xl border border-amber-500/40 bg-amber-950/25 space-y-2 text-center">
                          <div className="flex justify-center">
                            <RelojCuentaAtras expiraISO={reservaSeleccionada.expira_pago_at} />
                          </div>

                          <p className="text-xs text-amber-200/90 leading-relaxed">
                            ⏳ <strong>Importante:</strong> Tienes hasta las{' '}
                            <strong>
                              {formatearHoraLimiteHumana(reservaSeleccionada.expira_pago_at) || 'la hora de corte'}
                            </strong>{' '}
                            para abonar tu reserva (Bizum o Tarjeta). Si no se abona antes de esa hora, la reserva y tu mesa se liberarán automáticamente.
                          </p>

                          <div className="p-2.5 rounded-lg bg-black/50 border border-amber-500/30 text-xs text-slate-200 text-left space-y-1">
                            <p>
                              💳 <strong>Bizum:</strong>{' '}
                              <span className="text-amber-300 font-mono font-bold">
                                {configPago?.numeroBizum || '624 45 42 42'}
                              </span>
                            </p>
                            <p className="text-[11px] text-slate-400">
                              Concepto: GUISO {String(reservaSeleccionada.nombre_cliente).toUpperCase()}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs inline-flex items-center gap-1.5 shadow-md cursor-pointer"
                            >
                              <span>📲</span>
                              <span>Enviar Justificante WhatsApp</span>
                            </a>

                            {configPago?.enlacePago && (
                              <a
                                href={configPago.enlacePago}
                                target="_blank"
                                rel="noreferrer"
                                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold text-xs inline-flex items-center gap-1.5 border border-slate-700 cursor-pointer"
                              >
                                <span>💳</span>
                                <span>Pagar Online</span>
                              </a>
                            )}
                          </div>
                        </div>
                      )}

                      {/* MENSAJE SI YA ESTÁ PAGADA */}
                      {esPagada && (
                        <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/40 text-center">
                          <p className="text-xs text-emerald-300 font-bold">
                            🎉 ¡Tu plaza y tu mesa están completamente confirmadas! Te esperamos en Café Bar Nexus.
                          </p>
                        </div>
                      )}

                      {/* MENSAJE SI ESTÁ EN PREVENTA (BUSCANDO MÍNIMO) */}
                      {esPendiente && guisoActual?.estado === 'buscando_minimo' && (
                        <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-500/40 text-center">
                          <p className="text-xs text-cyan-200">
                            🟡 Tu reserva está guardada en preventa. No tienes que pagar nada hasta que alcancemos el mínimo de raciones.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* SECCIÓN DE ACCIONES: CAMBIAR POR OTRO GUISO O CANCELAR */}
                    {!esCancelada && !esExpirada && (
                      <div className="space-y-3 pt-2">
                        {/* BOTONES DE ACCIÓN PRINCIPAL */}
                        {!modoCambiarGuiso && !confirmandoCancelacion && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <button
                              type="button"
                              onClick={() => setModoCambiarGuiso(true)}
                              className="py-3 px-4 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-200 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
                            >
                              <span>🔄</span>
                              <span>Cambiar por otro guiso</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setConfirmandoCancelacion(true)}
                              className="py-3 px-4 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
                            >
                              <span>❌</span>
                              <span>Cancelar mi reserva</span>
                            </button>
                          </div>
                        )}

                        {/* SUB-PANEL: 🔄 CAMBIAR POR OTRO GUISO */}
                        {modoCambiarGuiso && (
                          <div className="p-4 rounded-2xl border border-indigo-500/40 bg-indigo-950/20 space-y-3 animate-in fade-in-50">
                            <div className="flex items-center justify-between border-b border-indigo-500/30 pb-2">
                              <h4 className="text-xs font-black text-indigo-300 uppercase">
                                🔄 Selecciona el nuevo guiso al que deseas cambiar:
                              </h4>
                              <button
                                type="button"
                                onClick={() => setModoCambiarGuiso(false)}
                                className="text-xs text-slate-400 hover:text-white cursor-pointer"
                              >
                                Cancelar
                              </button>
                            </div>

                            {otrosGuisosDisponibles.length === 0 ? (
                              <p className="text-xs text-slate-400 py-2 text-center">
                                No hay otros guisos disponibles para cambiar en este momento.
                              </p>
                            ) : (
                              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                                {otrosGuisosDisponibles.map((og) => (
                                  <div
                                    key={og.id}
                                    className="p-3 rounded-xl border border-white/10 bg-[#0c0d14] hover:border-indigo-400 flex items-center justify-between gap-3 transition-colors"
                                  >
                                    <div className="min-w-0">
                                      <span className="text-[10px] text-amber-400 font-bold block">
                                        📅 {formatearFechaHumana(og.fecha)}
                                      </span>
                                      <h5 className="text-xs font-bold text-white truncate">
                                        {og.nombre_plato}
                                      </h5>
                                      <span className="text-[10px] text-slate-400">
                                        {og.estado === 'confirmado' ? '🟢 Confirmado' : '🟡 Preventa'} ·{' '}
                                        {reservaSeleccionada.modalidad === 'takeaway'
                                          ? `${Number(og.precio_takeaway).toFixed(2)}€ llevar`
                                          : `${Number(og.precio_barra).toFixed(2)}€ sala`}
                                      </span>
                                    </div>

                                    <button
                                      type="button"
                                      disabled={procesandoGestion}
                                      onClick={() => handleCambiarGuiso(og)}
                                      className="px-3 py-1.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-slate-950 font-black text-xs cursor-pointer disabled:opacity-50 whitespace-nowrap shadow-sm"
                                    >
                                      {procesandoGestion ? 'Cambiando...' : 'Elegir este plato'}
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* SUB-PANEL: ❌ CONFIRMACIÓN DE CANCELACIÓN */}
                        {confirmandoCancelacion && (
                          <div className="p-4 rounded-2xl border border-rose-500/50 bg-rose-950/30 space-y-3 text-center animate-in fade-in-50">
                            <AlertTriangle className="h-8 w-8 text-rose-400 mx-auto" />
                            <h4 className="text-sm font-black text-white">
                              ¿Confirmas que deseas cancelar tu reserva?
                            </h4>
                            <p className="text-xs text-rose-200/90 leading-relaxed max-w-md mx-auto">
                              Al cancelar, se liberarán inmediatamente tus{' '}
                              <strong>{reservaSeleccionada.raciones} raciones</strong> y la mesa reservada en el local, permitiendo que otros clientes puedan ocuparla.
                            </p>

                            <div className="flex items-center justify-center gap-2.5 pt-1">
                              <button
                                type="button"
                                disabled={procesandoGestion}
                                onClick={() => setConfirmandoCancelacion(false)}
                                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
                              >
                                No, mantener mi reserva
                              </button>

                              <button
                                type="button"
                                disabled={procesandoGestion}
                                onClick={handleCancelarReserva}
                                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs cursor-pointer shadow-lg disabled:opacity-50"
                              >
                                {procesandoGestion ? 'Cancelando...' : 'Sí, confirmar cancelación'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()
            )}
          </div>
        </div>
      )}
    </main>
  );
}
