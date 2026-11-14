const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
async function api(url, body) {
  const r = await fetch(url, {method: body === undefined ? 'GET' : 'POST', headers: {'Content-Type': 'application/json'},
    body: body === undefined ? undefined : JSON.stringify(body), credentials: 'same-origin'});
  let j = {}; try { j = await r.json(); } catch (e) {}
  return {ok: r.ok, status: r.status, ...j};
}
function copyText(t, btn) {
  const done = () => { if (btn) { const o = btn.textContent; btn.textContent = 'Copied'; setTimeout(() => btn.textContent = o, 1400); } };
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(t).then(done);
  else { const a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); document.execCommand('copy'); a.remove(); done(); }
}
function startCountdown(left, el, onEnd) {
  const total = window.TTL || 60; let end = Date.now() + left * 1000, fired = false;
  const bar = $('i', el), lab = $('.timer', el);
  const tick = () => {
    const s = Math.max(0, (end - Date.now()) / 1000);
    const c = Math.ceil(s); lab.textContent = Math.floor(c / 60) + ':' + String(c % 60).padStart(2, '0');
    bar.style.width = (s / total * 100) + '%';
    el.classList.toggle('low', s <= 15);
    if (s <= 0 && !fired) { fired = true; onEnd && onEnd(); }
  };
  tick(); const id = setInterval(tick, 250);
  return {resync: s => { end = Date.now() + s * 1000; }, stop: () => clearInterval(id)};
}
async function emailInvoice(pid, mode) {
  const j = await api('/api/invoice/' + pid);
  if (j.error) return alert(j.error);
  if (mode === 'gmail') window.open(j.gmail, '_blank'); else location.href = j.mailto;
}
async function startQrScan(video, onText) {
  if (!('BarcodeDetector' in window)) throw new Error('Camera QR scanning isn’t supported in this browser. Paste the link instead.');
  const stream = await navigator.mediaDevices.getUserMedia({video: {facingMode: 'environment'}});
  video.srcObject = stream; await video.play();
  const det = new BarcodeDetector({formats: ['qr_code']}); let live = true;
  (async function loop() {
    while (live) { try { const c = await det.detect(video); if (c.length) { live = false; stream.getTracks().forEach(t => t.stop()); return onText(c[0].rawValue); } } catch (e) {} await new Promise(r => setTimeout(r, 300)); }
  })();
  return () => { live = false; stream.getTracks().forEach(t => t.stop()); };
}
