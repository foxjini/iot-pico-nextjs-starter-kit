# 학생 워크시트 생성기

`.docx` 워크시트를 만드는 선생님용 스크립트입니다. 학생에게 나눠주는 파일이 아닙니다.

```bash
cd worksheets/scripts
npm install          # 최초 1회 — docx 모듈을 받습니다
node gen_week08.js   # → ../8주차_학생워크시트.docx
```

- `ws_lib.js` 가 공용 헬퍼입니다 (`h1` `h2` `p` `table` `checklist` `codeBlock` `cover` `save` …).
- `save(children, "파일명.docx")` 는 **`worksheets/` 폴더**에 씁니다. 부록 생성기만
  `"appendix/파일명.docx"` 처럼 하위 폴더를 붙여 넘깁니다.
- 출력이 안 나오고 `saved ...` 도 안 찍히면 쓰기가 실패한 것입니다 (`save` 는 오류를 삼킵니다).

## 주차별 생성기

| 파일 | 출력 |
|---|---|
| `gen_week01.js` `gen_week02.js` `gen_week03.js` | `../1 · 2 · 3주차_학생워크시트.docx` |
| `gen_week04.js` `gen_week05.js` | `../4 · 5주차_학생워크시트.docx` |
| `gen_week08.js` | `../8주차_학생워크시트.docx` — 바이브 코딩 |
| `gen_week09.js` | `../9주차_학생워크시트.docx` — 전시장에 맞추기 |
| `gen_week11.js` | `../11주차_학생워크시트.docx` — 디지털 트윈 (2차 완성) |
| `gen_appendix_redesign.js` | `../appendix/4주차_학생워크시트.docx` *(옛 4주차 · 부록)* |
| `gen_appendix_design_styles.js` | `../appendix/12주차_학생워크시트.docx` *(옛 12주차 · 부록)* |
| `gen_appendix_tailwind_ui.js` | `../appendix/13주차_학생워크시트.docx` *(옛 13주차 · 부록)* |

> 🔢 파일 이름의 번호는 **2026-10-24 재번호 뒤의 새 번호**입니다. 옛 번호는
> [`../../번호-대조표.md`](../../번호-대조표.md) 를 보세요.

> `docx` 는 **9.8.1** 로 확인했습니다. 더 낮은 버전에서는 `new Document({ sections: [...] })` 형태가
> 달라질 수 있습니다. `package.json` 에 적어 두었으니 `npm install` 만 하면 같은 버전이 깔립니다.
