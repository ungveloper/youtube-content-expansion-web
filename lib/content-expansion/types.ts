export type SourceMode = "channel" | "video" | "discover";

export type Platform =
  | "wordpress"
  | "naver-blog"
  | "youtube"
  | "youtube-shorts";

export type ResearchGoal =
  | "overall-followup"
  | "series"
  | "audience-questions"
  | "seo-expansion"
  | "search-demand"
  | "content-gap";

export type CandidateStatus =
  | "KEEP"
  | "KEEP_COMPETITIVE"
  | "HOLD"
  | "PARK"
  | "REJECT"
  | "DEAD_END";

export type YouTubeChannel = {
  id: string;
  title: string;
  handle?: string | null;
  description?: string;
  thumbnailUrl?: string | null;
  subscriberCount?: number | null;
  videoCount?: number | null;
  viewCount?: number | null;
};

export type YouTubeVideo = {
  id: string;
  channelId: string;
  channelTitle: string;
  title: string;
  description: string;
  publishedAt: string;
  thumbnailUrl?: string | null;
  duration?: string | null;
  viewCount: number;
  likeCount: number;
  commentCount: number;
};

export type YouTubeComment = {
  id: string;
  parentCommentId: string | null;
  authorName: string;
  authorChannelId: string | null;
  text: string;
  likeCount: number;
  publishedAt: string;
  updatedAt: string;
  isReply: boolean;
};

export type CommentCollection = {
  comments: YouTubeComment[];
  topLevelCount: number;
  replyCount: number;
  status: "not_started" | "partial" | "complete";
  collectedAt: string;
};

export type ResearchPackage = {
  schemaVersion: "1.0";
  generatedAt: string;
  source: {
    mode: SourceMode;
    query: string;
  };
  channel: YouTubeChannel | null;
  video: YouTubeVideo;
  channelHistory: YouTubeVideo[];
  transcript: {
    status: "provided" | "missing";
    text: string;
  };
  comments: CommentCollection;
  settings: {
    platforms: Platform[];
    goals: ResearchGoal[];
    includeChannelHistory: boolean;
    includeCompetitorResearch: boolean;
    includeWebResearch: boolean;
  };
  principles: string[];
};
