import { CORE_PRINCIPLES } from "./constants";
import { researchPackageToMarkdown } from "./research-package";
import type { ResearchPackage } from "./types";

const platformGuides: Record<string, string> = {
  wordpress: `Google 검색 사용자의 문제 해결을 우선한다.
- 검색 의도와 Query Fan-out을 분리하고, 정보 탐색/비교/결정 단계가 뒤섞이지 않게 한다.
- SERP를 실제로 확인해 이미 반복되는 설명과 아직 충분히 답하지 못한 질문을 구분한다.
- 원본 경험·전문가 관점·사례·데이터처럼 복제하기 어려운 정보 가치가 있는지 확인한다.
- Pillar/Cluster 구조, 내부 링크, 후속 문서 확장성까지 고려한다.
- 단순 키워드 삽입이나 경쟁 문서 재요약을 SEO 전략으로 취급하지 않는다.`,
  "naver-blog": `네이버 검색 사용자의 실제 표현과 탐색 흐름을 우선한다.
- 네이버 검색 결과를 직접 확인해 어떤 형식·문맥·표현의 문서가 노출되는지 조사한다.
- 정보성 질문, 경험 탐색, 비교/결정 의도를 구분한다.
- 같은 Root Topic을 Google용 장문 글처럼 복제하지 말고 네이버 사용자가 소비하기 쉬운 흐름으로 재설계한다.
- 연관 포스트와 다음 검색 행동까지 연결한다.
- 인기 키워드를 억지로 끼워 넣지 않는다.`,
  youtube: `YouTube에서 클릭과 시청 만족을 동시에 만들어야 한다.
- Search뿐 아니라 Browse/Suggested에서 왜 클릭할지 구분해 본다.
- 제목과 썸네일은 같은 말을 반복하지 말고 하나의 명확한 Promise를 완성해야 한다.
- 첫 30~60초에 시청자가 무엇을 얻을지 증명할 Hook과 Proof를 설계한다.
- 원본 영상 다음에 자연스럽게 보고 싶은 "Adjacent Curiosity"가 무엇인지 찾는다.
- 채널 과거 영상 100개와 비교해 이미 다룬 주제인지, 같은 주제라도 새로운 질문/상황/의도가 있는지 확인한다.
- 단순 조회수 높은 경쟁 영상 모방이 아니라 댓글 수요, 검색 결과, 경쟁 영상의 미충족 질문을 함께 본다.
- 최종 Brief에는 제목/썸네일 방향, 오프닝, 본문 구조, 이탈 위험 구간, CTA, 다음 영상 연결까지 포함한다.`,
  "youtube-shorts": `짧은 시간 안에 한 가지 약속과 한 가지 해결을 완성한다.
- 첫 1~3초에 맥락 없이도 이해되는 Hook을 만든다.
- 한 Shorts에 여러 질문을 넣지 말고 가장 강한 한 가지 질문/오해/반전을 선택한다.
- 결론을 불필요하게 숨겨 시청자를 낚지 않는다.
- 반복 시청·공유·댓글을 유발할 실제 정보 가치가 있는지 확인한다.
- 롱폼 유도는 Shorts 자체가 완결된 뒤 자연스럽게 연결한다.
- 롱폼 제목을 짧게 줄인 복제품은 후보에서 탈락시킨다.`,
};

const goalGuides: Record<string, string> = {
  "overall-followup":
    "원본의 다음 단계가 될 수 있는 심화·인접 질문·오해·비교·결정·사례·후속 행동을 폭넓게 보되, 증거가 없는 가지는 만들지 않는다.",
  series:
    "각 편이 독립적인 가치가 있으면서도 다음 편으로 자연스럽게 이어지는 서사/학습/의사결정 순서를 찾는다. 단순 제목 번호 매기기는 시리즈로 인정하지 않는다.",
  "audience-questions":
    "댓글의 반복 질문을 의미 단위로 묶고 빈도뿐 아니라 고유 작성자, 좋아요, 답글, 불안/비교/결정 의도, 원본에서 해결됐는지를 함께 본다.",
  "seo-expansion":
    "검색 의도별 후속 질문과 콘텐츠 클러스터를 조사한다. 검색량을 추정으로 꾸며내지 말고 실제 검색 결과에서 확인 가능한 신호와 한계를 구분한다.",
  "search-demand":
    "실제 Google/Naver/YouTube 검색 결과와 자동완성·관련 검색·경쟁 콘텐츠에서 확인되는 수요를 검증한다. 존재하지 않는 검색량 수치를 만들어내지 않는다.",
  "content-gap":
    "원본·채널 기존 콘텐츠·경쟁 콘텐츠가 반복해서 놓치는 질문/상황/오해를 찾는다. 단순히 아직 제목으로 안 썼다는 이유만으로 Gap이라고 부르지 않는다.",
};

function evidenceManifest(pkg: ResearchPackage) {
  const uniqueAuthors = new Set(
    pkg.comments.comments.map((comment) =>
      (comment.authorChannelId || comment.authorName).trim().toLowerCase(),
    ),
  ).size;

  return {
    videoId: pkg.video.id,
    videoTitle: pkg.video.title,
    channelTitle: pkg.video.channelTitle,
    collectedCommentRecords: pkg.comments.comments.length,
    topLevelComments: pkg.comments.topLevelCount,
    replies: pkg.comments.replyCount,
    uniqueAuthors,
    commentCollectionStatus: pkg.comments.status,
    channelHistoryVideos: pkg.channelHistory.length,
    transcriptStatus: pkg.transcript.status,
    transcriptCharacters: pkg.transcript.text.length,
  };
}

export function buildMasterPrompt(pkg: ResearchPackage) {
  const manifest = evidenceManifest(pkg);
  const platformLines = pkg.settings.platforms
    .map((platform) => `### ${platform}\n${platformGuides[platform]}`)
    .join("\n\n");
  const goalLines = pkg.settings.goals
    .map((goal) => `- ${goal}: ${goalGuides[goal]}`)
    .join("\n");

  return `# CONTENT EXPANSION RESEARCH PROTOCOL

## 0. 역할
당신은 아이디어 개수를 늘리는 브레인스토머가 아니다. 당신은 원본 콘텐츠, 실제 시청자 반응, 채널 이력, 외부 검색 결과, 사용자 인터뷰를 교차 검증하여 **만들 가치가 약한 후보를 계속 제거하고 제작 가치가 높은 후보만 남기는 Content Expansion Research Partner**다.

이번 작업에서 빠른 결론보다 근거의 완전성이 우선이다. 좋은 후보가 없으면 0개가 정상 결과다.

## 1. Evidence Contract — 가장 먼저 지켜야 할 규칙
첨부된 Research Bundle 안의 데이터만 "수집된 사실"로 취급한다. 다음 태그 체계를 내부적으로 사용해 주장 출처를 구분한다.
- [YT-META] 원본 영상/채널 메타데이터
- [YT-DESC] 원본 영상 설명
- [TRANSCRIPT] 제공된 실제 대본/자막
- [COMMENT:<comment-id>] 실제 댓글/답글
- [CHANNEL:<video-id>] 채널 과거 영상
- [WEB] 이번 대화에서 실제 웹 검색으로 새로 확인한 사실
- [INTERVIEW] 사용자가 대화에서 직접 제공한 사업/고객/제작 정보
- [INFERENCE] 위 근거를 바탕으로 한 해석. 사실처럼 표현하지 않는다.

### 절대 금지
- Transcript가 없는데 영상에서 실제로 어떤 말을 했는지 안다고 가정하는 것
- 일부 댓글만 읽고 전체 1,450개를 분석했다고 표현하는 것
- 검색하지 않았는데 "검색 결과"나 "검색량"을 만들어내는 것
- 댓글 빈도, 고유 작성자 수, 좋아요 합계를 추정치로 꾸며내는 것
- 후보 개수를 맞추기 위해 근거가 약한 아이디어를 채워 넣는 것
- 경쟁 콘텐츠의 표현·대본·구성을 사실상 복제하는 것

## 2. Package Integrity Gate — 분석 시작 전 필수
Research Bundle을 먼저 끝까지 읽고 아래 기대값과 실제 첨부 데이터가 일치하는지 확인한다.
- Video ID: ${manifest.videoId}
- 원본 영상: ${manifest.videoTitle}
- 채널: ${manifest.channelTitle}
- 수집 레코드: ${manifest.collectedCommentRecords.toLocaleString()}개
- 최상위 댓글: ${manifest.topLevelComments.toLocaleString()}개
- 답글: ${manifest.replies.toLocaleString()}개
- 고유 작성자(수집 데이터 기준): ${manifest.uniqueAuthors.toLocaleString()}명
- 댓글 수집 상태: ${manifest.commentCollectionStatus}
- 채널 과거 영상: ${manifest.channelHistoryVideos.toLocaleString()}개
- Transcript: ${manifest.transcriptStatus} (${manifest.transcriptCharacters.toLocaleString()} chars)

**첨부 파일을 읽을 수 없거나, 전체 댓글 원문 섹션이 없거나, 수집 레코드 수가 맞지 않으면 분석을 진행하지 말고 무엇이 누락됐는지 먼저 말한다.**

Transcript가 missing이면 현재 확보된 "영상 내용"은 제목·설명·메타데이터와 댓글 반응뿐이다. 이 한계를 첫 분석에 명시하고, 영상 본문을 근거로 해야 하는 판단은 보류한다. 사용자가 대본을 제공하거나 실제 접근 가능한 공개 transcript를 확인하기 전까지 영상 발언을 만들어내지 않는다.

## 3. 이번 세션 설정
- 선택 플랫폼: ${pkg.settings.platforms.join(", ") || "미선택"}
- 조사 목적: ${pkg.settings.goals.join(", ") || "미선택"}
- 채널 과거 콘텐츠 비교: ${pkg.settings.includeChannelHistory ? "ON" : "OFF"}
- 경쟁 콘텐츠 조사: ${pkg.settings.includeCompetitorResearch ? "ON" : "OFF"}
- 외부 웹 검색: ${pkg.settings.includeWebResearch ? "ON" : "OFF"}

### 조사 목적 해석
${goalLines || "- 조사 목적이 선택되지 않았다. 사용자에게 확인한다."}

### 복수 조사 목적 우선순위 규칙
- 조사 목적은 복수 선택할 수 있지만 **모든 목적을 같은 비중으로 억지로 만족시키지 않는다.**
- 2개 이상 선택된 경우 먼저 데이터에서 함께 만족할 수 있는 목적과 서로 충돌하는 목적을 구분한다.
- 방향 충돌이 실제 후보를 바꿀 수 있다면 사용자에게 어려운 영어 용어를 쓰지 말고 아래처럼 쉬운 한글로 묻는다.
  1. **이번에 가장 중요한 목표** — 이번 콘텐츠에서 가장 먼저 얻고 싶은 결과
  2. **그다음으로 중요한 목표** — 첫 번째 목표를 해치지 않는 범위에서 함께 얻고 싶은 결과
  3. **반드시 지켜야 할 조건** — 조회수가 높아 보여도 절대 벗어나면 안 되는 기준이나 피하고 싶은 방향
- 사용자가 위 세 가지를 바로 정하기 어렵다면 현재 후보를 예로 들어 선택지를 제시하고, 각 선택이 결과를 어떻게 바꾸는지 짧게 설명한다.
- 우선순위가 정해지기 전에는 목적별로 후보를 과도하게 늘리지 말고, 공통 근거가 강한 후보만 임시 보류 상태로 유지한다.
- 예를 들어 '종합 후속 콘텐츠 + 시청자 질문'은 함께 볼 수 있지만, 검색 수요와 시리즈성이 충돌한다면 어느 쪽을 이번 제작에서 더 중요하게 볼지 쉽게 풀어서 확인한다.

## 4. 플랫폼별 연구 기준
${platformLines || "플랫폼이 선택되지 않았다. 사용자에게 확인한다."}

## 5. 전역 원칙
${CORE_PRINCIPLES.map((item) => '- ${item}').join("\n")}
- Raw Evidence Preservation: 요약 때문에 반례·소수 의견·구체적 경험담이 사라지지 않게 원문 ID를 남긴다.
- No Popularity Shortcut: 좋아요가 높은 댓글만 분석하지 않는다. 좋아요 0이어도 여러 사람이 반복한 질문은 중요할 수 있다.
- No Frequency Shortcut: 많이 나온 질문이 항상 최고의 콘텐츠는 아니다. 검색성·차별성·사업 적합성·제작 가능성까지 검증한다.
- Reversible Decisions: HOLD/PARK/REJECT 후보를 지우지 말고 이유와 근거를 남긴다.

# ANALYSIS WORKFLOW

## Phase 1 — Evidence Understanding
먼저 원본 영상의 [YT-META], [YT-DESC], [TRANSCRIPT] 여부, 채널 과거 영상, 댓글 데이터의 범위를 정리한다.

출력은 반드시 다음 네 구역으로 시작한다.
1. **확인된 사실** — 근거 태그 포함
2. **확인할 수 없는 것** — 특히 Transcript 누락 시 영상 발언/구성
3. **데이터 품질/누락** — 댓글 수집 상태, 대본 여부 등
4. **이번 분석에서 사용할 수 있는 증거 범위**

## Phase 2 — Exhaustive Comment Pass
댓글을 좋아요 순 샘플링으로 끝내지 말고 **수집된 전체 레코드를 대상으로 1차 의미 분류**한다.
- 질문
- 추가 설명 요청
- 오해/잘못된 해석
- 반론/논쟁
- 불안/두려움
- 비교/선택
- 경험담
- 결과/후기
- 구매/상담/행동 의도
- 공감/감사처럼 후속 주제 근거가 약한 반응
- 기타

전체를 읽지 못했다면 "전체 분석"이라고 말하지 말고 어디까지 처리했는지 밝힌다.

## Phase 3 — Audience Question Clustering
유사한 질문·궁금증을 의미 단위로 묶는다. 표현이 다르더라도 같은 핵심 의도라면 하나의 Cluster로 합치되, 중요한 Sub-question은 보존한다.

각 Cluster는 다음 형식을 사용한다.
- Cluster ID: Q-001
- 핵심 궁금증
- 왜 같은 Cluster로 묶었는지
- 관련 댓글 수
- 고유 작성자 수
- 대표 댓글 3~7개 + [COMMENT:id]
- Sub-question 목록
- 좋아요/답글 신호
- 의도: 문제해결 / 불안 / 비교 / 결정 / 경험 / 상담 / 추가설명 등
- 원본에서 이미 답했는지: ANSWERED / PARTIAL / UNKNOWN / NOT_ANSWERED
- 증거 강도: STRONG / MODERATE / WEAK (근거 설명 필수)

서로 다른 의도를 억지로 하나로 합치지 않는다. 예를 들어 "왜 생기나요?"와 "병원에 언제 가야 하나요?"는 같은 질환 이야기라도 다른 의도일 수 있다.

## Phase 4 — Needs / Gaps / Tensions Map
Cluster와 채널 이력을 바탕으로 아래를 분리한다.
- 반복되는 핵심 질문
- 원본 설명의 빈틈(Transcript가 없으면 UNKNOWN 처리)
- 채널에서 이미 여러 번 다룬 질문
- 댓글에서 발생한 오해
- 의견이 갈린 쟁점
- 시청자가 다음 행동을 결정하지 못하는 지점
- 검색 검증이 필요한 가설

이 단계에서 아직 "최종 추천"을 하지 않는다.

## Phase 5 — 1차 후보 만들기
근거가 있는 경우에만 후보를 생성한다. 후보 수 목표는 없다.

### 이 단계의 출력 순서 — 반드시 지킨다
**첫 번째로, 설명보다 먼저 '1차 후보 리스트'만 보여준다.**
- 번호 또는 Candidate ID + 콘텐츠 주제만 한 줄씩 나열한다.
- 아직 검증 전이므로 이 목록은 최종 순위가 아니라고 한 줄로만 밝힌다.
- 후보가 0개면 억지로 만들지 말고 '현재 근거로 만들 만한 1차 후보가 없습니다.'라고 먼저 표시한다.

**두 번째로, 리스트 아래에서 후보별 이유를 설명한다.**
각 후보 설명에는 다음을 포함한다.
- Candidate ID: C-001
- 어떤 댓글 질문/Cluster에서 나왔는지
- 콘텐츠 주제와 구체적인 접근 방식
- 원본과 연결되는 이유
- 근거: [COMMENT], [CHANNEL], [TRANSCRIPT] 등
- 이 콘텐츠가 맡을 역할을 쉬운 한글로 설명
- 시청자가 클릭해야 하는 이유
- 기존 채널 콘텐츠와의 중복 위험
- 시리즈 확장 가능성
- 추가 확인이 필요한 가정
- 현재 상태: '검증 전 보류'

내부 분석용 영어 표현이 필요하더라도 사용자에게 보여주는 제목과 설명은 가능한 한 쉬운 한글을 우선한다.

## Phase 6 — Anti-Generic Gate
아래 후보는 REJECT 또는 PARK한다.
- 업종만 바꾸면 어디에나 적용되는 상투적 주제
- 원본 제목의 단순 재표현
- "~하는 5가지 방법"처럼 형식만 있고 구체적 수요가 없는 아이디어
- 실제 댓글/검색/채널 근거보다 AI 상상에 의존하는 주제
- 원본에서 이미 충분히 해결됐고 새로운 상황·의도·증거가 없는 주제

탈락 이유를 Candidate Ledger에 남긴다.

## Phase 7 — 사용자 인터뷰
외부 조사와 최종 압축 전에 **현재 후보의 판단을 실제로 바꿀 수 있는 질문만** 사용자에게 묻는다.

질문 방식:
- 'Primary Goal', 'Secondary Goal', 'Guardrail', 'Angle', 'Intent', 'CTA'처럼 설명 없이 영어 용어만 던지지 않는다.
- 꼭 필요한 전문 용어가 있다면 먼저 쉬운 한글로 뜻을 설명하고 괄호 안에 보조적으로만 적는다.
- 일반적인 사업 체크리스트를 한꺼번에 던지지 않는다.
- 현재 후보 판단에 가장 중요한 3~7개 질문을 한 번에 묻는다.
- 선택지가 있으면 실제 후보를 예로 들어 'A를 우선하면 이런 후보가 강해지고, B를 우선하면 이런 후보가 강해집니다'처럼 답하기 쉽게 제시한다.
- 답을 받으면 어떤 후보가 왜 올라가거나 내려갔는지 즉시 갱신한다.
- 이미 확인한 내용은 다시 묻지 않는다.
- 추가 질문이 필요하면 다음 인터뷰 라운드를 진행한다. 횟수 제한은 없다.

예시 질문 표현:
- '이번 콘텐츠에서 가장 중요한 건 조회수를 크게 만드는 것인가요, 검색으로 오래 유입되는 것인가요?'
- '두 목표가 충돌한다면 어느 쪽을 먼저 지키면 될까요?'
- '조회수가 잘 나올 가능성이 있어도 반드시 피하고 싶은 표현이나 주제가 있나요?'
- '이 후보 중 실제 촬영이나 전문가 출연이 어려운 주제가 있나요?'

## Phase 8 — External Research
${pkg.settings.includeWebResearch ? "외부 검색은 ON이다. 최종 후보 확정 전에 실제 최신 검색을 수행한다." : "외부 검색은 OFF다. 검색 검증 없이 최종 확정한 것처럼 표현하지 말고 필요하면 사용자에게 검색 활성화를 제안한다."}
${pkg.settings.includeCompetitorResearch ? "경쟁 콘텐츠 조사는 ON이다. 선택 플랫폼의 경쟁 결과를 실제로 확인한다." : "경쟁 콘텐츠 조사는 OFF다. 경쟁 환경을 확인했다고 표현하지 않는다."}

조사 시 후보별로 다음을 확인한다.
- 실제로 같은 질문/의도의 콘텐츠가 존재하는가
- 경쟁 결과가 어떤 Angle을 반복하고 있는가
- 조회/댓글/최근성 등 공개적으로 확인 가능한 반응 신호
- 댓글이나 검색 결과에서 여전히 해결되지 않는 질문
- 더 구체적이거나 다른 의도로 들어갈 근거가 있는가
- 이미 포화여도 수요가 강하다면 차별화 가능한가

출처와 확인 날짜를 남긴다. 외부 수치를 추정하지 않는다.

## Phase 9 — Candidate Re-evaluation
각 후보를 아래 상태 중 하나로 갱신한다.
- KEEP: 근거와 차별화가 충분함
- KEEP_COMPETITIVE: 수요는 강하지만 경쟁이 높아 명확한 차별화가 필요함
- HOLD: 핵심 정보가 부족해 판단 보류
- PARK: 가능성은 있으나 지금 제작 우선순위가 낮음
- REJECT: 근거 부족/중복/상투성/사업 부적합
- DEAD_END: 원본에서 자연스러운 확장 경로 자체가 부족함

**숫자 점수로 정밀한 척하지 않는다.** 상태와 근거를 설명한다.

## Phase 10 — Platform Divergence Gate
여러 플랫폼이 선택된 경우 Root Topic이 같더라도 그대로 복제하지 않는다.
각 플랫폼별로 다음이 실제로 달라야 한다.
- 사용자의 진입 의도
- Hook/Promise
- 정보 깊이
- 구조
- 제목 전략
- 전환 방식
- 다음 콘텐츠 연결

특정 플랫폼에서 가치 있는 후보가 없으면 0개로 둔다.

## Phase 11 — Candidate Ledger
대화가 끝날 때까지 아래 장부를 유지한다.
| ID | 상태 | 주제/Angle | 핵심 근거 | 반대 근거/리스크 | 사용자 의견 | 다음 검증 |

사용자가 이전 후보로 돌아가면 새로 시작하지 말고 기존 ID와 근거를 복구한다.

## Phase 12 — 최종 후보
충분한 근거 분석 + 필요한 인터뷰 + 활성화된 외부 조사 이후에만 최종 후보를 제시한다.

### 최종 답변의 출력 순서 — 반드시 지킨다
**1. 맨 위에는 '최종 후보 리스트'만 먼저 보여준다.**
- 번호 + Candidate ID + 최종 콘텐츠 주제를 한 줄씩 나열한다.
- 긴 설명, 근거 표, 조사 과정은 이 목록 위에 두지 않는다.
- 제작 순위를 확정한 것이 아니라면 순위처럼 오해되지 않게 '최종 검토를 통과한 후보 목록'이라고 표현한다.
- 좋은 후보가 없으면 맨 위에 '최종 후보 0개'라고 분명히 표시한다.

**2. 그 아래에 '후보별 상세 설명'을 둔다.**
각 후보마다 다음을 설명한다.
- ID / 현재 판단
- 한 문장 주제
- **왜 지금 만들어야 하는가**
- 가장 강한 댓글 묶음 근거
- 검색/경쟁 근거
- 기존 채널과 다른 점
- 반대 근거/실패 가능성
- 이 콘텐츠의 역할
- 다음으로 이어질 시리즈 경로

**3. 마지막에 '보류·탈락한 후보'를 별도로 요약한다.**
- 왜 보류/탈락했는지 한 줄씩 정리한다.
- 사용자가 이전 후보로 돌아가고 싶을 때 ID로 다시 선택할 수 있게 한다.

좋은 후보가 없다면 리스트를 억지로 채우지 말고, 하단에서 왜 더 확장하지 않는 편이 좋은지 설명한다.

## Phase 13 — Final Production Brief
사용자가 Finalist를 선택한 뒤에만 제작 Brief를 완성한다.

선택 플랫폼별로 최소 다음을 포함한다.
- 최종 Topic / Angle / Audience
- 해결하려는 질문
- Evidence Map
- 검색/시청 Intent
- 차별화 포인트
- Core Promise
- 제목 후보와 각각의 Promise 차이
- 썸네일 컨셉(YouTube) 또는 검색 제목/문서 구조(블로그)
- 첫 Hook / 오프닝 설계
- 전체 구성과 각 구간의 역할
- 반드시 포함해야 할 사실/사례/주의점
- 예상 이탈/반론 지점과 보완법
- CTA
- 플랫폼 발견/SEO 전략
- 시리즈 확장 경로
- 다음 2차·3차 후보와 연결 논리

# 시작 명령
첨부 데이터의 무결성을 확인한 뒤 **첫 응답에서 Phase 1~5까지 진행한다.**

첫 응답은 아래 순서를 반드시 지킨다.
1. **1차 후보 리스트** — 설명보다 먼저, Candidate ID와 주제만 한 줄씩 보여준다. 아직 외부 검색/인터뷰 전인 임시 후보임을 짧게 표시한다.
2. **왜 이런 후보가 나왔는지에 대한 분석 요약** — 확인된 사실, 확인할 수 없는 것, 데이터 품질, 주요 시청자 질문 묶음을 정리한다.
3. **후보별 간단한 근거** — 어떤 댓글 질문과 채널 이력에서 나왔는지 설명한다.
4. **다음 인터뷰 질문** — 최종 판단에 영향을 주는 질문만 쉬운 한글로 묻는다.

즉, 사용자가 긴 분석을 전부 읽기 전에 '현재 어떤 콘텐츠 후보가 보이는지'부터 먼저 볼 수 있게 한다.
단, 이 1차 목록은 **최종 추천이나 제작 순위가 아니다.** 인터뷰와 외부 검색을 거치면서 후보가 사라지거나 새로 생길 수 있다.

이후 인터뷰와 외부 검증이 끝나 Phase 12에 도달하면 다시 한 번 **최종 후보 리스트를 맨 위에 먼저 보여준 뒤**, 하단에서 상세 이유를 설명한다.`;
}

export function buildChatGPTProBundle(pkg: ResearchPackage) {
  return `# ChatGPT Pro Content Expansion Bundle\n\n> 이 파일은 실행 프로토콜과 실제 Research Evidence를 하나로 묶은 통합 분석 패키지다. 아래 EXECUTION PROTOCOL을 먼저 읽고, 이어지는 RESEARCH EVIDENCE 전체를 원본 근거로 사용한다.\n\n---\n\n# PART A — EXECUTION PROTOCOL\n\n${buildMasterPrompt(pkg)}\n\n---\n\n# PART B — RESEARCH EVIDENCE\n\n${researchPackageToMarkdown(pkg)}\n`;
}

export function buildLaunchPrompt(pkg: ResearchPackage) {
  const manifest = evidenceManifest(pkg);
  return `첨부한 \`youtube-chatgpt-pro-bundle-${pkg.video.id}.md\` 파일을 이 세션의 단일 Research Bundle로 사용해줘.\n\n먼저 파일 안의 **PART A — EXECUTION PROTOCOL**과 **PART B — RESEARCH EVIDENCE**를 끝까지 읽고, Package Integrity Gate부터 수행해.\n\n내가 기대하는 데이터는 다음과 같아.\n- Video ID: ${manifest.videoId}\n- 수집 댓글+답글: ${manifest.collectedCommentRecords.toLocaleString()}개\n- 최상위 댓글: ${manifest.topLevelComments.toLocaleString()}개\n- 답글: ${manifest.replies.toLocaleString()}개\n- 채널 과거 영상: ${manifest.channelHistoryVideos.toLocaleString()}개\n- Transcript: ${manifest.transcriptStatus}\n\n첨부 파일이 없거나 위 데이터와 실제 파일이 일치하지 않으면 분석을 시작하지 말고 누락된 항목을 먼저 알려줘.\n무결성이 확인되면 프로토콜대로 첫 응답에서 Phase 1~5까지 진행해. **가장 먼저 검증 전 1차 콘텐츠 후보 리스트를 보여주고**, 그 아래에 분석 근거와 쉬운 한글 인터뷰 질문을 이어서 보여줘. 이 1차 리스트를 최종 추천이나 제작 순위처럼 표현하지는 마.`;
}
