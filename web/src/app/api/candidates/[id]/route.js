import sql from "@/app/api/utils/sql";

// GET - Get single candidate with documents and timeline
export async function GET(request, { params }) {
  try {
    const { id } = params;

    const [candidate] = await sql`SELECT * FROM candidates WHERE id = ${id}`;

    if (!candidate) {
      return Response.json({ error: "Candidate not found" }, { status: 404 });
    }

    const documents =
      await sql`SELECT * FROM documents WHERE candidate_id = ${id} ORDER BY upload_date DESC`;
    const timeline =
      await sql`SELECT * FROM status_timeline WHERE candidate_id = ${id} ORDER BY created_at ASC`;
    const payments =
      await sql`SELECT * FROM payments WHERE candidate_id = ${id} ORDER BY created_at DESC`;

    return Response.json({
      candidate,
      documents,
      timeline,
      payments,
    });
  } catch (error) {
    console.error("Error fetching candidate:", error);
    return Response.json(
      { error: "Failed to fetch candidate" },
      { status: 500 },
    );
  }
}

// PATCH - Update candidate
export async function PATCH(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();

    const setClauses = [];
    const values = [];
    let paramCount = 0;

    const allowedFields = [
      "full_name",
      "email",
      "phone",
      "address",
      "current_stage",
      "progress_percentage",
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        paramCount++;
        setClauses.push(`${field} = $${paramCount}`);
        values.push(body[field]);
      }
    }

    if (setClauses.length === 0) {
      return Response.json({ error: "No fields to update" }, { status: 400 });
    }

    paramCount++;
    values.push(id);

    const query = `UPDATE candidates SET ${setClauses.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramCount} RETURNING *`;
    const result = await sql(query, values);

    if (result.length === 0) {
      return Response.json({ error: "Candidate not found" }, { status: 404 });
    }

    return Response.json({ candidate: result[0] });
  } catch (error) {
    console.error("Error updating candidate:", error);
    return Response.json(
      { error: "Failed to update candidate" },
      { status: 500 },
    );
  }
}
