import { NextResponse } from "next/server";
import { discoverVideos } from "@/lib/youtube/api";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query") ?? "";
    const limit = Math.min(Number(searchParams.get("limit") ?? 100), 100);
    const period = searchParams.get("period") ?? "30d";
    const days = period === "7d" ? 7 : period === "90d" ? 90 : period === "all" ? null : 30;
    const publishedAfter = days
      ? new Date(Date.now() - days * 86_400_000).toISOString()
      : undefined;
    const videos = await discoverVideos(query, limit, publishedAfter);
    return NextResponse.json({ videos });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "영상 탐색에 실패했습니다." },
      { status: 400 },
    );
  }
}
