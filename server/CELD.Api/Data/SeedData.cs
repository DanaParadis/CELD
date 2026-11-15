using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace CELD.Api.Data;

public static class SeedData
{
    public static async Task InitializeAsync(
        IServiceProvider services,
        IConfiguration configuration)
    {
        await using var scope = services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CeldDbContext>();
        await db.Database.EnsureCreatedAsync();

        if (!await db.EquipmentItems.AnyAsync())
        {
            db.EquipmentItems.AddRange(
                new EquipmentItem
                {
                    AssetCode = "CELD-001",
                    Name = "Dell Latitude Laptop",
                    Category = "Computers",
                    Description = "Portable laptop for academic work."
                },
                new EquipmentItem
                {
                    AssetCode = "CELD-002",
                    Name = "HP ProBook Laptop",
                    Category = "Computers",
                    Description = "Portable laptop for coursework."
                },
                new EquipmentItem
                {
                    AssetCode = "CELD-003",
                    Name = "Logitech Wireless Mouse",
                    Category = "Accessories",
                    Description = "Wireless mouse for campus use."
                },
                new EquipmentItem
                {
                    AssetCode = "CELD-004",
                    Name = "Mechanical Keyboard",
                    Category = "Accessories",
                    Description = "External keyboard for a workstation."
                },
                new EquipmentItem
                {
                    AssetCode = "CELD-005",
                    Name = "Dell External Monitor",
                    Category = "Monitors",
                    Description = "External display for academic work."
                },
                new EquipmentItem
                {
                    AssetCode = "CELD-006",
                    Name = "Samsung Tablet",
                    Category = "Tablets",
                    Description = "Portable tablet for campus activities."
                });
            await db.SaveChangesAsync();
        }

        var passwordHasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher<Account>>();
        await EnsureAccountAsync(
            db,
            passwordHasher,
            configuration,
            "student1",
            "Student One",
            AccountRoles.Student,
            "CELD_SEED_STUDENT1_PASSWORD");
        await EnsureAccountAsync(
            db,
            passwordHasher,
            configuration,
            "student2",
            "Student Two",
            AccountRoles.Student,
            "CELD_SEED_STUDENT2_PASSWORD");
        await EnsureAccountAsync(
            db,
            passwordHasher,
            configuration,
            "staff1",
            "Lending Staff",
            AccountRoles.Staff,
            "CELD_SEED_STAFF_PASSWORD");
    }

    private static async Task EnsureAccountAsync(
        CeldDbContext db,
        IPasswordHasher<Account> passwordHasher,
        IConfiguration configuration,
        string username,
        string displayName,
        string role,
        string passwordKey)
    {
        var existingAccount = await db.Accounts.SingleOrDefaultAsync(
            account => account.Username == username);
        var password = configuration[passwordKey];
        if (existingAccount is not null)
        {
            if (string.IsNullOrWhiteSpace(password))
            {
                return;
            }

            ValidatePassword(password, passwordKey);
            existingAccount.PasswordHash = passwordHasher.HashPassword(existingAccount, password);
            await db.SaveChangesAsync();
            return;
        }

        if (string.IsNullOrWhiteSpace(password))
        {
            throw new InvalidOperationException(
                $"Set {passwordKey} before starting CELD for the first time.");
        }
        ValidatePassword(password, passwordKey);

        var account = new Account
        {
            Username = username,
            DisplayName = displayName,
            PasswordHash = string.Empty,
            Role = role
        };
        account.PasswordHash = passwordHasher.HashPassword(account, password);
        db.Accounts.Add(account);
        await db.SaveChangesAsync();
    }

    private static void ValidatePassword(string password, string passwordKey)
    {
        if (password.Length < 12)
        {
            throw new InvalidOperationException(
                $"{passwordKey} must contain at least 12 characters.");
        }
    }
}
