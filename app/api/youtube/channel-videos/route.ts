import { NextResponse } from "next/server";
import { getChannelVideos } from "@/lib/youtube/api";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const channelId = searchParams.get("channelId") ?? "";
    if (!channelId) {
      return NextResponse.json({ error: "channelId가 필요합니다." }, { status: 400 });
    }
    const limit = Math.min(Number(searchParams.get("limit") ?? 100), 100);
    const videos = await getChannelVideos(channelId, limit);
    return NextResponse.json({ videos });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "채널 영상을 불러오지 못했습니다." },
      { status: 400 },
    );
  }
}
