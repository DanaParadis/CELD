using System.Security.Claims;
using CELD.Api;
using CELD.Api.Data;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Data.Sqlite;

var builder = WebApplication.CreateBuilder(args);
var databasePath = Path.Combine(builder.Environment.ContentRootPath, "App_Data");
Directory.CreateDirectory(databasePath);
var connectionString = builder.Configuration.GetConnectionString("Celd")
    ?? $"Data Source={Path.Combine(databasePath, "celd.db")}";

builder.Services.AddDbContext<CeldDbContext>(options => options.UseSqlite(connectionString));
builder.Services.AddSingleton<IPasswordHasher<Account>, PasswordHasher<Account>>();
builder.Services.AddProblemDetails();
builder.Services.AddOpenApi();
builder.Services.AddAntiforgery(options => options.HeaderName = "X-CSRF-TOKEN");
builder.Services
    .AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        var secureCookie = !builder.Environment.IsDevelopment()
            && !builder.Environment.IsEnvironment("Testing");
        options.Cookie.Name = "CELD.Session";
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Lax;
        options.Cookie.SecurePolicy = secureCookie
            ? CookieSecurePolicy.Always
            : CookieSecurePolicy.SameAsRequest;
        options.ExpireTimeSpan = TimeSpan.FromHours(8);
        options.SlidingExpiration = true;
        options.Events.OnRedirectToLogin = context =>
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return context.Response.WriteAsJsonAsync(new ProblemDetails
            {
                Status = StatusCodes.Status401Unauthorized,
                Title = "Authentication is required."
            });
        };
        options.Events.OnRedirectToAccessDenied = context =>
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            return context.Response.WriteAsJsonAsync(new ProblemDetails
            {
                Status = StatusCodes.Status403Forbidden,
                Title = "The current account is not permitted to perform this action."
            });
        };
    });
builder.Services.AddAuthorizationBuilder()
    .AddPolicy("Student", policy => policy.RequireRole(AccountRoles.Student))
    .AddPolicy("Staff", policy => policy.RequireRole(AccountRoles.Staff));

var app = builder.Build();
app.UseExceptionHandler();
app.UseAuthentication();
app.UseAuthorization();
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

await SeedData.InitializeAsync(app.Services, builder.Configuration);

app.MapGet("/api/auth/csrf", (HttpContext context, IAntiforgery antiforgery) =>
{
    var tokens = antiforgery.GetAndStoreTokens(context);
    return Results.Ok(new CsrfTokenDto(tokens.RequestToken!));
});

app.MapGet("/api/auth/me", (ClaimsPrincipal user) =>
{
    if (user.Identity?.IsAuthenticated != true)
    {
        return Results.Ok(new AuthSessionDto(false, null));
    }

    return Results.Ok(new AuthSessionDto(
        true,
        new CurrentUserDto(
            GetUserId(user),
            user.Identity.Name!,
            user.FindFirstValue(ClaimTypes.Role)!)));
});

app.MapPost("/api/auth/login", async (
    LoginRequest request,
    HttpContext context,
    IAntiforgery antiforgery,
    CeldDbContext db,
    IPasswordHasher<Account> passwordHasher) =>
{
    var csrfFailure = await ValidateCsrfAsync(context, antiforgery);
    if (csrfFailure is not null)
    {
        return csrfFailure;
    }

    var username = request.Username.Trim();
    var account = await db.Accounts.SingleOrDefaultAsync(
        candidate => candidate.Username == username);
    if (account is null
        || passwordHasher.VerifyHashedPassword(account, account.PasswordHash, request.Password)
            == PasswordVerificationResult.Failed)
    {
        return Results.Problem(
            statusCode: StatusCodes.Status401Unauthorized,
            title: "Invalid username or password.");
    }

    var claims = new[]
    {
        new Claim(ClaimTypes.NameIdentifier, account.Id.ToString()),
        new Claim(ClaimTypes.Name, account.DisplayName),
        new Claim(ClaimTypes.Role, account.Role)
    };
    var principal = new ClaimsPrincipal(
        new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme));
    await context.SignInAsync(
        CookieAuthenticationDefaults.AuthenticationScheme,
        principal);

    return Results.Ok(new CurrentUserDto(account.Id, account.DisplayName, account.Role));
});

app.MapPost("/api/auth/logout", async (
    HttpContext context,
    IAntiforgery antiforgery) =>
{
    var csrfFailure = await ValidateCsrfAsync(context, antiforgery);
    if (csrfFailure is not null)
    {
        return csrfFailure;
    }

    await context.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
    return Results.NoContent();
}).RequireAuthorization();

app.MapGet("/api/equipment", async (
    [FromQuery] string? search,
    [FromQuery] string? category,
    CeldDbContext db) =>
{
    var query = db.EquipmentItems.AsNoTracking();
    if (!string.IsNullOrWhiteSpace(search))
    {
        var term = search.Trim().ToLower();
        query = query.Where(item => item.Name.ToLower().Contains(term));
    }

    if (!string.IsNullOrWhiteSpace(category))
    {
        query = query.Where(item => item.Category == category.Trim());
    }

    var equipment = await query
        .OrderBy(item => item.Name)
        .Select(item => new EquipmentDto(
            item.Id,
            item.AssetCode,
            item.Name,
            item.Category,
            item.Description,
            !db.Reservations.Any(reservation =>
                reservation.EquipmentItemId == item.Id
                && (reservation.Status == ReservationStatuses.Reserved
                    || reservation.Status == ReservationStatuses.CheckedOut))))
        .ToListAsync();

    return Results.Ok(equipment);
});

app.MapGet("/api/equipment/{id:int}", async (int id, CeldDbContext db) =>
{
    var item = await db.EquipmentItems
        .AsNoTracking()
        .Where(candidate => candidate.Id == id)
        .Select(candidate => new EquipmentDto(
            candidate.Id,
            candidate.AssetCode,
            candidate.Name,
            candidate.Category,
            candidate.Description,
            !db.Reservations.Any(reservation =>
                reservation.EquipmentItemId == candidate.Id
                && (reservation.Status == ReservationStatuses.Reserved
                    || reservation.Status == ReservationStatuses.CheckedOut))))
        .SingleOrDefaultAsync();

    return item is null
        ? Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Equipment item not found.")
        : Results.Ok(item);
});

app.MapPost("/api/reservations", async (
    ReserveRequest request,
    ClaimsPrincipal user,
    HttpContext context,
    IAntiforgery antiforgery,
    CeldDbContext db) =>
{
    var csrfFailure = await ValidateCsrfAsync(context, antiforgery);
    if (csrfFailure is not null)
    {
        return csrfFailure;
    }

    var itemExists = await db.EquipmentItems.AnyAsync(item => item.Id == request.EquipmentId);
    if (!itemExists)
    {
        return Results.Problem(
            statusCode: StatusCodes.Status404NotFound,
            title: "Equipment item not found.");
    }

    var now = DateTimeOffset.UtcNow;
    var reservation = new Reservation
    {
        EquipmentItemId = request.EquipmentId,
        StudentId = GetUserId(user),
        Status = ReservationStatuses.Reserved,
        CreatedAtUtc = now
    };
    db.Reservations.Add(reservation);
    db.HistoryEvents.Add(new ReservationHistoryEvent
    {
        Reservation = reservation,
        Status = ReservationStatuses.Reserved,
        EventType = "Created",
        ActorId = GetUserId(user),
        OccurredAtUtc = now
    });

    try
    {
        await db.SaveChangesAsync();
    }
    catch (DbUpdateException exception) when (IsReservationConflict(exception))
    {
        return ReservationConflict();
    }
    catch (SqliteException exception) when (IsReservationConflict(exception))
    {
        return ReservationConflict();
    }

    var saved = await LoadReservationAsync(db, reservation.Id);
    return Results.Created($"/api/reservations/{reservation.Id}", ToReservationDto(saved!));
}).RequireAuthorization("Student");

app.MapGet("/api/reservations", async (ClaimsPrincipal user, CeldDbContext db) =>
{
    var studentId = GetUserId(user);
    var reservations = await db.Reservations
        .AsNoTracking()
        .Where(reservation => reservation.StudentId == studentId)
        .Include(reservation => reservation.EquipmentItem)
        .Include(reservation => reservation.Student)
        .Include(reservation => reservation.HistoryEvents)
            .ThenInclude(historyEvent => historyEvent.Actor)
        .OrderByDescending(reservation => reservation.Id)
        .ToListAsync();

    return Results.Ok(reservations.Select(ToReservationDto));
}).RequireAuthorization("Student");

app.MapGet("/api/staff/reservations", async (
    [FromQuery] string? status,
    CeldDbContext db) =>
{
    var query = db.Reservations.AsNoTracking();
    if (!string.IsNullOrWhiteSpace(status))
    {
        if (!ReservationStatuses.All.Contains(status, StringComparer.Ordinal))
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["status"] = ["The requested reservation status is invalid."]
            });
        }

        query = query.Where(reservation => reservation.Status == status);
    }

    var reservations = await query
        .Include(reservation => reservation.EquipmentItem)
        .Include(reservation => reservation.Student)
        .Include(reservation => reservation.HistoryEvents)
            .ThenInclude(historyEvent => historyEvent.Actor)
        .OrderByDescending(reservation => reservation.Id)
        .ToListAsync();

    return Results.Ok(reservations.Select(ToReservationDto));
}).RequireAuthorization("Staff");

app.MapGet("/api/reservations/{id:int}", async (
    int id,
    ClaimsPrincipal user,
    CeldDbContext db) =>
{
    var query = db.Reservations
        .AsNoTracking()
        .Where(reservation => reservation.Id == id);

    if (user.IsInRole(AccountRoles.Student))
    {
        var studentId = GetUserId(user);
        query = query.Where(reservation => reservation.StudentId == studentId);
    }

    var reservation = await query
        .Include(candidate => candidate.EquipmentItem)
        .Include(candidate => candidate.Student)
        .Include(candidate => candidate.HistoryEvents)
            .ThenInclude(historyEvent => historyEvent.Actor)
        .SingleOrDefaultAsync();

    return reservation is null
        ? Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Reservation not found.")
        : Results.Ok(ToReservationDto(reservation));
}).RequireAuthorization(policy =>
    policy.RequireRole(AccountRoles.Student, AccountRoles.Staff));

app.MapPost("/api/reservations/{id:int}/cancel", async (
    int id,
    ClaimsPrincipal user,
    HttpContext context,
    IAntiforgery antiforgery,
    CeldDbContext db) =>
{
    var csrfFailure = await ValidateCsrfAsync(context, antiforgery);
    if (csrfFailure is not null)
    {
        return csrfFailure;
    }

    return await TransitionReservationAsync(
        db,
        id,
        GetUserId(user),
        ReservationStatuses.Reserved,
        ReservationStatuses.Cancelled,
        "Cancelled",
        ownerId: GetUserId(user));
}).RequireAuthorization("Student");

app.MapPost("/api/reservations/{id:int}/pickup", async (
    int id,
    ClaimsPrincipal user,
    HttpContext context,
    IAntiforgery antiforgery,
    CeldDbContext db) =>
{
    var csrfFailure = await ValidateCsrfAsync(context, antiforgery);
    if (csrfFailure is not null)
    {
        return csrfFailure;
    }

    return await TransitionReservationAsync(
        db,
        id,
        GetUserId(user),
        ReservationStatuses.Reserved,
        ReservationStatuses.CheckedOut,
        "PickedUp");
}).RequireAuthorization("Staff");

app.MapPost("/api/reservations/{id:int}/return", async (
    int id,
    ClaimsPrincipal user,
    HttpContext context,
    IAntiforgery antiforgery,
    CeldDbContext db) =>
{
    var csrfFailure = await ValidateCsrfAsync(context, antiforgery);
    if (csrfFailure is not null)
    {
        return csrfFailure;
    }

    return await TransitionReservationAsync(
        db,
        id,
        GetUserId(user),
        ReservationStatuses.CheckedOut,
        ReservationStatuses.Returned,
        "Returned");
}).RequireAuthorization("Staff");

app.Run();

static int GetUserId(ClaimsPrincipal user) =>
    int.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);

static async Task<IResult?> ValidateCsrfAsync(
    HttpContext context,
    IAntiforgery antiforgery)
{
    try
    {
        await antiforgery.ValidateRequestAsync(context);
        return null;
    }
    catch (AntiforgeryValidationException)
    {
        return Results.Problem(
            statusCode: StatusCodes.Status400BadRequest,
            title: "A valid CSRF token is required.");
    }
}

static bool IsReservationConflict(Exception exception)
{
    var sqliteException = exception as SqliteException
        ?? exception.InnerException as SqliteException;
    return sqliteException is not null
        && (sqliteException.SqliteErrorCode is 5 or 6
            || sqliteException.SqliteExtendedErrorCode is 1555 or 2067);
}

static IResult ReservationConflict() =>
    Results.Problem(
        statusCode: StatusCodes.Status409Conflict,
        title: "The equipment is no longer available.");

static async Task<IResult> TransitionReservationAsync(
    CeldDbContext db,
    int reservationId,
    int actorId,
    string expectedStatus,
    string nextStatus,
    string eventType,
    int? ownerId = null)
{
    var visibleReservation = await db.Reservations
        .AsNoTracking()
        .Where(reservation => reservation.Id == reservationId)
        .Where(reservation => ownerId == null || reservation.StudentId == ownerId)
        .Select(reservation => new { reservation.Id, reservation.Status })
        .SingleOrDefaultAsync();

    if (visibleReservation is null)
    {
        return Results.Problem(
            statusCode: StatusCodes.Status404NotFound,
            title: "Reservation not found.");
    }

    if (visibleReservation.Status != expectedStatus)
    {
        return Results.Problem(
            statusCode: StatusCodes.Status409Conflict,
            title: "The reservation has changed and cannot accept this transition.");
    }

    await using var transaction = await db.Database.BeginTransactionAsync();
    var update = db.Reservations
        .Where(reservation =>
            reservation.Id == reservationId
            && reservation.Status == expectedStatus);
    if (ownerId is not null)
    {
        update = update.Where(reservation => reservation.StudentId == ownerId);
    }

    try
    {
        var updated = await update.ExecuteUpdateAsync(
            setters => setters.SetProperty(reservation => reservation.Status, nextStatus));
        if (updated != 1)
        {
            await transaction.RollbackAsync();
            return Results.Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "The reservation has changed and cannot accept this transition.");
        }

        db.HistoryEvents.Add(new ReservationHistoryEvent
        {
            ReservationId = reservationId,
            Status = nextStatus,
            EventType = eventType,
            ActorId = actorId,
            OccurredAtUtc = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
    }
    catch (DbUpdateException exception) when (IsReservationConflict(exception))
    {
        return ReservationConflict();
    }
    catch (SqliteException exception) when (IsReservationConflict(exception))
    {
        return ReservationConflict();
    }

    var saved = await LoadReservationAsync(db, reservationId);
    return Results.Ok(ToReservationDto(saved!));
}

static Task<Reservation?> LoadReservationAsync(CeldDbContext db, int id) =>
    db.Reservations
        .AsNoTracking()
        .Include(reservation => reservation.EquipmentItem)
        .Include(reservation => reservation.Student)
        .Include(reservation => reservation.HistoryEvents)
            .ThenInclude(historyEvent => historyEvent.Actor)
        .SingleOrDefaultAsync(reservation => reservation.Id == id);

static ReservationDto ToReservationDto(Reservation reservation) =>
    new(
        reservation.Id,
        reservation.Status,
        reservation.CreatedAtUtc,
        new EquipmentSummaryDto(
            reservation.EquipmentItem.Id,
            reservation.EquipmentItem.AssetCode,
            reservation.EquipmentItem.Name,
            reservation.EquipmentItem.Category,
            ReservationStatuses.IsActive(reservation.Status)
                ? "Unavailable"
                : "Available"),
        new AccountSummaryDto(reservation.Student.Id, reservation.Student.DisplayName),
        reservation.HistoryEvents
            .OrderBy(historyEvent => historyEvent.OccurredAtUtc)
            .Select(historyEvent => new HistoryEventDto(
                historyEvent.Id,
                historyEvent.EventType,
                historyEvent.Status,
                historyEvent.Actor.DisplayName,
                historyEvent.OccurredAtUtc))
            .ToArray());

public partial class Program { }
