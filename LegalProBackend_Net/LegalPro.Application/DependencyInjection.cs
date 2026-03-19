using System.Reflection;
using FluentValidation;
using MediatR;
using Microsoft.Extensions.DependencyInjection;
using LegalPro.Application.Common.Behaviours;

namespace LegalPro.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplicationServices(this IServiceCollection services)
    {
        // MediatR: auto-scan all handlers in this assembly
        services.AddMediatR(cfg =>
        {
            cfg.RegisterServicesFromAssembly(Assembly.GetExecutingAssembly());
        });

        // FluentValidation: auto-scan all validators in this assembly
        services.AddValidatorsFromAssembly(Assembly.GetExecutingAssembly());

        // MediatR Pipeline Behaviours (order matters!)
        // 1. Logging (primero — registra TODO incluyendo errores de validación)
        services.AddTransient(typeof(IPipelineBehavior<,>), typeof(LoggingBehaviour<,>));
        // 2. Unhandled exceptions → respuesta uniforme
        services.AddTransient(typeof(IPipelineBehavior<,>), typeof(UnhandledExceptionBehaviour<,>));
        // 3. Tenant isolation — verifica OrganizationId ANTES de validar inputs
        services.AddTransient(typeof(IPipelineBehavior<,>), typeof(TenantValidationBehavior<,>));
        // 4. FluentValidation
        services.AddTransient(typeof(IPipelineBehavior<,>), typeof(ValidationBehaviour<,>));
        // 5. Plan limits — verifica cuotas ANTES de ejecutar el handler
        services.AddTransient(typeof(IPipelineBehavior<,>), typeof(PlanLimitsBehavior<,>));

        return services;
    }
}
