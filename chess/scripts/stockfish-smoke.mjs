import { spawn } from 'node:child_process'
import { access, mkdtemp, rm } from 'node:fs/promises'
import { createServer as createNetServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
let smokeStage = '启动浏览器'
const chromeCandidates = process.platform === 'win32'
  ? [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    ]
  : process.platform === 'darwin'
    ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
    : ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']

async function findBrowser() {
  for (const candidate of chromeCandidates) {
    try {
      await access(candidate)
      return candidate
    } catch {
      // Try the next commonly installed browser.
    }
  }
  throw new Error('Chrome/Edge was not found; cannot run the real browser Stockfish smoke test.')
}

async function findOpenPort() {
  const server = createNetServer()
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  await new Promise((resolve) => server.close(resolve))
  if (!address || typeof address === 'string') throw new Error('Could not reserve a debug port.')
  return address.port
}

async function evaluate(webSocketUrl, expression) {
  const socket = new WebSocket(webSocketUrl)
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })
  const result = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Chrome DevTools evaluation timed out during: ${smokeStage}`)), 10_000)
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data))
      if (message.id !== 1) return
      clearTimeout(timeout)
      resolve(message.result?.result?.value)
    })
    socket.send(JSON.stringify({
      id: 1,
      method: 'Runtime.evaluate',
      params: { expression, returnByValue: true },
    }))
  })
  socket.close()
  return result
}

async function pollEvaluate(webSocketUrl, expression, attempts = 100) {
  let value
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      value = await evaluate(webSocketUrl, expression)
    } catch {
      // Reloading the real app can briefly replace the page's DevTools target.
      await delay(250)
      continue
    }
    if (value) return value
    await delay(250)
  }
  return value
}

const browserPath = await findBrowser()
const debugPort = await findOpenPort()
const vite = await createServer({
  root: projectRoot,
  logLevel: 'error',
  server: { host: '127.0.0.1', port: 0 },
})
const profileDir = await mkdtemp(join(tmpdir(), 'chess-stockfish-smoke-'))
let browser

try {
  await vite.listen()
  const address = vite.httpServer?.address()
  if (!address || typeof address === 'string') throw new Error('Could not determine Vite smoke-test port.')
  const url = `http://127.0.0.1:${address.port}/?__smoke=computer`

  browser = spawn(browserPath, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--remote-allow-origins=*',
    '--no-first-run',
    '--disable-background-networking',
    `--user-data-dir=${profileDir}`,
    `--remote-debugging-port=${debugPort}`,
    url,
  ], { stdio: 'ignore' })

  let page
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const pages = await fetch(`http://127.0.0.1:${debugPort}/json`).then((response) => response.json())
      page = pages.find((candidate) => candidate.type === 'page' && candidate.url.startsWith(url))
      if (page) break
    } catch {
      // Chrome may still be starting.
    }
    await delay(250)
  }
  if (!page) throw new Error('Could not connect to the Chrome smoke-test page.')

  smokeStage = '等待真实应用就绪'
  const appReady = await pollEvaluate(
    page.webSocketDebuggerUrl,
    `document.body.innerText.includes('轮到你走棋')
      && document.querySelector('[data-square="e2"]') !== null
      && [...document.querySelectorAll('button')].some((button) => button.textContent.includes('获取提示') && !button.disabled)`,
  )
  if (!appReady) {
    let diagnostic = 'DevTools target unavailable'
    try { diagnostic = await evaluate(page.webSocketDebuggerUrl, 'document.body.innerText.slice(0, 1600)') }
    catch { /* Keep the connection diagnostic. */ }
    throw new Error(`The real app did not become ready for a human move: ${JSON.stringify(diagnostic)}`)
  }

  const initialEvaluation = await pollEvaluate(
    page.webSocketDebuggerUrl,
    `(() => {
      const value = document.querySelector('.analysis-heading strong')?.textContent || '';
      return value && value !== '暂无评分' ? value : '';
    })()`,
    120,
  )
  if (!initialEvaluation) throw new Error('The real analysis Worker did not produce an initial evaluation.')
  await evaluate(page.webSocketDebuggerUrl, `window.__smokeTicks = 0; window.__smokeTimer = setInterval(() => window.__smokeTicks += 1, 20); true;`)

  smokeStage = '请求第一级提示'
  await evaluate(page.webSocketDebuggerUrl, `
    [...document.querySelectorAll('button')].find((button) => button.textContent.includes('获取提示')).click();
    true;
  `)
  smokeStage = '等待第一级提示'
  const levelOne = await pollEvaluate(
    page.webSocketDebuggerUrl,
    `document.querySelector('.hint-card')?.dataset.hintLevel === '1'
      && !document.querySelector('.hint-loading')
      && !document.querySelector('.candidate-list')
      && !document.querySelector('.board-shell')?.dataset.hintArrow`,
    120,
  )
  if (!levelOne) throw new Error('Level-one hint leaked or did not finish.')

  smokeStage = '请求第二级提示'
  await evaluate(page.webSocketDebuggerUrl, `
    [...document.querySelectorAll('button')].find((button) => button.textContent.includes('再给一点提示')).click();
    true;
  `)
  const levelTwo = await pollEvaluate(
    page.webSocketDebuggerUrl,
    `document.querySelector('.hint-card')?.dataset.hintLevel === '2'
      && Boolean(document.querySelector('.board-shell')?.dataset.hintKey)
      && !document.querySelector('.board-shell')?.dataset.hintArrow`,
  )
  if (!levelTwo) throw new Error('Level-two key piece highlight was not shown correctly.')

  smokeStage = '请求第三级提示'
  await evaluate(page.webSocketDebuggerUrl, `
    [...document.querySelectorAll('button')].find((button) => button.textContent.includes('再给一点提示')).click();
    true;
  `)
  const levelThree = await pollEvaluate(
    page.webSocketDebuggerUrl,
    `document.querySelector('.hint-card')?.dataset.hintLevel === '3'
      && document.querySelectorAll('.candidate-list button').length >= 1
      && Boolean(document.querySelector('.board-shell')?.dataset.hintArrow)
      && document.body.innerText.includes('PV：')`,
  )
  if (!levelThree) throw new Error('Level-three candidates, SAN/PV, or arrow were not shown.')

  smokeStage = '切换候选走法'
  const hintData = await evaluate(page.webSocketDebuggerUrl, `(() => {
    const buttons = [...document.querySelectorAll('.candidate-list button')];
    if (buttons[1]) buttons[1].click();
    const selected = buttons[1] || buttons[0];
    return {
      count: buttons.length,
      uci: selected.dataset.uci,
      san: selected.querySelector('strong')?.textContent,
    };
  })()`)
  const switchedArrow = await pollEvaluate(
    page.webSocketDebuggerUrl,
    `document.querySelector('.board-shell')?.dataset.hintArrow === '${hintData.uci.slice(0, 2)}-${hintData.uci.slice(2, 4)}'`,
  )
  if (!switchedArrow) throw new Error('Switching MultiPV candidates did not update the arrow.')

  smokeStage = '执行提示走法'
  await evaluate(page.webSocketDebuggerUrl, `document.querySelector('[data-square="${hintData.uci.slice(0, 2)}"]').click(); true;`)
  await delay(150)
  await evaluate(page.webSocketDebuggerUrl, `document.querySelector('[data-square="${hintData.uci.slice(2, 4)}"]').click(); true;`)
  const qualityLabel = await pollEvaluate(
    page.webSocketDebuggerUrl,
    `(() => {
      const value = document.querySelector('.move-cell.assessed')?.textContent || '';
      return /最佳|优秀|良好|不准确|失误|严重失误/.test(value) ? value : '';
    })()`,
    120,
  )
  const twoPlies = await pollEvaluate(
    page.webSocketDebuggerUrl,
    `document.body.innerText.includes('2 步')`,
    80,
  )
  const hintMarked = await pollEvaluate(
    page.webSocketDebuggerUrl,
    `document.querySelector('.move-cell.assessed')?.textContent.includes('已使用提示 L3')
      && !document.querySelector('.board-shell')?.dataset.hintArrow`,
    80,
  )
  if (!qualityLabel || !twoPlies || !hintMarked) {
    const bodyText = await evaluate(page.webSocketDebuggerUrl, 'document.body.innerText.slice(0, 1200)')
    throw new Error(
      `The real app did not show analysis or a computer reply. `
      + `quality=${JSON.stringify(qualityLabel)}, twoPlies=${twoPlies}, hintMarked=${hintMarked}, body=${JSON.stringify(bodyText)}`,
    )
  }

  await evaluate(page.webSocketDebuggerUrl, `
    [...document.querySelectorAll('button')].find((button) => button.textContent.includes('重新开始')).click();
    true;
  `)
  const resetClean = await pollEvaluate(
    page.webSocketDebuggerUrl,
    `document.body.innerText.includes('0 步') && document.querySelector('.move-cell.assessed') === null`,
  )
  if (!resetClean) throw new Error('Restart left stale move analysis in the real app.')

  const heartbeat = await evaluate(page.webSocketDebuggerUrl, `clearInterval(window.__smokeTimer); window.__smokeTicks;`)
  if (heartbeat < 3) throw new Error('The page main thread did not remain responsive during analysis.')

  console.log(
    `Two Stockfish Workers ready; initial evaluation=${initialEvaluation}, UI heartbeat=${heartbeat}; `
    + `hint=${hintData.san}, candidates=${hintData.count}, label=${qualityLabel.trim()}, `
    + `computer reply and restart isolation passed`,
  )
} finally {
  if (browser) {
    const exited = new Promise((resolve) => browser.once('exit', resolve))
    browser.kill()
    await Promise.race([exited, delay(3_000)])
  }
  await vite.close()
  await rm(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
}
