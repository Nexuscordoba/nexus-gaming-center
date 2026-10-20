import { useState } from 'react';
import { QrCode, Printer, ArrowLeft, MapPin } from 'lucide-react';

interface TableQrGeneratorProps {
  onBack: () => void;
}

export default function TableQrGenerator({ onBack }: TableQrGeneratorProps) {
  const [numMesas, setNumMesas] = useState<number>(10);

  const mesasArray = Array.from({ length: numMesas }, (_, i) => i + 1);

  const imprimirQR = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-[#050609] text-slate-100 p-6 flex flex-col justify-between selection:bg-cyan-500 selection:text-black">
      {/* Cabecera */}
      <header className="border-b border-white/10 pb-4 mb-8 flex items-center justify-between sticky top-0 bg-[#050609]/90 backdrop-blur-md z-30 print:hidden">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center">
            <QrCode className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-wide text-white">NEXUS · GENERADOR DE QR PARA MESAS</h1>
            <p className="text-xs text-slate-400">Chinales 45 · Códigos directos a carta y pedidos</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10">
            <span className="text-xs text-slate-300">Total Mesas:</span>
            <input 
              type="number" 
              min="1" 
              max="50"
              value={numMesas} 
              onChange={(e) => setNumMesas(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-12 bg-black/50 border border-white/20 rounded-lg px-2 py-1 text-xs text-cyan-400 font-bold text-center outline-none"
            />
          </div>

          <button
            type="button"
            onClick={imprimirQR}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-all cursor-pointer shadow-lg"
          >
            <Printer className="h-4 w-4" />
            <span>Imprimir Carteles QR</span>
          </button>

          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs text-slate-300 hover:text-white transition-all cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Volver</span>
          </button>
        </div>
      </header>

      {/* Cuadrícula de QRs */}
      <main className="flex-1 max-w-6xl mx-auto w-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 print:grid-cols-2 print:gap-4">
          {mesasArray.map((mesa) => {
            // RUTA DIRECTA AL SISTEMA DE PEDIDOS DE ESA MESA
            const urlMesa = `https://nexusgamingcenter.es/#/mesa/${mesa}`;
            const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(urlMesa)}`;

            return (
              <div 
                key={mesa} 
                className="bg-[#0d0f17] border border-white/10 rounded-3xl p-6 flex flex-col items-center justify-between text-center shadow-xl print:bg-white print:text-black print:border-black print:shadow-none print:p-4"
              >
                <div className="space-y-1 mb-4">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-cyan-400 print:text-slate-600 block">
                    Nexus Gaming Center
                  </span>
                  <h2 className="text-2xl font-black text-white print:text-black flex items-center justify-center gap-1.5">
                    <MapPin className="h-5 w-5 text-amber-400 print:hidden" /> MESA {mesa}
                  </h2>
                </div>

                <div className="bg-white p-3 rounded-2xl shadow-inner border border-white/10 print:border-black">
                  <img 
                    src={qrApiUrl} 
                    alt={`QR Mesa ${mesa}`} 
                    className="w-40 h-40 object-contain mx-auto"
                  />
                </div>

                <div className="mt-4 space-y-1">
                  <p className="text-[11px] text-slate-400 print:text-slate-700 font-medium">
                    Escanea para ver la carta, pedir platos y pedir la cuenta
                  </p>
                  <span className="text-[9px] font-mono text-slate-500 print:text-slate-500 block truncate max-w-[200px] mx-auto">
                    {urlMesa}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      <footer className="mt-12 border-t border-white/5 pt-4 text-center text-xs text-slate-500 print:hidden">
        NEXUS CORDOBA SL · Generador automático de QRs de sala
      </footer>
    </div>
  );
}