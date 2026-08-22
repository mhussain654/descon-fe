import { createDocument } from "@/app/api/utils/mock-db";

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

    const document = createDocument({ candidate_id, document_type, file_url });

    return Response.json({ document }, { status: 201 });
  } catch (error) {
    console.error("Error uploading document:", error);
    return Response.json(
      { error: "Failed to upload document" },
      { status: 500 },
    );
  }
}
