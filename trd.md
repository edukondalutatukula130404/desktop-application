# Technical Requirements Document (TRD) - Modern Authentication System

## 1. System Architecture Overview
The application follows a decoupled Client-Server architecture:
- **Client (Frontend)**: Vite + HTML5 + CSS3 + Modular Vanilla JavaScript client communicating via async HTTP REST endpoints.
- **Server (Backend)**: Node.js + Express REST API handling auth logic, validation, password hashing, and token issuance.
- **Storage**: Persistent JSON File / SQLite store (`userStore.js`).

---

## 2. Technical Stack Specifications

### 2.1 Backend Environment
- **Runtime**: Node.js (v18+)
- **Framework**: Express.js (v4.x)
- **Security Packages**:
  - `bcryptjs` (v2.4.x) for hashing & verifying passwords.
  - `jsonwebtoken` (v9.x) for JWT token signing and verification.
  - `express-rate-limit` (v7.x) for rate limiting API calls.
  - `cors` (v2.8.x) for cross-origin request configuration.

### 2.2 Frontend Environment
- **Build Tool / Dev Server**: Vite (v5.x)
- **Styling**: Modern CSS3 (CSS Variables, Flexbox, Grid, Backdrop Filters, Keyframe Animations)
- **Icons & Typography**: Google Font `Outfit`, SVG icons

---

## 3. API Contract Specifications

### Base URL: `/api/auth`

#### 3.1 `POST /api/auth/register`
- **Request Body**:
  ```json
  {
    "name": "Jane Doe",
    "email": "jane@example.com",
    "password": "SecurePassword123!"
  }
  ```
- **Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "User registered successfully",
    "token": "eyJhbGciOiJIUzI1NiIsIn...",
    "user": {
      "id": "usr_123456",
      "name": "Jane Doe",
      "email": "jane@example.com",
      "createdAt": "2026-08-10T15:00:00.000Z"
    }
  }
  ```

#### 3.2 `POST /api/auth/login`
- **Request Body**:
  ```json
  {
    "email": "jane@example.com",
    "password": "SecurePassword123!"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Authentication successful",
    "token": "eyJhbGciOiJIUzI1NiIsIn...",
    "user": {
      "id": "usr_123456",
      "name": "Jane Doe",
      "email": "jane@example.com"
    }
  }
  ```

#### 3.3 `GET /api/auth/me`
- **Headers**: `Authorization: Bearer <token>`
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "user": {
      "id": "usr_123456",
      "name": "Jane Doe",
      "email": "jane@example.com",
      "createdAt": "2026-08-10T15:00:00.000Z"
    }
  }
  ```

#### 3.4 `POST /api/auth/forgot-password`
- **Request Body**: `{ "email": "jane@example.com" }`
- **Response (200 OK)**: `{ "success": true, "message": "Password reset instructions sent" }`

---

## 4. Security Requirements
1. **Password Hashing**: Salt factor 10 using `bcryptjs`. Raw passwords must never be logged or stored.
2. **JWT Secret**: Configured via environment variable (`JWT_SECRET`). Tokens expire in 24 hours.
3. **Input Sanitization**: Email normalized to lowercase; inputs validated for length and valid formats.
4. **Rate Limiting**: Auth endpoints throttled to 10 requests per 15 minutes per IP address.
