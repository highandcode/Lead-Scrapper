import { NextRequest, NextResponse } from "next/server";
import { analyzeLead, analyzeBatch } from "@/services/ai/analyzer";
import { requireApiAuth } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  const { response } = await requireApiAuth();
  if (response) return response;

  try {
    const body = await request.json();
    const { leadId, leadIds } = body;

    if (leadIds && Array.isArray(leadIds)) {
      // Batch analysis (runs sequentially with delay)
      if (leadIds.length > 10) {
        return NextResponse.json(
          { error: "Maximum 10 leads per batch" },
          { status: 400 }
        );
      }

      const results = await analyzeBatch(leadIds);
      const succeeded = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      return NextResponse.json({
        results,
        summary: { succeeded, failed, total: leadIds.length },
      });
    }

    if (leadId) {
      const result = await analyzeLead(leadId);

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      return NextResponse.json({ success: true, leadId });
    }

    return NextResponse.json(
      { error: "leadId or leadIds required" },
      { status: 400 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
