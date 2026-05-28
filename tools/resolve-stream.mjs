import { resolveStream } from '../lib/stream.js'

const [a, b, c, d] = process.argv.slice(2)
const isTv = a === 'tv'
const request = isTv
  ? { type: 'tv', id: b || '95396', season: c || '1', episode: d || '1' }
  : { type: 'movie', id: a || '1265609' }
const data = await resolveStream(request)
console.log(JSON.stringify(data, null, 2))
