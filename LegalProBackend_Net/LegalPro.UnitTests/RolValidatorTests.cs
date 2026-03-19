using FluentAssertions;
using LegalPro.Application.Alegato.Commands;
using LegalPro.Application.Interrogatorio.Commands;
using LegalPro.Application.Objeciones.Commands;
using LegalPro.Application.Plazos.Queries;
using LegalPro.Application.Fiscal.Commands;
using LegalPro.Application.Juez.Commands;
using LegalPro.Application.Juez.Queries;
using LegalPro.Application.Contador.Commands;

namespace LegalPro.UnitTests;

// ═══════════════════════════════════════════════════════════════════════
// TESTS DE VALIDADORES — Nuevas herramientas por rol (ABOGADO/FISCAL/JUEZ/CONTADOR)
// Sin mocks. FluentValidation es lógica pura, 100% offline y en milisegundos.
// Coverage: validators de los 8 nuevos handlers implementados.
// ═══════════════════════════════════════════════════════════════════════

// ─── ABOGADO: Alegato ────────────────────────────────────────────────────────
public class GenerarAlegatoValidatorTests
{
    private readonly GenerarAlegatoValidator _sut = new();

    [Fact]
    public void Deberia_Fallar_Cuando_TipoAlegato_Esta_Vacio()
    {
        var cmd = new GenerarAlegatoCommand("", "penal", new string('x', 25), "ABOGADO");
        _sut.Validate(cmd).IsValid.Should().BeFalse();
    }

    [Fact]
    public void Deberia_Fallar_Cuando_Hechos_Es_Muy_Corto()
    {
        var cmd = new GenerarAlegatoCommand("defensa", "penal", "corto", "ABOGADO");
        var result = _sut.Validate(cmd);
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Hechos");
    }

    [Fact]
    public void Deberia_Pasar_Con_Datos_Validos()
    {
        var cmd = new GenerarAlegatoCommand(
            "clausura",
            "penal",
            "El acusado fue detenido el 5 de enero sin orden judicial previa, vulnerando el art. 2.24 de la Constitución.",
            "defensa");
        _sut.Validate(cmd).IsValid.Should().BeTrue();
    }
}

// ─── ABOGADO: Interrogatorio ─────────────────────────────────────────────────
public class GenerarInterrogatorioValidatorTests
{
    private readonly GenerarInterrogatorioValidator _sut = new();

    [Fact]
    public void Deberia_Fallar_Cuando_NombreTestigo_Esta_Vacio()
    {
        var cmd = new GenerarInterrogatorioCommand("", "directo", new string('x', 25), "acreditar_hechos");
        _sut.Validate(cmd).IsValid.Should().BeFalse();
    }

    [Fact]
    public void Deberia_Fallar_Cuando_HechosClave_Es_Muy_Corto()
    {
        var cmd = new GenerarInterrogatorioCommand("Juan Pérez", "directo", "corto", "acreditar_hechos");
        var result = _sut.Validate(cmd);
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "HechosClave");
    }

    [Fact]
    public void Deberia_Pasar_Con_Datos_Validos()
    {
        var cmd = new GenerarInterrogatorioCommand(
            "María García",
            "directo",
            "Vio al acusado salir del edificio a las 11:30 PM del día 15 de febrero de 2025.",
            "acreditar_hechos");
        _sut.Validate(cmd).IsValid.Should().BeTrue();
    }
}

// ─── ABOGADO: Objeciones ─────────────────────────────────────────────────────
public class SugerirObjecionValidatorTests
{
    private readonly SugerirObjecionValidator _sut = new();

    [Fact]
    public void Deberia_Fallar_Cuando_Fragmento_Esta_Vacio()
    {
        var cmd = new SugerirObjecionCommand("", "penal", "juicio_oral");
        _sut.Validate(cmd).IsValid.Should().BeFalse();
    }

    [Fact]
    public void Deberia_Fallar_Cuando_Fragmento_Es_Muy_Corto()
    {
        var cmd = new SugerirObjecionCommand("corto", "penal", "juicio_oral");
        var result = _sut.Validate(cmd);
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "FragmentoAdversarial");
    }

    [Fact]
    public void Deberia_Pasar_Con_Datos_Validos()
    {
        var cmd = new SugerirObjecionCommand(
            "¿No es cierto que usted estuvo en el lugar de los hechos durante toda la tarde?",
            "penal",
            "examen_testigo");
        _sut.Validate(cmd).IsValid.Should().BeTrue();
    }
}

// ─── ABOGADO: Plazos Procesales ───────────────────────────────────────────────
public class CalcularPlazosQueryValidatorTests
{
    private readonly CalcularPlazosQueryValidator _sut = new();

    [Fact]
    public void Deberia_Fallar_Cuando_TipoActo_Esta_Vacio()
    {
        var q = new CalcularPlazosQuery("", "penal", DateTime.UtcNow.AddDays(-5));
        _sut.Validate(q).IsValid.Should().BeFalse();
    }

    [Fact]
    public void Deberia_Fallar_Con_RamaDerecho_Invalida()
    {
        var q = new CalcularPlazosQuery("apelar_sentencia", "marciana", DateTime.UtcNow.AddDays(-3));
        var result = _sut.Validate(q);
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "RamaDerecho");
    }

    [Fact]
    public void Deberia_Fallar_Con_FechaNotificacion_Futura()
    {
        var q = new CalcularPlazosQuery("apelar_sentencia", "civil", DateTime.UtcNow.AddDays(5));
        var result = _sut.Validate(q);
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "FechaNotificacion");
    }

    [Theory]
    [InlineData("penal")]
    [InlineData("civil")]
    [InlineData("laboral")]
    [InlineData("familia")]
    [InlineData("constitucional")]
    [InlineData("administrativo")]
    public void Deberia_Pasar_Con_Todas_Las_Ramas_Validas(string rama)
    {
        var q = new CalcularPlazosQuery("apelar_sentencia", rama, DateTime.UtcNow.AddDays(-2));
        _sut.Validate(q).IsValid.Should().BeTrue();
    }
}

// ─── FISCAL: Requerimiento ───────────────────────────────────────────────────
public class GenerarRequerimientoFiscalValidatorTests
{
    private readonly GenerarRequerimientoFiscalValidator _sut = new();

    [Fact]
    public void Deberia_Fallar_Cuando_TipoRequerimiento_Es_Invalido()
    {
        var cmd = new GenerarRequerimientoFiscalCommand
        {
            TipoRequerimiento = "tipo_inventado",
            Hechos            = new string('x', 55),
            Imputado          = "Pedro Ramírez",
            Delito            = "Robo agravado art. 189 CP"
        };
        var result = _sut.Validate(cmd);
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "TipoRequerimiento");
    }

    [Fact]
    public void Deberia_Fallar_Cuando_Hechos_Menor_50_Caracteres()
    {
        var cmd = new GenerarRequerimientoFiscalCommand
        {
            TipoRequerimiento = "acusacion",
            Hechos            = "muy corto",
            Imputado          = "Pedro Ramírez",
            Delito            = "Robo agravado"
        };
        var result = _sut.Validate(cmd);
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Hechos");
    }

    [Theory]
    [InlineData("acusacion")]
    [InlineData("sobreseimiento")]
    [InlineData("formalizacion")]
    [InlineData("prision_preventiva")]
    [InlineData("incautacion")]
    [InlineData("apelacion_fiscal")]
    public void Deberia_Pasar_Con_Todos_Los_Tipos_Validos(string tipo)
    {
        var cmd = new GenerarRequerimientoFiscalCommand
        {
            TipoRequerimiento = tipo,
            Hechos            = "El imputado Pedro Ramírez fue intervenido el 12 de enero de 2025 portando 50 gramos de cocaína base según acta de intervención policial.",
            Imputado          = "Pedro Ramírez García",
            Delito            = "Tráfico ilícito de drogas art. 296 CP"
        };
        _sut.Validate(cmd).IsValid.Should().BeTrue();
    }
}

// ─── JUEZ: Resolución Judicial ───────────────────────────────────────────────
public class GenerarResolucionJudicialValidatorTests
{
    private readonly GenerarResolucionJudicialValidator _sut = new();

    [Fact]
    public void Deberia_Fallar_Cuando_TipoResolucion_Esta_Vacio()
    {
        var cmd = new GenerarResolucionJudicialCommand
        {
            TipoResolucion    = "",
            Hechos            = new string('x', 55),
            Pretensiones      = "Se declare fundada la demanda",
            RamaDerecho       = "civil"
        };
        _sut.Validate(cmd).IsValid.Should().BeFalse();
    }

    [Fact]
    public void Deberia_Fallar_Cuando_Hechos_Menor_50_Caracteres()
    {
        var cmd = new GenerarResolucionJudicialCommand
        {
            TipoResolucion = "sentencia",
            Hechos         = "insuficiente",
            Pretensiones   = "Se declare fundada la demanda de desalojo.",
            RamaDerecho    = "civil"
        };
        var result = _sut.Validate(cmd);
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Hechos");
    }

    [Fact]
    public void Deberia_Pasar_Con_Datos_Validos()
    {
        var cmd = new GenerarResolucionJudicialCommand
        {
            TipoResolucion  = "sentencia",
            Hechos          = "El demandante interpuso acción de desalojo por vencimiento de contrato de arrendamiento del inmueble ubicado en Av. Arequipa 123, Lima, cuyo plazo venció el 31 de diciembre de 2024.",
            Pretensiones    = "Se declare fundada la demanda de desalojo y se ordene la restitución del inmueble.",
            RamaDerecho     = "civil"
        };
        _sut.Validate(cmd).IsValid.Should().BeTrue();
    }
}

// ─── JUEZ: Comparar Precedentes ──────────────────────────────────────────────
public class CompararPrecedentesQueryValidatorTests
{
    private readonly CompararPrecedentesQueryValidator _sut = new();

    [Fact]
    public void Deberia_Fallar_Cuando_CasoActual_Esta_Vacio()
    {
        var q = new CompararPrecedentesQuery { CasoActual = "", RamaDerecho = "civil", TipoResolucionBuscada = "sentencia" };
        _sut.Validate(q).IsValid.Should().BeFalse();
    }

    [Fact]
    public void Deberia_Fallar_Cuando_RamaDerecho_Esta_Vacia()
    {
        var q = new CompararPrecedentesQuery { CasoActual = "Caso de despido arbitrario en empresa minera.", RamaDerecho = "", TipoResolucionBuscada = "sentencia" };
        var result = _sut.Validate(q);
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "RamaDerecho");
    }

    [Fact]
    public void Deberia_Pasar_Con_Datos_Validos()
    {
        var q = new CompararPrecedentesQuery
        {
            CasoActual            = "Despido arbitrario de trabajador con 15 años de antigüedad sin causa justa, sin carta de preaviso, sin pago de beneficios sociales y sin audiencia previa.",
            RamaDerecho           = "laboral",
            TipoResolucionBuscada = "resolucion_casacion"
        };
        _sut.Validate(q).IsValid.Should().BeTrue();
    }
}

// ─── CONTADOR: Liquidación Laboral ───────────────────────────────────────────
public class CalcularLiquidacionLaboralValidatorTests
{
    private readonly CalcularLiquidacionLaboralValidator _sut = new();

    [Fact]
    public void Deberia_Fallar_Cuando_DatosEmpleadoJson_Esta_Vacio()
    {
        var cmd = new CalcularLiquidacionLaboralCommand { DatosEmpleadoJson = "", MotivoCese = "despido_arbitrario" };
        _sut.Validate(cmd).IsValid.Should().BeFalse();
    }

    [Fact]
    public void Deberia_Fallar_Cuando_MotivoCese_Esta_Vacio()
    {
        var cmd = new CalcularLiquidacionLaboralCommand
        {
            DatosEmpleadoJson = "{\"empleado\":\"Juan\",\"sueldo\":3000}",
            MotivoCese        = ""
        };
        var result = _sut.Validate(cmd);
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "MotivoCese");
    }

    [Fact]
    public void Deberia_Fallar_Cuando_DatosEmpleadoJson_Es_Muy_Corto()
    {
        var cmd = new CalcularLiquidacionLaboralCommand { DatosEmpleadoJson = "{}", MotivoCese = "renuncia" };
        var result = _sut.Validate(cmd);
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "DatosEmpleadoJson");
    }

    [Fact]
    public void Deberia_Pasar_Con_Datos_Validos()
    {
        var cmd = new CalcularLiquidacionLaboralCommand
        {
            DatosEmpleadoJson = "{\"empleado\":\"Carlos Torres\",\"fechaIngreso\":\"2018-03-01\",\"fechaCese\":\"2025-12-31\",\"sueldoBase\":4500,\"motivoCese\":\"despido_arbitrario\"}",
            MotivoCese        = "despido_arbitrario"
        };
        _sut.Validate(cmd).IsValid.Should().BeTrue();
    }
}

// ─── CONTADOR: Informe Pericial ──────────────────────────────────────────────
public class GenerarInformePericialValidatorTests
{
    private readonly GenerarInformePericialValidator _sut = new();

    [Fact]
    public void Deberia_Fallar_Cuando_TipoPericia_Esta_Vacio()
    {
        var cmd = new GenerarInformePericialCommand
        {
            TipoPericia   = "",
            HallazgosJson = "{\"monto\": 50000, \"periodo\": \"2023\"}",
        };
        _sut.Validate(cmd).IsValid.Should().BeFalse();
    }

    [Fact]
    public void Deberia_Fallar_Cuando_TipoPericia_Es_Invalido()
    {
        var cmd = new GenerarInformePericialCommand
        {
            TipoPericia   = "contable_general",
            HallazgosJson = "{\"monto\": 50000, \"periodo\": \"2023\"}",
        };
        var result = _sut.Validate(cmd);
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "TipoPericia");
    }

    [Fact]
    public void Deberia_Fallar_Cuando_HallazgosJson_Es_Muy_Corto()
    {
        var cmd = new GenerarInformePericialCommand
        {
            TipoPericia   = "laboral",
            HallazgosJson = "{}",
        };
        var result = _sut.Validate(cmd);
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "HallazgosJson");
    }

    [Theory]
    [InlineData("laboral")]
    [InlineData("societario")]
    [InlineData("tributario")]
    [InlineData("bancario")]
    [InlineData("patrimonial")]
    [InlineData("danos_perjuicios")]
    public void Deberia_Pasar_Con_TipoPericia_Valido(string tipoPericia)
    {
        var cmd = new GenerarInformePericialCommand
        {
            TipoPericia   = tipoPericia,
            HallazgosJson = "{\"monto\": 125000.50, \"periodo\": \"2022-2023\", \"cuentas\": \"activo fijo\"}",
        };
        _sut.Validate(cmd).IsValid.Should().BeTrue();
    }

    [Fact]
    public void Deberia_Pasar_Con_Hallazgos_Completos()
    {
        var cmd = new GenerarInformePericialCommand
        {
            TipoPericia   = "tributario",
            HallazgosJson = "{\"empresa\": \"ABC SAC\", \"periodo\": \"2019-2023\", \"omisionIGV\": 85000, \"omisionIR\": 42000, \"multas\": 12750, \"intereses\": 9800}",
        };
        _sut.Validate(cmd).IsValid.Should().BeTrue();
    }
}
