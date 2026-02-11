# Nutrition Tracker

A full-stack nutrition tracking application with a React Native mobile frontend and Spring Boot backend.

## Project Structure

```
.
├── frontend/          # React Native mobile application
│   ├── src/           # Source code
│   ├── android/       # Android native code
│   ├── ios/           # iOS native code
│   └── ...
│
├── backend/           # Spring Boot REST API
│   ├── src/           # Java source code
│   ├── pom.xml        # Maven configuration
│   └── ...
│
└── README.md          # This file
```

## Frontend (React Native)

The mobile application is built with React Native, featuring:
- NativeWind for styling
- Gluestack UI components

### Getting Started

```bash
cd frontend
npm install
npm run android  # For Android
npm run ios      # For iOS
```

## Backend (Spring Boot)

The REST API is built with Spring Boot and Java.

### Getting Started

```bash
cd backend
./mvnw spring-boot:run
```

## Development

Each project can be developed independently. Refer to the README in each subdirectory for specific instructions.
