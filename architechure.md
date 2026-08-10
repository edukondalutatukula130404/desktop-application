# System Architecture & Flow Specifications

## 1. High-Level Architecture Diagram

```
+-------------------------------------------------------------------+
|                        FRONTEND CLIENT                            |
|  +------------------+   +-------------------+  +---------------+  |
|  |  Login / Register|   | Password Strength |  | Toast Manager |  |
|  |     Form UI      |   |    Validator      |  |  Notification |  |
|  +--------+---------+   +---------+---------+  +-------+-------+  |
|           |                       |                    |          |
|           +-------------------+   |   +----------------+          |
|                               |   |   |                           |
|                       +-------v---v---v------+                    |
|                       |  API Client (Fetch)  |                    |
|                       | & Token Manager      |                    |
|                       +-----------+----------+                    |
+-----------------------------------|-------------------------------+
                                    | HTTP / JSON REST
                                    v
+-----------------------------------|-------------------------------+
|                        BACKEND REST SERVER                        |
|                       +-----------+----------+                    |
|                       |  Express App Server  |                    |
|                       +-----------+----------+                    |
|                                   |                               |
|        +--------------------------+--------------------------+    |
|        |                          |                          |    |
|  +-----v--------------+    +------v-------------+     +------v--+ |
|  | Rate Limiter (IP)  |    | Auth Controller    |     | Middleware|
|  +--------------------+    +------+-------------+     +------+--+ |
|                                   |                          |    |
|                        +----------v----------+               |    |
|                        | Password Hashing    |               |    |
|                        | & JWT Token Service |               |    |
|                        +----------+----------+               |    |
|                                   |                          |    |
|                        +----------v----------+               |    |
|                        | Persistent UserDB   |<--------------+    |
|                        |     (userStore)     |                    |
|                        +---------------------+                    |
+-------------------------------------------------------------------+
```

---

## 2. Component Responsibility Breakdown

### 2.1 Backend Layer (`/backend`)
1. **Server (`server.js`)**: Entry point; initializes Express middleware, CORS headers, rate limiters, route mappings, and global error handling.
2. **Routes (`src/routes/authRoutes.js`)**: Maps endpoints (`/register`, `/login`, `/me`, `/forgot-password`) to respective controller handlers.
3. **Controller (`src/controllers/authController.js`)**: Business logic for registration, authentication verification, JWT token creation, and profile fetching.
4. **Middleware (`src/middleware/authMiddleware.js`)**: Verifies incoming `Authorization: Bearer <token>` requests.
5. **Database (`src/db/userStore.js`)**: Abstracted user storage layer handling user creation, lookup by email/id, and JSON file persistence.

### 2.2 Frontend Layer (`/frontend`)
1. **HTML Shell (`index.html`)**: Semantic markup, modal overlays, toast container, Google Fonts integration.
2. **Design System (`src/styles/main.css`)**: Comprehensive CSS system (glassmorphism tokens, focus states, animations, dashboard layout).
3. **API Client (`src/js/api.js`)**: Handles HTTP communications with backend API, headers management, token storage, and error parsing.
4. **Application Logic (`src/js/app.js`)**: Form state management, tab switching, live password strength meter, dynamic toasts, dashboard view rendering, and session management.
