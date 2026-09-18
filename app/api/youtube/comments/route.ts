import { NextResponse } from "next/server";
import { getCommentsPage } from "@/lib/youtube/api";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get("videoId") ?? "";
    if (!videoId) {
      return NextResponse.json({ error: "videoId가 필요합니다." }, { status: 400 });
    }

    const pageToken = searchParams.get("pageToken") ?? undefined;
    const order = searchParams.get("order") === "relevance" ? "relevance" : "time";
    const includeAllReplies = searchParams.get("includeAllReplies") !== "false";

    const result = await getCommentsPage({
      videoId,
      pageToken,
      order,
      includeAllReplies,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "댓글을 불러오지 못했습니다." },
      { status: 400 },
    );
  }
}
