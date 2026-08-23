using MediatR;
using Microsoft.AspNetCore.Mvc;
using LegalPro.Application.Auth.Commands;
using LegalPro.Application.Auth.Queries;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Configuration;

namespace LegalPro.Api.Controllers;

// ═══════════════════════════════════════════════════════
// SRP: Controller ONLY delegates to MediatR.
// DIP: No try/catch here — ExceptionHandlingMiddleware
//      handles ALL exceptions globally (DRY + SRP).
// ═══════════════════════════════════════════════════════
[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly IConfiguration _configuration;

    public AuthController(IMediator mediator, IConfiguration configuration)
    {
        _mediator = mediator;
        _configuration = configuration;
    }

    // R-03: __Secure-Session — HttpOnly, Secure, SameSite=Strict, Path=/api, MaxAge 60min alineado con JWT
    private void SetSecureSessionCookie(string token)
    {
        var expiryMinutes = int.TryParse(_configuration["JWT_EXPIRY_MINUTES"], out var m) ? m : 60;
        Response.Cookies.Append("__Secure-Session", token, new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.Strict,
            Path = "/api",
            MaxAge = TimeSpan.FromMinutes(expiryMinutes),
            IsEssential = true
        });
    }

    private void ClearSecureSessionCookie()
    {
        Response.Cookies.Delete("__Secure-Session", new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.Strict,
            Path = "/api"
        });
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterCommand command)
    {
        var token = await _mediator.Send(command);
        SetSecureSessionCookie(token);
        return Ok(new { Token = token, Mensaje = "Usuario registrado exitosamente." });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginQuery query)
    {
        var token = await _mediator.Send(query);
        SetSecureSessionCookie(token);
        return Ok(new { token, mensaje = "Login exitoso." });
    }

    [HttpPost("logout")]
    [Authorize]
    public IActionResult Logout()
    {
        ClearSecureSessionCookie();
        return Ok(new { mensaje = "Sesión cerrada." });
    }

    /// <summary>
    /// Rota el refresh token: invalida el anterior y emite uno nuevo junto con un nuevo JWT.
    /// Implementa rotación segura según RFC 6819 §5.2.2.3.
    /// </summary>
    [HttpPost("refresh")]
    [AllowAnonymous]
    public async Task<IActionResult> Refresh([FromBody] RefreshTokenCommand command)
    {
        var result = await _mediator.Send(command);
        return Ok(new
        {
            accessToken = result.AccessToken,
            refreshToken = result.NewRefreshToken,
            expiresAt = result.ExpiresAt,
        });
    }

    // ── GET /api/auth/me ──────────────────────────────────────────────────
    // Retorna los datos del usuario autenticado basado en el JWT token.
    // ─────────────────────────────────────────────────────────────────────
    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> Me(CancellationToken ct)
    {
        var dto = await _mediator.Send(new GetCurrentUserQuery(), ct);
        return Ok(dto);
    }
}
