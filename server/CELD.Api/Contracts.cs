namespace CELD.Api;

public sealed record CsrfTokenDto(string RequestToken);
public sealed record LoginRequest(string Username, string Password);
public sealed record CurrentUserDto(int Id, string DisplayName, string Role);
public sealed record AuthSessionDto(bool IsAuthenticated, CurrentUserDto? User);
public sealed record ReserveRequest(int EquipmentId);
public sealed record EquipmentDto(
    int Id,
    string AssetCode,
    string Name,
    string Category,
    string Description,
    bool IsAvailable);
public sealed record EquipmentSummaryDto(
    int Id,
    string AssetCode,
    string Name,
    string Category,
    string Availability);
public sealed record AccountSummaryDto(int Id, string DisplayName);
public sealed record HistoryEventDto(
    int Id,
    string EventType,
    string Status,
    string ActorDisplayName,
    DateTimeOffset OccurredAtUtc);
public sealed record ReservationDto(
    int Id,
    string Status,
    DateTimeOffset CreatedAtUtc,
    EquipmentSummaryDto Equipment,
    AccountSummaryDto Student,
    IReadOnlyList<HistoryEventDto> History);
