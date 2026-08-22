import { listCandidates, createCandidate } from "@/app/api/utils/mock-db";

// GET - List all candidates with optional filters
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const stage = searchParams.get("stage");

    const candidates = listCandidates({ search, stage });

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

    const candidate = createCandidate({
      cnic,
      registration_number,
      full_name,
      email,
      phone,
      address,
    });

    return Response.json({ candidate }, { status: 201 });
  } catch (error) {
    console.error("Error creating candidate:", error);
    return Response.json(
      { error: "Failed to create candidate" },
      { status: 500 },
    );
  }
}
