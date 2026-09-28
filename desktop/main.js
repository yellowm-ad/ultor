// ============================================================================
// 마법학교 울토르 — 데스크톱 실행기 (테스트용, 온라인 주소 방식)
//
//   · 게임 본체는 웹 배포본(GAME_URL)을 그대로 띄운다 → Vercel 배포만 하면 exe 는 다시 켤 때 최신.
//   · 세이브는 게임 코드의 localStorage 가 이 앱 전용 저장소에 남는다(크롬 세이브와 별개).
//     저장 위치를 %APPDATA%\Ultor 로 고정해 앱 이름/버전이 바뀌어도 세이브가 유지되게 한다.
//   · 인터넷이 없으면 offline.html(다시 시도 버튼)을 보여준다.
// ============================================================================

const { app, BrowserWindow, shell } = require('electron')
const path = require('path')

const GAME_URL = 'https://ultor-web.vercel.app'
const GAME_ORIGIN = new URL(GAME_URL).origin

app.setPath('userData', path.join(app.getPath('appData'), 'Ultor'))

if (!app.requestSingleInstanceLock()) {
  app.quit()
}

let win = null

function loadGame() {
  win.loadURL(GAME_URL)
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#0b0a10',
    title: '마법학교 울토르',
    icon: path.join(__dirname, 'build', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  })
  win.removeMenu()

  // 게임 외부 링크는 기본 브라우저로
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(GAME_ORIGIN)) shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e, url) => {
    if (url.startsWith(GAME_ORIGIN) || url.startsWith('file:')) return
    e.preventDefault()
    shell.openExternal(url)
  })

  // 접속 실패(오프라인 등) → 안내 페이지
  win.webContents.on('did-fail-load', (_e, code, _desc, url, isMainFrame) => {
    if (!isMainFrame || code === -3 /* 사용자 취소 */) return
    win.loadFile(path.join(__dirname, 'offline.html'), { query: { url: url || GAME_URL } })
  })

  // 메뉴를 없앴으므로 기본 단축키 일부를 직접 연결: F11 전체화면, F5 새로고침
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return
    if (input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen())
      e.preventDefault()
    } else if (input.key === 'F5') {
      if (win.webContents.getURL().startsWith('file:')) loadGame()
      else win.webContents.reload()
      e.preventDefault()
    }
  })

  loadGame()
}

app.on('second-instance', () => {
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.focus()
})

app.whenReady().then(createWindow)
app.on('window-all-closed', () => app.quit())
