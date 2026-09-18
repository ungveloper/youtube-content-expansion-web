"use client";

import { useMemo, useRef, useState } from "react";
import { GOAL_OPTIONS, PLATFORM_OPTIONS } from "@/lib/content-expansion/constants";
import { buildMasterPrompt } from "@/lib/content-expansion/prompt-builder";
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
      setError(err instanceof Error ? err.message : "채널 과거 콘텐츠를 불러오지 못했습니다.");
    }
  }

  function selectVideo(video: YouTubeVideo) {
    setSelectedVideo(video);
    setComments([]);
    setCommentProgress(0);
    setCommentStatus("not_started");
    setTranscript("");
    if (sourceMode === "channel") {
      setChannelHistory(videos.filter((item) => item.channelId === video.channelId));
    } else {
      setChannelHistory([]);
      void loadChannelContext(video);
    }
  }

  async function searchSource() {
    setLoading(true);
    setError("");
    setSelectedVideo(null);
    setChannelHistory([]);
    setComments([]);
    try {
      if (sourceMode === "channel") {
        const channelData = await readJson(
          await fetch(`/api/youtube/channel?input=${encodeURIComponent(query)}`),
        );
        setChannel(channelData.channel);
        const videoData = await readJson(
          await fetch(`/api/youtube/channel-videos?channelId=${channelData.channel.id}&limit=100`),
        );
        setVideos(videoData.videos);
      } else if (sourceMode === "video") {
        const data = await readJson(
          await fetch(`/api/youtube/video?input=${encodeURIComponent(query)}`),
        );
        setVideos([data.video]);
        selectVideo(data.video);
      } else {
        const data = await readJson(
          await fetch(`/api/youtube/discover?query=${encodeURIComponent(query)}&limit=100&period=${discoveryPeriod}`),
        );
        setVideos(data.videos);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "조회 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function collectAllComments() {
    if (!selectedVideo) return;
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
      setCommentStatus(stopCollectionRef.current ? "partial" : "complete");
    } catch (err) {
      setError(err instanceof Error ? err.message : "댓글 수집 중 오류가 발생했습니다.");
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
    setGoals((current) =>
      current.includes(goal)
        ? current.filter((item) => item !== goal)
        : [...current, goal],
    );
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
  }

  async function copyPrompt() {
    const pkg = buildPackage();
    if (!pkg) return;
    await navigator.clipboard.writeText(buildMasterPrompt(pkg));
    window.alert("ChatGPT Pro용 단계형 프롬프트를 복사했습니다.");
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
                  ? "@handle 또는 YouTube 채널 URL"
                  : sourceMode === "video"
                    ? "영상 ID 또는 YouTube URL"
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
          ) : null}
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
                    <span className="rounded-lg bg-zinc-900 px-2.5 py-1 text-xs text-zinc-400">{commentProgress.toLocaleString()} records · {commentStatus}</span>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={collectAllComments}
                      disabled={collectingComments}
                      className="flex-1 rounded-xl bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-950 disabled:opacity-40"
                    >
                      {collectingComments ? "수집 중..." : comments.length ? "처음부터 다시 수집" : "전체 수집"}
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
                    <h3 className="font-semibold">Transcript</h3>
                    <p className="mt-1 text-sm text-zinc-500">공식 API로 확보할 수 없는 경우 직접 붙여넣거나 SRT/VTT/TXT 파일을 불러옵니다.</p>
                  </div>
                  <label className="cursor-pointer rounded-xl border border-zinc-800 px-3 py-2 text-xs text-zinc-300 hover:border-zinc-700">
                    파일 불러오기
                    <input
                      type="file"
                      accept=".txt,.srt,.vtt,text/plain"
                      className="hidden"
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        if (file) setTranscript(await file.text());
                      }}
                    />
                  </label>
                </div>
                <textarea
                  value={transcript}
                  onChange={(event) => setTranscript(event.target.value)}
                  placeholder="영상 Transcript를 여기에 붙여넣으세요. 없어도 진행할 수 있으며, 프롬프트가 그 한계를 명시합니다."
                  className="mt-4 min-h-48 w-full resize-y rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm leading-6 text-zinc-300 outline-none placeholder:text-zinc-600 focus:border-zinc-600"
                />
              </div>
            </section>

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

              <h3 className="mb-3 mt-7 text-sm font-semibold text-zinc-300">조사 목적</h3>
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
                  <p className="text-sm text-zinc-500">파일을 ChatGPT Pro에 첨부하고 단계형 프롬프트를 붙여넣어 인터뷰를 시작합니다.</p>
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
                    <p className="text-xs text-zinc-500">Transcript</p>
                    <p className="mt-2 text-2xl font-bold">{transcript.trim() ? "READY" : "MISSING"}</p>
                    <p className="mt-1 text-xs text-zinc-600">없어도 한계를 명시하고 진행</p>
                  </div>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <button type="button" onClick={() => downloadPackage("json")} className="rounded-xl border border-zinc-800 px-4 py-3 text-sm font-semibold text-zinc-200 hover:border-zinc-700">Research Package JSON</button>
                  <button type="button" onClick={() => downloadPackage("md")} className="rounded-xl border border-zinc-800 px-4 py-3 text-sm font-semibold text-zinc-200 hover:border-zinc-700">Research Package Markdown</button>
                  <button type="button" onClick={copyPrompt} className="rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-500">ChatGPT Pro 프롬프트 복사</button>
                </div>

                <div className="mt-6 rounded-2xl border border-zinc-900 bg-black/20 p-4 text-xs leading-6 text-zinc-500">
                  <strong className="text-zinc-300">Workflow:</strong> Evidence Understanding → Audience Question Clustering → Needs/Gap → Candidate Pool → Anti-Generic Gate → Interview Gate → External Research → Re-evaluation → Platform Divergence Gate → Candidate Ledger → Finalists → Production Brief
                </div>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
