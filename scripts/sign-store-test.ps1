# Run only on an ephemeral Windows CI runner. Does not install the application.
$ErrorActionPreference = 'Stop'
$source = @(Get-ChildItem 'source-store-package/*.appx')
if ($source.Count -ne 1) { throw 'Expected exactly one source package' }
$expected = 'd60a72e53bb3064ac3eb2605df9d3632b7800892e32af7a90ae40b58e70d8512'
if ((Get-FileHash $source[0].FullName -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected) {
    throw 'Source package differs from the package validated in Partner Center'
}
$out = New-Item -ItemType Directory -Path 'release-windows-test' -Force
$package = Join-Path $out.FullName 'Inklura-PDF-1.4.0-TEST-ONLY.appx'
Copy-Item $source[0].FullName $package
Copy-Item 'WINDOWS_TEST.fr.txt' (Join-Path $out.FullName 'LIRE-EN-PREMIER.txt')
$tools = @(Get-ChildItem "${env:ProgramFiles(x86)}/Windows Kits/10/bin/*/x64/signtool.exe" | Sort-Object FullName -Descending)
if (-not $tools.Count) { throw 'Windows SDK SignTool is required' }
$signtool = $tools[0].FullName
$cert = $null
$trusted = $null
try {
    $cert = New-SelfSignedCertificate -Type Custom -KeyUsage DigitalSignature `
        -Subject 'CN=235F0568-FD70-4528-8D32-8E37822DF41D' `
        -CertStoreLocation 'Cert:\CurrentUser\My' -KeyExportPolicy NonExportable `
        -TextExtension @('2.5.29.37={text}1.3.6.1.5.5.7.3.3', '2.5.29.19={text}') `
        -FriendlyName 'Inklura PDF - TEST ONLY - 14 days' `
        -NotAfter (Get-Date).AddDays(14)
    $cerPath = Join-Path $out.FullName 'Inklura-PDF-TEST-ONLY.cer'
    Export-Certificate -Cert $cert -FilePath $cerPath | Out-Null
    & $signtool sign /fd SHA256 /s My /sha1 $cert.Thumbprint $package
    if ($LASTEXITCODE -ne 0) { throw 'Test signing failed' }
    # Temporary leaf trust on this disposable runner, solely for signature verification.
    $trusted = Import-Certificate -FilePath $cerPath -CertStoreLocation 'Cert:\LocalMachine\TrustedPeople'
    & $signtool verify /pa /v $package
    if ($LASTEXITCODE -ne 0) { throw 'Signature verification failed' }
    # Signing must not change any app payload or manifest bytes.
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $before = [IO.Compression.ZipFile]::OpenRead($source[0].FullName)
    $after = [IO.Compression.ZipFile]::OpenRead($package)
    try {
        $sha = [Security.Cryptography.SHA256]::Create()
        try {
            foreach ($entry in $before.Entries) {
                if ($entry.FullName -eq '[Content_Types].xml') { continue }
                $other = $after.GetEntry($entry.FullName)
                if ($null -eq $other) { throw "Missing signed entry: $($entry.FullName)" }
                $a = $entry.Open(); $b = $other.Open()
                try {
                    if ([Convert]::ToBase64String($sha.ComputeHash($a)) -ne [Convert]::ToBase64String($sha.ComputeHash($b))) {
                        throw "Signing changed payload: $($entry.FullName)"
                    }
                } finally { $a.Dispose(); $b.Dispose() }
            }
            foreach ($entry in $after.Entries) {
                if ($null -eq $before.GetEntry($entry.FullName) -and $entry.FullName -ne 'AppxSignature.p7x') {
                    throw "Unexpected added entry: $($entry.FullName)"
                }
            }
        } finally { $sha.Dispose() }
    } finally { $before.Dispose(); $after.Dispose() }
    [ordered]@{
        purpose = 'Internal Windows installation test only; not a public release or Store update test'
        source_run = 'https://github.com/benfavre/caviard/actions/runs/41039014119'
        source_sha256 = $expected
        package_sha256 = (Get-FileHash $package -Algorithm SHA256).Hash.ToLowerInvariant()
        certificate_sha256 = (Get-FileHash $cerPath -Algorithm SHA256).Hash.ToLowerInvariant()
        certificate_thumbprint = $cert.Thumbprint
        certificate_expires = $cert.NotAfter.ToUniversalTime().ToString('o')
        payload_unchanged = $true
        signature_verified = $true
        native_installed_test = 'NOT PERFORMED'
        private_key = 'Non-exportable; deleted at end of job; never distributed'
    } | ConvertTo-Json | Set-Content (Join-Path $out.FullName 'verification.json') -Encoding utf8
    "Empreinte du certificat de test : $($cert.Thumbprint)`r`nExpiration : $($cert.NotAfter.ToUniversalTime().ToString('o'))" |
        Set-Content (Join-Path $out.FullName 'CERTIFICAT.txt') -Encoding utf8
} finally {
    if ($trusted) { Remove-Item "Cert:\LocalMachine\TrustedPeople\$($trusted.Thumbprint)" }
    if ($cert) { Remove-Item "Cert:\CurrentUser\My\$($cert.Thumbprint)" -DeleteKey }
}
