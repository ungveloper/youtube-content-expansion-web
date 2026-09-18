import { NextResponse } from "next/server";
import { getChannel } from "@/lib/youtube/api";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const input = searchParams.get("input") ?? "";
    const channel = await getChannel(input);
    return NextResponse.json({ channel });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "채널 조회에 실패했습니다." },
      { status: 400 },
    );
  }
}
