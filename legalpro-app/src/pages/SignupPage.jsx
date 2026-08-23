// legalpro-app/src/pages/SignupPage.jsx
// Generado por @frontend + @auditor-lpdp
// FIX CRITICAL: 4 checkboxes separados (no "cajon de sastre")
// Cumple LPDP Art. 14 (consentimiento libre, especifico, informado)

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { nodeClient } from '../api/client';
import IADisclaimerBanner from '../components/IADisclaimerBanner';
import { useUI } from '../context/UIContext';
import { logger } from '../utils/logger';

export default function SignupPage() {
  const navigate = useNavigate();
  const { toast } = useUI();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    password_confirm: '',
    nombre_completo: '',
    nombre_organizacion: '',
    slug: ''
  });

  // CRITICAL FIX: 4 checkboxes separados (no 1 cajon de sastre)
  const [consentimientos, setConsentimientos] = useState({
    terminos: false,
    privacidad: false,
    marketing: false,
    transferencia_internacional: false
  });

  // Para consentimientos revocables, permitir ver info antes de aceptar
  const [showDetalles, setShowDetalles] = useState({
    marketing: false,
    transferencia_internacional: false
  });

  const canProceedToStep2 = () => {
    return formData.email && formData.password && formData.password === formData.password_confirm &&
      formData.nombre_completo && formData.nombre_organizacion;
  };

  const canSubmit = () => {
    // CRITICAL: terminos y privacidad son obligatorios
    // CRITICAL: transferencia_internacional es OBLIGATORIO para usar IA (no es opcional)
    return consentimientos.terminos && consentimientos.privacidad;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit()) return;
    setSubmitting(true);
    try {
      const { data } = await nodeClient.post('/api/auth/register', {
        ...formData,
        consentimientos: {
          terminos: { aceptado: consentimientos.terminos, version: '1.0.0' },
          privacidad: { aceptado: consentimientos.privacidad, version: '1.0.0' },
          marketing: { aceptado: consentimientos.marketing, version: '1.0.0' },
          transferencia: { aceptado: consentimientos.transferencia_internacional, version: '1.0.0' }
        }
      });
      if (data.token) {
        navigate('/login?registered=true');
      }
    } catch (e) {
      const msg = e.response?.data?.error || 'Error al registrar. Verifica tus datos e intenta nuevamente.';
      toast.error(msg);
      logger.error('[SignupPage] Error al registrar:', e);
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 1) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-6">
        <form
          onSubmit={(e) => { e.preventDefault(); if (canProceedToStep2()) setStep(2); }}
          className="w-full max-w-md bg-slate-800 p-8 rounded-lg border border-slate-700"
          aria-labelledby="signup-title"
        >
          <h1 id="signup-title" className="text-2xl font-bold mb-2">Crear cuenta</h1>
          <p className="text-sm text-slate-400 mb-6">Paso 1 de 2: Informacion basica</p>
          <IADisclaimerBanner />
          <div className="space-y-4 mt-6">
            <label className="block">
              <span className="text-sm font-medium">Email</span>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full mt-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded"
                required
                aria-label="Email"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Nombre completo</span>
              <input
                type="text"
                value={formData.nombre_completo}
                onChange={(e) => setFormData({ ...formData, nombre_completo: e.target.value })}
                className="w-full mt-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded"
                required
                aria-label="Nombre completo"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Contrasena (minimo 8 caracteres)</span>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full mt-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded"
                minLength={8}
                required
                aria-label="Contrasena"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Confirmar contrasena</span>
              <input
                type="password"
                value={formData.password_confirm}
                onChange={(e) => setFormData({ ...formData, password_confirm: e.target.value })}
                className="w-full mt-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded"
                minLength={8}
                required
                aria-label="Confirmar contrasena"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Nombre de organizacion</span>
              <input
                type="text"
                value={formData.nombre_organizacion}
                onChange={(e) => {
                  const slug = e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-');
                  setFormData({ ...formData, nombre_organizacion: e.target.value, slug });
                }}
                className="w-full mt-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded"
                required
                aria-label="Nombre de organizacion"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={!canProceedToStep2()}
            className="w-full mt-6 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 rounded font-medium"
            aria-label="Continuar al paso 2"
          >
            Continuar
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-2xl bg-slate-800 p-8 rounded-lg border border-slate-700"
        aria-labelledby="consent-title"
      >
        <h1 id="consent-title" className="text-2xl font-bold mb-2">Consentimientos (LPDP)</h1>
        <p className="text-sm text-slate-400 mb-6">Paso 2 de 2: Tus derechos sobre tus datos</p>
        <div className="bg-amber-900/20 border border-amber-700 p-3 rounded mb-6">
          <p className="text-sm text-amber-200">
            âš ï¸ Conforme al articulo 14 de la LPDP 29733, cada finalidad requiere tu consentimiento <strong>especifico y por separado</strong>.
            No los agrupamos en un unico checkbox.
          </p>
        </div>
        <fieldset className="space-y-4">
          <legend className="text-sm font-medium mb-2">Consentimientos obligatorios</legend>

          <label className="flex items-start gap-3 p-3 bg-slate-900 rounded border border-slate-700">
            <input
              type="checkbox"
              checked={consentimientos.terminos}
              onChange={(e) => setConsentimientos({ ...consentimientos, terminos: e.target.checked })}
              className="mt-1"
              required
              aria-label="Acepto los terminos y condiciones"
            />
            <div>
              <span className="font-medium">Acepto los Terminos y Condiciones</span>
              <span className="text-red-400 ml-1">*</span>
              <p className="text-xs text-slate-400 mt-1">Version 1.0.0. Obligatorio para usar el servicio.</p>
              <a href="/legal/terminos" target="_blank" rel="noopener" className="text-xs text-blue-400 underline">Ver terminos</a>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3 bg-slate-900 rounded border border-slate-700">
            <input
              type="checkbox"
              checked={consentimientos.privacidad}
              onChange={(e) => setConsentimientos({ ...consentimientos, privacidad: e.target.checked })}
              className="mt-1"
              required
              aria-label="Acepto la politica de privacidad"
            />
            <div>
              <span className="font-medium">Acepto la Politica de Privacidad</span>
              <span className="text-red-400 ml-1">*</span>
              <p className="text-xs text-slate-400 mt-1">Version 1.0.0. Tratamiento de datos personales segun LPDP 29733.</p>
              <a href="/legal/privacidad" target="_blank" rel="noopener" className="text-xs text-blue-400 underline">Ver politica</a>
            </div>
          </label>
        </fieldset>

        <fieldset className="space-y-4 mt-6">
          <legend className="text-sm font-medium mb-2">Consentimientos opcionales</legend>

          <label className="flex items-start gap-3 p-3 bg-slate-900 rounded border border-slate-700">
            <input
              type="checkbox"
              checked={consentimientos.marketing}
              onChange={(e) => setConsentimientos({ ...consentimientos, marketing: e.target.checked })}
              className="mt-1"
              aria-label="Acepto recibir emails de marketing"
            />
            <div>
              <span className="font-medium">Acepto recibir emails de marketing</span>
              <p className="text-xs text-slate-400 mt-1">Newsletter, nuevos features, ofertas. Puedes revocar en cualquier momento.</p>
            </div>
          </label>
        </fieldset>

        <fieldset className="space-y-4 mt-6">
          <legend className="text-sm font-medium mb-2">Consentimientos para servicios especificos</legend>

          <label className="flex items-start gap-3 p-3 bg-slate-900 rounded border border-amber-700">
            <input
              type="checkbox"
              checked={consentimientos.transferencia_internacional}
              onChange={(e) => setConsentimientos({ ...consentimientos, transferencia_internacional: e.target.checked })}
              className="mt-1"
              aria-label="Acepto transferencia internacional a proveedores de IA"
            />
            <div>
              <span className="font-medium">Acepto la transferencia internacional a proveedores de IA (DeepSeek vía OpenCode Go)</span>
              <button
                type="button"
                onClick={() => setShowDetalles({ ...showDetalles, transferencia_internacional: !showDetalles.transferencia_internacional })}
                className="text-xs text-blue-400 underline ml-2"
              >
                {showDetalles.transferencia_internacional ? 'Ocultar' : 'Ver'} detalles
              </button>
              {showDetalles.transferencia_internacional && (
                <div className="text-xs text-slate-300 mt-2 p-2 bg-slate-800 rounded">
                  <p><strong>Destino:</strong> DeepSeek AI (vía OpenCode Go) - procesamiento de IA</p>
                  <p><strong>Base legal:</strong> Art. 21 LPDP 29733 - Consentimiento explicito</p>
                  <p><strong>Proposito:</strong> Procesamiento de IA (analisis, redaccion, busqueda)</p>
                  <p><strong>Datos enviados:</strong> Prompts y contexto (sin PII en claro, sanitizado)</p>
                  <p><strong>Protecciones:</strong> DPA con proveedores de IA, encriptacion en transito, minimizacion de datos</p>
                </div>
              )}
              <p className="text-xs text-amber-300 mt-1">
                <strong>Requerido para usar funciones de IA.</strong> Sin este consentimiento, no podras usar las 16 herramientas IA.
              </p>
            </div>
          </label>
        </fieldset>

        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={() => setStep(1)}
            className="flex-1 px-4 py-2 border border-slate-700 rounded font-medium"
          >
            Atras
          </button>
          <button
            type="submit"
            disabled={!canSubmit() || submitting}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 rounded font-medium"
            aria-label="Crear cuenta"
          >
            {submitting ? 'Creando...' : 'Crear cuenta'}
          </button>
        </div>
        <p className="text-xs text-slate-500 mt-4">
          * Obligatorio. Tus consentimientos se registran con timestamp, IP y user agent para cumplimiento LPDP.
        </p>
      </form>
    </div>
  );
}
