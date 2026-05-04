import { useState } from 'react';
import Header from '../components/Header';
import AppIcon from '../components/AppIcon';
import IADisclaimerBanner from '../components/IADisclaimerBanner';
import IADisclaimerModal from '../components/IADisclaimerModal';
import { api } from '../api/client';
import { generateLegalPDF, exportToDocx } from '../utils/documents';

export default function RedactorEscritos() {
  const [tipoEscrito, setTipoEscrito] = useState('Demanda de Alimentos');
  const [distritoJudicial, setDistritoJudicial] = useState('Corte Superior de Lima');
  const [hechos, setHechos] = useState('');
  const [resultado, setResultado] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDisclaimerModal, setShowDisclaimerModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [exportLoading, setExportLoading] = useState({ preview: false, docx: false });
  const [exportError, setExportError] = useState('');

  const handleGenerar = async () => {
    if (!hechos.trim()) return;
    setLoading(true);
    setError('');
    try {
      const prompt = `Redacta un escrito legal de tipo "${tipoEscrito}" para la "${distritoJudicial}". Hechos del caso: ${hechos}`;
      const data = await api.consulta(prompt, 'redaccion');
      setResultado(typeof data.resultado === 'string' ? data.resultado : JSON.stringify(data.resultado, null, 2));
    } catch {
      setError('Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-enter">
      <Header title="Redactor Legal Gemini" showBack rightAction={<AppIcon name="auto_awesome" size={20} />} />
      
      <main className="pb-28">
        <section className="p-4 space-y-4">
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Tipo de Escrito</span>
              <div className="relative">
                <select className="input appearance-none pr-10" value={tipoEscrito} onChange={e => setTipoEscrito(e.target.value)}>
                  <option>Demanda de Alimentos</option>
                  <option>Recurso de Apelación</option>
                  <option>Contestación de Demanda</option>
                  <option>Habeas Corpus</option>
                </select>
                <AppIcon name="expand_more" size={20} />
              </div>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Distrito Judicial</span>
              <div className="relative">
                <select className="input appearance-none pr-10" value={distritoJudicial} onChange={e => setDistritoJudicial(e.target.value)}>
                  <option>Corte Superior de Lima</option>
                  <option>Corte Superior de Lima Norte</option>
                  <option>Corte Superior de Arequipa</option>
                </select>
                <AppIcon name="location_on" size={20} />
              </div>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Hechos del Caso</span>
              <textarea
                className="input min-h-[100px] resize-none"
                placeholder="Describe los hechos relevantes del caso..."
                value={hechos}
                onChange={e => setHechos(e.target.value)}
              />
            </label>
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button
            className="btn btn-primary w-full"
            onClick={handleGenerar}
            disabled={loading || !hechos.trim()}
          >
            <AppIcon name="auto_awesome" size={20} />
            {loading ? ' Analizando con Gemini...' : ' Generar Escrito con Gemini'}
          </button>

          <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 flex items-center gap-3">
            <div className="bg-primary p-2 rounded-lg"><AppIcon name="upload_file" size={20} /></div>
            <div className="flex-1">
              <p className="text-xs font-bold text-primary">Documentos Analizados</p>
              <p className="text-[10px] text-slate-400 uppercase">Ningún expediente seleccionado</p>
            </div>
            <button className="text-xs font-semibold text-primary">Cambiar</button>
          </div>
        </section>

        <section className="px-4 py-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <AppIcon name="edit_note" size={20} />Borrador Inteligente
            </h2>
            <span className="badge badge-success">GEMINI 2.0</span>
          </div>
          <div className="card space-y-4 p-5 min-h-[350px]">
            {resultado && <IADisclaimerBanner className="mb-3" />}
            {resultado ? (
              <p className="text-xs leading-relaxed text-slate-300 whitespace-pre-wrap">{resultado}</p>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center py-12">
                <AppIcon name="edit_note" size={32} className="opacity-30 mb-3" />
                <p className="text-sm text-slate-400">El borrador del escrito aparecerá aquí después de generarlo.</p>
              </div>
            )}
            {exportError && <p className="text-red-400 text-xs">{exportError}</p>}
            <div className="pt-4 flex justify-end gap-2 border-t border-border-dark flex-wrap">
              <button className="btn btn-secondary text-xs py-2 px-3"><AppIcon name="list_alt" size={20} /> Anexos</button>
              <button 
                className="btn btn-secondary text-xs py-2 px-3"
                onClick={() => { setPendingAction('docx'); setShowDisclaimerModal(true); }}
                disabled={exportLoading.docx || !resultado}
              >
                <AppIcon name="description" size={20} /> {exportLoading.docx ? 'Generando DOCX...' : 'Descargar DOCX'}
              </button>
              <button 
                className="btn btn-primary text-xs py-2 px-3"
                onClick={() => { setPendingAction('preview'); setShowDisclaimerModal(true); }}
                disabled={exportLoading.preview || !resultado}
              >
                <AppIcon name="picture_as_pdf" size={20} /> {exportLoading.preview ? 'Generando PDF...' : 'Vista Previa PDF'}
              </button>
            </div>
          </div>
        </section>
      </main>

      <IADisclaimerModal
        isOpen={showDisclaimerModal}
        actionLabel={pendingAction === 'preview' ? 'Ver Vista Previa' : pendingAction === 'docx' ? 'Descargar DOCX' : 'Continuar'}
        onConfirm={async () => {
          setShowDisclaimerModal(false);
          setExportError('');
          const today = new Date().toISOString().split('T')[0];
          const safeTitle = tipoEscrito.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_-]/g, '_');

          if (pendingAction === 'preview') {
            setExportLoading(prev => ({ ...prev, preview: true }));
            try {
              await generateLegalPDF({
                title: tipoEscrito,
                content: resultado,
                metadata: { distrito: distritoJudicial },
                filename: `Escrito_${safeTitle}_${today}.pdf`
              });
            } catch {
              setExportError('Error al generar el PDF. Intenta de nuevo.');
            } finally {
              setExportLoading(prev => ({ ...prev, preview: false }));
              setPendingAction(null);
            }
          } else if (pendingAction === 'docx') {
            setExportLoading(prev => ({ ...prev, docx: true }));
            try {
              await exportToDocx({
                title: tipoEscrito,
                content: resultado,
                filename: `Escrito_${safeTitle}_${today}.docx`
              });
            } catch {
              setExportError('Error al generar el DOCX. Intenta de nuevo.');
            } finally {
              setExportLoading(prev => ({ ...prev, docx: false }));
              setPendingAction(null);
            }
          } else {
            setPendingAction(null);
          }
        }}
        onCancel={() => { setShowDisclaimerModal(false); setPendingAction(null); }}
      />

      <div className="fixed bottom-24 right-4 z-10">
        <button className="bg-primary hover:bg-primary/90 text-white p-4 rounded-full shadow-lg active:scale-95 transition-transform anim-pulse-glow">
          <AppIcon name="smart_toy" size={20} />
        </button>
      </div>
    </div>
  );
}
