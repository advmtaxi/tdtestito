function patchVmSlice(source) {
  let code = source
  code = code.replace(/\be\(\d+\)/g, (m) => {
    if (m.includes('5376')) return '({Buffer:Buffer})'
    if (m.includes('7358')) return '({})'
    return '({})'
  })
  code = code.replace(/iq=\(\{\}\)/, 'iq=crypto')
  code = code.replace(
    'i8[i1(1159)]=iZ,i8[iA(2061,"V8S*")]=iQ,',
    'i8[i1(1159)]=function(){},i8[iA(2061,"V8S*")]=function(){},',
  )
  code = code.replace('mA=()=>{', 'mA=()=>!0;if(!1){')
  code = code.replace('let mU=()=>{', 'let mU=()=>!0;if(!1){')
  code = code.replace('function mV(){return i4(7', 'function mV(){return!0;return i4(7')
  return code
}

export function extractVmSlice(chunkSource) {
  const start = chunkSource.indexOf('iq=e(3018),iD=e(5376).Buffer')
  const endMarker = 'i8[i$(2996)]=mM'
  const end = chunkSource.indexOf(endMarker, chunkSource.indexOf('async function mZ')) + endMarker.length
  if (start < 0 || end < start) throw new Error('VM region not found in chunk 365')
  return patchVmSlice(chunkSource.slice(start, end))
}

export const VM_BROWSER_SHIMS = `
globalThis.Worker = class Worker {
  constructor() { this.onmessage = null }
  postMessage() {}
  terminate() {}
  addEventListener() {}
  removeEventListener() {}
}
globalThis.MessageChannel = class MessageChannel {
  constructor() {
    this.port1 = { postMessage() {}, start() {}, addEventListener() {} }
    this.port2 = { postMessage() {}, start() {}, addEventListener() {} }
  }
}
globalThis.BroadcastChannel = class BroadcastChannel {
  postMessage() {}
  close() {}
  addEventListener() {}
}
globalThis.parent = globalThis
globalThis.top = globalThis
globalThis.postMessage = function () {}
if (!globalThis.crypto.randomBytes) {
  const baseCrypto = globalThis.crypto
  globalThis.crypto = Object.assign(Object.create(Object.getPrototypeOf(baseCrypto)), baseCrypto, {
    randomBytes(n) {
      const a = new Uint8Array(n)
      baseCrypto.getRandomValues(a)
      return typeof Buffer !== 'undefined' ? Buffer.from(a) : a
    },
  })
}
`

export const VM_PRELUDE = `var u={jsx:function(){},jsxs:function(){},Fragment:'f'};
var S=function(){}, C={useRouter:function(){return {push:function(){}}},usePathname:function(){return ''}};
var h={forwardRef:function(f){return f},useEffect:function(){},useRef:function(v){return {current:v}},useState:function(v){return [v,function(){}]}};
var f={A:{}}, y={A:{}}, v={A:{}}, R={A:{}}, P={A:{}}, g={Ay:{}}, J={hb:function(){}}, O={f:function(){}}, ij={};
function mV(){return!0} function mA(){return!0} function mU(){return!0};
${VM_BROWSER_SHIMS}`

export const VM_RUNNER = `
async function __runServers(EN){
  var servers=[], tU=EN, t6="";
  var od=function(v){servers=v}, ek=function(){}, or=function(){};
  await mf({crypto:iq,encode:iB,en:tU,server:t6,setServers:od,setState:ek,setFavServer:or,window:globalThis,document:globalThis.document,navigator:globalThis.navigator,localStorage:globalThis.localStorage,console:globalThis.console,JSON:JSON,Math:Math,Date:Date,RegExp:RegExp,Map:Map,Set:Set,WeakMap:WeakMap,WeakSet:WeakSet,Array:Array,Object:Object,Number:Number,String:String,Boolean:Boolean,Symbol:Symbol,Function:Function,screen:globalThis.screen,Error:Error,TypeError:TypeError,RangeError:RangeError,SyntaxError:SyntaxError,parseInt:parseInt,parseFloat:parseFloat,isNaN:isNaN,isFinite:isFinite,encodeURIComponent:encodeURIComponent,decodeURIComponent:decodeURIComponent,NaN:NaN,Infinity:1/0,undefined:void 0,Promise:Promise,Proxy:Proxy,Reflect:Reflect,Uint8Array:Uint8Array,Int8Array:Int8Array,Uint16Array:Uint16Array,Int16Array:Int16Array,Uint32Array:Uint32Array,Int32Array:Int32Array,Float32Array:Float32Array,Float64Array:Float64Array,BigInt:BigInt,fetch:fetch,TextEncoder:TextEncoder,TextDecoder:TextDecoder,URL:URL,URLSearchParams:URLSearchParams,AbortSignal:AbortSignal,AbortController:AbortController,Buffer:iD,atob:atob,btoa:btoa}, function(){});
  return servers;
}
async function __runDecode(RS){
  var l=[];
  await mZ({dr:l,rs:RS,crypto:iq,window:globalThis,document:globalThis.document,navigator:globalThis.navigator,localStorage:globalThis.localStorage,console:globalThis.console,JSON:JSON,Math:Math,Date:Date,RegExp:RegExp,Map:Map,Set:Set,WeakMap:WeakMap,WeakSet:WeakSet,Array:Array,Object:Object,Number:Number,String:String,Boolean:Boolean,Symbol:Symbol,Function:Function,screen:globalThis.screen,Error:Error,TypeError:TypeError,RangeError:RangeError,SyntaxError:SyntaxError,parseInt:parseInt,parseFloat:parseFloat,isNaN:isNaN,isFinite:isFinite,encodeURIComponent:encodeURIComponent,decodeURIComponent:decodeURIComponent,NaN:NaN,Infinity:1/0,undefined:void 0,Promise:Promise,Proxy:Proxy,Reflect:Reflect,Uint8Array:Uint8Array,Int8Array:Int8Array,Uint16Array:Uint16Array,Int16Array:Int16Array,Uint32Array:Uint32Array,Int32Array:Int32Array,Float32Array:Float32Array,Float64Array:Float64Array,BigInt:BigInt,fetch:fetch,TextEncoder:TextEncoder,TextDecoder:TextDecoder,URL:URL,URLSearchParams:URLSearchParams,AbortSignal:AbortSignal,AbortController:AbortController,Buffer:iD,atob:atob,btoa:btoa});
  return l[0];
}
globalThis.__vidfast = { runServers: __runServers, runDecode: __runDecode };
`
