# Auditoria de Cobertura Backend <-> UI -- LegalPro

**Endpoints backend totales:** 119 (Node: 78, .NET: 41)

**Frontend API calls unicos:** 41

**Cobertura global:** **43/119 = 36.1%**

## Cobertura por modulo

| Modulo | Cubiertos | Total | % | Status |
|---|---|---|---|---|
| analista | 1 | 1 | 100.0% | FULL |
| contador | 2 | 2 | 100.0% | FULL |
| auth | 13 | 18 | 72.2% | PARCIAL |
| mis-datos | 4 | 6 | 66.7% | PARCIAL |
| plazos | 2 | 3 | 66.7% | PARCIAL |
| creditos | 3 | 5 | 60.0% | PARCIAL |
| notificaciones | 1 | 2 | 50.0% | PARCIAL |
| simulacion | 2 | 4 | 50.0% | PARCIAL |
| expedientes | 7 | 17 | 41.2% | PARCIAL |
| clientes | 2 | 5 | 40.0% | PARCIAL |
| documentos | 1 | 3 | 33.3% | PARCIAL |
| organizaciones | 4 | 13 | 30.8% | PARCIAL |
| ai | 1 | 14 | 7.1% | PARCIAL |
| admin | 0 | 3 | 0.0% | NO UI |
| alegato | 0 | 1 | 0.0% | NO UI |
| chat | 0 | 3 | 0.0% | NO UI |
| creditos-uso | 0 | 1 | 0.0% | NO UI |
| fiscal | 0 | 1 | 0.0% | NO UI |
| gemini | 0 | 4 | 0.0% | NO UI |
| interrogatorio | 0 | 1 | 0.0% | NO UI |
| juez | 0 | 2 | 0.0% | NO UI |
| jurisprudencia | 0 | 2 | 0.0% | NO UI |
| legal | 0 | 5 | 0.0% | NO UI |
| objeciones | 0 | 1 | 0.0% | NO UI |
| predictor | 0 | 1 | 0.0% | NO UI |
| redactor | 0 | 1 | 0.0% | NO UI |

## Top endpoints backend SIN UI (priorizados)

1. `[node] GET /api/admin/catalogos/status` -- modulo: `admin` (archivo: `admin.js`)
2. `[node] GET /api/admin/health` -- modulo: `admin` (archivo: `admin.js`)
3. `[node] POST /api/admin/update-catalogos` -- modulo: `admin` (archivo: `admin.js`)
4. `[node] DELETE /api/ai/historial` -- modulo: `ai` (archivo: `ai.js`)
5. `[node] GET /api/ai/historial` -- modulo: `ai` (archivo: `ai.js`)
6. `[node] GET /api/ai/jurisprudencia` -- modulo: `ai` (archivo: `ai.js`)
7. `[node] GET /api/ai/notificaciones` -- modulo: `ai` (archivo: `ai.js`)
8. `[node] GET /api/gemini/historial` -- modulo: `ai` (archivo: `gemini.js`)
9. `[node] GET /api/gemini/jurisprudencia` -- modulo: `ai` (archivo: `gemini.js`)
10. `[node] GET /api/gemini/notificaciones` -- modulo: `ai` (archivo: `gemini.js`)
11. `[node] POST /api/ai/consulta` -- modulo: `ai` (archivo: `ai.js`)
12. `[node] POST /api/ai/consulta/stream` -- modulo: `ai` (archivo: `ai.js`)
13. `[node] POST /api/ai/panel-expertos` -- modulo: `ai` (archivo: `ai.js`)
14. `[node] POST /api/ai/panel-expertos/stream` -- modulo: `ai` (archivo: `ai.js`)
15. `[node] POST /api/gemini/chat` -- modulo: `ai` (archivo: `gemini.js`)
16. `[node] POST /api/gemini/consulta` -- modulo: `ai` (archivo: `gemini.js`)
17. `[node] DELETE /api/auth/cuenta` -- modulo: `auth` (archivo: `auth.js`)
18. `[node] POST /api/auth/login/mfa` -- modulo: `auth` (archivo: `auth-login-mfa.js`)
19. `[node] POST /api/auth/mfa/verify-enable` -- modulo: `auth` (archivo: `auth-mfa-routes.js`)
20. `[node] POST /api/auth/refresh` -- modulo: `auth` (archivo: `auth-login-mfa.js`)
21. `[node] GET /api/clientes/` -- modulo: `clientes` (archivo: `clientes.js`)
22. `[node] GET /api/clientes/:id` -- modulo: `clientes` (archivo: `clientes.js`)
23. `[node] POST /api/clientes/` -- modulo: `clientes` (archivo: `clientes.js`)
24. `[node] GET /api/creditos/culqi-key` -- modulo: `creditos` (archivo: `creditos.js`)
25. `[node] GET /api/creditos/saldo` -- modulo: `creditos` (archivo: `creditos.js`)
26. `[node] GET /api/creditos/uso` -- modulo: `creditos-uso` (archivo: `creditos-uso.js`)
27. `[node] POST /api/documentos/exportar` -- modulo: `documentos` (archivo: `documentos.js`)
28. `[node] POST /api/documentos/exportar-pdf` -- modulo: `documentos` (archivo: `documentos.js`)
29. `[node] GET /api/expedientes/` -- modulo: `expedientes` (archivo: `expedientes-secure.js`)
30. `[node] GET /api/expedientes/` -- modulo: `expedientes` (archivo: `expedientes.js`)
31. `[node] POST /api/expedientes/` -- modulo: `expedientes` (archivo: `expedientes-secure.js`)
32. `[node] POST /api/expedientes/` -- modulo: `expedientes` (archivo: `expedientes.js`)
33. `[node] PUT /api/expedientes/:id` -- modulo: `expedientes` (archivo: `expedientes-secure.js`)
34. `[node] PUT /api/expedientes/:id` -- modulo: `expedientes` (archivo: `expedientes.js`)
35. `[node] GET /api/legal/health` -- modulo: `legal` (archivo: `legal-multigent-routes.js`)
36. `[node] GET /api/legal/interpret/health` -- modulo: `legal` (archivo: `interpretacion-legal.js`)
37. `[node] POST /api/legal/interpret` -- modulo: `legal` (archivo: `interpretacion-legal.js`)
38. `[node] POST /api/legal/query` -- modulo: `legal` (archivo: `legal-multigent-routes.js`)
39. `[node] POST /api/legal/query/stream` -- modulo: `legal` (archivo: `legal-multigent-routes.js`)
40. `[node] GET /api/mis-datos/` -- modulo: `mis-datos` (archivo: `datos-personales.js`)
41. `[node] PUT /api/mis-datos/` -- modulo: `mis-datos` (archivo: `datos-personales.js`)
42. `[node] GET /api/notificaciones/` -- modulo: `notificaciones` (archivo: `notificaciones.js`)
43. `[node] DELETE /api/organizaciones/me/miembros/:targetUserId` -- modulo: `organizaciones` (archivo: `organizaciones.js`)
44. `[node] GET /api/organizaciones/me/miembros` -- modulo: `organizaciones` (archivo: `organizaciones.js`)
45. `[node] POST /api/organizaciones/` -- modulo: `organizaciones` (archivo: `organizaciones.js`)
46. `[node] POST /api/organizaciones/invitar` -- modulo: `organizaciones` (archivo: `organizaciones.js`)
47. `[node] GET /api/plazos/catalogo` -- modulo: `plazos` (archivo: `plazos.js`)
48. `[dotnet] POST api/alegato/generar` -- modulo: `alegato` (archivo: `AlegatoController.cs`)
49. `[dotnet] POST api/auth/refresh` -- modulo: `auth` (archivo: `AuthController.cs`)
50. `[dotnet] GET api/chat/historial` -- modulo: `chat` (archivo: `ChatController.cs`)
51. `[dotnet] GET api/chat/sesiones` -- modulo: `chat` (archivo: `ChatController.cs`)
52. `[dotnet] POST api/chat/enviar` -- modulo: `chat` (archivo: `ChatController.cs`)
53. `[dotnet] DELETE api/expedientes/{id:guid}` -- modulo: `expedientes` (archivo: `ExpedientesController.cs`)
54. `[dotnet] GET api/expedientes/{id:guid}` -- modulo: `expedientes` (archivo: `ExpedientesController.cs`)
55. `[dotnet] GET api/expedientes/{id:guid}/resumen-ia` -- modulo: `expedientes` (archivo: `ExpedientesController.cs`)
56. `[dotnet] PUT api/expedientes/{id:guid}` -- modulo: `expedientes` (archivo: `ExpedientesController.cs`)
57. `[dotnet] POST api/fiscal/requerimiento` -- modulo: `fiscal` (archivo: `FiscalController.cs`)
58. `[dotnet] GET api/gemini/historial` -- modulo: `gemini` (archivo: `GeminiController.cs`)
59. `[dotnet] GET api/gemini/jurisprudencia` -- modulo: `gemini` (archivo: `GeminiController.cs`)
60. `[dotnet] POST api/gemini/chat` -- modulo: `gemini` (archivo: `GeminiController.cs`)
61. `[dotnet] POST api/gemini/consulta` -- modulo: `gemini` (archivo: `GeminiController.cs`)
62. `[dotnet] POST api/interrogatorio/generar` -- modulo: `interrogatorio` (archivo: `InterrogatorioController.cs`)
63. `[dotnet] POST api/juez/precedentes/comparar` -- modulo: `juez` (archivo: `JuezController.cs`)
64. `[dotnet] POST api/juez/resolucion` -- modulo: `juez` (archivo: `JuezController.cs`)
65. `[dotnet] GET api/jurisprudencia/buscar` -- modulo: `jurisprudencia` (archivo: `JurisprudenciaController.cs`)
66. `[dotnet] POST api/jurisprudencia/buscar` -- modulo: `jurisprudencia` (archivo: `JurisprudenciaController.cs`)
67. `[dotnet] POST api/objeciones/sugerir` -- modulo: `objeciones` (archivo: `ObjecionesController.cs`)
68. `[dotnet] DELETE api/organizaciones/members/{usuarioId:guid}` -- modulo: `organizaciones` (archivo: `OrganizacionesController.cs`)
69. `[dotnet] GET api/organizaciones/me/miembros` -- modulo: `organizaciones` (archivo: `OrganizacionesController.cs`)
70. `[dotnet] POST api/organizaciones/accept-invite` -- modulo: `organizaciones` (archivo: `OrganizacionesController.cs`)
71. `[dotnet] POST api/organizaciones/invitar` -- modulo: `organizaciones` (archivo: `OrganizacionesController.cs`)
72. `[dotnet] POST api/organizaciones/invite` -- modulo: `organizaciones` (archivo: `OrganizacionesController.cs`)
73. `[dotnet] POST api/predictor/predecir` -- modulo: `predictor` (archivo: `PredictorController.cs`)
74. `[dotnet] POST api/redactor/generar` -- modulo: `redactor` (archivo: `RedactorController.cs`)
75. `[dotnet] GET api/simulacion/{id:guid}/board` -- modulo: `simulacion` (archivo: `SimulacionController.cs`)
76. `[dotnet] POST api/simulacion/{id:guid}/finalizar` -- modulo: `simulacion` (archivo: `SimulacionController.cs`)

## Recomendaciones

- **Auth/AI sin UI**: gaps visibles -- integrar MFA setup/verify, Aceptar invitacion, AI consulta/stream/panel-expertos, Jurisprudencia, Legal query/stream.
- **Endpoints admin** (`/api/admin/*`, `/api/creditos/culqi-key`, `/api/organizaciones/me/miembros`) suelen ser del owner-dashboard -- confirmar UI principal vs portal owner.
- **.NET orquestadores** (`/api/chat/enviar`, `/api/chat/sesiones`, `/api/simulacion/*`, `/api/redactor/*`, `/api/jurisprudencia/buscar`) requieren pantalla o hook en cliente.ts.
- **Path-params normalizados** -- al armar UI, usar URLs exactas detectadas (con `{id}` como placeholder).
