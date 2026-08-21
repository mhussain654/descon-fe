import sql from "@/app/api/utils/sql";

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

    // Check if stage already exists
    const existing = await sql`
      SELECT * FROM status_timeline 
      WHERE candidate_id = ${candidate_id} AND stage_name = ${stage_name}
    `;

    let result;
    if (existing.length > 0) {
      // Update existing stage
      result = await sql`
        UPDATE status_timeline 
        SET stage_status = ${stage_status},
            completed_date = ${stage_status === "completed" ? sql`CURRENT_TIMESTAMP` : null},
            notes = ${notes || null},
            updated_by = ${updated_by || null}
        WHERE candidate_id = ${candidate_id} AND stage_name = ${stage_name}
        RETURNING *
      `;
    } else {
      // Create new stage
      result = await sql`
        INSERT INTO status_timeline (candidate_id, stage_name, stage_status, completed_date, notes, updated_by)
        VALUES (
          ${candidate_id}, 
          ${stage_name}, 
          ${stage_status}, 
          ${stage_status === "completed" ? sql`CURRENT_TIMESTAMP` : null},
          ${notes || null},
          ${updated_by || null}
        )
        RETURNING *
      `;
    }

    // Update candidate's current stage
    await sql`
      UPDATE candidates 
      SET current_stage = ${stage_name}
      WHERE id = ${candidate_id}
    `;

    return Response.json({ timeline: result[0] });
  } catch (error) {
    console.error("Error updating timeline:", error);
    return Response.json(
      { error: "Failed to update timeline" },
      { status: 500 },
    );
  }
}
