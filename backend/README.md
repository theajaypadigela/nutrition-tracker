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
