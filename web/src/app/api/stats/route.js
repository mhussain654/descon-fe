import { getDashboardStats } from "@/app/api/utils/mock-db";

// GET - Get dashboard statistics
export async function GET(request) {
  try {
    return Response.json(getDashboardStats());
  } catch (error) {
    console.error("Error fetching stats:", error);
    return Response.json(
      { error: "Failed to fetch statistics" },
      { status: 500 },
    );
  }
}
