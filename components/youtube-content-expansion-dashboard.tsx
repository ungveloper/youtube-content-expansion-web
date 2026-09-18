"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { GOAL_OPTIONS, PLATFORM_OPTIONS } from "@/lib/content-expansion/constants";
import { buildChatGPTProBundle, buildLaunchPrompt } from "@/lib/content-expansion/prompt-builder";
import {
  createResearchPackage,
  researchPackageToMarkdown,
} from "@/lib/content-expansion/research-package";
import type {
  CommentCollection,
  Platform,
  ResearchGoal,
  SourceMode,
  YouTubeChannel,
  YouTubeComment,
  YouTubeVideo,
} from "@/lib/content-expansion/types";

const sourceModes: Array<{ id: SourceMode; label: string; description: string }> = [
  { id: "channel", label: "채널", description: "핸들 또는 채널 URL" },
  { id: "video", label: "영상", description: "영상 ID 또는 URL" },
  { id: "discover", label: "Discovery", description: "조회 시점의 인기 레퍼런스 탐색" },
];

function detectSourceModeFromInput(input: string): Exclude<SourceMode, "discover"> | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return "video";
  if (/^UC[a-zA-Z0-9_-]{22}$/.test(trimmed) || trimmed.startsWith("@")) return "channel";

  try {
    const url = new URL(trimmed);
    const host = url.hostname.replace(/^www\./, "");
    if (host === "youtu.be") return "video";
    if (host !== "youtube.com" && !host.endsWith(".youtube.com")) return null;

    const parts = url.pathname.split("/").filter(Boolean);
    if (url.searchParams.get("v")) return "video";
    if (["shorts", "embed", "live"].includes(parts[0] ?? "")) return "video";
    if ((parts[0] ?? "").startsWith("@")) return "channel";
    if (["channel", "c", "user"].includes(parts[0] ?? "")) return "channel";
  } catch {
    return null;
  }

  return null;
}

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("ko-KR", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function daysSince(date: string) {
  const ms = Date.now() - new Date(date).getTime();
  return Math.max(1, ms / 86_400_000);
}

function viewsPerDay(video: YouTubeVideo) {
  return video.viewCount / daysSince(video.publishedAt);
}

async function readJson(response: Response) {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "요청에 실패했습니다.");
  return data;
}

function downloadText(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function OptionCard({
  selected,
  title,
  description,
  onClick,
}: {
  selected: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition ${
        selected
          ? "border-red-500 bg-red-500/[0.08] ring-1 ring-red-500/30"
          : "border-zinc-800 bg-zinc-950/50 hover:border-zinc-700"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${selected ? "bg-red-500" : "bg-zinc-700"}`} />
        <span className="font-semibold text-zinc-100">{title}</span>
      </div>
      <p className="mt-2 text-sm leading-6 text-zinc-500">{description}</p>
    </button>
  );
}

function VideoCard({ video, onSelect }: { video: YouTubeVideo; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 text-left transition hover:-translate-y-0.5 hover:border-zinc-700"
    >
      <div className="aspect-video bg-zinc-900">
        {video.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={video.thumbnailUrl} alt="" className="h-full w-full object-cover" />
        ) : null}
      </div>
      <div className="p-4">
        <p className="line-clamp-2 min-h-12 font-semibold leading-6 text-zinc-100">{video.title}</p>
        <p className="mt-2 text-sm text-zinc-500">{video.channelTitle}</p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-zinc-500">
          <span>조회 {formatNumber(video.viewCount)}</span>
          <span>댓글 {formatNumber(video.commentCount)}</span>
          <span>{formatNumber(Math.round(viewsPerDay(video)))}/일</span>
        </div>
      </div>
    </button>
  );
}

export default function YouTubeContentExpansionDashboard() {
  const [sourceMode, setSourceMode] = useState<SourceMode>("channel");
  const [query, setQuery] = useState("");
  const [channel, setChannel] = useState<YouTubeChannel | null>(null);
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<YouTubeVideo | null>(null);
  const [channelHistory, setChannelHistory] = useState<YouTubeVideo[]>([]);
  const [discoveryPeriod, setDiscoveryPeriod] = useState<"7d" | "30d" | "90d" | "all">("30d");
  const [sortBy, setSortBy] = useState<"views" | "comments" | "recent" | "momentum">("views");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [platforms, setPlatforms] = useState<Platform[]>(["youtube"]);
  const [goals, setGoals] = useState<ResearchGoal[]>(["overall-followup", "audience-questions"]);
  const [includeChannelHistory, setIncludeChannelHistory] = useState(true);
  const [includeCompetitorResearch, setIncludeCompetitorResearch] = useState(true);
  const [includeWebResearch, setIncludeWebResearch] = useState(true);
  const [transcript, setTranscript] = useState("");

  const [comments, setComments] = useState<YouTubeComment[]>([]);
  const [collectingComments, setCollectingComments] = useState(false);
  const [commentProgress, setCommentProgress] = useState(0);
  const [commentStatus, setCommentStatus] = useState<"not_started" | "partial" | "complete">("not_started");
  const stopCollectionRef = useRef(false);

  const sortedVideos = useMemo(() => {
    const cloned = [...videos];
    return cloned.sort((a, b) => {
      if (sortBy === "comments") return b.commentCount - a.commentCount;
      if (sortBy === "recent") return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      if (sortBy === "momentum") return viewsPerDay(b) - viewsPerDay(a);
      return b.viewCount - a.viewCount;
    });
  }, [videos, sortBy]);

  function resetSource(mode: SourceMode) {
    setSourceMode(mode);
    setQuery("");
    setChannel(null);
    setVideos([]);
    setSelectedVideo(null);
    setChannelHistory([]);
    setComments([]);
    setTranscript("");
    setCommentStatus("not_started");
    setError("");
  }

  async function loadChannelContext(video: YouTubeVideo) {
    if (!includeChannelHistory) return;
    try {
      const [channelData, historyData] = await Promise.all([
        readJson(await fetch(`/api/youtube/channel?input=${encodeURIComponent(video.channelId)}`)),
        readJson(await fetch(`/api/youtube/channel-videos?channelId=${video.channelId}&limit=100`)),
      ]);
      setChannel(channelData.channel);
      setChannelHistory(historyData.videos);
    } catch (err) {
      const message = err instanceof Error ? err.message : "채널 과거 콘텐츠를 불러오지 못했습니다.";
      setError(message);
      toast.error(message);
    }
  }

  function selectVideo(video: YouTubeVideo, contextMode: SourceMode = sourceMode) {
    setSelectedVideo(video);
    setComments([]);
    setCommentProgress(0);
    setCommentStatus("not_started");
    setTranscript("");
    toast.success("분석할 영상을 선택했습니다. 댓글과 답글 전체 수집을 진행해주세요.");
    if (contextMode === "channel") {
      setChannelHistory(videos.filter((item) => item.channelId === video.channelId));
    } else {
      setChannelHistory([]);
      void loadChannelContext(video);
    }
  }

  async function searchSource() {
    const resolvedMode =
      sourceMode === "discover" ? "discover" : detectSourceModeFromInput(query) ?? sourceMode;
    const toastId = toast.loading(
      resolvedMode === "discover" ? "인기 레퍼런스를 탐색하고 있습니다." : "YouTube 데이터를 불러오고 있습니다.",
    );

    if (resolvedMode !== sourceMode && resolvedMode !== "discover") {
      setSourceMode(resolvedMode);
      toast.info(
        resolvedMode === "video"
          ? "입력한 URL을 영상 주소로 자동 인식했습니다."
          : "입력한 URL을 채널 주소로 자동 인식했습니다.",
      );
    }

    setLoading(true);
    setError("");
    setSelectedVideo(null);
    setChannelHistory([]);
    setComments([]);
    try {
      if (resolvedMode === "channel") {
        const channelData = await readJson(
          await fetch(`/api/youtube/channel?input=${encodeURIComponent(query)}`),
        );
        setChannel(channelData.channel);
        const videoData = await readJson(
          await fetch(`/api/youtube/channel-videos?channelId=${channelData.channel.id}&limit=100`),
        );
        setVideos(videoData.videos);
        toast.success(`채널 영상 ${videoData.videos.length}개를 불러왔습니다.`, { id: toastId });
      } else if (resolvedMode === "video") {
        const data = await readJson(
          await fetch(`/api/youtube/video?input=${encodeURIComponent(query)}`),
        );
        setVideos([data.video]);
        selectVideo(data.video, resolvedMode);
        toast.success("영상 정보를 불러왔습니다.", { id: toastId });
      } else {
        const data = await readJson(
          await fetch(`/api/youtube/discover?query=${encodeURIComponent(query)}&limit=100&period=${discoveryPeriod}`),
        );
        setVideos(data.videos);
        toast.success(`레퍼런스 영상 ${data.videos.length}개를 찾았습니다.`, { id: toastId });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "조회 중 오류가 발생했습니다.";
      setError(message);
      toast.error(message, { id: toastId });
    } finally {
      setLoading(false);
    }
  }

  async function collectAllComments() {
    if (!selectedVideo) return;
    const toastId = toast.loading("댓글과 답글 전체 수집을 시작했습니다.");
    setCollectingComments(true);
    setError("");
    setComments([]);
    setCommentProgress(0);
    setCommentStatus("partial");
    stopCollectionRef.current = false;

    try {
      let pageToken = "";
      const collected: YouTubeComment[] = [];
      do {
        const params = new URLSearchParams({
          videoId: selectedVideo.id,
          order: "time",
          includeAllReplies: "true",
        });
        if (pageToken) params.set("pageToken", pageToken);
        const data = await readJson(await fetch(`/api/youtube/comments?${params.toString()}`));
        collected.push(...data.comments);
        setComments([...collected]);
        setCommentProgress(collected.length);
        pageToken = data.nextPageToken ?? "";
      } while (pageToken && !stopCollectionRef.current);

      if (stopCollectionRef.current) {
        setCommentStatus("partial");
        toast.warning(`댓글 수집을 중지했습니다. 현재 ${collected.length.toLocaleString()}개가 저장되어 있습니다.`, { id: toastId });
      } else {
        setCommentStatus("complete");
        toast.success(`댓글과 답글 ${collected.length.toLocaleString()}개 수집을 완료했습니다. 다음 단계가 열렸습니다.`, { id: toastId });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "댓글 수집 중 오류가 발생했습니다.";
      setError(message);
      setCommentStatus("partial");
      toast.error(message, { id: toastId });
    } finally {
      setCollectingComments(false);
    }
  }

  function togglePlatform(platform: Platform) {
    setPlatforms((current) =>
      current.includes(platform)
        ? current.filter((item) => item !== platform)
        : [...current, platform],
    );
  }

  function toggleGoal(goal: ResearchGoal) {
    setGoals((current) => {
      const next = current.includes(goal)
        ? current.filter((item) => item !== goal)
        : [...current, goal];
      if (next.length >= 4 && next.length > current.length) {
        toast.info("조사 목적을 많이 선택하면 ChatGPT Pro 인터뷰에서 우선순위를 먼저 정리하도록 합니다.");
      }
      return next;
    });
  }

  function buildPackage() {
    if (!selectedVideo) return null;
    const topLevelCount = comments.filter((comment) => !comment.isReply).length;
    const replyCount = comments.length - topLevelCount;
    const commentCollection: CommentCollection = {
      comments,
      topLevelCount,
      replyCount,
      status: commentStatus,
      collectedAt: new Date().toISOString(),
    };

    return createResearchPackage({
      sourceMode,
      sourceQuery: query,
      channel,
      video: selectedVideo,
      channelHistory,
      transcript,
      comments: commentCollection,
      platforms,
      goals,
      includeChannelHistory,
      includeCompetitorResearch,
      includeWebResearch,
    });
  }

  function downloadPackage(format: "json" | "md") {
    const pkg = buildPackage();
    if (!pkg) return;
    const filenameBase = `youtube-research-${pkg.video.id}`;
    if (format === "json") {
      downloadText(`${filenameBase}.json`, JSON.stringify(pkg, null, 2), "application/json;charset=utf-8");
    } else {
      downloadText(`${filenameBase}.md`, researchPackageToMarkdown(pkg), "text/markdown;charset=utf-8");
    }
    toast.success(`Raw ${format === "json" ? "JSON" : "Markdown"} 파일을 다운로드했습니다.`);
  }

  function downloadChatGPTBundle() {
    const pkg = buildPackage();
    if (!pkg) return;
    downloadText(
      `youtube-chatgpt-pro-bundle-${pkg.video.id}.md`,
      buildChatGPTProBundle(pkg),
      "text/markdown;charset=utf-8",
    );
    toast.success("ChatGPT Pro 통합 분석 패키지를 다운로드했습니다. 새 채팅에 이 파일을 첨부해주세요.");
  }

  async function copyLaunchPrompt() {
    const pkg = buildPackage();
    if (!pkg) return;
    await navigator.clipboard.writeText(buildLaunchPrompt(pkg));
    toast.success("시작 프롬프트를 복사했습니다. 통합 분석 패키지를 첨부한 ChatGPT Pro 채팅에 붙여넣어주세요.");
  }

  return (
    <main className="min-h-screen bg-[#09090b] text-zinc-100">
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:px-10">
        <header className="border-b border-zinc-900 pb-8">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs text-zinc-400">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                INTERNAL CONTENT R&D
              </div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">YouTube Content Expansion</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-500 sm:text-base">
                한 영상을 출발점으로 댓글·질문·검색 수요를 수집하고, 근거 없는 후보를 제거해 다음 콘텐츠를 찾는 내부 연구 도구입니다.
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-xs leading-5 text-zinc-500">
              <strong className="text-zinc-300">Zero is Valid.</strong><br />가치가 없으면 억지로 추천하지 않습니다.
            </div>
          </div>
        </header>

        <section className="py-8">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 text-sm font-bold text-zinc-950">1</span>
            <div>
              <h2 className="font-semibold">Source 선택</h2>
              <p className="text-sm text-zinc-500">채널, 특정 영상, 또는 레퍼런스 탐색에서 시작합니다.</p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {sourceModes.map((mode) => (
              <OptionCard
                key={mode.id}
                selected={sourceMode === mode.id}
                title={mode.label}
                description={mode.description}
                onClick={() => resetSource(mode.id)}
              />
            ))}
          </div>

          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:flex-row">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && searchSource()}
              placeholder={
                sourceMode === "channel"
                  ? "채널 핸들/URL 또는 영상 URL — URL 종류 자동 감지"
                  : sourceMode === "video"
                    ? "영상 ID/URL 또는 채널 URL — URL 종류 자동 감지"
                    : "키워드 선택 입력 — 비워두면 광범위하게 탐색"
              }
              className="min-w-0 flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm outline-none placeholder:text-zinc-600 focus:border-zinc-600"
            />
            {sourceMode === "discover" ? (
              <select
                value={discoveryPeriod}
                onChange={(event) => setDiscoveryPeriod(event.target.value as typeof discoveryPeriod)}
                className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-3 text-sm text-zinc-300 outline-none"
              >
                <option value="7d">최근 7일</option>
                <option value="30d">최근 30일</option>
                <option value="90d">최근 90일</option>
                <option value="all">기간 전체</option>
              </select>
            ) : null}
            <button
              type="button"
              onClick={searchSource}
              disabled={loading || (sourceMode !== "discover" && !query.trim())}
              className="rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? "불러오는 중..." : sourceMode === "discover" ? "100개 탐색" : "불러오기"}
            </button>
          </div>
          {sourceMode === "discover" ? (
            <p className="mt-2 text-xs leading-5 text-zinc-600">
              Discovery는 기존 mostPopular 목록이 아니라 선택 기간 내 검색 API의 조회수 정렬을 이용한 레퍼런스 탐색입니다. 검색 API 할당량을 사용합니다.
            </p>
          ) : (
            <p className="mt-2 text-xs leading-5 text-zinc-600">
              채널/영상 탭을 잘못 선택해도 괜찮습니다. YouTube URL 또는 ID/핸들 형식을 확인해 채널과 영상을 자동으로 구분합니다.
            </p>
          )}
          {error ? <div className="mt-4 rounded-xl border border-red-950 bg-red-950/30 px-4 py-3 text-sm text-red-300">{error}</div> : null}
        </section>

        {channel ? (
          <section className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
            <div className="flex items-center gap-4">
              {channel.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={channel.thumbnailUrl} alt="" className="h-14 w-14 rounded-full object-cover" />
              ) : null}
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-semibold">{channel.title}</h3>
                <p className="mt-1 text-sm text-zinc-500">
                  구독자 {formatNumber(channel.subscriberCount)} · 영상 {formatNumber(channel.videoCount)} · 누적 조회 {formatNumber(channel.viewCount)}
                </p>
              </div>
            </div>
          </section>
        ) : null}

        {videos.length ? (
          <section className="pb-10">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">영상 {videos.length}개</h2>
                <p className="mt-1 text-sm text-zinc-500">분석할 영상을 선택하세요.</p>
              </div>
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as typeof sortBy)}
                className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-300 outline-none"
              >
                <option value="views">조회수</option>
                <option value="comments">댓글수</option>
                <option value="momentum">조회수/일</option>
                <option value="recent">최신순</option>
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {sortedVideos.map((video) => (
                <VideoCard key={video.id} video={video} onSelect={() => selectVideo(video)} />
              ))}
            </div>
          </section>
        ) : null}

        {selectedVideo ? (
          <>
            <section className="border-t border-zinc-900 py-8">
              <div className="mb-5 flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 text-sm font-bold text-zinc-950">2</span>
                <div>
                  <h2 className="font-semibold">Evidence 수집</h2>
                  <p className="text-sm text-zinc-500">원본 데이터는 최대한 보존하고, 의미 판단은 ChatGPT Pro에서 수행합니다.</p>
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
                <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
                  <div className="grid gap-4 p-5 sm:grid-cols-[220px_1fr]">
                    <div className="aspect-video overflow-hidden rounded-xl bg-zinc-900">
                      {selectedVideo.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={selectedVideo.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div>
                      <div className="mb-2 text-xs font-medium text-red-400">SELECTED VIDEO</div>
                      <h3 className="font-semibold leading-6">{selectedVideo.title}</h3>
                      <p className="mt-2 text-sm text-zinc-500">{selectedVideo.channelTitle}</p>
                      <div className="mt-4 flex flex-wrap gap-3 text-xs text-zinc-500">
                        <span>조회 {formatNumber(selectedVideo.viewCount)}</span>
                        <span>좋아요 {formatNumber(selectedVideo.likeCount)}</span>
                        <span>댓글 {formatNumber(selectedVideo.commentCount)}</span>
                        <span>{new Date(selectedVideo.publishedAt).toLocaleDateString("ko-KR")}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">댓글 + 답글 전체 수집</h3>
                      <p className="mt-1 text-sm text-zinc-500">페이지네이션과 답글 추가 조회를 끝까지 진행합니다.</p>
                    </div>
                    <span className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-2.5 py-1 text-xs text-zinc-400">
                      {collectingComments ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-100" /> : null}
                      {commentProgress.toLocaleString()} records · {commentStatus}
                    </span>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={collectAllComments}
                      disabled={collectingComments}
                      className="flex-1 rounded-xl bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-950 disabled:opacity-40"
                    >
                      <span className="inline-flex items-center justify-center gap-2">
                        {collectingComments ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-400 border-t-zinc-950" /> : null}
                        {collectingComments ? `수집 중... ${commentProgress.toLocaleString()}개` : comments.length ? "처음부터 다시 수집" : "전체 수집"}
                      </span>
                    </button>
                    {collectingComments ? (
                      <button
                        type="button"
                        onClick={() => { stopCollectionRef.current = true; }}
                        className="rounded-xl border border-zinc-800 px-4 py-2.5 text-sm text-zinc-300"
                      >
                        중지
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">영상 내용(대본)</h3>
                    <p className="mt-1 text-sm text-zinc-500">영상에서 실제로 어떤 말을 했는지까지 분석하려면 대본이 필요합니다. 자동으로 가져올 수 없는 영상은 직접 붙여넣거나 TXT/SRT/VTT 파일을 불러오세요.</p>
                  </div>
                  <label className="cursor-pointer rounded-xl border border-zinc-800 px-3 py-2 text-xs text-zinc-300 hover:border-zinc-700">
                    파일 불러오기
                    <input
                      type="file"
                      accept=".txt,.srt,.vtt,text/plain"
                      className="hidden"
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        if (file) {
                          setTranscript(await file.text());
                          toast.success(`영상 대본 파일을 불러왔습니다: ${file.name}`);
                        }
                      }}
                    />
                  </label>
                </div>
                <textarea
                  value={transcript}
                  onChange={(event) => setTranscript(event.target.value)}
                  placeholder="영상에서 말한 내용을 여기에 붙여넣으세요. 대본이 없어도 댓글 중심 분석은 가능하지만, 영상에서 실제로 말한 내용은 확인하지 않은 것으로 처리합니다."
                  className="mt-4 min-h-48 w-full resize-y rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm leading-6 text-zinc-300 outline-none placeholder:text-zinc-600 focus:border-zinc-600"
                />
              </div>
            </section>

            {commentStatus === "complete" ? (
              <>
            <section className="border-t border-zinc-900 py-8">
              <div className="mb-5 flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 text-sm font-bold text-zinc-950">3</span>
                <div>
                  <h2 className="font-semibold">Research 설정</h2>
                  <p className="text-sm text-zinc-500">결과를 미리 강제하지 않고, ChatGPT Pro가 조사와 인터뷰를 통해 좁혀갑니다.</p>
                </div>
              </div>

              <h3 className="mb-3 text-sm font-semibold text-zinc-300">플랫폼</h3>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {PLATFORM_OPTIONS.map((option) => (
                  <OptionCard key={option.id} selected={platforms.includes(option.id)} title={option.label} description={option.description} onClick={() => togglePlatform(option.id)} />
                ))}
              </div>

              <div className="mb-3 mt-7 flex flex-wrap items-end justify-between gap-2">
                <h3 className="text-sm font-semibold text-zinc-300">조사 목적</h3>
                <p className="text-xs text-zinc-600">복수 선택 가능 · 목적이 많을수록 인터뷰에서 우선순위를 먼저 정리합니다.</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {GOAL_OPTIONS.map((option) => (
                  <OptionCard key={option.id} selected={goals.includes(option.id)} title={option.label} description={option.description} onClick={() => toggleGoal(option.id)} />
                ))}
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-3">
                {[
                  [includeChannelHistory, setIncludeChannelHistory, "채널 과거 콘텐츠", "이미 다룬 주제인지 비교하도록 지시"],
                  [includeCompetitorResearch, setIncludeCompetitorResearch, "경쟁 콘텐츠 조사", "포화 여부보다 차별화 가능성을 검증"],
                  [includeWebResearch, setIncludeWebResearch, "외부 웹 검색", "최종 확정 전에 실제 검색 결과 검증"],
                ].map(([value, setter, title, description]) => (
                  <label key={String(title)} className="flex cursor-pointer gap-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                    <input
                      type="checkbox"
                      checked={Boolean(value)}
                      onChange={(event) => {
                        const next = event.target.checked;
                        (setter as (value: boolean) => void)(next);
                        if (String(title) === "채널 과거 콘텐츠" && next && selectedVideo && channelHistory.length === 0) {
                          void loadChannelContext(selectedVideo);
                        }
                      }}
                      className="mt-1 accent-red-500"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-zinc-200">{String(title)}</span>
                      <span className="mt-1 block text-xs leading-5 text-zinc-500">{String(description)}</span>
                    </span>
                  </label>
                ))}
              </div>
            </section>

            <section className="border-t border-zinc-900 py-8">
              <div className="mb-5 flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-red-600 text-sm font-bold text-white">4</span>
                <div>
                  <h2 className="font-semibold">Research Package & Prompt</h2>
                  <p className="text-sm text-zinc-500">작업 프로토콜과 실제 Evidence 전체를 한 파일로 묶어 ChatGPT Pro에 전달합니다.</p>
                </div>
              </div>

              <div className="rounded-3xl border border-zinc-800 bg-gradient-to-b from-zinc-950 to-zinc-950/40 p-6">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl bg-zinc-900/80 p-4">
                    <p className="text-xs text-zinc-500">Evidence</p>
                    <p className="mt-2 text-2xl font-bold">{comments.length.toLocaleString()}</p>
                    <p className="mt-1 text-xs text-zinc-600">댓글 + 답글 · 채널 영상 {channelHistory.length}개</p>
                  </div>
                  <div className="rounded-2xl bg-zinc-900/80 p-4">
                    <p className="text-xs text-zinc-500">Platforms</p>
                    <p className="mt-2 text-2xl font-bold">{platforms.length}</p>
                    <p className="mt-1 truncate text-xs text-zinc-600">{platforms.join(", ") || "미선택"}</p>
                  </div>
                  <div className="rounded-2xl bg-zinc-900/80 p-4">
                    <p className="text-xs text-zinc-500">영상 내용(대본)</p>
                    <p className="mt-2 text-2xl font-bold">{transcript.trim() ? "있음" : "없음"}</p>
                    <p className="mt-1 text-xs text-zinc-600">없으면 영상 발화 내용은 미검증 상태</p>
                  </div>
                </div>

                {!transcript.trim() ? (
                  <div className="mt-5 rounded-2xl border border-amber-900/60 bg-amber-950/20 p-4 text-sm leading-6 text-amber-200/90">
                    <strong className="font-semibold text-amber-200">영상 본문 Evidence가 아직 없습니다.</strong>
                    <span className="mt-1 block text-amber-200/70">
                      현재 확보된 영상 정보는 제목·설명·메타데이터와 댓글 반응입니다. 대본이 없으면 영상에서 실제로 한 말을 추정하지 않도록 통합 패키지에 제한 규칙이 포함됩니다. 영상의 발언 내용까지 분석하려면 TXT/SRT/VTT 대본을 추가하세요.
                    </span>
                  </div>
                ) : null}

                <div className="mt-6 rounded-2xl border border-red-950/70 bg-red-950/20 p-4">
                  <p className="text-sm font-semibold text-red-200">권장 사용 순서</p>
                  <ol className="mt-3 space-y-3 text-xs leading-6 text-red-200/75">
                    <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-500/15 font-semibold text-red-200">1</span><span><strong className="text-red-100">통합 분석 패키지 다운로드</strong><br />실행 프로토콜, 영상 정보·설명, 채널 과거 영상, 영상 대본(있는 경우), 댓글·답글 전체 원문이 한 .md 파일에 들어갑니다.</span></li>
                    <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-500/15 font-semibold text-red-200">2</span><span><strong className="text-red-100">ChatGPT Pro에서 새 채팅 열기</strong><br />새 채팅을 열어 분석 세션을 분리합니다.</span></li>
                    <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-500/15 font-semibold text-red-200">3</span><span><strong className="text-red-100">다운로드한 .md 파일 첨부</strong><br />ChatGPT Pro가 댓글 원문과 채널 이력을 실제 근거로 읽을 수 있게 합니다.</span></li>
                    <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-500/15 font-semibold text-red-200">4</span><span><strong className="text-red-100">시작 프롬프트 복사 후 전송</strong><br />파일 무결성 검사부터 시작해 댓글 분석 → 인터뷰 → 외부 조사 → 후보 압축 순서로 진행합니다.</span></li>
                  </ol>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <button type="button" onClick={downloadChatGPTBundle} className="rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-500">① 통합 분석 패키지</button>
                  <button type="button" onClick={copyLaunchPrompt} className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm font-semibold text-zinc-100 hover:border-zinc-600">② 시작 프롬프트 복사</button>
                </div>

                <details className="mt-4 rounded-2xl border border-zinc-900 bg-black/20 p-4">
                  <summary className="cursor-pointer text-xs font-medium text-zinc-400">원본 데이터 파일이 필요할 때만 열기</summary>
                  <p className="mt-2 text-xs leading-5 text-zinc-600">일반적인 ChatGPT Pro 분석에는 필요하지 않습니다. 백업·개발·직접 데이터 확인이 필요할 때만 사용하세요.</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <button type="button" onClick={() => downloadPackage("md")} className="rounded-xl border border-zinc-800 px-4 py-3 text-sm font-semibold text-zinc-300 hover:border-zinc-700">Raw Markdown</button>
                    <button type="button" onClick={() => downloadPackage("json")} className="rounded-xl border border-zinc-800 px-4 py-3 text-sm font-semibold text-zinc-300 hover:border-zinc-700">Raw JSON</button>
                  </div>
                </details>

                <div className="mt-6 rounded-2xl border border-zinc-900 bg-black/20 p-4 text-xs leading-6 text-zinc-500">
                  <strong className="text-zinc-300">Quality Gates:</strong> Package Integrity → Exhaustive Comment Pass → Audience Question Clustering → Anti-Generic Gate → Interview Gate → External Research → Candidate Re-evaluation → Platform Divergence → Candidate Ledger → Finalists → Production Brief
                </div>
              </div>
            </section>
              </>
            ) : (
              <section className="border-t border-zinc-900 py-8">
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-500">
                  <div className="flex items-center gap-3">
                    {collectingComments ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-300" /> : <span className="h-2 w-2 rounded-full bg-zinc-700" />}
                    <span>{collectingComments ? "댓글과 답글을 수집하고 있습니다. 완료되면 Research 설정 단계가 자동으로 열립니다." : "Research 설정과 분석 패키지 생성은 댓글 수집을 완료한 뒤 열립니다."}</span>
                  </div>
                </div>
              </section>
            )}
          </>
        ) : null}
      </div>
    </main>
  );
}
