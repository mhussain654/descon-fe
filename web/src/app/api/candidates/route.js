import sql from "@/app/api/utils/sql";

// GET - List all candidates with optional filters
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const stage = searchParams.get("stage");

    let query = "SELECT * FROM candidates WHERE 1=1";
    const params = [];
    let paramCount = 0;

    if (search) {
      paramCount++;
      query += ` AND (LOWER(full_name) LIKE LOWER($${paramCount}) OR LOWER(registration_number) LIKE LOWER($${paramCount}) OR LOWER(cnic) LIKE LOWER($${paramCount}))`;
      params.push(`%${search}%`);
    }

    if (stage) {
      paramCount++;
      query += ` AND current_stage = $${paramCount}`;
      params.push(stage);
    }

    query += " ORDER BY created_at DESC";

    const candidates = await sql(query, params);

    return Response.json({ candidates });
  } catch (error) {
    console.error("Error fetching candidates:", error);
    return Response.json(
      { error: "Failed to fetch candidates" },
      { status: 500 },
    );
  }
}

// POST - Create new candidate
export async function POST(request) {
  try {
    const body = await request.json();
    const { cnic, registration_number, full_name, email, phone, address } =
      body;

    if (!cnic || !registration_number || !full_name) {
      return Response.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const result = await sql`
      INSERT INTO candidates (cnic, registration_number, full_name, email, phone, address)
      VALUES (${cnic}, ${registration_number}, ${full_name}, ${email}, ${phone}, ${address})
      RETURNING *
    `;

    // Create initial timeline entry
    await sql`
      INSERT INTO status_timeline (candidate_id, stage_name, stage_status, completed_date)
      VALUES (${result[0].id}, 'registered', 'completed', CURRENT_TIMESTAMP)
    `;

    return Response.json({ candidate: result[0] }, { status: 201 });
  } catch (error) {
    console.error("Error creating candidate:", error);
    return Response.json(
      { error: "Failed to create candidate" },
      { status: 500 },
    );
  }
}
