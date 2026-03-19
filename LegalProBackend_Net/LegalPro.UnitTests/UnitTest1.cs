using FluentAssertions;
using FluentValidation;
using LegalPro.Application.Analisis.Commands;
using LegalPro.Application.Chat.Commands;
using LegalPro.Application.Prediccion.Queries;
using LegalPro.Application.Redactor.Commands;

namespace LegalPro.UnitTests;

// ═══════════════════════════════════════════════════════════════════════
// TESTS DE VALIDADORES — Sin mocks. FluentValidation es lógica pura.
// No requieren DB ni Gemini. Corren 100% offline y en milisegundos.
// ═══════════════════════════════════════════════════════════════════════

public class AnalizarExpedienteValidatorTests
{
    private readonly AnalizarExpedienteValidator _sut = new();

    [Fact]
    public void Deberia_Fallar_Cuando_TextoExpediente_Esta_Vacio()
    {
        var command = new AnalizarExpedienteCommand("");
        var result = _sut.Validate(command);

        result.IsValid.Should().BeFalse();
        // Texto vacío dispara NotEmpty + MinimumLength → múltiples errores sobre el mismo campo
        result.Errors.Should().Contain(e => e.PropertyName == "TextoExpediente");
    }

    [Fact]
    public void Deberia_Fallar_Cuando_TextoExpediente_Es_Muy_Corto()
    {
        var command = new AnalizarExpedienteCommand("corto");
        var result = _sut.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "TextoExpediente"
            && e.ErrorMessage.Contains("20 caracteres"));
    }

    [Fact]
    public void Deberia_Pasar_Con_Texto_Valido()
    {
        var command = new AnalizarExpedienteCommand(
            "El acusado fue detenido el 5 de enero de 2025 por presunto delito de robo agravado NCPP art. 189.");
        var result = _sut.Validate(command);

        result.IsValid.Should().BeTrue();
    }
}

public class EnviarMensajeChatValidatorTests
{
    private readonly EnviarMensajeChatValidator _sut = new();

    [Fact]
    public void Deberia_Fallar_Cuando_UserInput_Esta_Vacio()
    {
        var command = new EnviarMensajeChatCommand(History: "", UserInput: "");
        var result = _sut.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().ContainSingle(e => e.PropertyName == "UserInput");
    }

    [Fact]
    public void Deberia_Pasar_Con_UserInput_Valido()
    {
        var command = new EnviarMensajeChatCommand(History: "", UserInput: "¿Cuál es el plazo para apelar?");
        var result = _sut.Validate(command);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Deberia_Pasar_Con_History_Vacio_Y_UserInput_Relleno()
    {
        var command = new EnviarMensajeChatCommand(History: "", UserInput: "Explícame el NCPP artículo 71");
        var result = _sut.Validate(command);

        result.IsValid.Should().BeTrue();
    }
}

public class PredecirResultadoValidatorTests
{
    private readonly PredecirResultadoValidator _sut = new();

    [Fact]
    public void Deberia_Fallar_Cuando_HechosCausa_Esta_Vacio()
    {
        var query = new PredecirResultadoQuery(
            HechosCausa: "",
            Materia: "Penal",
            JuzgadoSala: "1er Juzgado",
            JuezAsignado: "Dr. García");
        var result = _sut.Validate(query);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "HechosCausa");
    }

    [Fact]
    public void Deberia_Fallar_Cuando_Materia_Esta_Vacia()
    {
        var query = new PredecirResultadoQuery(
            HechosCausa: "El acusado fue detenido en flagrancia con evidencia material",
            Materia: "",
            JuzgadoSala: "",
            JuezAsignado: "");
        var result = _sut.Validate(query);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Materia");
    }

    [Fact]
    public void Deberia_Pasar_Con_Datos_Validos()
    {
        var query = new PredecirResultadoQuery(
            HechosCausa: "Imputado detenido con 50g de PBC en boulevard de Arequipa",
            Materia: "Penal",
            JuzgadoSala: "2do Juzgado Penal Lima",
            JuezAsignado: "Dra. López");
        var result = _sut.Validate(query);

        result.IsValid.Should().BeTrue();
    }
}

public class GenerarBorradorValidatorTests
{
    private readonly GenerarBorradorValidator _sut = new();

    [Fact]
    public void Deberia_Fallar_Cuando_TipoEscrito_Esta_Vacio()
    {
        var command = new GenerarBorradorCommand(
            TipoEscrito: "",
            DistritoJudicial: "Lima",
            HechosCausa: "Los hechos del caso");
        var result = _sut.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "TipoEscrito");
    }

    [Fact]
    public void Deberia_Fallar_Cuando_HechosCausa_Esta_Vacio()
    {
        var command = new GenerarBorradorCommand(
            TipoEscrito: "Demanda",
            DistritoJudicial: "Lima",
            HechosCausa: "");
        var result = _sut.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "HechosCausa");
    }

    [Fact]
    public void Deberia_Pasar_Con_Datos_Completos()
    {
        var command = new GenerarBorradorCommand(
            TipoEscrito: "Demanda Civil",
            DistritoJudicial: "Lima Norte",
            HechosCausa: "El demandante sufrió daños materiales por negligencia del demandado");
        var result = _sut.Validate(command);

        result.IsValid.Should().BeTrue();
    }
}
