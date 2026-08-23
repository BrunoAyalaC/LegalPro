// legalpro-app/server/routes/legal-multigent-routes.js
// Endpoint principal para consultas legales multi-agente
// Generado por @arquitecto-chief

import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { processLegalQuery, streamLegalQuery } from '../legal-orchestrator.js';
import { logAudit } from '../utils/audit.js';
import { quotaMiddleware } from '../middleware/quotaMiddleware.js';

const router = Router();

// POST /api/legal/query - consulta legal multi-agente
router.post('/query',
  authMiddleware,
  quotaMiddleware('legal_query'),
  async (req, res) => {
    try {
      const { query, context = {}, options = {} } = req.body;
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ success: false, error: 'query required' });
      }

      const result = await processLegalQuery(
        query,
        {
          userId: req.user?.sub ?? req.user?.userId,
          organizationId: req.organizationId ?? req.user?.organization_id,
          role: req.user?.rol,
          ip: req.ip,
          ...context
        },
        options
      );

      res.json({ success: true, data: result });
    } catch (e) {
      console.error('[legal.query]', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }
);

// POST /api/legal/query/stream - streaming
router.post('/query/stream',
  authMiddleware,
  quotaMiddleware('legal_query'),
  async (req, res) => {
    try {
      const { query, context = {} } = req.body;
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ success: false, error: 'query required' });
      }

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const ctx = {
        userId: req.user?.sub ?? req.user?.userId,
        organizationId: req.organizationId ?? req.user?.organization_id,
        role: req.user?.rol,
        ip: req.ip,
        ...context
      };

      for await (const event of streamLegalQuery(query, ctx)) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
      res.end();
    } catch (e) {
      console.error('[legal.query.stream]', e);
      res.status(500).end();
    }
  }
);

// GET /api/legal/health
router.get('/health', async (req, res) => {
  res.json({ status: 'ok', orchestrator: 'ready' });
});

export default router;
