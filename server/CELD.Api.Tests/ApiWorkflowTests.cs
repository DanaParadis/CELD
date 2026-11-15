using System.Net;
using System.Net.Http.Json;
using System.Diagnostics;
using System.Security.Cryptography;
using System.Text.Json;
using CELD.Api.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using Xunit;
using Xunit.Abstractions;

namespace CELD.Api.Tests;

public sealed class ApiWorkflowTests
{
    private readonly ITestOutputHelper output;

    public ApiWorkflowTests(ITestOutputHelper output)
    {
        this.output = output;
    }

    // Verifies anonymous catalog search, filtering, availability, and missing-item responses.
    [Fact]
    public async Task Anonymous_catalog_search_and_missing_item_are_authoritative()
    {
        await using var testContext = await ApiTestContext.CreateAsync();
        using var client = testContext.CreateClient();
        var reservationRows = await testContext.ReadReservationRowsAsync();
        Assert.True(
            reservationRows.Count == 0,
            $"Unexpected seeded reservations in {testContext.ConnectionString}: {string.Join(", ", reservationRows)}");

        var catalog = await client.GetFromJsonAsync<JsonElement>("/api/equipment?search=dElL");
        Assert.Equal(2, catalog.GetArrayLength());
        Assert.All(catalog.EnumerateArray(), item => Assert.True(item.GetProperty("isAvailable").GetBoolean()));
        var anonymousSession = await client.GetFromJsonAsync<JsonElement>("/api/auth/me");
        Assert.False(anonymousSession.GetProperty("isAuthenticated").GetBoolean());
        Assert.Equal(JsonValueKind.Null, anonymousSession.GetProperty("user").ValueKind);

        var missing = await client.GetAsync("/api/equipment/9999");
        Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);

        var filtered = await client.GetFromJsonAsync<JsonElement>(
            "/api/equipment?search=dell&category=Monitors");
        Assert.Single(filtered.EnumerateArray());
    }

    // Verifies login, reservation creation, owner-scoped listing, and persistence across hosts.
    [Fact]
    public async Task Login_reserve_and_listing_use_the_authenticated_student()
    {
        await using var testContext = await ApiTestContext.CreateAsync();
        using var student = await testContext.SignInAsAsync("student1", testContext.Student1Password);
        using var otherStudent = await testContext.SignInAsAsync("student2", testContext.Student2Password);

        var reserved = await testContext.PostWithCsrfAsync(
            student,
            "/api/reservations",
            new { equipmentId = 1, studentId = 2, role = "Staff" });
        Assert.True(
            reserved.StatusCode == HttpStatusCode.Created,
            await reserved.Content.ReadAsStringAsync());
        using var created = await JsonDocument.ParseAsync(await reserved.Content.ReadAsStreamAsync());
        var reservationId = created.RootElement.GetProperty("id").GetInt32();
        Assert.Equal("Reserved", created.RootElement.GetProperty("status").GetString());
        Assert.Equal("Student One", created.RootElement
            .GetProperty("history")[0].GetProperty("actorDisplayName").GetString());
        Assert.Equal("Student One", created.RootElement
            .GetProperty("student").GetProperty("displayName").GetString());

        var session = await student.GetFromJsonAsync<JsonElement>("/api/auth/me");
        Assert.True(session.GetProperty("isAuthenticated").GetBoolean());
        Assert.Equal("Student", session.GetProperty("user").GetProperty("role").GetString());
        var mine = await student.GetFromJsonAsync<JsonElement>("/api/reservations");
        Assert.Single(mine.EnumerateArray());
        var notMine = await otherStudent.GetAsync($"/api/reservations/{reservationId}");
        Assert.Equal(HttpStatusCode.NotFound, notMine.StatusCode);

        var equipment = await student.GetFromJsonAsync<JsonElement>("/api/equipment/1");
        Assert.False(equipment.GetProperty("isAvailable").GetBoolean());

        await using var restartedFactory = testContext.CreateAdditionalFactory();
        using var restartedClient = restartedFactory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("http://localhost"),
            HandleCookies = true,
            AllowAutoRedirect = false
        });
        using var restartedSignIn = await testContext.SignInAsync(
            restartedClient,
            "student1",
            testContext.Student1Password);
        Assert.Equal(HttpStatusCode.OK, restartedSignIn.StatusCode);
        var afterRestart = await restartedClient.GetFromJsonAsync<JsonElement>("/api/reservations");
        Assert.Single(afterRestart.EnumerateArray());
    }

    // Verifies concurrent Students cannot reserve the same Item twice.
    [Fact]
    public async Task Competing_students_cannot_create_two_active_reservations()
    {
        await using var testContext = await ApiTestContext.CreateAsync();
        using var student1 = await testContext.SignInAsAsync("student1", testContext.Student1Password);
        using var student2 = await testContext.SignInAsAsync("student2", testContext.Student2Password);

        var attempts = await Task.WhenAll(
            testContext.PostWithCsrfAsync(student1, "/api/reservations", new { equipmentId = 3 }),
            testContext.PostWithCsrfAsync(student2, "/api/reservations", new { equipmentId = 3 }));

        Assert.Single(attempts, response => response.StatusCode == HttpStatusCode.Created);
        Assert.Single(attempts, response => response.StatusCode == HttpStatusCode.Conflict);
        Assert.All(attempts, response => response.Dispose());

        await using var scope = testContext.Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CeldDbContext>();
        Assert.Equal(1, await db.Reservations.CountAsync(reservation =>
            reservation.EquipmentItemId == 3
            && (reservation.Status == ReservationStatuses.Reserved
                || reservation.Status == ReservationStatuses.CheckedOut)));
        Assert.Equal(1, await db.HistoryEvents.CountAsync(historyEvent =>
            historyEvent.Reservation.EquipmentItemId == 3));
    }

    // Verifies concurrent Staff pickup requests allow only one valid transition.
    [Fact]
    public async Task Competing_staff_transitions_accept_only_one_current_status_change()
    {
        await using var testContext = await ApiTestContext.CreateAsync();
        using var student = await testContext.SignInAsAsync("student1", testContext.Student1Password);
        using var staff1 = await testContext.SignInAsAsync("staff1", testContext.StaffPassword);
        using var staff2 = await testContext.SignInAsAsync("staff1", testContext.StaffPassword);

        var created = await testContext.PostWithCsrfAsync(
            student,
            "/api/reservations",
            new { equipmentId = 6 });
        using var json = await JsonDocument.ParseAsync(await created.Content.ReadAsStreamAsync());
        var reservationId = json.RootElement.GetProperty("id").GetInt32();

        var attempts = await Task.WhenAll(
            testContext.PostWithCsrfAsync(
                staff1,
                $"/api/reservations/{reservationId}/pickup"),
            testContext.PostWithCsrfAsync(
                staff2,
                $"/api/reservations/{reservationId}/pickup"));

        Assert.Single(attempts, response => response.StatusCode == HttpStatusCode.OK);
        Assert.Single(attempts, response => response.StatusCode == HttpStatusCode.Conflict);
        Assert.All(attempts, response => response.Dispose());
        Assert.Equal(2, await testContext.CountHistoryAsync(6));
    }

    // Verifies reservation ownership, Staff authorization, valid transitions, and history.
    [Fact]
    public async Task Ownership_staff_authorization_and_legal_transitions_are_enforced()
    {
        await using var testContext = await ApiTestContext.CreateAsync();
        using var student = await testContext.SignInAsAsync("student1", testContext.Student1Password);
        using var otherStudent = await testContext.SignInAsAsync("student2", testContext.Student2Password);
        using var staff = await testContext.SignInAsAsync("staff1", testContext.StaffPassword);

        var created = await testContext.PostWithCsrfAsync(
            student,
            "/api/reservations",
            new { equipmentId = 2 });
        Assert.True(
            created.StatusCode == HttpStatusCode.Created,
            await created.Content.ReadAsStringAsync());
        using var reservationJson = await JsonDocument.ParseAsync(await created.Content.ReadAsStreamAsync());
        var reservationId = reservationJson.RootElement.GetProperty("id").GetInt32();

        var otherStudentAccess = await otherStudent.GetAsync($"/api/reservations/{reservationId}");
        Assert.Equal(HttpStatusCode.NotFound, otherStudentAccess.StatusCode);
        var deleteAttempt = await student.DeleteAsync($"/api/reservations/{reservationId}");
        Assert.Equal(HttpStatusCode.MethodNotAllowed, deleteAttempt.StatusCode);
        var otherStudentCancel = await testContext.PostWithCsrfAsync(
            otherStudent,
            $"/api/reservations/{reservationId}/cancel");
        Assert.Equal(HttpStatusCode.NotFound, otherStudentCancel.StatusCode);
        var studentStaffQueue = await student.GetAsync("/api/staff/reservations");
        Assert.Equal(HttpStatusCode.Forbidden, studentStaffQueue.StatusCode);

        var studentPickup = await testContext.PostWithCsrfAsync(
            student,
            $"/api/reservations/{reservationId}/pickup");
        Assert.Equal(HttpStatusCode.Forbidden, studentPickup.StatusCode);

        var cancelled = await testContext.PostWithCsrfAsync(
            student,
            $"/api/reservations/{reservationId}/cancel");
        Assert.Equal("Cancelled", await ReadStatusAsync(cancelled));
        var cancelledAgain = await testContext.PostWithCsrfAsync(
            student,
            $"/api/reservations/{reservationId}/cancel");
        Assert.Equal(HttpStatusCode.Conflict, cancelledAgain.StatusCode);

        var reReserved = await testContext.PostWithCsrfAsync(
            student,
            "/api/reservations",
            new { equipmentId = 2 });
        Assert.Equal(HttpStatusCode.Created, reReserved.StatusCode);
        using var secondReservation = await JsonDocument.ParseAsync(await reReserved.Content.ReadAsStreamAsync());
        var secondId = secondReservation.RootElement.GetProperty("id").GetInt32();

        var pickup = await testContext.PostWithCsrfAsync(
            staff,
            $"/api/reservations/{secondId}/pickup");
        Assert.Equal("CheckedOut", await ReadStatusAsync(pickup));
        var checkedOutQueue = await staff.GetFromJsonAsync<JsonElement>(
            "/api/staff/reservations?status=CheckedOut");
        Assert.Single(checkedOutQueue.EnumerateArray());
        var invalidStatus = await staff.GetAsync("/api/staff/reservations?status=NotAStatus");
        Assert.Equal(HttpStatusCode.BadRequest, invalidStatus.StatusCode);
        var repeatedPickup = await testContext.PostWithCsrfAsync(
            staff,
            $"/api/reservations/{secondId}/pickup");
        Assert.Equal(HttpStatusCode.Conflict, repeatedPickup.StatusCode);
        var returned = await testContext.PostWithCsrfAsync(
            staff,
            $"/api/reservations/{secondId}/return");
        Assert.Equal("Returned", await ReadStatusAsync(returned));

        var availableAgain = await student.GetFromJsonAsync<JsonElement>("/api/equipment/2");
        Assert.True(availableAgain.GetProperty("isAvailable").GetBoolean());
        var history = await student.GetFromJsonAsync<JsonElement>($"/api/reservations/{secondId}");
        Assert.Equal(3, history.GetProperty("history").GetArrayLength());
        Assert.Equal(
            ["Created", "PickedUp", "Returned"],
            history.GetProperty("history")
                .EnumerateArray()
                .Select(eventItem =>
                    eventItem.GetProperty("eventType").GetString() ?? string.Empty)
                .ToArray());

        var afterReturn = await testContext.PostWithCsrfAsync(
            student,
            "/api/reservations",
            new { equipmentId = 2 });
        Assert.Equal(HttpStatusCode.Created, afterReturn.StatusCode);
    }

    // Verifies failed history writes roll back reservation creation and status changes.
    [Fact]
    public async Task Failed_history_insert_rolls_back_status_and_reservation_changes()
    {
        await using var testContext = await ApiTestContext.CreateAsync();
        using var student = await testContext.SignInAsAsync("student1", testContext.Student1Password);
        using var staff = await testContext.SignInAsAsync("staff1", testContext.StaffPassword);

        await testContext.InstallHistoryFailureTriggerAsync();
        var failedCreate = await testContext.PostWithCsrfAsync(
            student,
            "/api/reservations",
            new { equipmentId = 4 });
        Assert.Equal(HttpStatusCode.InternalServerError, failedCreate.StatusCode);
        Assert.Equal(0, await testContext.CountReservationsAsync(4));
        Assert.Equal(0, await testContext.CountHistoryAsync(4));

        await testContext.DropHistoryFailureTriggerAsync();
        var created = await testContext.PostWithCsrfAsync(
            student,
            "/api/reservations",
            new { equipmentId = 4 });
        using var json = await JsonDocument.ParseAsync(await created.Content.ReadAsStreamAsync());
        var reservationId = json.RootElement.GetProperty("id").GetInt32();

        await testContext.InstallHistoryFailureTriggerAsync();
        var failedPickup = await testContext.PostWithCsrfAsync(
            staff,
            $"/api/reservations/{reservationId}/pickup");
        Assert.Equal(HttpStatusCode.InternalServerError, failedPickup.StatusCode);
        Assert.Equal(1, await testContext.CountHistoryAsync(4));

        using var scope = testContext.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CeldDbContext>();
        var persisted = await db.Reservations.SingleAsync(reservation => reservation.Id == reservationId);
        Assert.Equal(ReservationStatuses.Reserved, persisted.Status);
    }

    // Verifies invalid credentials, missing CSRF tokens, and logged-out sessions are rejected.
    [Fact]
    public async Task Invalid_credentials_missing_csrf_and_ended_sessions_are_refused()
    {
        await using var testContext = await ApiTestContext.CreateAsync();
        using var anonymous = testContext.CreateClient();

        var failedLogin = await testContext.PostWithCsrfAsync(
            anonymous,
            "/api/auth/login",
            new { username = "student1", password = "wrong" });
        Assert.Equal(HttpStatusCode.Unauthorized, failedLogin.StatusCode);
        Assert.Contains("Invalid username or password", await failedLogin.Content.ReadAsStringAsync());

        using var student = await testContext.SignInAsAsync("student1", testContext.Student1Password);
        var withoutCsrf = await student.PostAsJsonAsync(
            "/api/reservations",
            new { equipmentId = 5 });
        Assert.Equal(HttpStatusCode.BadRequest, withoutCsrf.StatusCode);

        var signOut = await testContext.PostWithCsrfAsync(student, "/api/auth/logout");
        Assert.Equal(HttpStatusCode.NoContent, signOut.StatusCode);
        var endedSession = await student.GetAsync("/api/reservations");
        Assert.Equal(HttpStatusCode.Unauthorized, endedSession.StatusCode);
    }

    // Verifies password hashes and secure HTTP-only authentication cookies.
    [Fact]
    public async Task Authentication_uses_hashed_credentials_and_an_http_only_session_cookie()
    {
        await using var testContext = await ApiTestContext.CreateAsync();
        using var client = testContext.CreateClient();

        var login = await testContext.SignInAsync(
            client,
            "student1",
            testContext.Student1Password);
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        var cookies = string.Join("; ", login.Headers.GetValues("Set-Cookie"));
        Assert.Contains("CELD.Session", cookies);
        Assert.Contains("httponly", cookies, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("samesite=lax", cookies, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain(testContext.Student1Password, cookies);

        await using var scope = testContext.Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CeldDbContext>();
        var account = await db.Accounts.SingleAsync(account => account.Username == "student1");
        Assert.NotEqual(testContext.Student1Password, account.PasswordHash);
    }

    // Verifies warmed catalog and Staff-list requests meet the local latency bound.
    [Fact]
    public async Task Warmed_catalog_and_reservation_lists_meet_the_two_second_local_bound()
    {
        await using var testContext = await ApiTestContext.CreateAsync();
        using var staff = await testContext.SignInAsAsync("staff1", testContext.StaffPassword);

        await using (var scope = testContext.Factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<CeldDbContext>();
            db.EquipmentItems.AddRange(Enumerable.Range(1, 50).Select(index => new EquipmentItem
            {
                AssetCode = $"PERF-{index:D3}",
                Name = $"Performance Item {index:D3}",
                Category = index % 2 == 0 ? "Performance A" : "Performance B",
                Description = "Seeded local performance fixture."
            }));
            await db.SaveChangesAsync();

            var itemIds = await db.EquipmentItems
                .OrderBy(item => item.Id)
                .Select(item => item.Id)
                .ToArrayAsync();
            var studentId = await db.Accounts
                .Where(account => account.Username == "student1")
                .Select(account => account.Id)
                .SingleAsync();
            for (var index = 0; index < 100; index++)
            {
                var status = index % 2 == 0
                    ? ReservationStatuses.Cancelled
                    : ReservationStatuses.Returned;
                var occurredAt = DateTimeOffset.UtcNow.AddMinutes(-index);
                var reservation = new Reservation
                {
                    EquipmentItemId = itemIds[index % itemIds.Length],
                    StudentId = studentId,
                    Status = status,
                    CreatedAtUtc = occurredAt
                };
                reservation.HistoryEvents.Add(new ReservationHistoryEvent
                {
                    Status = status,
                    EventType = status,
                    ActorId = studentId,
                    OccurredAtUtc = occurredAt
                });
                db.Reservations.Add(reservation);
            }

            await db.SaveChangesAsync();
        }

        using var warmedCatalog = await staff.GetAsync("/api/equipment");
        using var warmedReservations = await staff.GetAsync("/api/staff/reservations");
        Assert.Equal(HttpStatusCode.OK, warmedCatalog.StatusCode);
        Assert.Equal(HttpStatusCode.OK, warmedReservations.StatusCode);

        var catalogDuration = await MeasureRequestAsync(staff, "/api/equipment");
        var reservationsDuration = await MeasureRequestAsync(staff, "/api/staff/reservations");
        output.WriteLine(
            $"SQLite local performance fixture: 56 items / 100 historical reservations. "
            + $"Catalog {catalogDuration.TotalMilliseconds:F0} ms; "
            + $"staff list {reservationsDuration.TotalMilliseconds:F0} ms.");
        Assert.True(catalogDuration < TimeSpan.FromSeconds(2), $"Catalog took {catalogDuration}.");
        Assert.True(
            reservationsDuration < TimeSpan.FromSeconds(2),
            $"Staff reservation list took {reservationsDuration}.");
    }

    private static async Task<TimeSpan> MeasureRequestAsync(HttpClient client, string path)
    {
        var timer = Stopwatch.StartNew();
        using var response = await client.GetAsync(path);
        timer.Stop();
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return timer.Elapsed;
    }

    private static async Task<string?> ReadStatusAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var json = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        return json.RootElement.GetProperty("status").GetString();
    }
}

internal sealed class ApiTestContext : IAsyncDisposable
{
    private readonly SqliteConnection anchorConnection;
    private readonly string connectionString;

    private ApiTestContext()
    {
        connectionString = $"Data Source=celd-{Guid.NewGuid():N};Mode=Memory;Cache=Shared";
        anchorConnection = new SqliteConnection(connectionString);
        Student1Password = CreateTestPassword();
        Student2Password = CreateTestPassword();
        StaffPassword = CreateTestPassword();
        Factory = CreateFactory();
    }

    public WebApplicationFactory<Program> Factory { get; }
    public string ConnectionString => connectionString;
    public string Student1Password { get; }
    public string Student2Password { get; }
    public string StaffPassword { get; }

    public static async Task<ApiTestContext> CreateAsync()
    {
        var context = new ApiTestContext();
        await context.anchorConnection.OpenAsync();
        using var startupClient = context.CreateClient();
        var configuredConnection = context.Factory.Services
            .GetRequiredService<IConfiguration>()
            .GetConnectionString("Celd");
        if (configuredConnection != context.connectionString)
        {
            throw new InvalidOperationException(
                $"The test host did not use its isolated SQLite database: {configuredConnection}");
        }

        return context;
    }

    public HttpClient CreateClient() =>
        Factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("http://localhost"),
            HandleCookies = true,
            AllowAutoRedirect = false
        });

    public async Task<HttpClient> SignInAsAsync(string username, string password)
    {
        var client = CreateClient();
        var response = await SignInAsync(client, username, password);
        if (response.StatusCode != HttpStatusCode.OK)
        {
            var detail = await response.Content.ReadAsStringAsync();
            client.Dispose();
            throw new InvalidOperationException($"Test sign-in failed: {detail}");
        }

        response.Dispose();
        return client;
    }

    public async Task<HttpResponseMessage> SignInAsync(
        HttpClient client,
        string username,
        string password) =>
        await PostWithCsrfAsync(
            client,
            "/api/auth/login",
            new { username, password });

    public async Task<HttpResponseMessage> PostWithCsrfAsync(
        HttpClient client,
        string path,
        object? body = null)
    {
        var token = await client.GetFromJsonAsync<CsrfToken>("/api/auth/csrf")
            ?? throw new InvalidOperationException("The test CSRF endpoint returned no token.");
        using var request = new HttpRequestMessage(HttpMethod.Post, path);
        request.Headers.Add("X-CSRF-TOKEN", token.RequestToken);
        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
        }

        return await client.SendAsync(request);
    }

    public async Task InstallHistoryFailureTriggerAsync()
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CeldDbContext>();
        await db.Database.ExecuteSqlRawAsync(
            """
            CREATE TRIGGER IF NOT EXISTS FailHistoryInsert
            BEFORE INSERT ON HistoryEvents
            BEGIN
                SELECT RAISE(ABORT, 'forced history persistence failure');
            END;
            """);
    }

    public async Task DropHistoryFailureTriggerAsync()
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CeldDbContext>();
        await db.Database.ExecuteSqlRawAsync("DROP TRIGGER IF EXISTS FailHistoryInsert;");
    }

    public async Task<int> CountReservationsAsync(int equipmentId)
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CeldDbContext>();
        return await db.Reservations.CountAsync(reservation =>
            reservation.EquipmentItemId == equipmentId);
    }

    public async Task<int> CountHistoryAsync(int equipmentId)
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CeldDbContext>();
        return await db.HistoryEvents.CountAsync(historyEvent =>
            historyEvent.Reservation.EquipmentItemId == equipmentId);
    }

    public async Task<List<string>> ReadReservationRowsAsync()
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CeldDbContext>();
        return await db.Reservations
            .Select(reservation => $"{reservation.Id}:{reservation.EquipmentItemId}:{reservation.Status}")
            .ToListAsync();
    }

    public WebApplicationFactory<Program> CreateAdditionalFactory() => CreateFactory();

    private CeldApiFactory CreateFactory() =>
        new(connectionString, Student1Password, Student2Password, StaffPassword);

    private static string CreateTestPassword() =>
        Convert.ToBase64String(RandomNumberGenerator.GetBytes(24)) + "aA1!";

    public async ValueTask DisposeAsync()
    {
        await Factory.DisposeAsync();
        await anchorConnection.DisposeAsync();
    }

    private sealed record CsrfToken(string RequestToken);

    private sealed class CeldApiFactory(
        string databaseConnectionString,
        string student1Password,
        string student2Password,
        string staffPassword)
        : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Testing");
            builder.ConfigureLogging(logging =>
            {
                logging.ClearProviders();
                logging.SetMinimumLevel(LogLevel.Warning);
            });
            builder.ConfigureAppConfiguration((_, configuration) =>
            {
                configuration.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["ConnectionStrings:Celd"] = databaseConnectionString,
                    ["CELD_SEED_STUDENT1_PASSWORD"] = student1Password,
                    ["CELD_SEED_STUDENT2_PASSWORD"] = student2Password,
                    ["CELD_SEED_STAFF_PASSWORD"] = staffPassword
                });
            });
            builder.ConfigureTestServices(services =>
            {
                services.RemoveAll<CeldDbContext>();
                services.RemoveAll<DbContextOptions<CeldDbContext>>();
                services.AddDbContext<CeldDbContext>(options =>
                    options.UseSqlite(databaseConnectionString));
            });
        }
    }
}
