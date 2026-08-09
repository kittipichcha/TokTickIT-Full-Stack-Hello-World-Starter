import { getPrisma } from "./prisma.js";

export interface HealthCheckResponse {
  status: "ok" | "fail";
  error: string | null;
  service: string;
}

export interface Category {
  id: number;
  name: string;
}

export async function checkHealth(): Promise<HealthCheckResponse> {
  try {
    // Check database connection using Prisma
    const prisma = getPrisma();
    await prisma.$queryRaw`SELECT 1`;
    
    return {
      status: "ok",
      error: null,
      service: "TokTickIT API",
    };
  } catch (err) {
    return {
      status: "fail",
      error: "Database connection failed",
      service: "TokTickIT API",
    };
  }
}

export async function getCategories(): Promise<Category[]> {
  try {
    const prisma = getPrisma();
    const categories = await prisma.category.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        id: "asc",
      },
    });
    return categories;
  } catch (err) {
    throw new Error("Failed to fetch categories from database");
  }
}
