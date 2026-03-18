import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    // Leer auth directamente de localStorage — no depender de contexto que puede crashear
    const token = localStorage.getItem('legalpro_token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (!payload.exp || payload.exp * 1000 > Date.now()) {
          navigate('/dashboard', { replace: true });
          return;
        }
      } catch {
        // Token inválido — redirigir a landing
      }
    }
    window.location.replace('/landing/');
  }, [navigate]);

  return (
    <div style={{ minHeight: '100dvh', background: '#050508', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 40, height: 40, border: '2px solid #06B6D4', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}