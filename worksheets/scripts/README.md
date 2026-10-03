# 학생 워크시트 생성기

`.docx` 워크시트를 만드는 선생님용 스크립트입니다. 학생에게 나눠주는 파일이 아닙니다.

```bash
cd worksheets/scripts
npm install          # 최초 1회 — docx 모듈을 받습니다
node gen_week13.js   # → ../13주차_학생워크시트.docx
```

- `ws_lib.js` 가 공용 헬퍼입니다 (`h1` `h2` `p` `table` `checklist` `codeBlock` `cover` `save` …).
- `save(children, "파일명.docx")` 는 **`worksheets/` 폴더**에 씁니다. 경로가 아니라 파일명만 넘기세요.
- 출력이 안 나오고 `saved ...` 도 안 찍히면 쓰기가 실패한 것입니다 (`save` 는 오류를 삼킵니다).

## 주차별 생성기

| 파일 | 출력 |
|---|---|
| `gen_week1.js` ~ `gen_week4.js` | 1~4주차 (4주차는 압축 운영에서 빼는 주차) |
| `gen_week8.js` `gen_week9.js` `gen_week11.js` `gen_week12.js` | 8·9·11·12주차 |
| `gen_week13.js` | **13주차 — Tailwind ① 구조와 글자** |

> `docx` 는 **9.8.1** 로 확인했습니다. 더 낮은 버전에서는 `new Document({ sections: [...] })` 형태가
> 달라질 수 있습니다. `package.json` 에 적어 두었으니 `npm install` 만 하면 같은 버전이 깔립니다.
