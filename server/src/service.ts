import { getPrisma } from "./prisma.js";

export interface HealthCheckResponse {
  status: "ok" | "fail";
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
      service: "TokTickIT API",
    };
  } catch (err) {
    return {
      status: "fail",
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
      orderBy: [
    { id: "asc" },
    { name: "asc" },]
    });
    return categories;
  } catch (err) {
    throw new Error("Failed to fetch categories from database");
  }
}
