import sql from "@/app/api/utils/sql";
import {
  hasDatabase,
  updateMockDocumentVerification,
} from "@/app/api/utils/mock-data";

// POST - Verify or reject document
export async function POST(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    const { status, rejection_reason, verified_by } = body;

    if (!status || !["verified", "rejected"].includes(status)) {
      return Response.json({ error: "Invalid status" }, { status: 400 });
    }

    if (!hasDatabase()) {
      const document = updateMockDocumentVerification(
        id,
        status,
        rejection_reason || null,
        verified_by || null,
      );

      if (!document) {
        return Response.json({ error: "Document not found" }, { status: 404 });
      }

      return Response.json({ document });
    }

    const result = await sql`
      UPDATE documents 
      SET verification_status = ${status},
          rejection_reason = ${rejection_reason || null},
          verified_by = ${verified_by || null},
          verified_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;

    if (result.length === 0) {
      return Response.json({ error: "Document not found" }, { status: 404 });
    }

    return Response.json({ document: result[0] });
  } catch (error) {
    console.error("Error verifying document:", error);
    return Response.json(
      { error: "Failed to verify document" },
      { status: 500 },
    );
  }
}
