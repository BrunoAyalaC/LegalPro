using FluentValidation;
using MediatR;
using LegalPro.Application.Common.Behaviours;
using LegalPro.Application.Common.Interfaces;
using LegalPro.Domain.Entities;

namespace LegalPro.Application.Chat.Commands;

/// <summary>
/// Envía un mensaje al chat legal IA y lo persiste junto a la respuesta.
/// Si no se indica SesionId, se inicia una nueva sesión.
/// </summary>
public record EnviarMensajeChatCommand(
    string History,
    string UserInput,
    Guid? SesionId = null) : IRequest<ChatResult>, ITenantRequest
{
    public Guid OrganizationId => Guid.Empty;
}

public record ChatResult(string Respuesta, Guid SesionId);

public class EnviarMensajeChatValidator : AbstractValidator<EnviarMensajeChatCommand>
{
    public EnviarMensajeChatValidator()
    {
        RuleFor(x => x.UserInput).NotEmpty().WithMessage("El mensaje no puede estar vacío.");
    }
}

public class EnviarMensajeChatHandler : IRequestHandler<EnviarMensajeChatCommand, ChatResult>
{
    private readonly IMinimaxService _minimaxService;
    private readonly IApplicationDbContext _db;
    private readonly ICurrentUserService _currentUser;

    public EnviarMensajeChatHandler(
        IMinimaxService minimaxService,
        IApplicationDbContext db,
        ICurrentUserService currentUser)
    {
        _minimaxService = minimaxService;
        _db = db;
        _currentUser = currentUser;
    }

    public async Task<ChatResult> Handle(EnviarMensajeChatCommand request, CancellationToken cancellationToken)
    {
        var sesionId = request.SesionId ?? Guid.NewGuid();
        var userId = _currentUser.UserId
            ?? throw new UnauthorizedAccessException("Usuario no autenticado.");
        var orgId = _currentUser.OrganizationId;

        // Llamar a MiniMax IA
        var resultJson = await _minimaxService.ChatLegalAsync(request.History, request.UserInput);
        var doc = System.Text.Json.JsonDocument.Parse(resultJson);
        var root = doc.RootElement;
        var respuesta = root.TryGetProperty("respuesta", out var r) ? r.GetString() ?? "" : resultJson;

        // Persistir mensaje del usuario
        var msgUsuario = MensajeChat.Crear(userId, orgId, "user", request.UserInput, sesionId);
        // Persistir respuesta del asistente
        var msgAsistente = MensajeChat.Crear(userId, orgId, "assistant", respuesta, sesionId);

        _db.MensajesChat.Add(msgUsuario);
        _db.MensajesChat.Add(msgAsistente);
        await _db.SaveChangesAsync(cancellationToken);

        return new ChatResult(respuesta, sesionId);
    }
}
