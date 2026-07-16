# 업스트림(yishentu/claudian) 머지 운영 가이드

이 포크의 원칙: **업스트림 소스 수정은 ~10줄 이하로 유지하고, 모든 커스텀은 `src/a4p/`에 격리한다.**
그래야 업스트림의 버그 수정·SDK 업데이트가 항상 깨끗하게 머지된다.

## 머지 주기

- GitHub에서 yishentu/claudian을 Watch → Custom → **Releases** 구독
- **2주 주기 + a4p 릴리스 직전**에 최신 릴리스 **태그**를 머지 (main tip 아님)

## 머지 절차

```bash
git fetch upstream --tags
git checkout -b merge/upstream-2.0.XX main
git merge 2.0.XX
# 충돌 해결 (아래 표)
npm ci && npm run typecheck && npm run lint && npm run test && npm run build
# 테스트 볼트 스모크 체크 (아래)
git checkout main && git merge --no-ff merge/upstream-2.0.XX
git push origin main
```

⚠️ **`git push --tags` 절대 금지** — 업스트림 태그가 딸려 올라가 Release 워크플로우를 발화시킨다.
릴리스 태그는 반드시 개별 푸시: `git push origin 2.0.XX-a4p.N`

## 충돌 핫스팟 해결 규칙

| 파일 | 규칙 |
|---|---|
| `manifest.json` | 우리 것 유지 (id/name/description/author). 단 **`minAppVersion` 상향은 업스트림 채택** |
| `package.json` | `name`/`description`은 우리 것, deps/scripts/engines는 업스트림 |
| `src/main.ts` | 우리 a4p 훅 2줄 유지, 나머지 전부 업스트림 |
| `src/features/chat/tabs/Tab.ts` | 우리 `a4pOnTabUICreated(tab)` 1줄 유지, 나머지 업스트림 |
| `src/app/settings/defaultSettings.ts` | `locale: 'ko'` 유지, 나머지 업스트림 |
| `src/style/index.css` | 우리 a4p `@import` 줄 유지 |
| `esbuild.config.mjs` | 우리 PLUGIN_ID 도출 줄 유지, **SDK 패치 변경은 업스트림 그대로 채택** |
| `versions.json` | 합집합 (우리 항목 유지) |
| `README.md` | 우리 상단 고지 유지, 하단 원본 README는 업스트림 채택 |
| `src/providers/**` | 우리가 안 건드리므로 충돌 없어야 정상. 충돌 시 무조건 업스트림 |

## 머지 후 검증

1. `npm run typecheck && npm run lint && npm run test && npm run build` 전부 통과
2. 테스트 볼트 스모크:
   - 설정에 General / Claude / Codex / A4P 탭만 표시 (OpenCode·Pi 없음)
   - UI 한국어
   - Claude 메시지 송수신·중단, Codex 송신
   - 프리셋 칩이 입력창 위에 마운트
   - 정상 CLI에서 호환성 배너 없음
   - Notice 몇 개가 한국어로 표시
3. **포크 풋프린트 감사** (10줄 초과 시 원인 조사):
   ```bash
   git diff 2.0.XX main --stat -- . ':(exclude)src/a4p' ':(exclude)docs' ':(exclude)compat' ':(exclude)README.md' ':(exclude)LICENSE' ':(exclude)manifest.json' ':(exclude)package.json' ':(exclude)versions.json' ':(exclude).auditignore'
   ```
4. Notice 사전 보충: `grep -rn "new Notice(" src --include="*.ts"`를 `src/a4p/notices/noticeKo.ts` 사전과 대조

## 릴리스 절차

1. `npm version 2.0.XX-a4p.N --no-git-tag-version` → `node scripts/sync-version.js` → `versions.json`에 `"2.0.XX-a4p.N": "<minAppVersion>"` 추가 (또는 `scripts/a4p-release.mjs` 원스텝)
2. 커밋 → `git tag 2.0.XX-a4p.N` → `git push origin main 2.0.XX-a4p.N`
3. CI가 태그==package==manifest 검증 후 main.js/manifest.json/styles.css 릴리스 발행 (BRAT가 자동 감지)
4. **bare `x.y.z` 태그 발행 금지** (업스트림 태그와 충돌 + semver 정렬 문제)

## 머지 이력

| 업스트림 버전 | 머지일 | 비고 |
|---|---|---|
| 2.0.34 | 2026-07-16 | 포크 시작점 (기준 태그) |
