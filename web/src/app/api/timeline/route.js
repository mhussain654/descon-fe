import { upsertTimelineStage } from "@/app/api/utils/mock-db";

// POST - Update candidate timeline stage
export async function POST(request) {
  try {
    const body = await request.json();
    const { candidate_id, stage_name, stage_status, notes, updated_by } = body;

    if (!candidate_id || !stage_name || !stage_status) {
      return Response.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const timeline = upsertTimelineStage({
      candidate_id,
      stage_name,
      stage_status,
      notes,
      updated_by,
    });

    return Response.json({ timeline });
  } catch (error) {
    console.error("Error updating timeline:", error);
    return Response.json(
      { error: "Failed to update timeline" },
      { status: 500 },
    );
  }
}
