import { CORE_PRINCIPLES } from "./constants";
import type {
  CommentCollection,
  Platform,
  ResearchGoal,
  ResearchPackage,
  SourceMode,
  YouTubeChannel,
  YouTubeComment,
  YouTubeVideo,
} from "./types";

export function createResearchPackage(input: {
  sourceMode: SourceMode;
  sourceQuery: string;
  channel: YouTubeChannel | null;
  video: YouTubeVideo;
  channelHistory: YouTubeVideo[];
  transcript: string;
  comments: CommentCollection;
  platforms: Platform[];
  goals: ResearchGoal[];
  includeChannelHistory: boolean;
  includeCompetitorResearch: boolean;
  includeWebResearch: boolean;
}): ResearchPackage {
  return {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    source: {
      mode: input.sourceMode,
      query: input.sourceQuery,
    },
    channel: input.channel,
    video: input.video,
    channelHistory: input.includeChannelHistory ? input.channelHistory : [],
    transcript: {
      status: input.transcript.trim() ? "provided" : "missing",
      text: input.transcript.trim(),
    },
    comments: input.comments,
    settings: {
      platforms: input.platforms,
      goals: input.goals,
      includeChannelHistory: input.includeChannelHistory,
      includeCompetitorResearch: input.includeCompetitorResearch,
      includeWebResearch: input.includeWebResearch,
    },
    principles: CORE_PRINCIPLES,
  };
}

function authorKey(comment: YouTubeComment) {
  return (comment.authorChannelId || comment.authorName).trim().toLowerCase();
}

function normalizedText(text: string) {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeQuestion(text: string) {
  return /\?|궁금|어떻게|왜\s|왜$|무엇|뭐가|뭔가|언제|어디|얼마|가능한가|가능할까요|가능한지|되나요|되나|인가요|인가요|나요|까요|방법|차이|부작용|증상|원인/.test(
    text.toLowerCase(),
  );
}

function commentLine(comment: YouTubeComment) {
  const type = comment.isReply ? "REPLY" : "COMMENT";
  return `- [${type}:${comment.id}] likes=${comment.likeCount} | author=${comment.authorName} | published=${comment.publishedAt} | parent=${comment.parentCommentId ?? "-"}\n  ${comment.text.replace(/\n/g, " ")}`;
}

function evidenceDigest(pkg: ResearchPackage) {
  const comments = pkg.comments.comments;
  const uniqueAuthors = new Set(comments.map(authorKey).filter(Boolean)).size;

  const repliesByParent = new Map<string, number>();
  comments.forEach((comment) => {
    if (comment.parentCommentId) {
      repliesByParent.set(
        comment.parentCommentId,
        (repliesByParent.get(comment.parentCommentId) ?? 0) + 1,
      );
    }
  });

  const topLiked = [...comments]
    .sort((a, b) => b.likeCount - a.likeCount)
    .slice(0, 30);

  const questionSignals = comments
    .filter((comment) => looksLikeQuestion(comment.text))
    .sort((a, b) => b.likeCount - a.likeCount)
    .slice(0, 100);

  const discussionThreads = comments
    .filter((comment) => !comment.isReply)
    .map((comment) => ({
      comment,
      replies: repliesByParent.get(comment.id) ?? 0,
    }))
    .filter((item) => item.replies > 0)
    .sort((a, b) => b.replies - a.replies || b.comment.likeCount - a.comment.likeCount)
    .slice(0, 30);

  const duplicateMap = new Map<string, YouTubeComment[]>();
  comments.forEach((comment) => {
    const normalized = normalizedText(comment.text);
    if (normalized.length < 8) return;
    const group = duplicateMap.get(normalized) ?? [];
    group.push(comment);
    duplicateMap.set(normalized, group);
  });
  const duplicateSignals = [...duplicateMap.entries()]
    .filter(([, group]) => group.length >= 2)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 20);

  const topChannelVideos = [...pkg.channelHistory]
    .sort((a, b) => b.viewCount - a.viewCount)
    .slice(0, 20);

  return `## Evidence Manifest\n- Video ID: ${pkg.video.id}\n- Video URL: https://www.youtube.com/watch?v=${pkg.video.id}\n- Collected comment records: ${comments.length}\n- Top-level comments: ${pkg.comments.topLevelCount}\n- Replies: ${pkg.comments.replyCount}\n- Unique authors in collected records: ${uniqueAuthors}\n- Collection status: ${pkg.comments.status}\n- Channel history videos: ${pkg.channelHistory.length}\n- Transcript: ${pkg.transcript.status}\n\n## Deterministic Evidence Signals\n> 아래 항목은 AI 의미 분석 결과가 아니라, 앱이 원본 데이터에서 기계적으로 뽑은 탐색 보조 신호다. 이것을 Audience Question Cluster의 최종 결과로 오해하지 않는다.\n\n### Top liked comments / replies (up to 30)\n${topLiked.map(commentLine).join("\n") || "(none)"}\n\n### Question-like text signals (up to 100)\n${questionSignals.map(commentLine).join("\n") || "(none detected by heuristic)"}\n\n### Most discussed top-level threads (up to 30)\n${discussionThreads.map(({ comment, replies }) => `${commentLine(comment)}\n  replies=${replies}`).join("\n") || "(none)"}\n\n### Exact/normalized repeated-text signals (up to 20 groups)\n${duplicateSignals.map(([text, group], index) => `- D-${String(index + 1).padStart(3, "0")} | count=${group.length} | normalized=${text}\n  ids=${group.map((comment) => comment.id).join(", ")}`).join("\n") || "(none)"}\n\n### Top channel videos by views (up to 20)\n${topChannelVideos.map((video) => `- [CHANNEL:${video.id}] ${video.title} | views=${video.viewCount} | comments=${video.commentCount} | published=${video.publishedAt} | https://www.youtube.com/watch?v=${video.id}`).join("\n") || "(not included)"}`;
}

function renderComments(comments: YouTubeComment[]) {
  return comments
    .map((comment, index) => {
      const prefix = comment.isReply ? "Reply" : "Comment";
      return `### ${String(index + 1).padStart(5, "0")} · ${prefix} · [COMMENT:${comment.id}]\n- YouTube comment ID: ${comment.id}\n- Author: ${comment.authorName}\n- Author channel ID: ${comment.authorChannelId ?? "-"}\n- Likes: ${comment.likeCount}\n- Published: ${comment.publishedAt}\n- Updated: ${comment.updatedAt}\n- Parent: ${comment.parentCommentId ?? "-"}\n\n${comment.text}`;
    })
    .join("\n\n");
}

export function researchPackageToMarkdown(pkg: ResearchPackage) {
  const channelHistory = pkg.channelHistory
    .map(
      (video, index) =>
        `### ${String(index + 1).padStart(3, "0")} · [CHANNEL:${video.id}]\n- URL: https://www.youtube.com/watch?v=${video.id}\n- Published: ${video.publishedAt}\n- Title: ${video.title}\n- Views: ${video.viewCount}\n- Likes: ${video.likeCount}\n- Comments: ${video.commentCount}`,
    )
    .join("\n\n");

  return `# Research Package\n\n## Source\n- Mode: ${pkg.source.mode}\n- Query: ${pkg.source.query}\n- Generated: ${pkg.generatedAt}\n\n## Selected Video [YT-META]\n- ID: ${pkg.video.id}\n- URL: https://www.youtube.com/watch?v=${pkg.video.id}\n- Title: ${pkg.video.title}\n- Channel ID: ${pkg.video.channelId}\n- Channel: ${pkg.video.channelTitle}\n- Published: ${pkg.video.publishedAt}\n- Duration: ${pkg.video.duration ?? "-"}\n- Views: ${pkg.video.viewCount}\n- Likes: ${pkg.video.likeCount}\n- Comments shown by video statistics: ${pkg.video.commentCount}\n- Thumbnail URL: ${pkg.video.thumbnailUrl ?? "-"}\n\n## Selected Video Description [YT-DESC]\n${pkg.video.description || "(empty)"}\n\n${evidenceDigest(pkg)}\n\n## Channel Metadata [YT-META]\n${pkg.channel ? `- ID: ${pkg.channel.id}\n- Title: ${pkg.channel.title}\n- Handle: ${pkg.channel.handle ?? "-"}\n- Subscribers: ${pkg.channel.subscriberCount ?? "-"}\n- Video count: ${pkg.channel.videoCount ?? "-"}\n- Total views: ${pkg.channel.viewCount ?? "-"}\n\n### Channel description\n${pkg.channel.description || "(empty)"}` : "(not loaded)"}\n\n## Channel History\n- Included videos: ${pkg.channelHistory.length}\n\n${channelHistory || "(not included)"}\n\n## Transcript [TRANSCRIPT]\nStatus: ${pkg.transcript.status}\nCharacters: ${pkg.transcript.text.length}\n\n${pkg.transcript.text || "(not provided — do not infer exact spoken content)"}\n\n## Research Settings\n- Platforms: ${pkg.settings.platforms.join(", ") || "-"}\n- Goals: ${pkg.settings.goals.join(", ") || "-"}\n- Channel history: ${pkg.settings.includeChannelHistory}\n- Competitor research: ${pkg.settings.includeCompetitorResearch}\n- Web research: ${pkg.settings.includeWebResearch}\n\n## Principles\n${pkg.principles.map((item) => `- ${item}`).join("\n")}\n\n# FULL RAW COMMENT CORPUS\n- Total records: ${pkg.comments.comments.length}\n- Top-level: ${pkg.comments.topLevelCount}\n- Replies: ${pkg.comments.replyCount}\n- Status: ${pkg.comments.status}\n- Collected at: ${pkg.comments.collectedAt}\n\n${renderComments(pkg.comments.comments) || "(no comments collected)"}\n`;
}
