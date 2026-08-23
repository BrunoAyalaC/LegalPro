// Conversor UIT — herramienta determinística (sin IA)
// Endpoint: GET /api/herramientas/uit (Node)
// Contrato: { success, data: { valor_uit_2026, valor_uitm_2026, valor_rm, fuente } }
import { useEffect, useState } from 'react';
import { ArrowRightLeft, AlertTriangle, Info, RefreshCw, Loader2 } from 'lucide-react';
import { nodeClient } from '../api/client';

const fmtPEN = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', minimumFractionDigits: 2 });

export default function ConversorUIT() {
  const [uitData, setUitData] = useState(null);
  const [monto, setMonto] = useState('');
  const [uits, setUits] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  async function cargarUit() {
    setCargando(true);
    setError('');
    try {
      const { data } = await nodeClient.get('/api/herramientas/uit');
      if (!data?.success || !data?.data) throw new Error(data?.error || 'Respuesta inválida del servidor.');
      setUitData(data.data);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Error al cargar el valor de la UIT.');
    } finally {
      setCargando(false);
    }
  }

  // Carga al montar
  useEffect(() => {
    cargarUit();
  }, []);

  const valorUit = uitData ? Number(uitData.valor_uit_2026) : null;

  function handleMontoChange(v) {
    setMonto(v);
    const n = parseFloat(v);
    if (valorUit && !Number.isNaN(n)) {
      setUits((n / valorUit).toFixed(4));
    } else {
      setUits('');
    }
  }

  function handleUitsChange(v) {
    setUits(v);
    const n = parseFloat(v);
    if (valorUit && !Number.isNaN(n)) {
      setMonto((n * valorUit).toFixed(2));
    } else {
      setMonto('');
    }
  }

  return (
    <div className="min-h-screen bg-[#0b1120] text-white p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 rounded-xl bg-gradient-to-br from-sky-500/20 to-blue-600/10 border border-sky-500/20">
            <ArrowRightLeft className="w-7 h-7 text-sky-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Conversor UIT</h1>
            <p className="text-slate-400 text-sm">Convierte montos en soles a Unidades Impositivas Tributarias</p>
          </div>
        </div>

        {/* Disclaimer permanente — Ley 29571 (consumidor) / herramienta referencial */}
        <div
          role="note"
          aria-label="Aviso: herramienta referencial"
          className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5 text-[11px] text-amber-200/90 flex gap-2 mb-6"
        >
          <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" aria-hidden="true" />
          <span>
            Herramienta referencial. Los cálculos no constituyen asesoría legal. Verifique fuentes oficiales
            (SPIJ, BCRP, El Peruano) antes de usar profesionalmente.
          </span>
        </div>

        {cargando ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-500" role="status" aria-live="polite">
            <Loader2 className="w-8 h-8 animate-spin mb-3" />
            <p className="text-sm">Cargando valor de la UIT…</p>
          </div>
        ) : error ? (
          <div className="bg-slate-800/50 border border-red-500/30 rounded-2xl p-8 text-center">
            <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <p role="alert" className="text-red-400 text-sm mb-4">{error}</p>
            <button
              type="button"
              onClick={cargarUit}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white"
            >
              <RefreshCw className="w-4 h-4" /> Reintentar
            </button>
          </div>
        ) : (
          <>
            {/* Valor vigente */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-slate-800/50 border border-sky-500/20 rounded-2xl p-5 text-center">
                <p className="text-xs text-slate-500 mb-1">UIT vigente</p>
                <p className="text-2xl font-bold text-sky-400">{fmtPEN.format(valorUit)}</p>
                <p className="text-xs text-slate-500 mt-1">Año {new Date().getFullYear()}</p>
              </div>
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 text-center">
                <p className="text-xs text-slate-500 mb-1">UIT mensualizada</p>
                <p className="text-xl font-semibold text-white">{fmtPEN.format(uitData.valor_uitm_2026)}</p>
                <p className="text-xs text-slate-500 mt-1">UIT ÷ 12 (referencial)</p>
              </div>
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 text-center">
                <p className="text-xs text-slate-500 mb-1">Remuneración Mínima</p>
                <p className="text-xl font-semibold text-white">{fmtPEN.format(uitData.valor_rm)}</p>
                <p className="text-xs text-slate-500 mt-1">RMV vigente</p>
              </div>
            </div>

            {/* Conversor bidireccional */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-sky-400" />
                Conversión
              </h2>

              <div className="space-y-5">
                <div>
                  <label htmlFor="cu-monto" className="block text-sm font-medium text-slate-300 mb-2">
                    Monto en soles (S/)
                  </label>
                  <input
                    id="cu-monto"
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={monto}
                    onChange={(e) => handleMontoChange(e.target.value)}
                    placeholder="Ej.: 10700.00"
                    className="w-full bg-slate-700/50 border border-slate-600/50 rounded-xl px-4 py-3 text-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-500/50"
                  />
                </div>

                <div className="flex items-center justify-center" aria-hidden="true">
                  <span className="w-9 h-9 rounded-full bg-sky-500/15 border border-sky-500/25 flex items-center justify-center">
                    <ArrowRightLeft className="w-4 h-4 text-sky-400" />
                  </span>
                </div>

                <div>
                  <label htmlFor="cu-uits" className="block text-sm font-medium text-slate-300 mb-2">
                    Equivalente en UITs
                  </label>
                  <input
                    id="cu-uits"
                    type="number"
                    min="0"
                    step="0.0001"
                    inputMode="decimal"
                    value={uits}
                    onChange={(e) => handleUitsChange(e.target.value)}
                    placeholder="Ej.: 2.0000"
                    className="w-full bg-slate-700/50 border border-slate-600/50 rounded-xl px-4 py-3 text-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-500/50"
                  />
                </div>
              </div>

              {monto && uits && !Number.isNaN(parseFloat(monto)) && (
                <div className="mt-5 p-3 rounded-xl bg-sky-500/10 border border-sky-500/25 text-sm text-sky-300 text-center" aria-live="polite">
                  {fmtPEN.format(parseFloat(monto))} ={' '}
                  <strong>{parseFloat(uits).toLocaleString('es-PE', { maximumFractionDigits: 4 })} UITs</strong>
                </div>
              )}
            </div>

            {/* Fuente + disclaimer */}
            <div className="mt-6 p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-xs text-slate-400 flex items-start gap-2">
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-slate-500" />
              <span>
                Valores <strong className="text-slate-300">referenciales</strong>. {uitData.fuente} La UIT se fija por
                Decreto Supremo del MEF cada diciembre para el año siguiente; verifique contra El Peruano antes de
                usarla en un escrito.
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
