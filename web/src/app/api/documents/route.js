import sql from "@/app/api/utils/sql";

// POST - Upload document
export async function POST(request) {
  try {
    const body = await request.json();
    const { candidate_id, document_type, file_url } = body;

    if (!candidate_id || !document_type) {
      return Response.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const result = await sql`
      INSERT INTO documents (candidate_id, document_type, file_url, verification_status)
      VALUES (${candidate_id}, ${document_type}, ${file_url}, 'uploaded')
      RETURNING *
    `;

    return Response.json({ document: result[0] }, { status: 201 });
  } catch (error) {
    console.error("Error uploading document:", error);
    return Response.json(
      { error: "Failed to upload document" },
      { status: 500 },
    );
  }
}
