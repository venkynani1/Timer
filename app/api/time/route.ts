// Lightweight time beacon for client clock synchronisation. No database access,
// so frequent resyncs never load Postgres. Runs at the edge for low latency.
export const runtime = "edge";
export const dynamic = "force-dynamic";

export function GET() {
  return new Response(JSON.stringify({ now: Date.now() }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store, max-age=0" },
  });
}
