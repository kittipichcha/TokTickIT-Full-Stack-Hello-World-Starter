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

## 📦 Installation

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

### Server Tests
```bash
cd server
npm test
```

### Client Tests
```bash
cd client
npm test
```

## 🌐 API Endpoints

The server runs on `http://localhost:3000`. Check `server/src/app.ts` for available endpoints.

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