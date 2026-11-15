$project = Join-Path $PSScriptRoot '..\server\CELD.Api\CELD.Api.csproj'
$passwordKeys = @(
    'CELD_SEED_STUDENT1_PASSWORD',
    'CELD_SEED_STUDENT2_PASSWORD',
    'CELD_SEED_STAFF_PASSWORD'
)
$previousValues = @{}
$exitCode = 0

try {
    foreach ($key in $passwordKeys) {
        $previousValues[$key] = [Environment]::GetEnvironmentVariable($key, 'Process')
        $secret = Read-Host "Set $key (minimum 12 characters)" -AsSecureString
        if ($secret.Length -lt 12) {
            throw "$key must contain at least 12 characters."
        }

        $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
        try {
            $value = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
            [Environment]::SetEnvironmentVariable($key, $value, 'Process')
        }
        finally {
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
        }
    }

    & dotnet run --project $project
    $exitCode = $LASTEXITCODE
}
finally {
    foreach ($key in $passwordKeys) {
        [Environment]::SetEnvironmentVariable($key, $previousValues[$key], 'Process')
    }
}

exit $exitCode
