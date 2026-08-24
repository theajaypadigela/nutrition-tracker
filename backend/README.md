# Backend Deployment Guide (EC2)

This backend can be deployed without the frontend, using only backend files.

## 1) Build the JAR

```bash
cd backend
./mvnw clean package -DskipTests
```

Output JAR:

- `target/habitbuilder-0.0.1-SNAPSHOT.jar`

## 2) Configure backend properties (inside backend only)

Edit:

- `src/main/resources/application.properties`

Set these values before packaging:

- `server.port`
- `spring.data.mongodb.uri`
- `jwt.secret`
- `cors.allowed-origins`
- Optional AI and voice settings (`ai.provider`, `gemini.api.*`, `groq.api.*`, `vapi.*`)

### iOS VoIP notification delivery

Server-driven iOS CallKit invitations are disabled by default. Set all of these environment
variables on a backend that can make outbound HTTP/2 connections to APNs:

- `APNS_VOIP_ENABLED=true`
- `APNS_VOIP_TEAM_ID` — Apple Developer Team ID
- `APNS_VOIP_KEY_ID` — identifier of the APNs signing key
- `APNS_VOIP_PRIVATE_KEY_BASE64` — base64 of the complete downloaded `.p8` file (or its
  PKCS#8 DER bytes); never commit this value
- `APNS_VOIP_BUNDLE_ID` — the iOS app bundle identifier, without the `.voip` suffix
- `APNS_VOIP_ENVIRONMENT=production` for App Store/TestFlight builds, or `sandbox` for
  development-signed builds

Optional tuning variables are `APNS_VOIP_CONNECT_TIMEOUT_MS` (default `10000`),
`APNS_VOIP_REQUEST_TIMEOUT_MS` (default `10000`), `APNS_VOIP_DUE_WINDOW_SECONDS` (default
`120`, clamped to 60–300), `APNS_VOIP_RETRY_BACKOFF_SECONDS` (default `30`), and
`APNS_VOIP_MAX_ATTEMPTS` (default `3`, clamped to 1–10).

The authenticated `POST /notifications/ios/voip-token` endpoint returns `503` unless the
feature is enabled and the signing key can be parsed. This is intentional: iOS only disables
its local reminder fallback after a successful registration. `DELETE` remains available so an
installation can unregister even when APNs delivery has subsequently been disabled.

## 3) Create a systemd service

Create `/etc/systemd/system/nutrition-backend.service`:

```ini
[Unit]
Description=Nutrition Tracker Backend
After=network.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/opt/nutrition-tracker/backend
ExecStart=/usr/bin/java -jar /opt/nutrition-tracker/backend/habitbuilder.jar
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

## 4) Copy the JAR and start service

Copy your built JAR to EC2 as:

- `/opt/nutrition-tracker/backend/habitbuilder.jar`

Then run:

```bash
sudo systemctl daemon-reload
sudo systemctl enable nutrition-backend
sudo systemctl start nutrition-backend
sudo systemctl status nutrition-backend
```

Logs:

```bash
journalctl -u nutrition-backend -f
```

## 5) Open port on EC2 security group

Allow inbound TCP to your backend port (default `8080`) from the trusted sources only.

## 6) Optional reverse proxy (recommended)

Put Nginx in front and expose backend via HTTPS on your domain.

## Local development

Run directly from backend:

```bash
cd backend
./mvnw spring-boot:run
```

If you want detached/background startup with Maven plugin:

```bash
cd backend
./mvnw compile spring-boot:start
./mvnw spring-boot:stop
```
