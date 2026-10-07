const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('index.html', 'utf8');
const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].filter(m => !/\bsrc=/.test(m[1]));
for (const script of scripts) new vm.Script(script[2]);
console.log(`Syntax: ${scripts.length} inline scripts passed`);
const source = scripts.find(m => /id="vo-js"/.test(m[1]))[2];
function setup() {
  const timers = new Map(), elements = new Map(), listeners = {}, pageListeners = {};
  let timerId = 0;
  function element(id) {
    if (elements.has(id)) return elements.get(id);
    const classes = new Set();
    const el = { hidden: true, checked: true, disabled: false, textContent: '', innerHTML: '', dataset: {}, style: {},
      classList: { contains: n => classes.has(n), add: n => classes.add(n), remove: n => classes.delete(n), toggle(n, force) { const on = force === undefined ? !classes.has(n) : force; on ? classes.add(n) : classes.delete(n); } },
      querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, setAttribute() {} };
    elements.set(id, el); return el;
  }
  class Audio {
    constructor() { this.dataset = {}; this.events = {}; this.paused = true; this.ended = false; this.currentTime = 0; this.duration = 50; this.calls = 0; }
    setAttribute() {}
    addEventListener(n, f) { (this.events[n] ||= []).push(f); }
    emit(n) { for (const f of this.events[n] || []) f(); }
    play() { this.calls++; if (this.reject) return Promise.reject(new Error('NotAllowedError')); this.paused = false; this.ended = false; return Promise.resolve(); }
    pause() { this.paused = true; }
    load() { this.error = null; this.emit('loadedmetadata'); }
    end() { this.ended = true; this.paused = true; this.emit('ended'); }
  }
  const document = { body: element('body'), hidden: false, getElementById: element, querySelector: () => null, querySelectorAll: () => [], addEventListener(n, f) { listeners[n] = f; } };
  const window = { speechSynthesis: { cancel() {}, getVoices: () => [] }, scrollTo() {} };
  const context = { window, document, navigator: { userAgent: 'iPhone', maxTouchPoints: 5 }, Audio, MutationObserver: class { observe() {} }, sessionStorage: { getItem: () => '1', setItem() {} }, location: { hash: '' }, setTimeout(f, delay) { const id = ++timerId; timers.set(id, {f, delay}); return id; }, clearTimeout: id => timers.delete(id), addEventListener(n, f) { pageListeners[n] = f; } };
  vm.runInNewContext(source, context);
  const aud = window.__phiAud, bar = element('vo-bar');
  return { aud, bar, window, document, elements, timers, start: () => element('vo-start').onclick(), toggle: () => element('vo-pp').onclick(), stop: () => element('vo-st').onclick(), next: () => element('vo-next').onclick(), flush(delay = 1200) { const tasks = [...timers.entries()].filter(([, task]) => task.delay === delay); tasks.forEach(([id, task]) => { timers.delete(id); task.f(); }); }, visible(hidden) { document.hidden = hidden; listeners.visibilitychange(); }, pageListeners };
}
(async () => {
  let t = setup(); t.start(); assert.equal(t.aud.calls, 1); assert.equal(t.window.__phiDirectAudio, true); assert(t.bar.classList.contains('show')); console.log('Mobile native playback starts synchronously');
  t.aud.end(); assert.equal(t.timers.size, 1); t.flush(); assert.equal(t.aud.dataset.k, 'standout'); console.log('Automatic chapter progression');
  t = setup(); t.start(); t.aud.end(); t.toggle(); t.flush(); assert.equal(t.aud.calls, 1); assert(t.bar.classList.contains('paused')); t.toggle(); assert.equal(t.aud.dataset.k, 'standout'); console.log('Pause cancels transition; Resume continues next chapter');
  t = setup(); t.start(); t.aud.end(); t.stop(); t.flush(); assert.equal(t.aud.calls, 1); assert(!t.bar.classList.contains('show')); console.log('End cancels transition');
  t = setup(); t.start(); t.aud.end(); t.next(); t.flush(); assert.equal(t.aud.calls, 2); console.log('Manual Next cancels stale automatic transition');
  t = setup(); t.aud.reject = true; t.start(); await Promise.resolve(); assert(t.bar.classList.contains('paused')); t.aud.reject = false; t.toggle(); assert(!t.bar.classList.contains('paused')); console.log('Rejected play shows recoverable Resume');
  t = setup(); t.aud.reject = true; t.start(); t.aud.reject = false; t.next(); await Promise.resolve(); assert(!t.bar.classList.contains('paused')); console.log('Stale play rejection cannot pause new chapter');
  t = setup(); t.start(); t.aud.paused = true; t.aud.emit('pause'); assert(t.bar.classList.contains('paused')); t.toggle(); assert(!t.bar.classList.contains('paused')); console.log('Native interruption is reflected and recoverable');
  t = setup(); t.start(); t.next(); t.aud.emit('pause'); assert(!t.bar.classList.contains('paused')); console.log('Queued old pause cannot pause new playback');
  t = setup(); t.start(); t.aud.currentTime = 17; t.visible(true); assert(t.bar.classList.contains('paused')); t.visible(false); assert(!t.bar.classList.contains('paused')); assert.equal(t.aud.currentTime, 17); console.log('Background/foreground preserves playback position');
  t = setup(); t.start(); t.toggle(); t.visible(true); t.visible(false); assert(t.bar.classList.contains('paused')); assert.equal(t.aud.calls, 1); console.log('Explicit pause remains paused after foreground');
  t = setup(); t.start(); t.aud.end(); t.visible(true); t.flush(); t.visible(false); assert.equal(t.aud.dataset.k, 'standout'); console.log('Background during transition resumes correct next chapter');
  t = setup(); t.start(); t.pageListeners.pagehide(); t.pageListeners.pageshow(); assert.equal(t.aud.calls, 2); console.log('Page lifecycle restoration');
  t = setup(); t.start(); t.aud.end(); t.elements.get('vo-auto').checked = false; t.flush(); assert(!t.bar.classList.contains('show')); console.log('Turning off auto during transition prevents next chapter');
  t = setup(); t.start(); t.aud.currentTime = 13; t.aud.error = {}; t.aud.emit('error'); assert(t.bar.classList.contains('paused')); t.toggle(); assert.equal(t.aud.error, null); assert.equal(t.aud.currentTime, 13); console.log('Media error reload and position restoration');
  t = setup(); t.start(); t.flush(15000); assert(t.bar.classList.contains('paused')); assert(t.aud.paused); t.toggle(); assert(!t.bar.classList.contains('paused')); console.log('Playback stall offers Resume and reloads media');
  t = setup(); t.start(); t.aud.currentTime = 10; t.flush(15000); assert(!t.bar.classList.contains('paused')); t.stop(); t.flush(15000); assert(!t.bar.classList.contains('show')); console.log('Watchdog allows progressing audio and cancels on End');
  console.log('All voice tour regressions passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
