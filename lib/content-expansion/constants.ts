import type { Platform, ResearchGoal } from "./types";

export const PLATFORM_OPTIONS: Array<{
  id: Platform;
  label: string;
  description: string;
}> = [
  {
    id: "wordpress",
    label: "WordPress",
    description: "Google 검색 의도와 장기 검색 유입 중심",
  },
  {
    id: "naver-blog",
    label: "네이버 블로그",
    description: "네이버 검색 맥락과 정보 탐색 흐름 중심",
  },
  {
    id: "youtube",
    label: "YouTube",
    description: "클릭·시청 지속·후속 시청 흐름 중심",
  },
  {
    id: "youtube-shorts",
    label: "YouTube Shorts",
    description: "즉시 이해되는 Hook과 단일 메시지 중심",
  },
];

export const GOAL_OPTIONS: Array<{
  id: ResearchGoal;
  label: string;
  description: string;
}> = [
  {
    id: "overall-followup",
    label: "종합 후속 콘텐츠",
    description: "원본 영상 이후 가장 가치 있는 확장 방향 탐색",
  },
  {
    id: "series",
    label: "시리즈",
    description: "연속 시청과 반복 방문을 만들 수 있는 시리즈 탐색",
  },
  {
    id: "audience-questions",
    label: "시청자 질문",
    description: "댓글의 반복 질문과 미해결 궁금증 중심",
  },
  {
    id: "seo-expansion",
    label: "SEO 확장",
    description: "검색 의도와 정보 구조를 확장할 수 있는 주제 탐색",
  },
  {
    id: "search-demand",
    label: "검색 수요",
    description: "실제 검색 시장에서 수요가 확인되는 주제 탐색",
  },
  {
    id: "content-gap",
    label: "Content Gap",
    description: "원본·경쟁 콘텐츠가 충분히 답하지 못한 공백 탐색",
  },
];

export const CORE_PRINCIPLES = [
  "Evidence First: 근거 없는 추천을 만들지 않는다.",
  "Quality over Quantity: 개수를 맞추기 위한 억지 후보를 만들지 않는다.",
  "Zero is Valid: 가치 있는 후속 콘텐츠가 없다면 0개라고 결론낼 수 있다.",
  "Interview before Conclusion: 사업·고객·제작 조건을 추측하지 말고 필요한 만큼 인터뷰한다.",
  "Search before Finalization: 최종 후보는 실제 외부 검색과 경쟁 환경을 확인한 뒤 확정한다.",
  "Preserve Alternatives: 보류·탈락 후보도 Candidate Ledger에 남겨 언제든 되돌아갈 수 있게 한다.",
  "Platform Divergence: 같은 Root Topic이라도 플랫폼별 결과를 단순 복제하지 않는다.",
  "No Blind Copying: 경쟁 콘텐츠는 수요와 구조를 연구하되 표현·대본·구성을 그대로 가져오지 않는다.",
  "Content Dead End: 확장 가치가 없다면 억지로 이어가지 않고 종료를 권고한다.",
  "Traceability: 모든 추천은 댓글·영상·검색 근거까지 역추적 가능해야 한다.",
];
