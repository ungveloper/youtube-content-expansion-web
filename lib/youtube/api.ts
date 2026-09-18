/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  YouTubeChannel,
  YouTubeComment,
  YouTubeVideo,
} from "../content-expansion/types";

const API_BASE = "https://www.googleapis.com/youtube/v3";

function getApiKey() {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    throw new Error(
      "YOUTUBE_API_KEY가 없습니다. 프로젝트 루트의 .env.local에 YOUTUBE_API_KEY를 설정해주세요.",
    );
  }
  return key;
}

async function youtubeFetch<T>(
  endpoint: string,
  params: Record<string, string | number | undefined>,
): Promise<T> {
  const searchParams = new URLSearchParams();
  searchParams.set("key", getApiKey());
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      searchParams.set(key, String(value));
    }
  });

  const response = await fetch(`${API_BASE}/${endpoint}?${searchParams.toString()}`, {
    cache: "no-store",
  });

  const data = await response.json();
  if (!response.ok) {
    const message =
      data?.error?.message || `YouTube API 요청에 실패했습니다. (${response.status})`;
    throw new Error(message);
  }
  return data as T;
}

function parseCount(value: string | undefined) {
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function channelFromItem(item: any): YouTubeChannel {
  return {
    id: item.id,
    title: item.snippet?.title ?? "",
    handle: item.snippet?.customUrl ?? null,
    description: item.snippet?.description ?? "",
    thumbnailUrl:
      item.snippet?.thumbnails?.high?.url ??
      item.snippet?.thumbnails?.medium?.url ??
      item.snippet?.thumbnails?.default?.url ??
      null,
    subscriberCount: item.statistics?.hiddenSubscriberCount
      ? null
      : parseCount(item.statistics?.subscriberCount),
    videoCount: parseCount(item.statistics?.videoCount),
    viewCount: parseCount(item.statistics?.viewCount),
  };
}

function videoFromItem(item: any): YouTubeVideo {
  return {
    id: item.id,
    channelId: item.snippet?.channelId ?? "",
    channelTitle: item.snippet?.channelTitle ?? "",
    title: item.snippet?.title ?? "",
    description: item.snippet?.description ?? "",
    publishedAt: item.snippet?.publishedAt ?? "",
    thumbnailUrl:
      item.snippet?.thumbnails?.maxres?.url ??
      item.snippet?.thumbnails?.high?.url ??
      item.snippet?.thumbnails?.medium?.url ??
      item.snippet?.thumbnails?.default?.url ??
      null,
    duration: item.contentDetails?.duration ?? null,
    viewCount: parseCount(item.statistics?.viewCount),
    likeCount: parseCount(item.statistics?.likeCount),
    commentCount: parseCount(item.statistics?.commentCount),
  };
}

export function extractVideoId(input: string) {
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

  try {
    const url = new URL(trimmed);
    if (url.hostname === "youtu.be") {
      return url.pathname.split("/").filter(Boolean)[0] ?? null;
    }
    if (url.hostname.includes("youtube.com")) {
      const fromQuery = url.searchParams.get("v");
      if (fromQuery) return fromQuery;
      const parts = url.pathname.split("/").filter(Boolean);
      const markerIndex = parts.findIndex((part) =>
        ["shorts", "embed", "live"].includes(part),
      );
      if (markerIndex >= 0) return parts[markerIndex + 1] ?? null;
    }
  } catch {
    return null;
  }
  return null;
}

export async function getVideo(input: string) {
  const videoId = extractVideoId(input);
  if (!videoId) throw new Error("유효한 YouTube 영상 ID 또는 URL을 입력해주세요.");

  const data = await youtubeFetch<any>("videos", {
    part: "snippet,statistics,contentDetails",
    id: videoId,
  });
  const item = data.items?.[0];
  if (!item) throw new Error("영상을 찾을 수 없습니다.");
  return videoFromItem(item);
}

export async function getChannel(input: string) {
  const trimmed = input.trim();
  let channelId: string | null = null;
  let handle: string | null = null;

  if (/^UC[a-zA-Z0-9_-]{22}$/.test(trimmed)) {
    channelId = trimmed;
  } else {
    try {
      const url = new URL(trimmed);
      const parts = url.pathname.split("/").filter(Boolean);
      const channelIndex = parts.indexOf("channel");
      if (channelIndex >= 0) channelId = parts[channelIndex + 1] ?? null;
      const handlePart = parts.find((part) => part.startsWith("@"));
      if (handlePart) handle = handlePart.slice(1);
    } catch {
      handle = trimmed.replace(/^@/, "");
    }
  }

  if (channelId) {
    const data = await youtubeFetch<any>("channels", {
      part: "snippet,statistics,contentDetails",
      id: channelId,
    });
    const item = data.items?.[0];
    if (!item) throw new Error("채널을 찾을 수 없습니다.");
    return channelFromItem(item);
  }

  if (handle) {
    const data = await youtubeFetch<any>("channels", {
      part: "snippet,statistics,contentDetails",
      forHandle: handle,
    });
    const item = data.items?.[0];
    if (item) return channelFromItem(item);
  }

  throw new Error("유효한 YouTube 채널 핸들 또는 URL을 입력해주세요.");
}

async function getVideoDetails(ids: string[]) {
  const results: YouTubeVideo[] = [];
  for (let index = 0; index < ids.length; index += 50) {
    const chunk = ids.slice(index, index + 50);
    const data = await youtubeFetch<any>("videos", {
      part: "snippet,statistics,contentDetails",
      id: chunk.join(","),
    });
    results.push(...(data.items ?? []).map(videoFromItem));
  }
  return results;
}

export async function getChannelVideos(channelId: string, limit = 100) {
  const channelData = await youtubeFetch<any>("channels", {
    part: "contentDetails",
    id: channelId,
  });
  const uploads =
    channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) throw new Error("채널 업로드 목록을 찾을 수 없습니다.");

  const ids: string[] = [];
  let pageToken: string | undefined;

  while (ids.length < limit) {
    const data = await youtubeFetch<any>("playlistItems", {
      part: "contentDetails",
      playlistId: uploads,
      maxResults: Math.min(50, limit - ids.length),
      pageToken,
    });
    ids.push(
      ...(data.items ?? [])
        .map((item: any) => item.contentDetails?.videoId)
        .filter(Boolean),
    );
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }

  return getVideoDetails(ids);
}

export async function discoverVideos(
  query: string,
  limit = 100,
  publishedAfter?: string,
) {
  const ids: string[] = [];
  let pageToken: string | undefined;

  while (ids.length < limit) {
    const data = await youtubeFetch<any>("search", {
      part: "snippet",
      type: "video",
      order: "viewCount",
      maxResults: Math.min(50, limit - ids.length),
      pageToken,
      q: query.trim() || undefined,
      publishedAfter,
      regionCode: "KR",
      relevanceLanguage: "ko",
      safeSearch: "none",
    });

    ids.push(
      ...(data.items ?? [])
        .map((item: any) => item.id?.videoId)
        .filter(Boolean),
    );
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }

  return getVideoDetails(Array.from(new Set(ids)));
}

function commentFromSnippet(
  id: string,
  snippet: any,
  parentCommentId: string | null,
): YouTubeComment {
  return {
    id,
    parentCommentId,
    authorName: snippet?.authorDisplayName ?? "",
    authorChannelId: snippet?.authorChannelId?.value ?? null,
    text: snippet?.textDisplay ?? snippet?.textOriginal ?? "",
    likeCount: parseCount(String(snippet?.likeCount ?? 0)),
    publishedAt: snippet?.publishedAt ?? "",
    updatedAt: snippet?.updatedAt ?? snippet?.publishedAt ?? "",
    isReply: Boolean(parentCommentId),
  };
}

async function getAllReplies(parentId: string) {
  const replies: YouTubeComment[] = [];
  let pageToken: string | undefined;
  do {
    const data = await youtubeFetch<any>("comments", {
      part: "snippet",
      parentId,
      maxResults: 100,
      pageToken,
      textFormat: "plainText",
    });
    replies.push(
      ...(data.items ?? []).map((item: any) =>
        commentFromSnippet(item.id, item.snippet, parentId),
      ),
    );
    pageToken = data.nextPageToken;
  } while (pageToken);
  return replies;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
) {
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => run()),
  );
  return results;
}

export async function getCommentsPage(input: {
  videoId: string;
  pageToken?: string;
  order?: "time" | "relevance";
  includeAllReplies?: boolean;
}) {
  const data = await youtubeFetch<any>("commentThreads", {
    part: "snippet,replies",
    videoId: input.videoId,
    maxResults: 100,
    pageToken: input.pageToken,
    order: input.order ?? "time",
    textFormat: "plainText",
  });

  const threads = data.items ?? [];
  const comments: YouTubeComment[] = [];
  const parentsWithReplies: Array<{ id: string; totalReplyCount: number }> = [];

  for (const thread of threads) {
    const top = thread.snippet?.topLevelComment;
    if (!top) continue;
    comments.push(commentFromSnippet(top.id, top.snippet, null));
    const totalReplyCount = Number(thread.snippet?.totalReplyCount ?? 0);
    if (totalReplyCount > 0) {
      parentsWithReplies.push({ id: top.id, totalReplyCount });
    }
  }

  if (input.includeAllReplies && parentsWithReplies.length) {
    const replyGroups = await mapWithConcurrency(
      parentsWithReplies,
      8,
      ({ id }) => getAllReplies(id),
    );
    replyGroups.forEach((group) => comments.push(...group));
  } else {
    for (const thread of threads) {
      const parentId = thread.snippet?.topLevelComment?.id;
      if (!parentId) continue;
      for (const reply of thread.replies?.comments ?? []) {
        comments.push(commentFromSnippet(reply.id, reply.snippet, parentId));
      }
    }
  }

  return {
    comments,
    nextPageToken: data.nextPageToken ?? null,
    pageInfo: data.pageInfo ?? null,
  };
}
