import { getPrisma } from "./prisma.js";

export interface HealthCheckResponse {
  status: "ok" | "fail";
  error: string | null;
  service: string;
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
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return {
      status: "fail",
      error: errorMessage,
      service: "TokTickIT API",
    };
  }
}
