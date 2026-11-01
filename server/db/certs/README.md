Public trust anchor downloaded from Supabase's certificate distribution:
https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt

Supabase Root 2021 CA; expires April 26, 2031. SHA-256:
`80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`

This is a public CA certificate, not a credential. The driver verifies both its certificate chain and the database hostname. Replace the trust anchor when Supabase rotates its CA; never disable TLS validation to work around a certificate error.

Reference: https://supabase.com/docs/guides/platform/ssl-enforcement
