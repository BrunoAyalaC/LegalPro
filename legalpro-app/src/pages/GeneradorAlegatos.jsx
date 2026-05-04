import { useState } from 'react';
import Header from '../components/Header';
import AppIcon from '../components/AppIcon';
import IADisclaimerBanner from '../components/IADisclaimerBanner';
import IADisclaimerModal from '../components/IADisclaimerModal';
import { api } from '../api/client';
import { generateLegalPDF, exportToDocx } from '../utils/documents';

export default function GeneradorAlegatos() {
  const [tipoAlegato, setTipoAlegato] = useState('Alegato de Clausura - Defensa');
  const [teoriaDelCaso, setTeoriaDelCaso] = useState('');
  const [resultado, setResultado] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDisclaimerModal, setShowDisclaimerModal] = useState(false);
  const [exportLoading, setExportLoading] = useState({ pdf: false, docx: false });
  const [exportError, setExportError] = useState('');

  const handleGenerar = async () => {
    if (!teoriaDelCaso.trim()) return;
    setLoading(true);
    setError('');
    try {
      const prompt = `Genera un ${tipoAlegato} para el siguiente caso:\n\nTeoría del caso: ${teoriaDelCaso}`;
      const data = await api.consulta(prompt, 'alegatos');
      setResultado(typeof data.resultado === 'string' ? data.resultado : JSON.stringify(data.resultado, null, 2));
    } catch {
      setError('Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-enter">
      <Header title="Alegatos de Clausura IA" showBack rightAction={<span className="badge badge-primary">IA Gemini</span>} />
      <div className="px-4 py-6 space-y-6">
        <div className="space-y-3">
          <label className="block"><span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Tipo de Alegato</span>
            <div className="relative">
              <select className="input appearance-none pr-10" value={tipoAlegato} onChange={e => setTipoAlegato(e.target.value)}>
                <option>Alegato de Clausura - Defensa</option>
                <option>Alegato de Clausura - Fiscal</option>
                <option>Alegato de Apertura</option>
              </select>
              <AppIcon name="expand_more" size={20} />
            </div>
          </label>
          <label className="block"><span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Teoría del Caso</span>
            <textarea
              className="input min-h-[80px] resize-none"
              placeholder="Describe brevemente tu teoría del caso..."
              value={teoriaDelCaso}
              onChange={e => setTeoriaDelCaso(e.target.value)}
            />
          </label>
        </div>
        {error && <p className="text-red-400 text-xs">{error}</p>}
        <button
          className="btn btn-primary w-full"
          onClick={handleGenerar}
          disabled={loading || !teoriaDelCaso.trim()}
        >
          <AppIcon name="auto_awesome" size={20} />
          {loading ? ' Analizando con Gemini...' : ' Generar Alegato con Gemini'}
        </button>
        <div className="card bg-primary/5 border-primary/20 min-h-[200px] p-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-primary mb-3">Borrador del Alegato</h3>
          {resultado && <IADisclaimerBanner className="mb-3" compact />}
          {resultado ? (
            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{resultado}</p>
          ) : (
            <p className="text-sm text-slate-500 leading-relaxed">El borrador del alegato aparecerá aquí después de generarlo.</p>
          )}
          {resultado && (
            <>
              {exportError && <p className="text-red-400 text-xs mt-2">{exportError}</p>}
              <div className="pt-4 flex justify-end gap-2 border-t border-border-dark mt-4 flex-wrap">
                <button 
                  className="btn btn-secondary text-xs py-2 px-3"
                  onClick={async () => {
                    setExportError('');
                    setExportLoading(prev => ({ ...prev, docx: true }));
                    try {
                      const today = new Date().toISOString().split('T')[0];
                      const safeTitle = tipoAlegato.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_-]/g, '_');
                      await exportToDocx({
                        title: tipoAlegato,
                        content: resultado,
                        filename: `Alegato_${safeTitle}_${today}.docx`
                      });
                    } catch {
                      setExportError('Error al generar el DOCX. Intenta de nuevo.');
                    } finally {
                      setExportLoading(prev => ({ ...prev, docx: false }));
                    }
                  }}
                  disabled={exportLoading.docx}
                >
                  <AppIcon name="description" size={20} /> {exportLoading.docx ? 'Generando...' : 'Descargar DOCX'}
                </button>
                <button 
                  className="btn btn-primary text-xs py-2 px-3"
                  onClick={() => setShowDisclaimerModal(true)}
                  disabled={exportLoading.pdf}
                >
                  <AppIcon name="picture_as_pdf" size={20} /> {exportLoading.pdf ? 'Generando...' : 'Descargar PDF'}
                </button>
              </div>
            </>
          )}
        </div>

        <IADisclaimerModal
          isOpen={showDisclaimerModal}
          actionLabel="Descargar PDF"
          onConfirm={async () => {
            setShowDisclaimerModal(false);
            setExportError('');
            setExportLoading(prev => ({ ...prev, pdf: true }));
            try {
              const today = new Date().toISOString().split('T')[0];
              const safeTitle = tipoAlegato.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_-]/g, '_');
              await generateLegalPDF({
                title: tipoAlegato,
                content: resultado,
                metadata: { caso: teoriaDelCaso.substring(0, 100) },
                filename: `Alegato_${safeTitle}_${today}.pdf`
              });
            } catch {
              setExportError('Error al generar el PDF. Intenta de nuevo.');
            } finally {
              setExportLoading(prev => ({ ...prev, pdf: false }));
            }
          }}
          onCancel={() => setShowDisclaimerModal(false)}
        />
      </div>
    </div>
  );
}
