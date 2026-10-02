import { copyFile, mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const packageRoot = join(projectRoot, 'node_modules', 'stockfish')
const targetRoot = join(projectRoot, 'public', 'stockfish')

const files = [
  ['bin/stockfish-19-lite-single.js', 'stockfish-19-lite-single.js'],
  ['bin/stockfish-19-lite-single.wasm', 'stockfish-19-lite-single.wasm'],
  ['Copying.txt', 'COPYING.txt'],
]

await mkdir(targetRoot, { recursive: true })
await Promise.all(
  files.map(([source, target]) =>
    copyFile(join(packageRoot, source), join(targetRoot, target)),
  ),
)

await writeFile(
  join(targetRoot, 'SOURCE.txt'),
  [
    'Stockfish.js 19.0.0 (lite single-threaded WebAssembly build)',
    'Package: https://www.npmjs.com/package/stockfish/v/19.0.0',
    'Build source: https://github.com/nmrugg/stockfish.js/tree/v19.0.0',
    'Upstream engine: https://github.com/official-stockfish/Stockfish/tree/sf_19',
    'License: GNU General Public License v3; see COPYING.txt in this directory.',
    '',
  ].join('\n'),
  'utf8',
)

console.log('Stockfish 19 lite-single resources are ready in public/stockfish.')
