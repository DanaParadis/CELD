namespace CELD.Api.Data;

public static class AccountRoles
{
    public const string Student = "Student";
    public const string Staff = "Staff";
}

public static class ReservationStatuses
{
    public const string Reserved = "Reserved";
    public const string CheckedOut = "CheckedOut";
    public const string Cancelled = "Cancelled";
    public const string Returned = "Returned";

    public static readonly string[] All =
    [
        Reserved,
        CheckedOut,
        Cancelled,
        Returned
    ];

    public static bool IsActive(string status) =>
        status is Reserved or CheckedOut;
}

public sealed class Account
{
    public int Id { get; set; }
    public required string Username { get; set; }
    public required string DisplayName { get; set; }
    public required string PasswordHash { get; set; }
    public required string Role { get; set; }
}

public sealed class EquipmentItem
{
    public int Id { get; set; }
    public required string AssetCode { get; set; }
    public required string Name { get; set; }
    public required string Category { get; set; }
    public required string Description { get; set; }
}

public sealed class Reservation
{
    public int Id { get; set; }
    public int EquipmentItemId { get; set; }
    public EquipmentItem EquipmentItem { get; set; } = null!;
    public int StudentId { get; set; }
    public Account Student { get; set; } = null!;
    public required string Status { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
    public ICollection<ReservationHistoryEvent> HistoryEvents { get; set; } =
        new List<ReservationHistoryEvent>();
}

public sealed class ReservationHistoryEvent
{
    public int Id { get; set; }
    public int ReservationId { get; set; }
    public Reservation Reservation { get; set; } = null!;
    public required string Status { get; set; }
    public required string EventType { get; set; }
    public int ActorId { get; set; }
    public Account Actor { get; set; } = null!;
    public DateTimeOffset OccurredAtUtc { get; set; }
}
