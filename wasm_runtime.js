// THE WASM RUNTIME of the exported engine. The engine's two C++ modules are compiled once (tools/harvest.js) and live in wasm/happy_main.wasm (the page: geometry, trees and plants, noise) and wasm/happy_worker.wasm
// (the worker: transforms, physics, the rig and the creatures, the environment). This file loads them with the same glue that the in-browser compile used to put in front of the bytes, so `happy_wasm("main")()` is what
// `wasm$(...)()` was: a promise of `env`, with env.wa (the instance), env.memory (the wasm_memory below) and the functions the page gives the wasm.
//
//   happy_wasm(kind)(env, wasi)      kind: "main" | "worker". Resolves with env once the module is running.
//   happy_wasm.base()                the url of the wasm folder: window.HAPPY_WASM_BASE, else <origin>/wasm/ (in the worker: what engine.js put in self.HAPPY_WASM_BASE)
//   happy_worker_source(fn)          the source of the worker: fn (engine_worker) with the base url put in front of it, as create_worker takes it (a Blob has no relative urls)
//
// The functions the wasm imports from the page (print_call, debug_draw_*, upload_geometry ...) are read from its import section, not from a list: any that the page has not defined when the wasm calls it is a late
// binding (env[name] is looked up at the call), so the page may set env.upload_geometry after the module started, as it always did.
const happy_wasm = (function () {
  const FILES = { main: "happy_main.wasm", worker: "happy_worker.wasm" };

  const wasm_memory = function wasm_memory(memory) {
    this.memory = memory;
    this.buffer = memory.buffer;
    this.u8 = new Uint8Array(this.memory.buffer);
    this.u32 = new Uint32Array(this.memory.buffer);
    this.f32 = new Float32Array(this.memory.buffer);
    this.check = function check() {
      if (this.buffer.byteLength === 0) {                                       // (the memory grew: the old views are detached)
        this.buffer = this.memory.buffer;
        this.u8 = new Uint8Array(this.buffer);
        this.u32 = new Uint32Array(this.buffer);
        this.f32 = new Float32Array(this.buffer);
      }
    };
    this.read8 = function read8(o) { return this.u8[o]; };
    this.read32 = function read32(o) { return this.u32[o >> 2]; };
    this.readf32 = function readf32(o) { return this.f32[o >> 2]; };
    this.write8 = function write8(o, v) { this.u8[o] = v; };
    this.write32 = function write32(o, v) { this.u32[o >> 2] = v; };
    this.write64 = function write64(o, vlo, vhi) {
      if (vhi === void 0) vhi = 0;
      this.write32(o, vlo);
      this.write32(o + 4, vhi);
    };
    function readStr(u8, o, len) {
      if (len === undefined) len = -1;
      let str = "";
      let end = u8.length;
      if (len != -1) end = o + len;
      for (let i = o; i < end && u8[i] != 0; ++i) str += String.fromCharCode(u8[i]);
      return str;
    }
    this.readStr = function (o, len) { return readStr(this.u8, o, len); };
    this.writeStr = function writeStr(o, str) {
      o += this.write(o, str);
      this.write8(o, 0);
      return str.length + 1;
    };
    this.write = function write(o, buf) {
      if (buf instanceof ArrayBuffer) return this.write(o, new Uint8Array(buf));
      else if (typeof buf === "string") return this.write(o, buf.split("").map(function (x) { return x.charCodeAt(0); }));
      const dst = new Uint8Array(this.buffer, o, buf.length);
      dst.set(buf);
      return buf.length;
    };
    return this;
  };

  const base = function () {
    if (typeof self !== "undefined" && self.HAPPY_WASM_BASE) return self.HAPPY_WASM_BASE;
    if (typeof window !== "undefined" && window.HAPPY_WASM_BASE) return window.HAPPY_WASM_BASE;
    return new URL("/wasm/", self.location.href).href;
  };

  const compile = function (url) {
    const bytes = function () { return fetch(url).then(function (r) { if (!r.ok) throw new Error("happy wasm: " + url + " " + r.status); return r.arrayBuffer(); }).then(function (b) { return WebAssembly.compile(b); }); };
    if (WebAssembly.compileStreaming) {
      return fetch(url).then(function (r) {
        if (!r.ok) throw new Error("happy wasm: " + url + " " + r.status);
        return WebAssembly.compileStreaming(r);
      }).catch(function (e) { return bytes(); });                                  // (a server that does not say application/wasm)
    }
    return bytes();
  };

  const load = function (kind) {
    return function (_env, _wasi_unstable) {
      if (!FILES[kind]) throw new Error("happy_wasm: unknown module " + kind);
      return compile(base() + FILES[kind]).then(function (module) {
        const wasi_unstable = {};
        wasi_unstable.fd_close = wasi_unstable.fd_write = wasi_unstable.fd_seek = function () { };
        const env = {};
        env.externs = WebAssembly.Module.imports(module).filter(function (i) { return i.module === "env" && i.kind === "function"; }).map(function (i) { return i.name; });
        if (_env) Object.assign(env, _env);
        if (_wasi_unstable) Object.assign(wasi_unstable, _wasi_unstable);
        env.externs.forEach(function (w) {
          if (!env[w]) {
            const ex_call = function () { if (env[w] && env[w] != ex_call) return env[w].apply(env, arguments); };
            env[w] = ex_call;
          }
        });
        env.wacos = Math.acos;
        env.wabs = Math.abs;
        env.wsin = Math.sin;
        env.wcos = Math.cos;
        env.wtan = Math.tan;
        env.wpow = Math.pow;
        env.wmaxf = env.wmax = Math.max;
        env.wminf = env.wmin = Math.min;
        env.watan2 = Math.atan2;
        env.wsqrt = Math.sqrt;
        env.wfloor = Math.floor;
        env.print_call = function (txt, size) {
          env.wa.memory.check();
          console.log(env.wa.memory.readStr(txt, size));
        };
        env.params_calls = {};
        env.params_call = function (id, txt, size) {
          env.wa.memory.check();
          env.params_calls[id] = env.wa.memory.readStr(txt, size);
        };
        return WebAssembly.instantiate(module, { wasi_unstable: wasi_unstable, env: env }).then(function (instance) {
          instance.memory = instance.exports.memory ? new wasm_memory(instance.exports.memory) : new wasm_memory(env.memory);
          env.memory = instance.memory;
          env.wa = instance;
          return env;
        });
      });
    };
  };

  load.base = base;
  return load;
})();

// engine_worker is the worker's whole program (worker.js), a function that create_worker turns into a Blob: the url of the wasm folder goes in front of it
const happy_worker_source = function (fn) {
  return "function(self){ self.HAPPY_WASM_BASE = " + JSON.stringify(happy_wasm.base()) + "; return (" + fn.toString() + ")(self); }";
};
