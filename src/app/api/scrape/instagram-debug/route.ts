import { NextRequest, NextResponse } from "next/server";
import { runApifyActor, APIFY_ACTORS } from "@/lib/apify";
import { requireApiAuth } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  const { response } = await requireApiAuth();
  if (response) return response;

  const { username } = await request.json();
  if (!username) {
    return NextResponse.json({ error: "username required" }, { status: 400 });
  }

  try {
    const rawResults = await runApifyActor({
      actorId: APIFY_ACTORS.INSTAGRAM_SCRAPER,
      input: {
        usernames: [username],
        resultsType: "details",
        resultsLimit: 1,
        addParentData: false,
      },
      timeoutSecs: 90,
      memoryMbytes: 256,
    });

    return NextResponse.json({
      username,
      count: rawResults.length,
      raw: rawResults,
      keys: rawResults[0] ? Object.keys(rawResults[0]) : [],
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
