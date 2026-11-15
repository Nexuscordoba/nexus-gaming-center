// src/CobroModal.tsx
import { useState, useMemo, useEffect } from 'react';
import {
  Banknote,
  CreditCard,
  Smartphone,
  Printer,
  X,
  RefreshCw,
  Coins,
  CheckCircle2,
  FileText,
  Building2
} from 'lucide-react';
import { redondearMoneda } from './fiscalService';

export interface DatosFiscalesCliente {
  razonSocial: string;
  nifCif: string;
  direccion: string;
  codigoPostal?: string;
  ciudad?: string;
}

export interface CobroModalProps {
  identificador: string; // ej. "COBRO DE MESA 4" o "COBRO DE BARRA · B-01"
  subtitulo?: string; // ej. "Salón Interior", "Terraza 2", "Javier - Cerveza"
  total: number;
  procesando?: boolean;
  modoFacturaInicial?: boolean;
  onConfirmarCobro: (
    metodo: 'efectivo' | 'tarjeta' | 'bizum',
    importeEntregado?: number,
    cambio?: number,
    datosFiscales?: DatosFiscalesCliente
  ) => Promise<void> | void;
  onCerrar: () => void;
}

export default function CobroModal({
  identificador,
  subtitulo,
  total,
  procesando = false,
  modoFacturaInicial = false,
  onConfirmarCobro,
  onCerrar
}: CobroModalProps) {
  const [metodoPago, setMetodoPago] = useState<'efectivo' | 'tarjeta' | 'bizum'>('efectivo');
  const [importeEntregado, setImporteEntregado] = useState<string>(() => total.toFixed(2));

  // Estados de Facturación con NIF
  const [emitirFactura, setEmitirFactura] = useState<boolean>(Boolean(modoFacturaInicial));
  const [nifCif, setNifCif] = useState('');
  const [razonSocial, setRazonSocial] = useState('');
  const [direccion, setDireccion] = useState('');
  const [codigoPostal, setCodigoPostal] = useState('');
  const [clientesGuardados, setClientesGuardados] = useState<DatosFiscalesCliente[]>([]);

  // Sincronizar si cambia modoFacturaInicial
  useEffect(() => {
    if (modoFacturaInicial) {
      setEmitirFactura(true);
    }
  }, [modoFacturaInicial]);

  // Cargar clientes guardados en localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('nexus_clientes_fiscales');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setClientesGuardados(parsed);
        }
      }
    } catch (e) {
      console.error('Error al leer clientes fiscales de localStorage:', e);
    }
  }, []);

  // Actualizar importe por defecto si cambia el total
  useEffect(() => {
    setImporteEntregado(total.toFixed(2));
  }, [total]);

  // Cálculo en tiempo real del cambio a devolver
  const cambio = useMemo(() => {
    if (metodoPago !== 'efectivo') return 0;
    const entregado = parseFloat(importeEntregado) || 0;
    const dif = entregado - total;
    return dif > 0 ? redondearMoneda(dif) : 0;
  }, [metodoPago, importeEntregado, total]);

  const entregadoNum = useMemo(() => {
    return parseFloat(importeEntregado) || 0;
  }, [importeEntregado]);

  const efectivoInsuficiente = useMemo(() => {
    return metodoPago === 'efectivo' && entregadoNum < total;
  }, [metodoPago, entregadoNum, total]);

  const datosFiscalesIncompletos = useMemo(() => {
    if (!emitirFactura) return false;
    return !nifCif.trim() || !razonSocial.trim();
  }, [emitirFactura, nifCif, razonSocial]);

  const seleccionarClienteExistente = (nif: string) => {
    const c = clientesGuardados.find((item) => item.nifCif === nif);
    if (c) {
      setNifCif(c.nifCif);
      setRazonSocial(c.razonSocial);
      setDireccion(c.direccion);
      setCodigoPostal(c.codigoPostal || '');
    }
  };

  const manejarCobro = () => {
    if (procesando) return;
    if (efectivoInsuficiente) return;

    let datosFiscales: DatosFiscalesCliente | undefined = undefined;
    if (emitirFactura) {
      if (!nifCif.trim() || !razonSocial.trim()) {
        alert('Por favor, indica obligatoriamente el NIF / CIF y el Nombre / Razón Social para emitir la factura.');
        return;
      }

      datosFiscales = {
        nifCif: nifCif.trim().toUpperCase(),
        razonSocial: razonSocial.trim(),
        direccion: direccion.trim() || 'Dirección no especificada',
        codigoPostal: codigoPostal.trim()
      };

      // Guardar en el historial de clientes frecuentes
      try {
        const raw = localStorage.getItem('nexus_clientes_fiscales');
        const lista: DatosFiscalesCliente[] = raw ? JSON.parse(raw) : [];
        const filtrada = lista.filter(
          (c) => c.nifCif.trim().toUpperCase() !== datosFiscales!.nifCif
        );
        filtrada.unshift(datosFiscales);
        localStorage.setItem('nexus_clientes_fiscales', JSON.stringify(filtrada.slice(0, 50)));
      } catch (e) {
        console.error('Error al guardar cliente fiscal en localStorage:', e);
      }
    }

    onConfirmarCobro(metodoPago, entregadoNum, cambio, datosFiscales);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="bg-[#0f111a] border border-white/15 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-200">
        
        {/* CABECERA DEL MODAL */}
        <div className="flex items-start justify-between border-b border-white/10 pb-4">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 block">
              {emitirFactura ? 'Factura Nominativa & Cobro' : 'Cobro y Cierre de Cuenta'}
            </span>
            <h3 className="text-xl font-black text-white uppercase tracking-tight">
              {identificador}
            </h3>
            {subtitulo && (
              <p className="text-xs text-slate-400 mt-0.5 font-medium">
                {subtitulo}
              </p>
            )}
          </div>
          <button
            type="button"
            disabled={procesando}
            onClick={onCerrar}
            className="p-2 rounded-xl text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-40"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* TOTAL A COBRAR EN GRANDE */}
        <div className="bg-black/60 p-4 rounded-2xl border border-white/10 text-center shadow-inner">
          <span className="text-xs uppercase font-bold text-slate-400 block mb-1">
            Total a Cobrar
          </span>
          <span className="text-4xl sm:text-5xl font-black text-amber-400 tracking-tight">
            {total.toFixed(2)} €
          </span>
        </div>

        {/* SELECTOR DE MÉTODO DE PAGO */}
        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
            Selecciona Método de Pago:
          </span>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              disabled={procesando}
              onClick={() => setMetodoPago('efectivo')}
              className={`p-3.5 rounded-2xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                metodoPago === 'efectivo'
                  ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-lg scale-102 ring-2 ring-amber-400/50'
                  : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
              }`}
            >
              <Banknote className="h-6 w-6" />
              <span className="text-xs font-bold">Efectivo</span>
            </button>

            <button
              type="button"
              disabled={procesando}
              onClick={() => setMetodoPago('tarjeta')}
              className={`p-3.5 rounded-2xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                metodoPago === 'tarjeta'
                  ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-lg scale-102 ring-2 ring-amber-400/50'
                  : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
              }`}
            >
              <CreditCard className="h-6 w-6" />
              <span className="text-xs font-bold">Tarjeta</span>
            </button>

            <button
              type="button"
              disabled={procesando}
              onClick={() => setMetodoPago('bizum')}
              className={`p-3.5 rounded-2xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                metodoPago === 'bizum'
                  ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-lg scale-102 ring-2 ring-amber-400/50'
                  : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
              }`}
            >
              <Smartphone className="h-6 w-6" />
              <span className="text-xs font-bold">Bizum</span>
            </button>
          </div>
        </div>

        {/* CALCULADORA Y BILLETES RÁPIDOS SI ES EFECTIVO */}
        {metodoPago === 'efectivo' && (
          <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-bold flex items-center gap-1.5">
                <Coins className="h-4 w-4 text-amber-400" />
                <span>Importe entregado por el cliente:</span>
              </span>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  disabled={procesando}
                  value={importeEntregado}
                  onChange={(e) => setImporteEntregado(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  className="w-28 bg-black/80 border border-white/20 rounded-xl px-3 py-1.5 text-right font-black text-white text-sm outline-none focus:border-amber-400"
                />
              </div>
            </div>

            {/* BOTONES DE BILLETES RÁPIDOS */}
            <div className="flex flex-wrap gap-1.5 justify-end">
              {[5, 10, 20, 50, 100].map((billete) => (
                <button
                  key={billete}
                  type="button"
                  disabled={procesando}
                  onClick={() => setImporteEntregado(billete.toString())}
                  className="px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-slate-200 transition-colors cursor-pointer"
                >
                  {billete} €
                </button>
              ))}
              <button
                type="button"
                disabled={procesando}
                onClick={() => setImporteEntregado(total.toFixed(2))}
                className="px-2.5 py-1 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold border border-amber-500/40 transition-colors cursor-pointer"
              >
                Exacto
              </button>
            </div>

            {/* CAMBIO A DEVOLVER O AVISO DE INSUFICIENTE */}
            {efectivoInsuficiente ? (
              <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs font-bold text-rose-400">
                <span>Faltan por entregar:</span>
                <span className="font-mono text-sm font-black">
                  {(total - entregadoNum).toFixed(2)} €
                </span>
              </div>
            ) : cambio > 0 ? (
              <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs font-black text-emerald-400">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Cambio a devolver:</span>
                </span>
                <span className="text-base font-mono font-black tracking-tight">
                  {cambio.toFixed(2)} €
                </span>
              </div>
            ) : (
              <div className="pt-2 border-t border-white/10 text-right text-[11px] font-bold text-slate-400">
                <span>Importe exacto entregado (sin cambio)</span>
              </div>
            )}
          </div>
        )}

        {/* SECCIÓN / SWITCH: ¿EMITIR FACTURA CON NIF? */}
        <div className="bg-black/50 p-4 rounded-2xl border border-cyan-500/30 space-y-3">
          <div
            className="flex items-center justify-between cursor-pointer select-none"
            onClick={() => !procesando && setEmitirFactura(!emitirFactura)}
          >
            <div className="flex items-center gap-2.5">
              <FileText className={`h-5 w-5 ${emitirFactura ? 'text-cyan-400' : 'text-slate-400'}`} />
              <div>
                <span className="text-xs font-black text-white block">
                  ¿Emitir Factura con NIF?
                </span>
                <span className="text-[10px] text-slate-400 block">
                  {emitirFactura
                    ? 'Factura Completa Nominativa con datos fiscales'
                    : 'Ticket Simplificado estándar de caja'}
                </span>
              </div>
            </div>
            <div
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ${
                emitirFactura ? 'bg-cyan-500 justify-end' : 'bg-white/15 justify-start'
              }`}
            >
              <div className="bg-white w-4 h-4 rounded-full shadow-md" />
            </div>
          </div>

          {emitirFactura && (
            <div className="space-y-3 pt-3 border-t border-white/10 animate-in fade-in duration-150">
              {clientesGuardados.length > 0 && (
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1 mb-1">
                    <Building2 className="h-3 w-3" /> Clientes Frecuentes Guardados:
                  </label>
                  <select
                    onChange={(e) => seleccionarClienteExistente(e.target.value)}
                    defaultValue=""
                    className="w-full bg-black/80 border border-cyan-500/30 rounded-xl px-3 py-2 text-xs text-cyan-200 outline-none focus:border-cyan-400 cursor-pointer"
                  >
                    <option value="">-- Autocompletar con cliente existente --</option>
                    {clientesGuardados.map((c) => (
                      <option key={c.nifCif} value={c.nifCif}>
                        {c.razonSocial} ({c.nifCif})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-300 block mb-1">
                    NIF / CIF / NIE *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="B12345678 / 12345678Z"
                    value={nifCif}
                    onChange={(e) => setNifCif(e.target.value.toUpperCase())}
                    className="w-full bg-black/80 border border-white/20 rounded-xl px-3 py-2 text-xs text-white uppercase font-mono outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-300 block mb-1">
                    Nombre / Razón Social *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Empresa S.L. o Nombre"
                    value={razonSocial}
                    onChange={(e) => setRazonSocial(e.target.value)}
                    className="w-full bg-black/80 border border-white/20 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="text-[10px] font-bold text-slate-300 block mb-1">
                    Dirección Fiscal *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Calle, Número, Ciudad"
                    value={direccion}
                    onChange={(e) => setDireccion(e.target.value)}
                    className="w-full bg-black/80 border border-white/20 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-300 block mb-1">
                    Cód. Postal
                  </label>
                  <input
                    type="text"
                    placeholder="14001"
                    value={codigoPostal}
                    onChange={(e) => setCodigoPostal(e.target.value)}
                    className="w-full bg-black/80 border border-white/20 rounded-xl px-3 py-2 text-xs text-white font-mono outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              {datosFiscalesIncompletos && (
                <p className="text-[11px] text-amber-400 font-medium">
                  ⚠️ El NIF/CIF y la Razón Social son obligatorios para emitir la factura.
                </p>
              )}
            </div>
          )}
        </div>

        {/* BOTÓN PRINCIPAL DESTACADO */}
        <div className="pt-2 space-y-2">
          <button
            type="button"
            disabled={procesando || efectivoInsuficiente || datosFiscalesIncompletos}
            onClick={manejarCobro}
            className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2.5 cursor-pointer transition-all active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed ${
              emitirFactura
                ? 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 shadow-[0_0_25px_rgba(6,182,212,0.4)]'
                : 'bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 shadow-[0_0_25px_rgba(16,185,129,0.4)]'
            }`}
          >
            {procesando ? (
              <>
                <RefreshCw className="h-5 w-5 animate-spin" />
                <span>{emitirFactura ? 'Emitiendo Factura...' : 'Emitiendo Ticket e Imprimiendo...'}</span>
              </>
            ) : emitirFactura ? (
              <>
                <Printer className="h-5 w-5" />
                <span>🖨️ 📄 EMITIR FACTURA, COBRAR Y CERRAR</span>
              </>
            ) : (
              <>
                <Printer className="h-5 w-5" />
                <span>🖨️ 💳 COBRAR, IMPRIMIR Y CERRAR</span>
              </>
            )}
          </button>
          <p className="text-[10px] text-center text-slate-500">
            {emitirFactura
              ? 'Emite Factura Completa legal vinculada a VeriFactu e imprime en impresora térmica.'
              : 'Registra el cobro en caja diaria, libera la cuenta e imprime el ticket fiscal en la impresora térmica.'}
          </p>
        </div>
      </div>
    </div>
  );
}
