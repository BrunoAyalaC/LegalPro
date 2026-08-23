"""Audit Backend <-> UI coverage for LegalPro."""
from __future__ import annotations
import os, re, json
from pathlib import Path
from collections import defaultdict

ROOT = Path("C:/Users/Pc/Desktop/Abogacia")
NODE_ROUTES_DIR = ROOT / "legalpro-app/server/routes"
NET_CTRL_DIR = ROOT / "LegalProBackend_Net/LegalPro.Api/Controllers"
NODE_INDEX = ROOT / "legalpro-app/server/index.js"
FRONTEND_SRC = ROOT / "legalpro-app/src"


def normalize_path(method, path):
    p = path.strip().split("?")[0].split("#")[0]
    p = re.sub(r"\{[A-Za-z_][\w]*(:[A-Za-z_]+)?\}", "{id}", p)
    p = re.sub(r":[A-Za-z_][\w]*", "{id}", p)
    p = re.sub(r"\$\{[^}]+\}", "{id}", p)
    p = re.sub(r"/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f-]{27,}", "/{id}", p, flags=re.I)
    p = p.rstrip("/") or "/"
    return f"{method.upper()} {p}".lower()


M_NODE = {
    "admin":"admin","ai":"ai","auth":"auth","auth-login-mfa":"auth",
    "auth-mfa-routes":"auth","clientes":"clientes","creditos":"creditos",
    "datos-personales":"mis-datos","documentos":"documentos",
    "expedientes":"expedientes","expedientes-secure":"expedientes",
    "gemini":"ai","interpretacion-legal":"legal",
    "legal-multigent-routes":"legal","notificaciones":"notificaciones",
    "organizaciones":"organizaciones","plazos":"plazos",
}
M_NET = {
    "Alegato":"alegato","Analista":"analista","Auth":"auth",
    "Chat":"chat","Contador":"contador","Documentos":"documentos",
    "Expedientes":"expedientes","Fiscal":"fiscal","Gemini":"gemini",
    "Interrogatorio":"interrogatorio","Juez":"juez",
    "Jurisprudencia":"jurisprudencia","Notificaciones":"notificaciones",
    "Objeciones":"objeciones","Organizaciones":"organizaciones",
    "Plazos":"plazos","Predictor":"predictor","Redactor":"redactor",
    "Simulacion":"simulacion",
}
RX_ROUTE = re.compile(r"router\.(get|post|put|patch|delete)\s*\(\s*['\"`]([^'\"`]+)['\"`]", re.I)


def parse_mount():
    out = {}
    txt = NODE_INDEX.read_text(encoding="utf-8")
    for m in re.finditer(r"app\.use\(['\"`]([^'\"`]+)['\"`]\s*,[^)]*?(\w+Routes)\)", txt):
        out[m.group(2)] = m.group(1)
    return out


mounts = parse_mount()
file_prefix = {}
for fn in os.listdir(NODE_ROUTES_DIR):
    if not fn.endswith(".js"):
        continue
    stem = Path(fn).stem
    var = None
    for cand in (f"{stem}Routes", stem):
        if cand in mounts:
            var = cand
            break
    file_prefix[fn] = mounts.get(var) if var else None
file_prefix["ai.js"] = "/api/ai"
file_prefix["gemini.js"] = "/api/gemini"
file_prefix["legal-multigent-routes.js"] = "/api/legal"
file_prefix["interpretacion-legal.js"] = "/api/legal"
file_prefix["auth-login-mfa.js"] = "/api/auth"
file_prefix["auth-mfa-routes.js"] = "/api/auth"
file_prefix["expedientes-secure.js"] = "/api/expedientes"
file_prefix["datos-personales.js"] = "/api/mis-datos"
file_prefix["creditos-uso.js"] = "/api/creditos"

node_eps = []
for f in sorted(NODE_ROUTES_DIR.glob("*.js")):
    txt = f.read_text(encoding="utf-8")
    mod = M_NODE.get(f.stem, f.stem)
    for m in RX_ROUTE.finditer(txt):
        verb = m.group(1).upper()
        rel = m.group(2)
        pref = file_prefix.get(f.name) or ""
        node_eps.append({"backend":"node","method":verb,"full_path":pref+rel,
                         "rel_path":rel,"module":mod,"file":f.name})


RX_VERB = re.compile(r"\[(HttpGet|HttpPost|HttpPut|HttpPatch|HttpDelete)\s*\(\s*\"([^\"]*)\"\s*\)\]")
RX_CTRL = re.compile(r"\[Route\(\s*\"([^\"]+)\"\s*\)\]")

net_eps = []
for f in sorted(NET_CTRL_DIR.glob("*.cs")):
    txt = f.read_text(encoding="utf-8")
    base = "api/[controller]"
    rm = RX_CTRL.search(txt)
    if rm:
        base = rm.group(1)
    cname = f.stem.replace("Controller","")
    base_r = base.replace("[controller]", cname.lower())
    mod = M_NET.get(cname, cname.lower())
    for m in RX_VERB.finditer(txt):
        verb = m.group(1).replace("Http","").upper()
        sub = m.group(2)
        if sub.startswith("/"):
            full = base_r + sub
        elif sub == "":
            full = base_r
        else:
            full = base_r + "/" + sub
        net_eps.append({"backend":"dotnet","method":verb,"full_path":full,
                        "rel_path":sub,"module":mod,"file":f.name})


RX_FE = re.compile(r"(nodeClient|dotnetClient)\.(get|post|put|patch|delete)\s*\(\s*(['\"`])([^'\"`]+)", re.I)
fe_set = set()
for p in FRONTEND_SRC.rglob("*"):
    if p.is_file() and p.suffix in {".ts",".tsx",".js",".jsx"}:
        try:
            txt = p.read_text(encoding="utf-8")
        except Exception:
            continue
        for m in RX_FE.finditer(txt):
            fe_set.add(normalize_path(m.group(2).upper(), m.group(4)))

fe_by_method = defaultdict(set)
for n in fe_set:
    method, pp = n.split(" ", 1)
    fe_by_method[method].add(pp)


def matches(method, full):
    if normalize_path(method, full) in fe_set:
        return True
    for c in fe_by_method.get(method.lower(), set()):
        if c == full.lower():
            return True
        a = c.lstrip("/").removeprefix("api/")
        b = full.lower().lstrip("/").removeprefix("api/")
        if a == b:
            return True
    return False


all_eps = node_eps + net_eps
covered, uncovered = [], []
for ep in all_eps:
    (covered if matches(ep["method"], ep["full_path"]) else uncovered).append(ep)

mod_stats = defaultdict(lambda: {"covered":0,"uncovered":0,"list":[]})
for ep in all_eps:
    if ep in covered:
        mod_stats[ep["module"]]["covered"] += 1
    else:
        mod_stats[ep["module"]]["uncovered"] += 1
        mod_stats[ep["module"]]["list"].append(ep)


total = len(all_eps)
cov = len(covered)
pct = (cov/total*100) if total else 0.0

print("=" * 78)
print(" AUDITORIA DE COBERTURA BACKEND <-> UI -- LegalPro")
print("=" * 78)
print(f"Backend endpoints totales: {total}")
print(f"  - Node (Express):        {len(node_eps)}")
print(f"  - .NET (Controllers):    {len(net_eps)}")
print(f"Frontend API calls unicos:  {len(fe_set)}")
print(f"Endpoints backend cubiertos por UI: {cov}/{total} ({pct:.1f}%)")
print()
print("-- Cobertura por modulo --")
print(f"{'MODULO':<22}{'COV':>6}{'TOTAL':>8}{'%':>8}  STATUS")
print("-" * 78)
sorted_mods = sorted(mod_stats.items(), key=lambda kv:(-(kv[1]["covered"]/(kv[1]["covered"]+kv[1]["uncovered"]) if (kv[1]["covered"]+kv[1]["uncovered"]) else 1), kv[0]))
for name, s in sorted_mods:
    tot = s["covered"] + s["uncovered"]
    p = (s["covered"]/tot*100) if tot else 0
    st = "FULL" if s["uncovered"]==0 else ("PARCIAL" if s["covered"]>0 else "NO UI")
    print(f"{name:<22}{s['covered']:>6}{tot:>8}{p:>7.1f}%  {st}")

print()
print("-- Top endpoints backend sin UI (priorizados) --")
prio = sorted(uncovered, key=lambda e: ({"node":0,"dotnet":1}[e["backend"]], e["module"], e["method"], e["full_path"]))
for i, ep in enumerate(prio[:30], 1):
    print(f"{i:>3}. [{ep['backend']:6}] {ep['method']:<7} {ep['full_path']:<55} ({ep['module']})")
print(f"... y {max(0,len(uncovered)-30)} mas")


out = {
    "summary":{"total_backend":total,"node_endpoints":len(node_eps),
               "dotnet_endpoints":len(net_eps),"frontend_calls_unique":len(fe_set),
               "covered":cov,"uncovered":len(uncovered),"coverage_pct":round(pct,2)},
    "by_module":{m:{"covered":s["covered"],"uncovered":s["uncovered"],
                     "pct":round((s["covered"]/(s["covered"]+s["uncovered"])*100) if (s["covered"]+s["uncovered"]) else 0, 1),
                     "uncovered_endpoints":[{"method":e["method"],"path":e["full_path"],"file":e["file"]} for e in s["list"]]}
                 for m,s in mod_stats.items()},
    "uncovered_full":[{"backend":e["backend"],"method":e["method"],"path":e["full_path"],
                      "module":e["module"],"file":e["file"]} for e in uncovered],
}
out_path = ROOT / "reports/coverage-audit.json"
out_path.parent.mkdir(parents=True, exist_ok=True)
out_path.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
print(f"\n[JSON] -> {out_path}")

md = ["# Auditoria de Cobertura Backend <-> UI -- LegalPro\n\n"]
md.append(f"**Endpoints backend totales:** {total} (Node: {len(node_eps)}, .NET: {len(net_eps)})\n\n")
md.append(f"**Frontend API calls unicos:** {len(fe_set)}\n\n")
md.append(f"**Cobertura global:** **{cov}/{total} = {pct:.1f}%**\n\n")
md.append("## Cobertura por modulo\n\n| Modulo | Cubiertos | Total | % | Status |\n|---|---|---|---|---|\n")
for name, s in sorted_mods:
    tot = s["covered"] + s["uncovered"]
    p = (s["covered"]/tot*100) if tot else 0
    st = "FULL" if s["uncovered"]==0 else ("PARCIAL" if s["covered"]>0 else "NO UI")
    md.append(f"| {name} | {s['covered']} | {tot} | {p:.1f}% | {st} |\n")
md.append("\n## Top endpoints backend SIN UI (priorizados)\n\n")
for i, ep in enumerate(prio, 1):
    md.append(f"{i}. `[{ep['backend']}] {ep['method']} {ep['full_path']}` -- modulo: `{ep['module']}` (archivo: `{ep['file']}`)\n")
md.append("\n## Recomendaciones\n\n")
md.append("- **Auth/AI sin UI**: gaps visibles -- integrar MFA setup/verify, Aceptar invitacion, AI consulta/stream/panel-expertos, Jurisprudencia, Legal query/stream.\n")
md.append("- **Endpoints admin** (`/api/admin/*`, `/api/creditos/culqi-key`, `/api/organizaciones/me/miembros`) suelen ser del owner-dashboard -- confirmar UI principal vs portal owner.\n")
md.append("- **.NET orquestadores** (`/api/chat/enviar`, `/api/chat/sesiones`, `/api/simulacion/*`, `/api/redactor/*`, `/api/jurisprudencia/buscar`) requieren pantalla o hook en cliente.ts.\n")
md.append("- **Path-params normalizados** -- al armar UI, usar URLs exactas detectadas (con `{id}` como placeholder).\n")
md_path = ROOT / "reports/coverage-audit.md"
md_path.write_text("".join(md), encoding="utf-8")
print(f"[MD]   -> {md_path}")
