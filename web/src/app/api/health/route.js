const DEFAULT_API_BASE_URL = "http://localhost:3000/api/v1";

function backendApiBaseUrl() {
  return (
    process.env.BACKEND_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    DEFAULT_API_BASE_URL
  ).replace(/\/$/, "");
}

export async function GET(request) {
  const locale = request.headers.get("X-Locale");
  const acceptLanguage = request.headers.get("Accept-Language");
  const headers = { Accept: "application/json" };

  if (locale) headers["X-Locale"] = locale;
  if (acceptLanguage) headers["Accept-Language"] = acceptLanguage;

  try {
    const response = await fetch(`${backendApiBaseUrl()}/health/live`, {
      headers,
      signal: AbortSignal.timeout(5_000),
    });
    const body = await response.json();

    return Response.json(body, { status: response.status });
  } catch (error) {
    console.error("Backend health check failed:", error);
    return Response.json(
      {
        errors: [
          {
            code: "backend_unavailable",
            message: "The backend API is unavailable.",
          },
        ],
      },
      { status: 503 },
    );
  }
}
