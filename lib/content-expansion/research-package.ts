import { CORE_PRINCIPLES } from "./constants";
import type {
  CommentCollection,
  Platform,
  ResearchGoal,
  ResearchPackage,
  SourceMode,
  YouTubeChannel,
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

export function researchPackageToMarkdown(pkg: ResearchPackage) {
  const comments = pkg.comments.comments
    .map((comment) => {
      const prefix = comment.isReply ? "Reply" : "Comment";
      return `### ${prefix} ${comment.id}\n- Author: ${comment.authorName}\n- Likes: ${comment.likeCount}\n- Published: ${comment.publishedAt}\n- Parent: ${comment.parentCommentId ?? "-"}\n\n${comment.text}`;
    })
    .join("\n\n");

  return `# Research Package\n\n## Source\n- Mode: ${pkg.source.mode}\n- Query: ${pkg.source.query}\n- Generated: ${pkg.generatedAt}\n\n## Video\n- ID: ${pkg.video.id}\n- Title: ${pkg.video.title}\n- Channel: ${pkg.video.channelTitle}\n- Published: ${pkg.video.publishedAt}\n- Views: ${pkg.video.viewCount}\n- Likes: ${pkg.video.likeCount}\n- Comments: ${pkg.video.commentCount}\n\n### Description\n${pkg.video.description || "(empty)"}\n\n## Channel History\n- Included videos: ${pkg.channelHistory.length}\n\n${pkg.channelHistory.map((video) => `- ${video.publishedAt.slice(0, 10)} | ${video.title} | views=${video.viewCount} | comments=${video.commentCount}`).join("\n") || "(not included)"}\n\n## Transcript\nStatus: ${pkg.transcript.status}\n\n${pkg.transcript.text || "(not provided)"}\n\n## Research Settings\n- Platforms: ${pkg.settings.platforms.join(", ") || "-"}\n- Goals: ${pkg.settings.goals.join(", ") || "-"}\n- Channel history: ${pkg.settings.includeChannelHistory}\n- Competitor research: ${pkg.settings.includeCompetitorResearch}\n- Web research: ${pkg.settings.includeWebResearch}\n\n## Principles\n${pkg.principles.map((item) => `- ${item}`).join("\n")}\n\n## Collected Comments\n- Total records: ${pkg.comments.comments.length}\n- Top-level: ${pkg.comments.topLevelCount}\n- Replies: ${pkg.comments.replyCount}\n- Status: ${pkg.comments.status}\n- Collected at: ${pkg.comments.collectedAt}\n\n${comments || "(no comments collected)"}\n`;
}
