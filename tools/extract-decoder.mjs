import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const input = process.argv[2] || path.join(root, 'assets/chunk-365.js')
const output = process.argv[3] || path.join(root, 'lib/string-decoder.generated.js')

const s = fs.readFileSync(input, 'utf8')
const i5Start = s.indexOf('function i5(W,t)')
const i5End = s.indexOf('}try{Object[i2(765)]', i5Start) + 1
const i3Start = s.indexOf('function i3(W,t)')
const i3End = s.indexOf('}function i7(){', i3Start) + 1
const i7Start = s.indexOf('function i7(){')
const i7End = s.indexOf('return(i7=function(){return W})()}', i7Start) + 'return(i7=function(){return W})()}'.length
const rotStart = s.indexOf('!function(W,t){let e=i3,o=i5')
const rotEnd = s.indexOf('}(i7,0);', rotStart) + 8

if ([i5Start, i3Start, i7Start, rotStart].some((v) => v < 0)) {
  console.error('decoder boundaries not found')
  process.exit(1)
}

const code = [
  s.slice(i7Start, i7End),
  s.slice(i5Start, i5End),
  s.slice(i3Start, i3End),
  s.slice(rotStart, rotEnd),
  'export function decodeString(index, key) { return key ? i3(index, key) : i5(index) }',
].join('\n')

fs.mkdirSync(path.dirname(output), { recursive: true })
fs.writeFileSync(output, code)
console.log('wrote', output, code.length, 'bytes')
