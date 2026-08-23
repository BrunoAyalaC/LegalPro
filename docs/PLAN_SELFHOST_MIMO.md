# Plan Self-Hosting Xiaomi MiMo V2.5 — LegalPro

> Fecha: 1 de agosto de 2026
> Objetivo: Eliminar transferencia internacional para visión/OCR (LPDP Art. 21)

## 🎯 Beneficios

- ✅ Sin transferencia internacional de datos de documentos/evidencia (LPDP Art. 21)
- ✅ Datos de OCR permanecen en infraestructura propia
- ✅ Compliance reforzado (principio de minimización Art. 7)
- ✅ Costo predecible (infra propia vs API externa)
- ✅ Sin dependencia de proveedor externo para visión

## 📦 Requerimientos de Infraestructura

### Modelo
- Modelo: `XiaomiMiMo/MiMo-V2.5` (open source, HuggingFace)
- Formato: FP4 / FP8 (quantizado para inferencia eficiente)
- Tamaño estimado: [30-80GB según cuantización]

### Hardware recomendado
| Componente | Mínimo | Recomendado |
|------------|--------|-------------|
| GPU | 16GB VRAM | 24-48GB VRAM (RTX 4090/A6000/A100) |
| RAM | 32GB | 64GB |
| Storage | 50GB | 100GB NVMe |
| CPU | 8 cores | 16 cores |

### Software
- vLLM (recomendado) u Ollama
- OpenAI-compatible API server
- Docker (para deploy)

## 🚀 Implementación

### Opción A: vLLM (recomendado)

```bash
# 1. Pull modelo
docker run --runtime nvidia --gpus all \
  -v ~/.cache/huggingface:/root/.cache/huggingface \
  -p 8000:8000 \
  --ipc=host \
  vllm/vllm-openai:latest \
  --model XiaomiMiMo/MiMo-V2.5 \
  --dtype float16 \
  --max-model-len 32768

# 2. Verificar
curl http://localhost:8000/v1/models
```

### Opción B: Ollama

```bash
# 1. Instalar Ollama
curl -fsSL https://ollama.com/install.sh | sh

# 2. Pull MiMo (si está en registry)
ollama pull mimo-v2.5

# 3. Servir
ollama serve
# Configurar OLLAMA_HOST=http://0.0.0.0:8000
```

## 🔄 Integración con LegalPro

### Actualizar .env

```bash
# Vision self-hosted (sin transferencia internacional)
MIMO_VISION_BASE_URL=http://localhost:8000/v1  # o IP del servidor
MIMO_VISION_MODEL=xiaomi/mimo-v2.5
MIMO_VISION_SELF_HOSTED=true
MIMO_VISION_API_KEY=local-any-key  # no requiere key real
```

### Actualizar visionClient.js

Agregar soporte para self-hosted (sin requerir API key real):

```js
// En visionClient.js, modificar isConfigured():
isConfigured: () => {
  if (process.env.MIMO_VISION_SELF_HOSTED === 'true') return true;
  return !!process.env.MIMO_VISION_API_KEY;
}
```

### Compliance LPDP

- Si self-hosted: **NO hay transferencia internacional** para visión
- Actualizar `docs/TRANSFERENCIA_INTERNACIONAL.md`: MiMo self-hosted = sin transferencia
- Actualizar `catalogs/disclaimers-ia.json`: proveedor `self_hosted` con nota "sin transferencia"

## 📊 Monitoreo

- GPU utilization: nvidia-smi / Grafana dashboard
- Latencia OCR: p95 < 3s
- Throughput: requests/min
- Alertas: GPU memory, latencia alta

## 💰 Costos Estimados

| Item | Costo |
|------|-------|
| GPU Cloud (A10G/24GB) | ~$0.80-1.50/hr |
| GPU Cloud (A100/40GB) | ~$2.00-3.50/hr |
| Dedicated server | $300-800/mes |
| **vs API externa (costo variable)** | **Costo fijo vs variable** |

**Break-even:** ~50K-100K OCR requests/mes

## 🎯 Roadmap

### Fase 1 (POC, 1 semana)
- [ ] Desplegar vLLM con MiMo V2.5 en GPU de prueba
- [ ] Validar calidad OCR vs API externa
- [ ] Medir latencia y throughput

### Fase 2 (Pilot, 2 semanas)
- [ ] Integrar visionClient self-hosted
- [ ] Test en staging con documentos reales
- [ ] Validar compliance LPDP

### Fase 3 (Producción, 2 semanas)
- [ ] Deploy en infraestructura dedicada
- [ ] Monitoreo + alertas
- [ ] Actualizar documentación LPDP
- [ ] Migrar 100% de tráfico de visión

## ⚠️ Riesgos y Mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Calidad OCR inferior a API | A/B testing antes de migrar 100% |
| GPU costos altos | Auto-scaling, spot instances |
| Mantenimiento del modelo | Versionado + rollback |
| Latencia en pico | Load balancing, queue |
| Falla de hardware | HA con 2 nodos |

## ✅ Criterio de Éxito

- [ ] OCR calidad ≥ 95% vs baseline
- [ ] Latencia p95 < 3s
- [ ] Uptime ≥ 99.5%
- [ ] Compliance LPDP Art. 21: sin transferencia para visión
- [ ] Costo < API externa (break-even)
