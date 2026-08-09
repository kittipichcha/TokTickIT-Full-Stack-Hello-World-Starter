# TokTickIT - Full Stack Application

A modern full-stack web application built with **React**, **Express**, **TypeScript**, and **Prisma ORM**. This project provides a scalable foundation for building feature-rich applications with a responsive frontend and robust backend API.

## 📋 Table of Contents

- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Setup](#environment-setup)
- [Running the Application](#running-the-application)
- [Available Scripts](#available-scripts)
- [Database Management](#database-management)
- [Testing](#testing)
- [Deployment](#deployment)

## 🛠 Tech Stack

### Frontend
- **React** 18.3 - UI library
- **Vite** 6.0 - Build tool and dev server
- **TypeScript** 5.7 - Type-safe JavaScript
- **Bootstrap** 5.3 - CSS framework
- **Vitest** 2.1 - Unit testing framework

### Backend
- **Express** 4.21 - Web framework
- **Node.js** - Runtime
- **TypeScript** 5.7 - Type-safe JavaScript
- **Prisma** 5.22 - ORM for database management
- **PostgreSQL** - Database
- **Vitest** 2.1 - Unit testing framework
- **Supertest** 7.0 - HTTP assertion library

## ✨ Project Status

### ✅ Implemented Features

| Feature | Status | Details |
|---------|--------|---------|
| **Project Foundation** | ✅ Complete | Full-stack setup with React, Express, TypeScript, and Prisma |
| **Health Check Endpoint** | ✅ Complete | `GET /api/health` returns status and service name |
| **Category Model & Seed** | ✅ Complete | Prisma schema with Category table, seeded with 4 categories |
| **Category List API** | ✅ Complete | `GET /api/categories` returns sorted category list |
| **Frontend UI** | ✅ Complete | React components with "Check System" and "Load Categories" buttons |
| **Full Test Suite** | ✅ Complete | 11 backend tests + 6 frontend tests all passing |
| **Build System** | ✅ Complete | Both server and client build successfully |

### 🧪 Test Results (Latest Run)

**Server Tests:** ✅ 11/11 PASS  
- Health endpoint tests (unit + integration)
- Category endpoint tests (unit + integration) 
- Composite sort validation (ID primary, name secondary)
- Error handling tests

**Client Tests:** ✅ 6/6 PASS
- Component rendering tests
- State management tests
- API integration tests
- Button functionality tests

**Build Status:** ✅ Both builds successful
- Server: TypeScript compilation complete (0 errors)
- Client: Vite production build complete

## 📁 Project Structure

```
toktickit/
├── client/                          # React frontend application
│   ├── src/
│   │   ├── App.tsx                 # Root component
│   │   ├── main.tsx                # React entry point
│   │   ├── api.ts                  # API client utilities
│   │   └── vite-env.d.ts           # Vite type definitions
│   ├── index.html                  # HTML entry point
│   ├── package.json                # Client dependencies
│   ├── tsconfig.json               # TypeScript configuration
│   ├── vite.config.ts              # Vite configuration
│   └── .env.example                # Environment variables template
│
├── server/                          # Express backend application
│   ├── src/
│   │   ├── index.ts                # Server entry point
│   │   ├── app.ts                  # Express app configuration
│   │   └── prisma.ts               # Prisma client setup
│   ├── prisma/
│   │   ├── schema.prisma           # Database schema
│   │   └── seed.ts                 # Database seeding script
│   ├── package.json                # Server dependencies
│   ├── tsconfig.json               # TypeScript configuration
│   ├── vitest.config.ts            # Vitest configuration
│   └── .env.example                # Environment variables template
│
└── README.md                        # This file
```

## ✅ Prerequisites

Before you begin, make sure you have the following installed:

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **npm** 9+ (comes with Node.js)
- **PostgreSQL** 12+ ([Download](https://www.postgresql.org/download/))
- **Git** ([Download](https://git-scm.com/))

## � Quick Start

Get the application running in 5 minutes:

```bash
# 1. Install server dependencies
cd server
npm install
npm run prisma:migrate
npm run prisma:seed

# 2. Install client dependencies (new terminal)
cd ../client
npm install

# 3. Start the server (Terminal 1)
cd server
npm run dev

# 4. Start the client (Terminal 2)
cd client
npm run dev

# 5. Open browser and navigate to http://localhost:5173
# Click "Check System" to verify connection
# Click "Load Categories" to fetch and display categories
```

**Troubleshooting:** If the server can't connect to the database, verify your `.env` file in the `server/` directory has the correct `DATABASE_URL`.

## �📦 Installation

### 1. Clone the Repository
```bash
git clone <repository-url>
cd toktickit
```

### 2. Install Dependencies

#### Install Server Dependencies
```bash
cd server
npm install
```

#### Install Client Dependencies
```bash
cd ../client
npm install
```

## 🔐 Environment Setup

### Server Configuration

1. Copy the environment template:
```bash
cd server
cp .env.example .env
```

2. Edit `.env` and configure your database connection:
```env
DATABASE_URL="postgresql://toktickit:toktickit@localhost:5432/toktickit?schema=public"
PORT=3000
```

**Database Connection String Format:**
```
postgresql://[user]:[password]@[host]:[port]/[database]?schema=public
```

### Client Configuration

1. Copy the environment template:
```bash
cd client
cp .env.example .env
```

2. Update `.env` if your API runs on a different host/port:
```env
VITE_API_URL="http://localhost:3000"
```

## 🚀 Running the Application

### Option 1: Run Both Concurrently (Recommended for Development)

From the project root, run both services:

#### Terminal 1 - Start Server
```bash
cd server
npm run dev
```
The API will be available at `http://localhost:3000`

#### Terminal 2 - Start Client
```bash
cd client
npm run dev
```
The frontend will be available at `http://localhost:5173`

### Option 2: Run Individually

#### Start Server Only
```bash
cd server
npm run dev
```

#### Start Client Only
```bash
cd client
npm run dev
```

## 📝 Available Scripts

### Server Scripts
```bash
cd server

# Development server with hot-reload
npm run dev

# Build for production
npm run build

# Start production build
npm start

# Run database migrations
npm run prisma:migrate

# Seed the database with initial data
npm run prisma:seed

# Run tests
npm test
```

### Client Scripts
```bash
cd client

# Development server with hot-reload
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview

# Run tests
npm test
```

## 🗄️ Database Management

### Initialize Database

1. **Create PostgreSQL Database**
   ```sql
   CREATE DATABASE toktickit;
   CREATE USER toktickit WITH PASSWORD 'toktickit';
   ALTER ROLE toktickit SET client_encoding TO 'utf8';
   GRANT ALL PRIVILEGES ON DATABASE toktickit TO toktickit;
   ```

2. **Run Prisma Migrations**
   ```bash
   cd server
   npm run prisma:migrate
   ```
   This will run all pending migrations and update your database schema.

3. **Seed Database (Optional)**
   ```bash
   npm run prisma:seed
   ```
   Populates the database with initial/test data.

### Update Schema

1. Modify `server/prisma/schema.prisma`
2. Run migrations:
   ```bash
   npm run prisma:migrate
   ```
3. Prisma Client will automatically regenerate

### Access Database Directly

```bash
cd server
npx prisma studio
```
Opens Prisma Studio at `http://localhost:5555` for visual database management.

## 🧪 Testing

### Run All Tests

**Server Tests:**
```bash
cd server
npm test
```
Result: ✅ 11/11 tests passing
- Health endpoint validation
- Category list retrieval and sorting
- Error handling

**Client Tests:**
```bash
cd client
npm test
```
Result: ✅ 6/6 tests passing
- Component rendering
- Button interactions
- API integration
- Error states

### Test Coverage

The project includes:
- **Unit Tests:** Fast, isolated component and service tests with mocks
- **Integration Tests:** Full-stack tests with real database connections
- **React Component Tests:** Vitest + React Testing Library
- **API Tests:** Supertest HTTP assertion library

### Example Test Run
```bash
cd server && npm test
# Output:
# ✓ Test Files  4 passed (4)
#     Tests  11 passed (11)
#    Duration  6.63s
```

## 🌐 API Endpoints

The server runs on `http://localhost:3000`. The following endpoints are currently implemented:

### Health Check
```
GET /api/health
```
**Response (200 OK):**
```json
{
  "status": "ok",
  "service": "TokTickIT API"
}
```
Validates backend connectivity and service status.

### Categories List
```
GET /api/categories
```
**Response (200 OK):**
```json
[
  { "id": 1, "name": "Account and Access" },
  { "id": 2, "name": "Hardware" },
  { "id": 3, "name": "Software" },
  { "id": 4, "name": "Network" }
]
```
Returns all categories from the database, sorted by ID (ascending) and then by name (ascending).

## 🚢 Deployment

### Build for Production

#### Server
```bash
cd server
npm run build
npm start
```

#### Client
```bash
cd client
npm run build
```

The built files will be in `client/dist/`.

### Environment Variables for Production
- Update `.env` files with production values
- Ensure `DATABASE_URL` points to production database
- Update `VITE_API_URL` in client for production API URL

## 🐛 Troubleshooting

### Port Already in Use
- Server (3000): `lsof -ti:3000 | xargs kill -9` (macOS/Linux) or use Windows Task Manager
- Client (5173): Vite will auto-increment the port

### Database Connection Error
- Verify PostgreSQL is running
- Check `DATABASE_URL` in `.env` matches your setup
- Ensure user has proper permissions

### Prisma Errors
```bash
# Regenerate Prisma Client
cd server
npx prisma generate
```

### Node Modules Issues
```bash
# Clear and reinstall
rm -rf node_modules package-lock.json
npm install
```

## 📚 Additional Resources

- [React Documentation](https://react.dev/)
- [Express Documentation](https://expressjs.com/)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [Vite Documentation](https://vitejs.dev/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)

## 📄 License

This project is licensed under the MIT License.

## 👥 Contributors

- TokTickIT Team

---

**Happy coding! 🚀**