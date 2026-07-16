# a4p-claudian 이어가기 문서

_최종 갱신: 2026-07-16_

## 프로젝트 개요

yishentu/claudian(v2.0.34, MIT)의 **업스트림 추적 포크**. 목회자 수강생용으로 한국어 UI·스킬 스토어·환경 진단·워크플로우 프리셋을 얹었다.
- 리포: https://github.com/ai4pastor/a4p-claudian (public, BRAT 배포 예정)
- 스킬 레지스트리: https://github.com/ai4pastor/a4p-skills (public) + 로컬 `~/Projects/a4p-skills`
- 설계 원칙: 커스텀은 전부 `src/a4p/`(+`src/style/a4p/`, `tests/unit/a4p/`), 업스트림 소스 수정은 5개 파일 ~13줄
- 운영 문서: `docs/UPSTREAM.md`(머지 절차·충돌 표·릴리스), `docs/CLI-GUIDE.md`(수강생용 버전 안내)

## 완료된 것 (2026-07-16 세션, M0~M4 전부)

- **M0**: GitHub 포크 생성(ai4pastor/a4p-claudian), main=2.0.34 태그 기준, 시크릿 필요 워크플로우 4개 비활성(CI·Release는 유지), 리브랜딩(manifest id `a4p-claudian`), locale ko 기본, esbuild dev 폴더 manifest 도출, a4p 스캐폴드(A4PStore→`.claudian/a4p.json`, A4PSettingTab, 탭 데코레이터 훅)
- **M1**: 환경 진단 8종(DiagnosticsModal, 첫 실행 자동 오픈) + **CLI 호환성 가드**(`compat/a4p-compat.json`을 리포 main에서 fetch — 파일만 고치면 전 수강생 당일 공지. 현재 검증 기준: claude 2.1.211, codex 0.144.4)
- **M2**: 스킬 스토어(레지스트리 fetch+캐시, codeload 타르볼+자체 tar 파서, 스테이징 설치, preserve 보존, **rm 없음 — ~/.Trash 또는 .a4p-trash 이동**, 심볼릭은 링크만 해제, firstRun 프롬프트 채팅 프리필). 실 GitHub 대상 파이프라인 E2E 검증 완료
- **M3**: 프리셋 8종 기본값 + 입력창 위 칩 + 웰컴 버튼 + 설정 편집기(추가/수정/정렬/복원). `{{activeNote}}`/`{{selection}}`, a4p 플러그인 커맨드 연동, requiredSkill 잠금→원클릭 설치
- **M4**: 간편 모드(프로바이더 탭 전체+General 고급 항목 숨김, 값 비변경), NoticeTranslator(영문 Notice ~45개 한국어 사전, fail-open), 업스트림 계약 트립와이어 테스트, a4p 단위 테스트 22개
- 검증: typecheck·lint(0 에러)·테스트 265 스위트/6021개·빌드 전부 통과

## ⚠️ 다음 세션 시작점 (남은 일, 순서대로)

1. **수동 QA (릴리스 전 필수)**: `.env.local`에 `OBSIDIAN_VAULT=<테스트 볼트 경로>` 넣고 `npm run dev` → 옵시디언에서 확인:
   - 설정 탭: General + Claude + Codex + 🍞 AI4Pastor만 보이는지 / 간편 모드 토글
   - 새 채팅: 프리셋 칩·웰컴 버튼, 채팅 송수신, 첫 실행 진단 자동 오픈
   - 스토어에서 `a4p-hello` 설치→채팅에서 스킬 동작→업데이트(마커 버전 낮춰서)→제거(휴지통 확인)
   - 심볼릭 스킬(강사 머신) 케이스: 🔗 배지·업데이트 거부·링크만 해제
2. **첫 릴리스**: `npm version 2.0.34-a4p.1 --no-git-tag-version` → `node scripts/sync-version.js` → 커밋 → `git tag 2.0.34-a4p.1` → `git push origin main 2.0.34-a4p.1` (versions.json에는 이미 매핑 있음). BRAT: `ai4pastor/a4p-claudian`
3. **a4p-skills 레지스트리 채우기**: sermon-import·kids-sermon 등 실스킬 이관(유료 콘텐츠 공개 범위는 사용자와 확인 — 혼합 전략 가능). preserve(word-profile.json)·firstRun 프롬프트 설정
4. **업스트림 머지 리허설**: 2.0.35+ 릴리스가 나오면 `docs/UPSTREAM.md` 절차 1회 실행해 검증
5. **Windows QA**: 타르볼 추출·내부 휴지통(.a4p-trash)·npm CLI+node 감지
6. (선택) 업스트림에 Notice `t()` 전환 PR 기여 → 사전 축소

## 주의사항

- `git push --tags` 금지 (업스트림 태그 → Release 워크플로우 오발동). 태그는 개별 푸시
- bare `x.y.z` 태그 발행 금지 — 항상 `-a4p.N` 접미사
- 이 머신은 `CLAUDE_CONFIG_DIR=~/.claude-account2`라 일부 업스트림 테스트가 실패함 → `env -u CLAUDE_CONFIG_DIR npm run test`로 실행
- 풋프린트 감사: `git diff <업스트림태그> main --stat -- . ':(exclude)src/a4p' ...` (UPSTREAM.md 참조)
