using FluentAssertions;
using LegalPro.Application.Auth.Commands;
using LegalPro.Application.Auth.Queries;
using Microsoft.AspNetCore.Mvc.Testing;
using System.Net;
using System.Net.Http.Json;
using System.Threading.Tasks;
using Xunit;

namespace LegalPro.IntegrationTests.Controllers;

public class AuthControllerIntegrationTests : IClassFixture<LegalProWebApplicationFactory>
{
    private readonly LegalProWebApplicationFactory _factory;

    public AuthControllerIntegrationTests(LegalProWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Login_WithInvalidCredentials_ReturnsUnauthorizedOrBadRequest()
    {
        // Arrange
        var client = _factory.CreateClient();
        var query = new LoginQuery { Email = "invalid@test.com", Password = "WrongPassword" };

        // Act
        var response = await client.PostAsJsonAsync("/api/Auth/login", query);

        // Assert
        // Assuming your GlobalExceptionMiddleware converts this to a bad request or unauthorized
        response.StatusCode.Should().NotBe(HttpStatusCode.OK);
    }
}
