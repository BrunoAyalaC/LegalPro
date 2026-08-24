using Microsoft.AspNetCore.Http;

namespace LegalPro.Infrastructure.Services;

/// <summary>
/// FIX anti-mock B (2026-08-24): reenvía el JWT del llamador al backend Node
/// (cliente HTTP "nodeapi") para que /api/ai/jurisprudencia aplique SU RBAC,
/// quota y aislamiento multi-tenant al usuario real — identidad extremo a extremo.
///
/// Sin request entrante (p.ej. background job) no agrega header → Node responde
/// 401 → el handler CompararPrecedentes hace fail-open a lista vacía y responde
/// honestamente sin jurisprudencia verificable.
/// </summary>
public sealed class NodeApiAuthForwardHandler : DelegatingHandler
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public NodeApiAuthForwardHandler(IHttpContextAccessor httpContextAccessor)
        => _httpContextAccessor = httpContextAccessor;

    protected override Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var authorization = _httpContextAccessor.HttpContext?.Request.Headers.Authorization.ToString();
        if (!string.IsNullOrWhiteSpace(authorization))
            request.Headers.TryAddWithoutValidation("Authorization", authorization);

        return base.SendAsync(request, cancellationToken);
    }
}
