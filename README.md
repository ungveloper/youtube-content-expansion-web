# youtube-content-expansion-web

한 개의 YouTube 영상을 출발점으로 영상 메타데이터, 댓글/답글, Transcript를 Research Package로 정리하고 ChatGPT Pro에서 단계적으로 조사·인터뷰·후보 압축을 진행하기 위한 개인용 Content R&D 도구입니다.

## V1 원칙

- Evidence First
- Quality over Quantity
- Zero is Valid
- Interview before Conclusion
- Search before Finalization
- Preserve Alternatives
- Platform Divergence
- No Blind Copying
- Content Dead End
- Traceability

## 현재 구현

- 채널 핸들/URL 조회
- 특정 영상 ID/URL 조회
- Discovery: 최근 7/30/90일 또는 전체 기간의 검색 API 조회수 정렬 기반 최대 100개 레퍼런스 탐색
- 채널 최근 업로드 최대 100개 로드 후 조회수/댓글수/조회수·일/최신순 정렬
- 영상/Discovery 진입에서도 선택 영상의 채널 과거 콘텐츠 100개를 Research Package에 포함
- 선택 영상 댓글 + 모든 답글 페이지네이션 수집
- Transcript 직접 입력 및 TXT/SRT/VTT 불러오기
- WordPress / Naver Blog / YouTube / YouTube Shorts 플랫폼 설정
- 조사 목적 설정
- Research Package JSON / Markdown 다운로드
- ChatGPT Pro용 12-Phase Master Prompt 생성 및 복사

## 환경 변수

`.env.example`을 참고해 프로젝트 루트에 `.env.local`을 생성합니다.

```bash
YOUTUBE_API_KEY=YOUR_KEY
```

YouTube Data API v3가 활성화된 Google Cloud API Key가 필요합니다.

## 실행

```bash
npm install
npm run dev
```

## V1 데이터 정책

V1은 별도 DB에 AI 판단을 저장하지 않습니다. Research Package가 사실 데이터의 이동 단위입니다. 이후 DB를 도입할 때는 `Channels`, `Videos`, `Video Snapshots`, `Comments`, `Replies`, `Transcript`, `Research Sessions`, `Candidate Ledger`, `Generated Packages`, `Generated Prompts`를 사실/기억 계층으로 분리할 예정입니다.
