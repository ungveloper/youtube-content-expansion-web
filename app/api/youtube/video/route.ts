import { NextResponse } from "next/server";
import { getVideo } from "@/lib/youtube/api";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const input = searchParams.get("input") ?? "";
    const video = await getVideo(input);
    return NextResponse.json({ video });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "영상 조회에 실패했습니다." },
      { status: 400 },
    );
  }
}
