import {
  getCandidateById,
  getDocumentsForCandidate,
  getTimelineForCandidate,
  getPaymentsForCandidate,
  updateCandidate,
} from "@/app/api/utils/mock-db";

// GET - Get single candidate with documents and timeline
export async function GET(request, { params }) {
  try {
    const { id } = params;

    const candidate = getCandidateById(id);

    if (!candidate) {
      return Response.json({ error: "Candidate not found" }, { status: 404 });
    }

    const documents = getDocumentsForCandidate(id);
    const timeline = getTimelineForCandidate(id);
    const payments = getPaymentsForCandidate(id);

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

    const allowedFields = [
      "full_name",
      "email",
      "phone",
      "address",
      "current_stage",
      "progress_percentage",
    ];

    const fields = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        fields[field] = body[field];
      }
    }

    if (Object.keys(fields).length === 0) {
      return Response.json({ error: "No fields to update" }, { status: 400 });
    }

    const candidate = updateCandidate(id, fields);

    if (!candidate) {
      return Response.json({ error: "Candidate not found" }, { status: 404 });
    }

    return Response.json({ candidate });
  } catch (error) {
    console.error("Error updating candidate:", error);
    return Response.json(
      { error: "Failed to update candidate" },
      { status: 500 },
    );
  }
}
