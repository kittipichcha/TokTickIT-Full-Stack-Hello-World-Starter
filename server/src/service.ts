export interface HealthCheckResponse {
  status: "ok" | "fail";
  error: string | null;
  service: string;
}

export async function checkHealth(): Promise<HealthCheckResponse> {
  try {
    // Simulate health check logic
    // In a real application, you might check database connection, etc.
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
