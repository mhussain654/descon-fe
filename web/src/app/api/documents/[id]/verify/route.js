import { verifyDocument } from "@/app/api/utils/mock-db";

// POST - Verify or reject document
export async function POST(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    const { status, rejection_reason, verified_by } = body;

    if (!status || !["verified", "rejected"].includes(status)) {
      return Response.json({ error: "Invalid status" }, { status: 400 });
    }

    const document = verifyDocument(id, { status, rejection_reason, verified_by });

    if (!document) {
      return Response.json({ error: "Document not found" }, { status: 404 });
    }

    return Response.json({ document });
  } catch (error) {
    console.error("Error verifying document:", error);
    return Response.json(
      { error: "Failed to verify document" },
      { status: 500 },
    );
  }
}
