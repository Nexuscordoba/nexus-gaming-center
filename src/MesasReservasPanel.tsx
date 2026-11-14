// src/MesasReservasPanel.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabase';
import {
  Sun,
  Home,
  Plus,
  Minus,
  Trash2,
  Edit2,
  RefreshCw,
  X
} from 'lucide-react';
import {
  type MesaLocal,
  type ReservaMesa
} from './notificacionesGuisos';

interface MesasReservasPanelProps {
  notificar: (texto: string, tipo?: 'ok' | 'error' | 'info') => void;
  onVolver?: () => void;
}

const TRAMOS_HORARIOS = [
  '13:00',
  '13:30',
  '14:00',
  '14:30',
  '15:00',
  '15:30',
  '16:00',
  '20:30',
  '21:00',
  '21:30',
  '22:00',
  '22:30',
  '23:00'
];

export default function MesasReservasPanel({ notificar, onVolver }: MesasReservasPanelProps) {
  const [mesas, setMesas] = useState<MesaLocal[]>([]);
  const [reservas, setReservas] = useState<ReservaMesa[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtro de día y hora para el mapa de ocupación
  const hoyISO = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [fechaFiltro, setFechaFiltro] = useState<string>(hoyISO);
  const [horaFiltro, setHoraFiltro] = useState<string>('14:00');
  const [zonaFiltro, setZonaFiltro] = useState<'todas' | 'interior' | 'terraza'>('todas');
  const [busquedaCliente, setBusquedaCliente] = useState<string>('');

  // Formulario rápido de 10s para el camarero
  const [camareroFecha, setCamareroFecha] = useState<string>(hoyISO);
  const [camareroHora, setCamareroHora] = useState<string>('14:00');
  const [camareroZona, setCamareroZona] = useState<'interior' | 'terraza'>('interior');
  const [camareroMesaId, setCamareroMesaId] = useState<string>('');
  const [camareroComensales, setCamareroComensales] = useState<number>(2);
  const [camareroNombre, setCamareroNombre] = useState<string>('');
  const [camareroTelefono, setCamareroTelefono] = useState<string>('');
  const [camareroObs, setCamareroObs] = useState<string>('');
  const [guardandoReserva, setGuardandoReserva] = useState<boolean>(false);

  // Modal para editar mesa individual
  const [mesaAEditar, setMesaAEditar] = useState<MesaLocal | null>(null);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      const [resMesas, resReservas] = await Promise.all([
        supabase.from('mesas_local').select('*').order('numero', { ascending: true }),
        supabase.from('reservas_mesas').select('*').order('hora_servicio', { ascending: true })
      ]);

      if (resMesas.error) {
        console.error('Error cargando mesas_local:', resMesas.error);
      } else if (resMesas.data) {
        setMesas(resMesas.data as MesaLocal[]);
      }

      if (resReservas.error) {
        console.error('Error cargando reservas_mesas:', resReservas.error);
      } else if (resReservas.data) {
        setReservas(resReservas.data as ReservaMesa[]);
      }
    } catch (err: any) {
      console.error('Excepción cargando mesas y reservas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();

    const channel = supabase
      .channel('realtime-mesas-reservas-panel')
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

  // Mesas separadas por zona
  const mesasInterior = useMemo(
    () => mesas.filter((m) => m.zona === 'interior').sort((a, b) => a.numero - b.numero),
    [mesas]
  );
  const mesasTerraza = useMemo(
    () => mesas.filter((m) => m.zona === 'terraza').sort((a, b) => a.numero - b.numero),
    [mesas]
  );

  // Interruptores globales de zona
  const interiorAbierto = useMemo(() => mesasInterior.some((m) => m.activa), [mesasInterior]);
  const terrazaAbierta = useMemo(() => mesasTerraza.some((m) => m.activa), [mesasTerraza]);

  const toggleZonaGlobal = async (zona: 'interior' | 'terraza', nuevoEstado: boolean) => {
    try {
      const { error } = await supabase
        .from('mesas_local')
        .update({ activa: nuevoEstado })
        .eq('zona', zona);

      if (error) throw error;
      notificar(
        `${zona === 'interior' ? '🏠 Interior' : '☀️ Terraza'} ${
          nuevoEstado ? 'abierto' : 'cerrado'
        } correctamente.`,
        'ok'
      );
      await cargarDatos();
    } catch (err: any) {
      notificar('Error al cambiar estado de zona: ' + err.message, 'error');
    }
  };

  // Ajuste rápido de número total de mesas por zona (+ / -)
  const ajustarCantidadMesasZona = async (zona: 'interior' | 'terraza', incremento: number) => {
    const mesasDeZona = zona === 'interior' ? mesasInterior : mesasTerraza;
    const totalActual = mesasDeZona.length;
    const nuevoTotal = totalActual + incremento;

    if (nuevoTotal < 0) return;

    try {
      if (incremento > 0) {
        // Añadir una nueva mesa con el siguiente número disponible
        const maxNum = mesasDeZona.reduce((acc, m) => Math.max(acc, m.numero), 0);
        const nuevoNumero = maxNum + 1;
        const { error } = await supabase.from('mesas_local').insert([
          {
            numero: nuevoNumero,
            zona,
            capacidad: 4,
            activa: true,
            orden: nuevoNumero
          }
        ]);
        if (error) throw error;
        notificar(`Mesa ${nuevoNumero} añadida a ${zona === 'interior' ? 'Interior' : 'Terraza'}.`, 'ok');
      } else if (incremento < 0 && totalActual > 0) {
        // Eliminar la mesa con número más alto
        const ultimaMesa = mesasDeZona[mesasDeZona.length - 1];
        const { error } = await supabase.from('mesas_local').delete().eq('id', ultimaMesa.id);
        if (error) throw error;
        notificar(
          `Mesa ${ultimaMesa.numero} eliminada de ${zona === 'interior' ? 'Interior' : 'Terraza'}.`,
          'info'
        );
      }
      await cargarDatos();
    } catch (err: any) {
      notificar('Error ajustando mesas: ' + err.message, 'error');
    }
  };

  // Mapa de reservas confirmadas en la fecha y hora seleccionadas
  const reservasEnTramo = useMemo(() => {
    return reservas.filter(
      (r) => r.fecha === fechaFiltro && r.hora_servicio === horaFiltro && r.estado === 'confirmada'
    );
  }, [reservas, fechaFiltro, horaFiltro]);

  const mapaOcupacionPorMesaId = useMemo(() => {
    const map = new Map<string, ReservaMesa>();
    reservasEnTramo.forEach((r) => {
      if (r.mesa_id) {
        map.set(r.mesa_id, r);
      }
    });
    return map;
  }, [reservasEnTramo]);

  // Lista de mesas libres para el formulario de camarero
  const mesasLibresParaCamarero = useMemo(() => {
    const reservasDelMomento = reservas.filter(
      (r) => r.fecha === camareroFecha && r.hora_servicio === camareroHora && r.estado === 'confirmada'
    );
    const idsOcupados = new Set(reservasDelMomento.map((r) => r.mesa_id).filter(Boolean));

    return mesas.filter(
      (m) => m.activa && m.zona === camareroZona && !idsOcupados.has(m.id)
    );
  }, [mesas, reservas, camareroFecha, camareroHora, camareroZona]);

  // Guardar nueva reserva rápida de camarero
  const handleCrearReservaCamarero = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!camareroNombre.trim() || !camareroTelefono.trim() || guardandoReserva) return;

    setGuardandoReserva(true);
    try {
      // Si eligió una mesa concreta o asignamos la primera disponible
      let mesaAsignadaId: string | null = camareroMesaId || null;
      if (!mesaAsignadaId && mesasLibresParaCamarero.length > 0) {
        mesaAsignadaId = mesasLibresParaCamarero[0].id;
      }

      const payload = {
        fecha: camareroFecha,
        hora_servicio: camareroHora,
        zona_preferida: camareroZona,
        mesa_id: mesaAsignadaId,
        comensales: camareroComensales,
        nombre_cliente: camareroNombre.trim(),
        telefono: camareroTelefono.trim(),
        estado: 'confirmada' as const,
        observaciones: camareroObs.trim()
      };

      const { error } = await supabase.from('reservas_mesas').insert([payload]);
      if (error) throw error;

      const mesaObj = mesas.find((m) => m.id === mesaAsignadaId);
      const mesaNombre = mesaObj
        ? `${mesaObj.zona === 'interior' ? '🏠 Mesa ' : '☀️ Terraza '}${mesaObj.numero}`
        : 'Sin mesa fija asignada';

      notificar(
        `✅ Reserva confirmada para ${payload.nombre_cliente} (${payload.comensales} pers) en ${mesaNombre} a las ${payload.hora_servicio}.`,
        'ok'
      );

      // Limpiar formulario camarero
      setCamareroNombre('');
      setCamareroTelefono('');
      setCamareroObs('');
      setCamareroMesaId('');
      await cargarDatos();
    } catch (err: any) {
      notificar('Error creando reserva: ' + err.message, 'error');
    } finally {
      setGuardandoReserva(false);
    }
  };

  // Cancelar / finalizar reserva
  const cambiarEstadoReserva = async (reservaId: string, nuevoEstado: 'confirmada' | 'cancelada' | 'finalizada') => {
    try {
      const { error } = await supabase
        .from('reservas_mesas')
        .update({ estado: nuevoEstado })
        .eq('id', reservaId);
      if (error) throw error;
      notificar(`Reserva marcada como ${nuevoEstado}.`, 'info');
      await cargarDatos();
    } catch (err: any) {
      notificar('Error al actualizar reserva: ' + err.message, 'error');
    }
  };

  // Guardar cambios en mesa editada individualmente
  const handleGuardarMesaEditada = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mesaAEditar) return;

    try {
      const { error } = await supabase
        .from('mesas_local')
        .update({
          numero: mesaAEditar.numero,
          zona: mesaAEditar.zona,
          capacidad: Math.max(1, mesaAEditar.capacidad),
          activa: mesaAEditar.activa
        })
        .eq('id', mesaAEditar.id);

      if (error) throw error;
      notificar(`Mesa ${mesaAEditar.numero} actualizada correctamente.`, 'ok');
      setMesaAEditar(null);
      await cargarDatos();
    } catch (err: any) {
      notificar('Error al actualizar mesa: ' + err.message, 'error');
    }
  };

  // Eliminar mesa individual
  const handleEliminarMesa = async (mesa: MesaLocal) => {
    const ok = window.confirm(
      `¿Eliminar definitivamente la Mesa ${mesa.numero} (${mesa.zona === 'interior' ? 'Interior' : 'Terraza'})?`
    );
    if (!ok) return;

    try {
      const { error } = await supabase.from('mesas_local').delete().eq('id', mesa.id);
      if (error) throw error;
      notificar(`Mesa ${mesa.numero} eliminada.`, 'info');
      await cargarDatos();
    } catch (err: any) {
      notificar('Error al eliminar mesa: ' + err.message, 'error');
    }
  };

  // Listado filtrado de reservas
  const reservasFiltradas = useMemo(() => {
    return reservas.filter((r) => {
      if (fechaFiltro && r.fecha !== fechaFiltro) return false;
      if (zonaFiltro !== 'todas' && r.zona_preferida !== zonaFiltro) return false;
      if (busquedaCliente.trim()) {
        const query = busquedaCliente.toLowerCase();
        const coincide =
          r.nombre_cliente.toLowerCase().includes(query) ||
          r.telefono.includes(query) ||
          (r.observaciones && r.observaciones.toLowerCase().includes(query));
        if (!coincide) return false;
      }
      return true;
    });
  }, [reservas, fechaFiltro, zonaFiltro, busquedaCliente]);

  return (
    <div className="space-y-6">
      {/* CABECERA */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#0f172a] border border-slate-800 rounded-3xl p-5 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center font-black text-xl">
            🪑
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
              <span>Mesas, Zonas y Reservas de Sala</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Control flexible de aforo en Interior y Terraza, reservas de camarero y disponibilidad en tiempo real.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onVolver && (
            <button
              type="button"
              onClick={onVolver}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
            >
              Volver
            </button>
          )}
          <button
            type="button"
            onClick={cargarDatos}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-lg transition-all cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* ================= BLOQUE 1: CONFIGURADOR RÁPIDO DE MESAS (INTERIOR Y TERRAZA) ================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* ZONA 1: 🏠 INTERIOR */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-3xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <Home className="h-5 w-5 text-indigo-400" />
              <div>
                <h3 className="text-base font-black text-white">🏠 Salón Interior</h3>
                <p className="text-[11px] text-slate-400">
                  {mesasInterior.filter((m) => m.activa).length} de {mesasInterior.length} mesas activas
                </p>
              </div>
            </div>

            {/* INTERRUPTOR GLOBAL INTERIOR */}
            <button
              type="button"
              onClick={() => toggleZonaGlobal('interior', !interiorAbierto)}
              className={`px-3 py-1.5 rounded-xl font-black text-xs transition-all cursor-pointer border ${
                interiorAbierto
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/30'
                  : 'bg-rose-500/20 border-rose-500/50 text-rose-300 hover:bg-rose-500/30'
              }`}
            >
              {interiorAbierto ? '🟢 Interior Abierto' : '🔴 Interior Cerrado'}
            </button>
          </div>

          {/* CONTADOR RÁPIDO (+ / -) */}
          <div className="flex items-center justify-between bg-slate-950/80 border border-slate-800/80 rounded-2xl p-3">
            <span className="text-xs font-bold text-slate-300">Nº Total de Mesas Interior:</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => ajustarCantidadMesasZona('interior', -1)}
                className="h-8 w-8 rounded-lg bg-slate-900 hover:bg-rose-950/50 border border-slate-800 text-slate-300 hover:text-rose-300 flex items-center justify-center font-bold cursor-pointer transition-all"
                title="Quitar última mesa de interior"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-10 text-center font-black text-base text-white">
                {mesasInterior.length}
              </span>
              <button
                type="button"
                onClick={() => ajustarCantidadMesasZona('interior', 1)}
                className="h-8 w-8 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center font-bold cursor-pointer transition-all shadow-md"
                title="Añadir mesa a interior"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* LISTA COMPACTA DE MESAS INTERIOR */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {mesasInterior.map((mesa) => (
              <div
                key={mesa.id}
                className={`p-2.5 rounded-xl border text-center transition-all relative group ${
                  mesa.activa
                    ? 'bg-slate-950 border-slate-800 text-white'
                    : 'bg-slate-950/40 border-slate-800/40 text-slate-500 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                  <span>Mesa {mesa.numero}</span>
                  <span className="font-mono text-indigo-400 font-bold">{mesa.capacidad}p</span>
                </div>
                <div className="text-xs font-black text-white">
                  {mesa.activa ? '🟢 Activa' : '⚪ Inactiva'}
                </div>
                <div className="flex items-center justify-center gap-1 mt-2 pt-1 border-t border-slate-900">
                  <button
                    type="button"
                    onClick={() => setMesaAEditar(mesa)}
                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    title="Editar capacidad / estado"
                  >
                    <Edit2 className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEliminarMesa(mesa)}
                    className="p-1 rounded hover:bg-rose-950 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                    title="Eliminar mesa"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ZONA 2: ☀️ TERRAZA */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-3xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <Sun className="h-5 w-5 text-amber-400" />
              <div>
                <h3 className="text-base font-black text-white">☀️ Terraza Exterior</h3>
                <p className="text-[11px] text-slate-400">
                  {mesasTerraza.filter((m) => m.activa).length} de {mesasTerraza.length} mesas activas
                </p>
              </div>
            </div>

            {/* INTERRUPTOR GLOBAL TERRAZA */}
            <button
              type="button"
              onClick={() => toggleZonaGlobal('terraza', !terrazaAbierta)}
              className={`px-3 py-1.5 rounded-xl font-black text-xs transition-all cursor-pointer border ${
                terrazaAbierta
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 hover:bg-amber-500/30'
                  : 'bg-rose-500/20 border-rose-500/50 text-rose-300 hover:bg-rose-500/30'
              }`}
            >
              {terrazaAbierta ? '☀️ Terraza Abierta' : '🌧️ Terraza Cerrada'}
            </button>
          </div>

          {/* CONTADOR RÁPIDO (+ / -) */}
          <div className="flex items-center justify-between bg-slate-950/80 border border-slate-800/80 rounded-2xl p-3">
            <span className="text-xs font-bold text-slate-300">Nº Total de Mesas Terraza:</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => ajustarCantidadMesasZona('terraza', -1)}
                className="h-8 w-8 rounded-lg bg-slate-900 hover:bg-rose-950/50 border border-slate-800 text-slate-300 hover:text-rose-300 flex items-center justify-center font-bold cursor-pointer transition-all"
                title="Quitar última mesa de terraza"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-10 text-center font-black text-base text-white">
                {mesasTerraza.length}
              </span>
              <button
                type="button"
                onClick={() => ajustarCantidadMesasZona('terraza', 1)}
                className="h-8 w-8 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center font-bold cursor-pointer transition-all shadow-md"
                title="Añadir mesa a terraza"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* LISTA COMPACTA DE MESAS TERRAZA */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {mesasTerraza.map((mesa) => (
              <div
                key={mesa.id}
                className={`p-2.5 rounded-xl border text-center transition-all relative group ${
                  mesa.activa
                    ? 'bg-slate-950 border-slate-800 text-white'
                    : 'bg-slate-950/40 border-slate-800/40 text-slate-500 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                  <span>Mesa {mesa.numero}</span>
                  <span className="font-mono text-amber-400 font-bold">{mesa.capacidad}p</span>
                </div>
                <div className="text-xs font-black text-white">
                  {mesa.activa ? '🟢 Activa' : '⚪ Inactiva'}
                </div>
                <div className="flex items-center justify-center gap-1 mt-2 pt-1 border-t border-slate-900">
                  <button
                    type="button"
                    onClick={() => setMesaAEditar(mesa)}
                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    title="Editar capacidad / estado"
                  >
                    <Edit2 className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEliminarMesa(mesa)}
                    className="p-1 rounded hover:bg-rose-950 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                    title="Eliminar mesa"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ================= BLOQUE 2: FORMULARIO RÁPIDO DE 10s PARA EL CAMARERO Y MAPA VISUAL ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* COLUMNA IZQUIERDA: FORMULARIO CAMARERO (5 cols) */}
        <div className="lg:col-span-5 bg-[#0f172a] border border-slate-800 rounded-3xl p-5 space-y-4">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <span>⚡ Nueva Reserva Camarero (10 segundos)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Apunta reservas telefónicas o presenciales en sala al instante.
            </p>
          </div>

          <form onSubmit={handleCrearReservaCamarero} className="space-y-3.5">
            {/* FECHA Y HORA */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                  📅 Día
                </label>
                <input
                  type="date"
                  required
                  value={camareroFecha}
                  onChange={(e) => setCamareroFecha(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                  ⏰ Hora de Turno
                </label>
                <select
                  value={camareroHora}
                  onChange={(e) => setCamareroHora(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-amber-300 outline-none focus:border-amber-400"
                >
                  {TRAMOS_HORARIOS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* ZONA PREFERIDA Y COMENSALES */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                  📍 Zona
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setCamareroZona('interior');
                      setCamareroMesaId('');
                    }}
                    className={`py-2 px-1 rounded-xl text-center text-xs font-bold transition-all border cursor-pointer ${
                      camareroZona === 'interior'
                        ? 'bg-indigo-600/30 border-indigo-500 text-white font-black'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    🏠 Interior
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCamareroZona('terraza');
                      setCamareroMesaId('');
                    }}
                    className={`py-2 px-1 rounded-xl text-center text-xs font-bold transition-all border cursor-pointer ${
                      camareroZona === 'terraza'
                        ? 'bg-amber-500/30 border-amber-500 text-amber-300 font-black'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    ☀️ Terraza
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                  👥 Nº Personas
                </label>
                <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 justify-between">
                  <button
                    type="button"
                    onClick={() => setCamareroComensales((prev) => Math.max(1, prev - 1))}
                    className="h-8 w-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="font-black text-sm text-white">{camareroComensales}</span>
                  <button
                    type="button"
                    onClick={() => setCamareroComensales((prev) => Math.min(25, prev + 1))}
                    className="h-8 w-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* MESA ESPECÍFICA (OPCIONAL) */}
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                🪑 Mesa Asignada ({mesasLibresParaCamarero.length} libres a las {camareroHora})
              </label>
              <select
                value={camareroMesaId}
                onChange={(e) => setCamareroMesaId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-amber-400"
              >
                <option value="">-- Asignar automáticamente primera mesa libre --</option>
                {mesasLibresParaCamarero.map((m) => (
                  <option key={m.id} value={m.id}>
                    Mesa {m.numero} ({m.zona === 'interior' ? '🏠 Interior' : '☀️ Terraza'} ·{' '}
                    {m.capacidad} plazas)
                  </option>
                ))}
              </select>
            </div>

            {/* DATOS DEL CLIENTE */}
            <div className="space-y-2">
              <div>
                <label className="text-[10px] font-bold text-slate-300 block mb-1">
                  Nombre del Cliente *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Laura Gómez"
                  value={camareroNombre}
                  onChange={(e) => setCamareroNombre(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-300 block mb-1">
                  Teléfono / WhatsApp *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="Ej: 600 123 456"
                  value={camareroTelefono}
                  onChange={(e) => setCamareroTelefono(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">
                  Observaciones (Cumpleaños, carrito, intolerancia...)
                </label>
                <input
                  type="text"
                  placeholder="Opcional..."
                  value={camareroObs}
                  onChange={(e) => setCamareroObs(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-slate-600"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={guardandoReserva}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg hover:opacity-95 disabled:opacity-50 transition-all cursor-pointer mt-2"
            >
              {guardandoReserva ? 'Confirmando Reserva...' : '⚡ Confirmar Reserva Mesa'}
            </button>
          </form>
        </div>

        {/* COLUMNA DERECHA: MAPA VISUAL DE OCUPACIÓN Y LISTADO DE RESERVAS (7 cols) */}
        <div className="lg:col-span-7 bg-[#0f172a] border border-slate-800 rounded-3xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-black text-white">
                🗺️ Mapa de Ocupación ({horaFiltro})
              </h3>
              <p className="text-[11px] text-slate-400">
                Selecciona fecha y hora para ver qué mesas están ocupadas o libres.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="date"
                value={fechaFiltro}
                onChange={(e) => setFechaFiltro(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white"
              />
              <select
                value={horaFiltro}
                onChange={(e) => setHoraFiltro(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-amber-300 font-bold"
              >
                {TRAMOS_HORARIOS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* MAPA VISUAL DE MESAS (VERDE = LIBRE, ROJO = OCUPADA) */}
          <div className="space-y-3">
            {/* SECCIÓN INTERIOR */}
            <div>
              <span className="text-[11px] font-black uppercase text-indigo-400 block mb-2">
                🏠 Salón Interior ({fechaFiltro} · {horaFiltro})
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {mesasInterior.map((m) => {
                  const reservaOcupa = mapaOcupacionPorMesaId.get(m.id);
                  const ocupada = Boolean(reservaOcupa);

                  return (
                    <div
                      key={m.id}
                      className={`p-3 rounded-2xl border text-center transition-all ${
                        !m.activa
                          ? 'bg-slate-950/40 border-slate-800 text-slate-600'
                          : ocupada
                          ? 'bg-rose-950/40 border-rose-500/60 text-white shadow-[0_0_15px_rgba(244,63,94,0.15)]'
                          : 'bg-emerald-950/30 border-emerald-500/40 text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-bold">Mesa {m.numero}</span>
                        <span className="font-mono text-slate-400">{m.capacidad}p</span>
                      </div>
                      <div className="text-xs font-black mt-1">
                        {!m.activa ? (
                          <span className="text-slate-500">Cerrada</span>
                        ) : ocupada ? (
                          <span className="text-rose-400 truncate block">
                            🔴 {reservaOcupa?.nombre_cliente} ({reservaOcupa?.comensales}p)
                          </span>
                        ) : (
                          <span className="text-emerald-400">🟢 Libre</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* SECCIÓN TERRAZA */}
            <div>
              <span className="text-[11px] font-black uppercase text-amber-400 block mb-2">
                ☀️ Terraza Exterior ({fechaFiltro} · {horaFiltro})
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {mesasTerraza.map((m) => {
                  const reservaOcupa = mapaOcupacionPorMesaId.get(m.id);
                  const ocupada = Boolean(reservaOcupa);

                  return (
                    <div
                      key={m.id}
                      className={`p-3 rounded-2xl border text-center transition-all ${
                        !m.activa
                          ? 'bg-slate-950/40 border-slate-800 text-slate-600'
                          : ocupada
                          ? 'bg-rose-950/40 border-rose-500/60 text-white shadow-[0_0_15px_rgba(244,63,94,0.15)]'
                          : 'bg-emerald-950/30 border-emerald-500/40 text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-bold">Mesa {m.numero}</span>
                        <span className="font-mono text-slate-400">{m.capacidad}p</span>
                      </div>
                      <div className="text-xs font-black mt-1">
                        {!m.activa ? (
                          <span className="text-slate-500">Cerrada</span>
                        ) : ocupada ? (
                          <span className="text-rose-400 truncate block">
                            🔴 {reservaOcupa?.nombre_cliente} ({reservaOcupa?.comensales}p)
                          </span>
                        ) : (
                          <span className="text-emerald-400">🟢 Libre</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* LISTADO DE RESERVAS CONFIRMADAS DE LA JORNADA */}
          <div className="pt-3 border-t border-slate-800 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-300">
                📋 Reservas Registradas ({reservasFiltradas.length})
              </h4>
              <div className="flex items-center gap-2">
                <select
                  value={zonaFiltro}
                  onChange={(e) => setZonaFiltro(e.target.value as any)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-300 font-bold"
                >
                  <option value="todas">Todas las zonas</option>
                  <option value="interior">🏠 Solo Interior</option>
                  <option value="terraza">☀️ Solo Terraza</option>
                </select>
                <input
                  type="text"
                  placeholder="Buscar cliente o teléfono..."
                  value={busquedaCliente}
                  onChange={(e) => setBusquedaCliente(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white w-48"
                />
              </div>
            </div>

            {reservasFiltradas.length === 0 ? (
              <p className="text-xs text-slate-500 py-3 text-center">
                No hay reservas registradas para los filtros aplicados.
              </p>
            ) : (
              <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                {reservasFiltradas.map((r) => {
                  const mesaAsoc = mesas.find((m) => m.id === r.mesa_id);
                  return (
                    <div
                      key={r.id}
                      className="bg-slate-950 border border-slate-800/80 rounded-xl p-2.5 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 font-mono font-black text-[11px] shrink-0">
                          {r.hora_servicio}
                        </span>
                        <div className="min-w-0">
                          <p className="font-bold text-white truncate">{r.nombre_cliente}</p>
                          <p className="text-[10px] text-slate-400">
                            📞 {r.telefono} · {r.comensales} personas ·{' '}
                            {mesaAsoc
                              ? `${mesaAsoc.zona === 'interior' ? '🏠 Mesa ' : '☀️ Terraza '}${mesaAsoc.numero}`
                              : `Zona ${r.zona_preferida}`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {r.estado === 'confirmada' ? (
                          <>
                            <button
                              type="button"
                              onClick={() => cambiarEstadoReserva(r.id, 'finalizada')}
                              className="px-2 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold cursor-pointer"
                              title="Marcar como sentados / finalizada"
                            >
                              ✓ Sentados
                            </button>
                            <button
                              type="button"
                              onClick={() => cambiarEstadoReserva(r.id, 'cancelada')}
                              className="px-2 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-[10px] font-bold cursor-pointer"
                              title="Cancelar reserva"
                            >
                              ✕
                            </button>
                          </>
                        ) : (
                          <span
                            className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                              r.estado === 'finalizada'
                                ? 'bg-slate-800 text-slate-400'
                                : 'bg-rose-950 text-rose-300'
                            }`}
                          >
                            {r.estado}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ================= MODAL EDITAR MESA INDIVIDUAL ================= */}
      {mesaAEditar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <form
            onSubmit={handleGuardarMesaEditada}
            className="w-full max-w-sm rounded-3xl border border-slate-700 bg-[#0f172a] p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white">
                ✏️ Editar Mesa {mesaAEditar.numero}
              </h3>
              <button
                type="button"
                onClick={() => setMesaAEditar(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                Número de Mesa
              </label>
              <input
                type="number"
                min={1}
                required
                value={mesaAEditar.numero}
                onChange={(e) =>
                  setMesaAEditar({ ...mesaAEditar, numero: parseInt(e.target.value, 10) || 1 })
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white"
              />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                Zona
              </label>
              <select
                value={mesaAEditar.zona}
                onChange={(e) =>
                  setMesaAEditar({ ...mesaAEditar, zona: e.target.value as 'interior' | 'terraza' })
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white"
              >
                <option value="interior">🏠 Interior</option>
                <option value="terraza">☀️ Terraza</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                Capacidad de Comensales (Plazas)
              </label>
              <input
                type="number"
                min={1}
                max={30}
                required
                value={mesaAEditar.capacidad}
                onChange={(e) =>
                  setMesaAEditar({ ...mesaAEditar, capacidad: parseInt(e.target.value, 10) || 2 })
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={mesaAEditar.activa}
                  onChange={(e) => setMesaAEditar({ ...mesaAEditar, activa: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-indigo-600"
                />
                <span className="text-xs font-bold text-white">Mesa Activa / Disponible para Reservas</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setMesaAEditar(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase"
              >
                Guardar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
