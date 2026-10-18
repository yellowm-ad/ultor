// 대본(md) → 게임 대사 데이터 변환기.
//   입력: 게임 개발 파일/울토르_메인스토리_대사_컷신_<범위>.md  (v1.1 형식: **이름** *(감정)* / > "대사" / 지문 문단 / ## [SCENE]·[CUTSCENE]·[INTERLUDE])
//   출력: lib/story-script-gen.ts  — EP_SCRIPT_GEN(막 번호 → 오프닝 brief / 결말 outro) + CUTSCENES_GEN(컷 슬롯)
//
//   · brief = 첫 [GAMEPLAY] 앞까지(없으면 첫 장면만), outro = 그 뒤 전부. [GAMEPLAY]·[FLAGS] 본문은 기획 메모라 뺀다.
//   · [CUTSCENE xx-y] / [INTERLUDE xx-y] → 컷 id 'epxx-y'(막간은 풀컷신). 다음 [SCENE] 에서 컷을 내린다.
//   · 감정 지문 *(…)* 의 낱말로 연출 동작(lib/story-anims)을 붙인다 — 있는 동작만.
//
// usage: node scripts/build-story-script.mjs [최대 막 번호=19]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const WEB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const GAME = path.join(WEB, '..', '..')
const MAX_EP = Number(process.argv[2] ?? 19)
const MIN_EP = 5
const FILES = ['05-09', '10-14', '15-19', '20-24', '25-29', '30-34', '35-39', '40-44', '45-49', '50-52'].map((r) => path.join(GAME, `울토르_메인스토리_대사_컷신_${r}.md`))

// ── 기획 메모처럼 쓰인 지문 고치기(2026-10-18 검수) ─────────────────────────────
//   키 = 대본의 원문 지문(clean 후), 값 = 화면에 낼 문장(null = 빼기). 대본 md 를 고치면 여기도 함께 본다.
const NARRATION_FIX = {
  '낚시, 해양 채집, 상인 심부름, 주민 도움 퀘스트.': null,
  '평판이 높을수록 주민 제보가 늘어난다(오로라 평판 단계에 따라 대사 분기).': null,
  '종합 실기: 영창 암기 → 리듬 타이밍 → 원소 실전.': '기말시험 날. 영창 암기로 시작해 리듬 실기, 원소 실전까지 — 해가 질 때까지 끝나지 않는다.',
  '역사·윤리·빛 실기.': '시험 기간. 역사와 윤리 필기가 끝나면, 오후엔 빛 실기가 기다린다.',
  '고대문양 기억 → 빛 마법 → 전투 응용.': '기말시험. 고대문양을 외워 그리고, 빛을 다루고, 마지막엔 실전이다.',
  '고대문양 배열, 영창 암기, 역사 문제, 실전 과제.': '3학년 종합 시험. 문양, 영창, 역사, 실전 — 4년 중 가장 긴 하루라는 소문이 사실이었다.',
  '고대문양, 봉인 안전해제, 전투 실습. 카엘의 봉인 해제 실습에서 리안이 자물쇠 대신 책상을 녹인다.': '기말 실습. 카엘의 봉인 해제 시험에서 리안이 자물쇠 대신 책상을 녹인다.',
  '성당과 주민들의 겨울 지원. 장작 나르기, 무료 급식, 아이들 돌보기.': '성당의 겨울 일손을 돕는다. 장작을 나르고, 급식을 퍼 주고, 아이들 썰매를 끌어 준다.',
  '폐허 외곽의 야영지. 요리/장비 제작으로 모험 전 마지막 정비.': '폐허 외곽의 야영지. 냄비가 끓고, 반이 장비 끈을 하나씩 다시 조인다.',
  '마을 광장의 분수대 — 용암을 식혀 만든 검은 돌 분수 — 가 지역 평판 허브로 열린다.': '마을 광장의 분수대 — 용암을 식혀 만든 검은 돌 분수 — 둘레로 주민들이 모여든다. 부탁할 일이 많은 얼굴들이다.',
  '4학년 2학기. 학기 구조가 멈추고 특수 루프가 시작된다.': '4학년 2학기. 시간표가 멈춘다. 이제부터는 여섯 마을을 직접 돌며 마음을 얻어야 한다.',
  '마물 마을 평판이 충분히 쌓이면, 장로 카즈가 일행을 성 아래 밭으로 안내한다.': '마을 사람들이 더는 창을 들지 않게 된 어느 저녁, 장로 카즈가 일행을 성 아래 밭으로 안내한다.',
  // 화면 지시는 글로 띄우지 않는다(장면은 비트가 끝나며 넘어간다)
  '화면 암전.': null,
  '구금 첫날 밤. 성녀가 근위병의 교대 시간을 알려 주고, 카엘이 자물쇠를 녹인다("봉인 해제라고 했지, 봉인 소각이라고 안 했다").': '구금 첫날 밤. 성녀가 근위병의 교대 시간을 알려 주고, 카엘이 자물쇠를 녹인다. 「봉인 해제라고 했지, 소각하라고는 안 했다.」 누군가 투덜거린다.',
  '이 루트에서 미르엘의 정체는 드러나지 않는다.': null,
  '멀리 새벽빛. 화면 암전.': '멀리서 새벽빛이 번진다.',
  // 카메라 지시문(영상 대본 문법)은 대화창에서 읽으면 몰입이 깨진다 — 장면 묘사로
  '야영지의 불이 꺼진 뒤, 카메라가 숲 위로 떠오른다.': '야영지의 불이 꺼진다. 모두 잠든 숲은, 생각보다 조용하지 않다.',
  '카메라가 물속으로 내려간다. 빛을 따라 아래로, 더 아래로.': '빛은 물속으로 이어진다. 아래로, 더 아래로.',
  '카메라가 수면 아래로 내려간다. 거대한 광원이 해저 깊은 곳에서 맥박친다.': '수면 아래, 해저 깊은 곳에서 거대한 빛이 맥박친다.',
  '모닥불 주위의 평범한 밤. 카메라가 천천히 멀어져 어둠 속 신전 입구를 비춘다.': '모닥불 주위의 평범한 밤. 그 불빛이 닿지 않는 어둠 속에서, 신전 입구가 입을 벌리고 있다.',
  '석비 전체를 천천히 비춘다. 카메라가 마지막 줄의 문장 하나를 오래 잡는다.': '횃불이 석비를 천천히 훑어 내려간다. 마지막 줄의 문장 하나에서, 오래 멈춘다.',
  '카메라가 입학식의 분수대와 같은 구도로 전환된다. 분수 물줄기가 네 갈래로 갈라졌다가, 하나로 모인다.': '입학식 날의 그 분수대. 물줄기가 네 갈래로 갈라졌다가, 하나로 모인다.',
  '51막 심문의 연장. 정체가 드러난 미르엘이 천공 신전 위로 떠오른다. 신전의 바람이 황금빛으로 물든다.': '심문석이 부서진다. 정체가 드러난 미르엘이 천공 신전 위로 떠오른다. 신전의 바람이 황금빛으로 물든다.',
  '각 거점에서 마지막 평판 퀘스트가 열린다. 성공하면 희귀 보상과 함께 상징 아이템을 받는다.': '마을마다 마지막 부탁이 하나씩 남아 있다. 그 부탁을 들어주면, 마을은 자기 이름을 건 상징을 내어 줄 것이다.',
}

// ── 화자 ────────────────────────────────────────────────────────────────────
const SPEAKERS = {
  미르엘: ['미르엘 교수', 'npc-mirel', 'mirel'],
  오웬: ['사서 오웬', 'npc-librarian', 'owen'],
  셀린: ['셀린', 'npc-potion', 'celine'],
  반: ['반', 'npc-weapon', 'van'],
  리안: ['리안', 'comp-rian', 'rian'],
  셀라: ['셀라', 'comp-sella', 'sella'],
  도란: ['도란', 'comp-doran', 'doran'],
  유나: ['유나', 'comp-yuna', 'yuna'],
  루스벨: ['루스벨', 'comp-rusbel', 'ruspell'],
  카엘: ['카엘 조교', 'npc-kael', 'kael'],
  '성녀 리아나': ['성녀 리아나', 'npc-saint', 'saint'],
  '국왕 레오니스': ['국왕 레오니스', 'npc-king', 'king'],
  '왕실 근위병': ['왕실 근위병', 'npc-royal-guard', null],
  모르스: ['모르스', 'npc-mors', 'mors'],
  '설인족장 보르': ['설인족장 보르', 'npc-aurora-chief', null],
  룬: ['서리사냥꾼 룬', 'npc-aurora-hunter', null],
  '장로 카즈': ['장로 카즈', 'npc-demon-elder', null],
  그롯: ['그롯', 'npc-demon-smith', null],
}
function speakerOf(raw) {
  const m = raw.match(/^(.+?)(\((.+)\))?$/)
  const base = m[1].trim()
  const tag = m[3] ? `(${m[3]})` : ''
  if (base === '주인공') return { player: true }
  if (base === '나레이션') return { narration: true }
  const s = SPEAKERS[base]
  if (!s) return { speaker: base + tag }
  return { speaker: s[0] + tag, portraitId: s[1], actor: s[2] }
}

// ── 감정 → 동작 ──────────────────────────────────────────────────────────────
const ANIM_IDS = new Set(fs.readdirSync(path.join(WEB, 'public/images/story-anims')).map((f) => f.replace(/\.png$/, '')))
const EMOTION_RULES = [
  ['rage', /보랏빛|폭주|태워/],
  ['cry', /울음을 터|눈물/],
  ['grin', /노래하듯|경박|신났|즐거워/],
  ['hurt', /그을린|데었|붕대/],
  ['angry', /이를 악물|주먹|노려|외친|소리친|비명처럼/],
  ['heat', /땀|관자놀이|덥|뜨거/],
  ['heal', /빛으로 감싼|치유|빛을 비/],
  ['surprise', /놀라|놀란|움찔|화들짝|굳는|굳어|비명|눈이 커|갈라진|갈라진다|목소리가 떨|입을 벌린/],
  ['sad', /울음|울먹|눈물|창백|한숨|시무룩|쓴웃음|미안|떨린|안경을 벗/],
  ['laugh', /웃|피식|킥|신이 나|눈이 반짝|의기양양|뿌듯|자랑|기쁘/],
  ['think', /생각|끄덕|망설|진지|조용히|낮게|작게|살피|들여다|베끼|받아 적|펜|노트|팔짱|멍하니|한참/],
  ['wave', /손을 흔들|손을 크게|손짓/],
]
// 지문 문단 — '<인물>이/가/은/는 …' 으로 시작하면 그 인물의 동작(기존 연출 동작 포함)
const NARRATION_RULES = [
  ['dig', /감자를 캐|밭 한가운데/],
  ['pat', /머리 위에 얹|쓰다듬/],
  ['offer', /손바닥이 위|손을 내민/],
  ['kneel', /무릎을 꿇/],
  ['bow', /고개를 숙|허리를 숙|예를 표/],
  ['cast', /마법진을 그|봉인진/],
  ['notes', /노트|받아 적|적는다|밑줄/],
  ['touch', /쪼그려|흙에 손|손을 대/],
  ['look', /두리번|둘러본|살핀다/],
  ['down', /내려다본|바닥을 본/],
  ['pickup', /집어 든|집어 올/],
  ['stop', /막아선|손을 뻗어 막/],
  ['give', /건넨|내민다|내밀며/],
  ['inspect', /점검|살펴본/],
  ['think', /펼친|베낀|비춘|확인한|들여다/],
  ...EMOTION_RULES,
]
const ACTOR_NAMES = { 모르스: 'mors', 국왕: 'king', 성녀: 'saint', 리안: 'rian', 셀라: 'sella', 도란: 'doran', 오웬: 'owen', 미르엘: 'mirel', 셀린: 'celine', 반: 'van', 카엘: 'kael', 유나: 'yuna', 루스벨: 'ruspell' }
function narrationAnim(text) {
  const m = text.match(/^(모르스|국왕|성녀|리안|셀라|도란|오웬|미르엘|셀린|반|카엘|유나|루스벨)(이|가|은|는|의)\s/)
  if (!m) return undefined
  const actor = ACTOR_NAMES[m[1]]
  for (const [kind, re] of NARRATION_RULES) if (re.test(text) && ANIM_IDS.has(`${actor}-${kind}`)) return `${actor}-${kind}`
  return undefined
}
function animFor(actor, emotion) {
  if (!actor || !emotion) return undefined
  for (const [kind, re] of EMOTION_RULES) if (re.test(emotion) && ANIM_IDS.has(`${actor}-${kind}`)) return `${actor}-${kind}`
  return undefined
}

const clean = (t) => t.replace(/\*\*/g, '').replace(/(^|\s)\*([^*]+)\*/g, '$1$2').replace(/`/g, '').replace(/\\/g, '').trim()
const DESIGN_NOTE = /EP\d|연출|복선|플레이어|대사로|반전|디자인|예고|회수|화면에는|게임|분기|작성 메모|이 장면|구현/

const episodes = {}
const cutscenes = []

for (const file of FILES) {
  if (!fs.existsSync(file)) continue
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/)
  let ep = null
  let collect = false
  let phase = 'brief'
  let speaker = null
  let emotion = null
  let pendingCut // 다음 줄에 붙일 컷(문자열 = 컷, null = 내림)
  let pendingTitle = null
  let cutShot = null // 현재 컷의 shot 을 모으는 중이면 CutsceneDef
  let scenesSeen = 0
  let sawGameplay = false
  let sectionRoute = null // ## [ROUTE X] 구역
  let inlineRoute = null // **[X 루트]** 표시 이후 다음 제목까지
  const ROUTE_OF = { A: 'A', 'B/C': 'B_OR_C', B: 'B', C: 'C' }

  const push = (line) => {
    if (!ep || ep.no > MAX_EP || ep.no < MIN_EP) return
    const route = inlineRoute ?? sectionRoute
    if (route) line.route = route
    // 장면 제목 — 예전엔 「[제목] 지문」으로 본문 앞에 붙여 화면에 그대로 나왔다(몰입 방해, 2026-10-18).
    // 이제 그 장면 첫 줄의 place(대화창 제목 칩 「EP · 장소」)로만 넘긴다. 괄호 속 기획 꼬리표(게임 id·루트·조건)는 뗀다.
    if (pendingTitle) {
      const place = pendingTitle.replace(/\s*\([^)]*\)/g, '').trim()
      if (place) line.place = place
      pendingTitle = null
    }
    // 지문인데 실제로는 기획 메모였던 줄 — 지우거나(null) 이야기 문장으로 다시 쓴다
    if (!line.speaker && !line.player && Object.prototype.hasOwnProperty.call(NARRATION_FIX, line.text)) {
      const fixed = NARRATION_FIX[line.text]
      if (fixed === null) {
        // 지운 줄의 장소 칩은 다음 줄로 넘긴다
        if (line.place) pendingTitle = line.place
        return
      }
      line.text = fixed
    }
    if (pendingCut !== undefined) {
      line.cut = pendingCut
      pendingCut = undefined
    }
    ep[phase].push(line)
  }

  for (const raw of lines) {
    const l = raw.trim()
    const epHead = l.match(/^# EP(\d+) · (.+)$/)
    if (epHead) {
      ep = { no: Number(epHead[1]), title: epHead[2], brief: [], outro: [], sceneStarts: [], scenes: [] }
      if (ep.no >= MIN_EP && ep.no <= MAX_EP) episodes[ep.no] = ep
      collect = false; phase = 'brief'; speaker = null; scenesSeen = 0; sawGameplay = false; pendingCut = undefined; cutShot = null; sectionRoute = null; inlineRoute = null
      continue
    }
    if (!ep) continue
    const head = l.match(/^(#{2,3}) \[([A-Z /]+)(?: ([\d-]+[A-Z]?\d*))?\](.*)$/)
    if (head) {
      const [, hashes, kind, num, rest] = head
      inlineRoute = null
      if (kind.startsWith('ROUTE')) {
        sectionRoute = ROUTE_OF[kind.slice(6).trim()] ?? null
        collect = true; speaker = null; pendingTitle = null
        continue
      }
      if (hashes === '##' && kind !== 'GAMEPLAY' && kind !== 'FLAGS' && kind !== 'STORY FLAGS') sectionRoute = null
      const title = clean(rest.replace(/^[\s—-]+/, ''))
      cutShot = null
      if (kind === 'GAMEPLAY') {
        collect = false
        if (!sawGameplay) { sawGameplay = true; phase = 'outro' }
        continue
      }
      if (kind === 'FLAGS' || kind === 'STORY FLAGS') { collect = false; continue }
      if (kind === 'SCENE' || kind === 'CUTSCENE' || kind === 'INTERLUDE') {
        collect = true
        speaker = null; emotion = null
        scenesSeen++
        ep.scenes.push({ at: ep.brief.length + ep.outro.length, route: sectionRoute })
        if (phase === 'brief') ep.sceneStarts.push(ep.brief.length)
        // GAMEPLAY 이 없는 막: 두 번째 장면부터 결말
        if (!sawGameplay && scenesSeen === 2 && !fileHasGameplay(lines, ep.no)) phase = 'outro'
        if (kind === 'SCENE') {
          if (pendingCut === undefined) pendingCut = null
          pendingTitle = title || null
        } else {
          const n = num ?? `${String(ep.no).padStart(2, '0')}-${kind === 'INTERLUDE' ? 'B' : 'A'}`
          const id = `ep${n.toLowerCase()}`
          pendingCut = id
          pendingTitle = null
          if (ep.no >= MIN_EP && ep.no <= MAX_EP && !cutscenes.some((c) => c.id === id)) {
            cutShot = { id, scene: `EP${String(ep.no).padStart(2, '0')} [${kind} ${n}] ${title || ep.title}`, full: kind === 'INTERLUDE', shot: '', refs: [] }
            cutscenes.push(cutShot)
          }
        }
        continue
      }
      collect = false
      continue
    }
    if (/^#{1,4} /.test(l)) { collect = false; inlineRoute = null; continue }
    if (!collect) continue
    if (/^\*\*\[GAMEPLAY\]\*\*/.test(l)) continue
    const rm = l.match(/^\*\*\[(A|B\/C|B|C)(?: 루트)?[^\]]*\]\*\*\s*(.*)$/)
    if (rm) {
      inlineRoute = ROUTE_OF[rm[1]]
      if (!rm[2]) continue
      const rest = clean(rm[2])
      speaker = null
      push({ speaker: '', text: rest })
      continue
    }
    if (!l || l === '---' || l === '\\---') { speaker = speaker; continue }

    const sp = l.match(/^\*\*(.+?)\*\*\s*(\*\((.+)\)\*)?\s*$/)
    if (sp) {
      speaker = speakerOf(sp[1].trim())
      emotion = sp[3] ?? null
      continue
    }
    if (l.startsWith('>')) {
      const body = l.replace(/^>\s*/, '')
      const q = body.match(/^["“](.*)["”]$/)
      if (q && speaker && !speaker.narration) {
        const line = speaker.player ? { speaker: '주인공', player: true, text: clean(q[1]) } : { speaker: speaker.speaker, ...(speaker.portraitId ? { portraitId: speaker.portraitId } : {}), text: clean(q[1]) }
        const anim = animFor(speaker.actor, emotion)
        if (anim) line.anim = anim
        emotion = null // 같은 감정으로 여러 줄이면 첫 줄만 동작
        push(line)
      } else if (q) {
        push({ speaker: '', text: clean(q[1]) })
      } else if (!/^(분기|작성) 메모/.test(body)) {
        push({ speaker: '', text: clean(body) })
      }
      continue
    }
    if (/^[-*] /.test(l) && !/^\*[^*].*\*$/.test(l)) continue // 목록 = 기획 메모
    if (/[:：]$/.test(l)) continue
    const italic = l.match(/^\*(.+)\*$/)
    if (italic && DESIGN_NOTE.test(italic[1])) continue
    const text = clean(italic ? italic[1] : l)
    if (!text) continue
    if (cutShot && cutShot.shot.length < 260) cutShot.shot += (cutShot.shot ? ' ' : '') + text
    speaker = null
    const nAnim = narrationAnim(text)
    push(nAnim ? { speaker: '', text, anim: nAnim } : { speaker: '', text })
  }
}

function fileHasGameplay(lines, no) {
  let inEp = false
  for (const l of lines) {
    const m = l.match(/^# EP(\d+) /)
    if (m) { inEp = Number(m[1]) === no; continue }
    if (inEp && /^#{2,3} \[GAMEPLAY\]/.test(l.trim())) return true
  }
  return false
}

// 루트가 나뉘는 막 — 루트(공통 포함)마다 첫 장면을 오프닝, 나머지를 결말로(줄은 게임에서 루트로 거른다)
for (const e of Object.values(episodes)) {
  const all = [...e.brief, ...e.outro]
  if (!all.some((l) => l.route)) continue
  const seen = new Set()
  const pick = new Set()
  e.scenes.forEach((sc, i) => {
    const key = sc.route ?? 'ALL'
    if (seen.has(key)) return
    seen.add(key)
    const end = e.scenes[i + 1]?.at ?? all.length
    for (let k = sc.at; k < end; k++) pick.add(k)
  })
  e.brief = all.filter((_, k) => pick.has(k))
  e.outro = all.filter((_, k) => !pick.has(k))
}

// 결말이 비면([GAMEPLAY] 이 막 끝에 있는 경우) 장면 경계에서 나눈다 — 장면 수의 절반쯤
for (const e of Object.values(episodes)) {
  if (e.outro.length || e.sceneStarts.length < 2) continue
  const at = e.sceneStarts[Math.ceil(e.sceneStarts.length / 2)] ?? e.sceneStarts[1]
  e.outro = e.brief.splice(at)
}

// 인물 참고 시트(이미지 직접 제작 시 안내용)
const REF = { 미르엘: '미르엘 삼면도.jpg', 리안: '리안 삼면도.jpg', 셀라: '전투 NPC 셀라 삼면도.png', 도란: '도란 삼면도.jpg', 유나: '유나 삼면도.jpg', 카엘: '카엘 삼면도.jpg', 모르스: '모르스 1페이즈(망토, 면류관), 2페이즈(망토, 면류관 없음) 삼면도.png', 뿔: '모르스 1페이즈(망토, 면류관), 2페이즈(망토, 면류관 없음) 삼면도.png', 오웬: '스토리 NPC 일러스트.png', 셀린: '스토리 NPC 일러스트.png', 반: '스토리 NPC 일러스트.png' }
for (const c of cutscenes) {
  c.shot = c.shot || c.scene
  c.refs = [...new Set(Object.entries(REF).filter(([k]) => c.shot.includes(k)).map(([, v]) => v))]
}

// ── 출력 ────────────────────────────────────────────────────────────────────
const nos = Object.keys(episodes).map(Number).sort((a, b) => a - b)
let out = `// ⚠ 자동 생성 파일 — 손으로 고치지 말 것. 대본 md 를 고친 뒤 \`node scripts/build-story-script.mjs ${MAX_EP}\` 로 다시 만든다.
// EP${String(MIN_EP).padStart(2, '0')}~EP${String(MAX_EP).padStart(2, '0')} 오프닝(brief)/결말(outro) 대사 + 컷신 슬롯. 원본: 게임 개발 파일/울토르_메인스토리_대사_컷신_*.md (v1.1)
import type { StoryLine } from '@/lib/story'
import type { CutsceneDef } from '@/lib/cutscenes'

export const EP_SCRIPT_GEN: Record<number, { brief: StoryLine[]; outro: StoryLine[] }> = {
`
for (const no of nos) {
  const e = episodes[no]
  out += `  // ═════════ EP${String(no).padStart(2, '0')} · ${e.title} ═════════\n  ${no}: {\n`
  for (const k of ['brief', 'outro']) {
    out += `    ${k}: [\n`
    for (const line of e[k]) out += `      ${JSON.stringify(line)},\n`
    out += `    ],\n`
  }
  out += `  },\n`
}
out += `}\n\nexport const CUTSCENES_GEN: CutsceneDef[] = [\n`
for (const c of cutscenes) out += `  ${JSON.stringify(c)},\n`
out += `]\n`
fs.writeFileSync(path.join(WEB, 'lib/story-script-gen.ts'), out)
console.log(`EP ${nos.join(',')} · 컷 ${cutscenes.length}개 · 줄 ${nos.reduce((s, n) => s + episodes[n].brief.length + episodes[n].outro.length, 0)}`)
for (const no of nos) console.log(`  EP${no}: brief ${episodes[no].brief.length} / outro ${episodes[no].outro.length} / anim ${[...episodes[no].brief, ...episodes[no].outro].filter((l) => l.anim).length}`)
