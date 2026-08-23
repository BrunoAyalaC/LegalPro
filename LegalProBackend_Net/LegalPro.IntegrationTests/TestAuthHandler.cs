using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System.Security.Claims;
using System.Text.Encodings.Web;

namespace LegalPro.IntegrationTests;

/// <summary>
/// Authentication handler de testing: autentica cualquier request automáticamente
/// con un usuario ficticio. Permite que los integration tests de endpoints protegidos
/// (MiniMax, Chat, etc.) corran sin depender de JWT reales ni base de datos.
/// </summary>
public class TestAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
    public const string SchemeName = "Test";

    public TestAuthHandler(
        IOptionsMonitor<AuthenticationSchemeOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder)
        : base(options, logger, encoder)
    {
    }

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var testOrgId = "11111111-1111-1111-1111-111111111111";
        var testUserId = "22222222-2222-2222-2222-222222222222";

        var claims = new[]
        {
            new Claim("sub", testUserId),
            new Claim("organization_id", testOrgId),
            new Claim("email", "test@legalpro.test"),
            // "rol" replica el claim emitido por Node.js (legalpro-app/server/utils/jwt.js)
            new Claim("rol", "Abogado"),
            new Claim("role", "Abogado"),
            new Claim("is_org_admin", "true"),
            new Claim("org_slug", "test-org")
        };

        var identity = new ClaimsIdentity(claims, SchemeName);
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, SchemeName);

        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}
