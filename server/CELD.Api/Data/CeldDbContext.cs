using Microsoft.EntityFrameworkCore;

namespace CELD.Api.Data;

public sealed class CeldDbContext(DbContextOptions<CeldDbContext> options)
    : DbContext(options)
{
    public DbSet<Account> Accounts => Set<Account>();
    public DbSet<EquipmentItem> EquipmentItems => Set<EquipmentItem>();
    public DbSet<Reservation> Reservations => Set<Reservation>();
    public DbSet<ReservationHistoryEvent> HistoryEvents => Set<ReservationHistoryEvent>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Account>()
            .HasIndex(account => account.Username)
            .IsUnique();

        modelBuilder.Entity<EquipmentItem>()
            .HasIndex(item => item.AssetCode)
            .IsUnique();

        modelBuilder.Entity<Reservation>()
            .HasIndex(reservation => reservation.EquipmentItemId)
            .IsUnique()
            .HasFilter("\"Status\" IN ('Reserved', 'CheckedOut')");

        modelBuilder.Entity<Reservation>()
            .HasOne(reservation => reservation.EquipmentItem)
            .WithMany()
            .HasForeignKey(reservation => reservation.EquipmentItemId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Reservation>()
            .HasOne(reservation => reservation.Student)
            .WithMany()
            .HasForeignKey(reservation => reservation.StudentId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<ReservationHistoryEvent>()
            .HasOne(historyEvent => historyEvent.Reservation)
            .WithMany(reservation => reservation.HistoryEvents)
            .HasForeignKey(historyEvent => historyEvent.ReservationId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<ReservationHistoryEvent>()
            .HasOne(historyEvent => historyEvent.Actor)
            .WithMany()
            .HasForeignKey(historyEvent => historyEvent.ActorId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
