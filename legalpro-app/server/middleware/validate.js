/**
 * Middleware de validación con Zod para Express.
 * Valida req.body contra el esquema proporcionado.
 */
export function validate(schema) {
  return (req, res, next) => {
    try {
      const result = schema.safeParse(req.body);
      if (!result.success) {
        const issues = result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        }));
        return res.status(400).json({ success: false, error: 'Datos de entrada inválidos.', details: issues, code: 'VALIDATION_ERROR' });
      }
      // Reemplazar req.body por los datos parseados (aplica defaults, transformaciones, etc.)
      req.body = result.data;
      next();
    } catch (err) {
      return res.status(400).json({ success: false, error: 'Error de validación.', message: err.message, code: 'VALIDATION_ERROR' });
    }
  };
}

export function validateQuery(schema) {
  return (req, res, next) => {
    try {
      const result = schema.safeParse(req.query);
      if (!result.success) {
        const issues = result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        }));
        return res.status(400).json({ success: false, error: 'Parámetros de consulta inválidos.', details: issues, code: 'VALIDATION_ERROR' });
      }
      req.query = result.data;
      next();
    } catch (err) {
      return res.status(400).json({ success: false, error: 'Error de validación query.', message: err.message, code: 'VALIDATION_ERROR' });
    }
  };
}
