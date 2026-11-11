
var builder = WebApplication.CreateBuilder(args);

// CORS: permite que React se comunique con nuestra API.
builder.Services.AddCors(options =>
{
    options.AddPolicy("CELDClient", policy =>
    {
        policy
            .WithOrigins("http://localhost:5173")
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

builder.Services.AddOpenApi();

var app = builder.Build();

// Configuración de la aplicación.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();
app.UseCors("CELDClient");

// Datos temporales para probar el catálogo.
var equipment = new[]
{
    new EquipmentDto(
        1, "DEMO-001", "Laptop Dell", "Computadoras",
        "Laptop para uso académico.", "Available"),

    new EquipmentDto(
        2, "DEMO-002", "Laptop HP", "Computadoras",
        "Laptop para actividades académicas.", "Available"),

    new EquipmentDto(
        3, "DEMO-003", "Mouse Logitech", "Accesorios",
        "Mouse inalámbrico.", "Available"),

    new EquipmentDto(
        4, "DEMO-004", "Teclado mecánico", "Accesorios",
        "Teclado para uso académico.", "Unavailable"),

    new EquipmentDto(
        5, "DEMO-005", "Monitor Dell", "Monitores",
        "Monitor externo.", "Available"),

    new EquipmentDto(
        6, "DEMO-006", "Tablet Samsung", "Tabletas",
        "Tableta para actividades académicas.", "Available")
};

// GET: /api/equipment
app.MapGet("/api/equipment", () =>
{
    return Results.Ok(equipment);
})
.WithName("GetEquipment");

app.Run();

// Representación temporal de un equipo.
record EquipmentDto(
    int Id,
    string AssetCode,
    string Name,
    string Category,
    string Description,
    string Availability
);
