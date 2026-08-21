import sql from "@/app/api/utils/sql";
import { getMockStats, hasDatabase } from "@/app/api/utils/mock-data";

// GET - Get dashboard statistics
export async function GET(request) {
  try {
    if (!hasDatabase()) {
      return Response.json(getMockStats());
    }

    const [totalCandidates] =
      await sql`SELECT COUNT(*) as count FROM candidates`;

    const stageStats = await sql`
      SELECT current_stage, COUNT(*) as count 
      FROM candidates 
      GROUP BY current_stage
    `;

    const [documentStats] = await sql`
      SELECT 
        COUNT(*) FILTER (WHERE verification_status = 'verified') as verified,
        COUNT(*) FILTER (WHERE verification_status = 'uploaded') as pending,
        COUNT(*) FILTER (WHERE verification_status = 'rejected') as rejected
      FROM documents
    `;

    const [paymentStats] = await sql`
      SELECT 
        COUNT(*) FILTER (WHERE payment_status = 'paid') as paid,
        COUNT(*) FILTER (WHERE payment_status = 'pending') as pending,
        SUM(amount) FILTER (WHERE payment_status = 'paid') as total_collected
      FROM payments
    `;

    return Response.json({
      totalCandidates: parseInt(totalCandidates.count),
      stageStats,
      documentStats,
      paymentStats,
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    return Response.json(
      { error: "Failed to fetch statistics" },
      { status: 500 },
    );
  }
}
