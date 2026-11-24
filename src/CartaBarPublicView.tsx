// src/CartaBarPublicView.tsx
import { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  FileText,
  Download,
  UtensilsCrossed,
  ShieldAlert,
  ArrowRight,
  Coffee,
  ChefHat,
  Info
} from 'lucide-react';
import { supabase } from './supabase';
import {
  FAMILIAS_OFICIALES,
  construirCartaPublica,
  formatearPrecioEuro,
  type FamiliaCartaId,
  type ItemCartaPublica,
  type ProductoCartaDB
} from './cartaOficial';
import { AVISO_LEGAL_CARTA, cumpleFiltroAlergenos } from './alergenos';
import {
  AlergenosBadges,
  FiltroAlergenosBar,
  TablaAlergenosModal,
  type ProductoAlergenoTabla
} from './AlergenosUI';

interface CartaBarPublicViewProps {
  onIrAGuisos: () => void;
  abrirAlergenosInicial?: boolean;
}

export default function CartaBarPublicView({
  onIrAGuisos,
  abrirAlergenosInicial = false
}: CartaBarPublicViewProps) {
  const [productosDB, setProductosDB] = useState<ProductoCartaDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [excluidos, setExcluidos] = useState<string[]>([]);
  const [incluirTrazasEnFiltro, setIncluirTrazasEnFiltro] = useState(false);
  const [modalAlergenosAbierto, setModalAlergenosAbierto] = useState(abrirAlergenosInicial);
  const [familiaActiva, setFamiliaActiva] = useState<'TODAS' | FamiliaCartaId>('TODAS');

  useEffect(() => {
    let mounted = true;
    const cargar = async () => {
      try {
        const { data, error } = await supabase
          .from('productos_carta')
          .select('*')
          .eq('activo', true)
          .order('id', { ascending: true });

        if (!error && mounted && data) {
          setProductosDB(data);
        }
      } catch (err) {
        console.error('Error al cargar productos_carta en #bar:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    cargar();

    const channel = supabase
      .channel('public-bar-carta')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'productos_carta' },
        () => {
          cargar();
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const cartaCompleta = useMemo(() => construirCartaPublica(productosDB), [productosDB]);

  const itemsVisibles = useMemo(() => {
    return cartaCompleta.filter((item) =>
      cumpleFiltroAlergenos(item.alergenos, item.trazas, excluidos, incluirTrazasEnFiltro)
    );
  }, [cartaCompleta, excluidos, incluirTrazasEnFiltro]);

  const totalOcultos = cartaCompleta.length - itemsVisibles.length;

  const productosParaTabla: ProductoAlergenoTabla[] = useMemo(() => {
    return cartaCompleta.map((item) => {
      let precioTexto = item.precioTexto || '';
      if (!precioTexto) {
        if (item.precio1 !== undefined && item.precio2 !== undefined) {
          precioTexto = `${formatearPrecioEuro(item.precio1)} / ${formatearPrecioEuro(item.precio2)}`;
        } else if (item.precio !== undefined) {
          precioTexto = formatearPrecioEuro(item.precio);
        }
      }
      return {
        id: item.id,
        nombre: item.nombre,
        categoria: item.categoriaNombre,
        precioTexto,
        alergenos: item.alergenos,
        trazas: item.trazas
      };
    });
  }, [cartaCompleta]);

  const toggleExcluido = (alergenoId: string) => {
    setExcluidos((prev) =>
      prev.includes(alergenoId) ? prev.filter((x) => x !== alergenoId) : [...prev, alergenoId]
    );
  };

  const familiasAMostrar =
    familiaActiva === 'TODAS'
      ? FAMILIAS_OFICIALES
      : FAMILIAS_OFICIALES.filter((f) => f.id === familiaActiva);

  return (
    <main className="flex-grow">
      {/* CABECERA COMPACTA DE ACCESO DIRECTO QR */}
      <section className="relative overflow-hidden py-8 sm:py-14 border-b border-white/[0.06]">
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=2000&q=80"
            alt="Café Bar Nexus"
            className="w-full h-full object-cover object-center opacity-35"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#08090d] via-[#08090d]/85 to-[#08090d]/65" />
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-5 relative z-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-950/80 backdrop-blur-md px-3.5 py-1 text-[11px] text-amber-300 mb-3">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Lunes a Viernes de 7:00 a 17:00 · Polígono Chinales 45</span>
              </div>

              <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight uppercase">
                Café Bar{' '}
                <span className="text-amber-400 drop-shadow-[0_0_25px_rgba(245,158,11,0.5)]">
                  Nexus
                </span>
              </h1>
              <p className="mt-2 text-sm sm:text-base text-slate-300 max-w-2xl leading-relaxed">
                Carta oficial, desayunos, menú del día casero, tapas y guisos de la casa.
              </p>
            </div>

            {/* ACCESOS DIRECTOS VISIBLES SIN SCROLL EN MÓVIL (QR) */}
            <div className="grid grid-cols-1 sm:flex sm:flex-wrap gap-2.5 shrink-0">
              <button
                type="button"
                onClick={onIrAGuisos}
                className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-3 text-slate-950 text-xs sm:text-sm font-black uppercase tracking-wider shadow-[0_0_25px_rgba(245,158,11,0.35)] hover:opacity-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <ChefHat className="h-4 w-4 shrink-0" />
                <span>Platos del Día y Guisos</span>
                <ArrowRight className="h-4 w-4 shrink-0" />
              </button>

              <button
                type="button"
                onClick={() => setModalAlergenosAbierto(true)}
                className="rounded-xl bg-amber-950/90 border border-amber-400/50 text-amber-200 px-5 py-3 text-xs sm:text-sm font-bold uppercase tracking-wider hover:bg-amber-900/70 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <ShieldAlert className="h-4 w-4 text-amber-400 shrink-0" />
                <span>Tabla de Alérgenos e Info Legal</span>
              </button>

              <a
                href="/carta-cafe-bar-nexus.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/15 text-slate-100 px-5 py-3 text-xs sm:text-sm font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2"
              >
                <FileText className="h-4 w-4 text-cyan-400 shrink-0" />
                <span>Carta Oficial PDF</span>
                <Download className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* CUERPO PRINCIPAL DE LA CARTA */}
      <section className="max-w-6xl mx-auto px-4 sm:px-5 py-8 sm:py-12 space-y-6">
        {/* FILTROS RÁPIDOS DE ALÉRGENOS */}
        <FiltroAlergenosBar
          excluidos={excluidos}
          onToggleExcluido={toggleExcluido}
          onLimpiarFiltros={() => {
            setExcluidos([]);
            setIncluirTrazasEnFiltro(false);
          }}
          incluirTrazas={incluirTrazasEnFiltro}
          onToggleIncluirTrazas={() => setIncluirTrazasEnFiltro((v) => !v)}
          onAbrirTablaAlergenos={() => setModalAlergenosAbierto(true)}
          totalOcultos={totalOcultos}
        />

        {/* PESTAÑAS DE LAS 5 FAMILIAS */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setFamiliaActiva('TODAS')}
            className={`shrink-0 rounded-xl px-4 py-2 text-xs font-bold border transition-all cursor-pointer ${
              familiaActiva === 'TODAS'
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                : 'bg-white/[0.04] text-slate-300 border-white/10 hover:border-white/25'
            }`}
          >
            Todas las Familias (4)
          </button>
          {FAMILIAS_OFICIALES.map((fam) => (
            <button
              key={fam.id}
              type="button"
              onClick={() => setFamiliaActiva(fam.id)}
              className={`shrink-0 rounded-xl px-4 py-2 text-xs font-bold border transition-all cursor-pointer ${
                familiaActiva === fam.id
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                  : 'bg-white/[0.04] text-slate-300 border-white/10 hover:border-white/25'
              }`}
            >
              {fam.nombre}
            </button>
          ))}
        </div>

        {loading && (
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <Coffee className="h-4 w-4 animate-pulse text-amber-400" />
            <span>Sincronizando precios y alérgenos en tiempo real...</span>
          </div>
        )}

        {/* LAS 5 FAMILIAS OFICIALES */}
        <div className="grid gap-6">
          {familiasAMostrar.map((fam) => {
            const itemsFamilia = itemsVisibles.filter((it) => it.familia === fam.id);
            const tieneDobleColumna = Boolean(fam.columnaPrecio1 && fam.columnaPrecio2);

            return (
              <div
                key={fam.id}
                id={`familia-${fam.id}`}
                className="rounded-3xl border border-amber-500/20 bg-[#0d1018]/90 backdrop-blur overflow-hidden shadow-xl"
              >
                {/* Cabecera de familia */}
                <div className="px-5 py-4 bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent border-b border-white/[0.07] flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-amber-400">
                      <UtensilsCrossed className="h-4 w-4" />
                      <h2 className="text-lg sm:text-xl font-black uppercase tracking-wide text-white">
                        {fam.nombre}
                      </h2>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{fam.subtitulo}</p>
                  </div>

                  {tieneDobleColumna && (
                    <div className="flex items-center gap-4 text-xs font-black uppercase tracking-wider text-amber-300 pr-1">
                      <span className="w-16 text-right">{fam.columnaPrecio1}</span>
                      <span className="w-16 text-right">{fam.columnaPrecio2}</span>
                    </div>
                  )}
                </div>

                {/* Lista de platos */}
                {itemsFamilia.length === 0 ? (
                  <div className="px-5 py-6 text-xs text-slate-400">
                    Todos los platos de esta familia han sido ocultados por el filtro de alérgenos activo.
                  </div>
                ) : (
                  <div className="divide-y divide-white/[0.06]">
                    {itemsFamilia.map((item: ItemCartaPublica) => (
                      <div
                        key={item.id}
                        className="px-5 py-3.5 hover:bg-white/[0.02] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-sm sm:text-base text-white">
                              {item.nombre}
                            </span>
                            {item.esGuisosLink && (
                              <button
                                type="button"
                                onClick={onIrAGuisos}
                                className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 border border-amber-400/40 px-2.5 py-0.5 text-[11px] font-bold text-amber-300 hover:bg-amber-500/30 cursor-pointer"
                              >
                                <span>🍲 Ver calendario semanal</span>
                                <ArrowRight className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                          {item.descripcion && (
                            <p className="text-xs text-slate-400 mt-0.5">{item.descripcion}</p>
                          )}
                          <AlergenosBadges alergenos={item.alergenos} trazas={item.trazas} />
                        </div>

                        {/* Precios */}
                        <div className="flex items-center justify-end gap-4 shrink-0">
                          {item.precio1 !== undefined && item.precio2 !== undefined ? (
                            <>
                              <div className="w-16 text-right">
                                {fam.columnaPrecio1 && (
                                  <span className="sm:hidden block text-[10px] text-slate-500 uppercase">
                                    {fam.columnaPrecio1}
                                  </span>
                                )}
                                <span className="font-black text-sm sm:text-base text-amber-300">
                                  {formatearPrecioEuro(item.precio1)}
                                </span>
                              </div>
                              <div className="w-16 text-right">
                                {fam.columnaPrecio2 && (
                                  <span className="sm:hidden block text-[10px] text-slate-500 uppercase">
                                    {fam.columnaPrecio2}
                                  </span>
                                )}
                                <span className="font-black text-sm sm:text-base text-amber-300">
                                  {formatearPrecioEuro(item.precio2)}
                                </span>
                              </div>
                            </>
                          ) : item.precioTexto ? (
                            <span className="font-black text-sm text-amber-300">
                              {item.precioTexto}
                            </span>
                          ) : (
                            <span className="font-black text-base text-amber-300">
                              {formatearPrecioEuro(item.precio)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* AVISO LEGAL EXACTA CARTA */}
        <div className="rounded-2xl border border-white/10 bg-[#0c0d14]/90 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3 text-xs text-slate-300 leading-relaxed">
            <Info className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <p>{AVISO_LEGAL_CARTA}</p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setModalAlergenosAbierto(true)}
              className="rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/40 text-amber-200 px-4 py-2 text-xs font-bold cursor-pointer"
            >
              Tabla de Alérgenos
            </button>
            <a
              href="/carta-cafe-bar-nexus.pdf"
              download="Carta_Cafe_Bar_Nexus.pdf"
              className="rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/15 text-slate-200 px-4 py-2 text-xs font-bold inline-flex items-center gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Descargar PDF</span>
            </a>
          </div>
        </div>
      </section>

      <TablaAlergenosModal
        abierto={modalAlergenosAbierto}
        onCerrar={() => setModalAlergenosAbierto(false)}
        productos={productosParaTabla}
      />
    </main>
  );
}
