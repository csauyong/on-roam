import { samplePt, tangent } from '../lib/arc';
import { fmtDMY, fmtMY, fmtStamp } from '../lib/format';
import type { ArcTable } from '../lib/types';

/* Camera-follow archive, ported from the prototype.
   Scroll = distance travelled along the line. The camera follows.
   Geometry is precomputed at build time and inlined as JSON;
   this module only drives the camera and the interactions. */

interface ImgRef { src: string; w: number; h: number; }
interface PostData {
  title: string;
  place: string;
  date: number; // epoch ms
  desc: string;
  cap: string;
  type: 'photo' | 'reflection';
  s: number;
  small: ImgRef;
  large: ImgRef;
}
interface SpanData {
  type: 'home' | 'trip' | 'move';
  s0: number;
  s1: number;
  d0: number;
  d1: number;
  place?: string;
}
interface RoamData {
  base: string;
  home: string;
  origin: string;
  tEnd: number;
  total: number;
  bbox: { x: number; y: number; w: number; h: number };
  px: number[];
  py: number[];
  cum: number[];
  spans: SpanData[];
  posts: Record<string, PostData>;
}

const REVEAL_AHEAD = 120;

function boot() {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return; // the CSS swaps in the static fallback

  const dataEl = document.getElementById('roam-data');
  if (!dataEl) return;
  const data: RoamData = JSON.parse(dataEl.textContent!);
  const arc: ArcTable = { px: data.px, py: data.py, cum: data.cum, total: data.total };

  const world = document.getElementById('world')!;
  const markerText = document.getElementById('markerText')!;
  const needle = document.getElementById('needle')!;
  const preview = document.getElementById('preview')!;
  const overlay = document.getElementById('overlay')!;
  const postCard = document.getElementById('postCard')!;
  const hint = document.getElementById('hint')!;
  const btnOverview = document.getElementById('btnOverview')! as HTMLButtonElement;
  const finePointer = matchMedia('(pointer: fine)').matches;

  /* span path elements, in span order (trips + the move draw on; home fades in) */
  const pathEls = Array.from(world.querySelectorAll<SVGPathElement>('svg path'));
  for (let i = 0; i < data.spans.length; i++) {
    const m = data.spans[i]!;
    if (m.type !== 'home') {
      const len = m.s1 - m.s0;
      pathEls[i]!.style.strokeDasharray = String(len);
      pathEls[i]!.style.strokeDashoffset = String(len);
    }
  }

  interface Item { el: HTMLElement; s: number; }
  const items: Item[] = Array.from(world.querySelectorAll<HTMLElement>('[data-s]')).map((el) => ({
    el,
    s: parseFloat(el.dataset.s!),
  }));

  let overview = false;
  let cam = { x: 0, y: 0, k: 1 };
  let camT = { x: 0, y: 0, k: 1 };
  const lerp = (a: number, b: number, f: number) => a + (b - a) * f;

  /* ---------- per-frame state ---------- */
  function update(instant = false) {
    const s = Math.max(0, Math.min(data.total, scrollY));
    if (s > 60) hint.classList.add('gone');

    /* segment draw states */
    for (let i = 0; i < data.spans.length; i++) {
      const m = data.spans[i]!;
      if (m.type !== 'home') {
        const len = m.s1 - m.s0;
        const off = s >= m.s1 ? 0 : s <= m.s0 ? len : len - (s - m.s0);
        pathEls[i]!.style.strokeDashoffset = String(off);
      } else if (s >= m.s0) {
        pathEls[i]!.classList.add('in');
      }
    }
    for (const it of items) if (it.s <= s + REVEAL_AHEAD) it.el.classList.add('in');

    /* marker */
    let label = data.home;
    let date = new Date(data.tEnd);
    for (const m of data.spans) {
      if (s >= m.s0 && s <= m.s1) {
        if (m.type === 'trip') {
          label = m.place!;
          date = new Date(m.d0);
        } else if (m.type === 'move') {
          label = `${data.origin} → ${data.home}`;
          date = new Date(m.d0);
        } else {
          const f = (s - m.s0) / Math.max(m.s1 - m.s0, 1);
          date = new Date(m.d0 + f * (m.d1 - m.d0));
        }
        break;
      }
    }
    markerText.textContent = `${fmtMY(date)} · ${label}`;

    /* compass follows travel heading */
    const t = tangent(arc, s);
    needle.setAttribute('transform', `rotate(${(Math.atan2(t.y, t.x) * 180) / Math.PI + 90} 26 26)`);

    /* camera target */
    if (overview) {
      const k = Math.min(innerWidth / data.bbox.w, innerHeight / data.bbox.h) * 0.82;
      camT = { x: data.bbox.x + data.bbox.w / 2, y: data.bbox.y + data.bbox.h / 2, k };
    } else {
      const p = samplePt(arc, s);
      camT = { x: p.x, y: p.y, k: 1 };
    }
    if (instant) cam = { ...camT };
  }

  function frame() {
    cam.x = lerp(cam.x, camT.x, 0.11);
    cam.y = lerp(cam.y, camT.y, 0.11);
    cam.k = lerp(cam.k, camT.k, 0.11);
    world.style.transform = `translate(${(innerWidth / 2 - cam.k * cam.x).toFixed(2)}px,${(
      innerHeight / 2 -
      cam.k * cam.y
    ).toFixed(2)}px) scale(${cam.k.toFixed(4)})`;
    requestAnimationFrame(frame);
  }

  addEventListener('scroll', () => update(false), { passive: true });
  addEventListener('resize', () => update(false));

  /* ---------- overview + jumps ---------- */
  btnOverview.addEventListener('click', () => {
    overview = !overview;
    btnOverview.classList.toggle('active', overview);
    if (overview) for (const it of items) it.el.classList.add('in');
    update(false);
  });
  function jumpTo(s: number) {
    overview = false;
    btnOverview.classList.remove('active');
    scrollTo({ top: s, behavior: 'smooth' });
  }

  /* ---------- preview + overlay ---------- */
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function photoHTML(img: ImgRef, dateMs: number, alt = '', onPhotoTitle?: string) {
    return `<span class="photo"><img src="${img.src}" width="${img.w}" height="${img.h}" alt="${esc(alt)}">${
      onPhotoTitle ? `<span class="ptitle">${esc(onPhotoTitle)}</span>` : ''
    }<span class="stamp">${fmtStamp(new Date(dateMs))}</span></span>`;
  }

  function showPreview(dot: HTMLElement, p: PostData) {
    preview.innerHTML =
      photoHTML(p.small, p.date, '', p.type === 'reflection' ? p.title : undefined) +
      `<div class="cap">${esc(p.cap)}</div>`;
    const r = dot.getBoundingClientRect();
    preview.style.left = `${r.left + r.width / 2}px`;
    preview.style.top = `${r.top}px`;
    preview.classList.add('show');
  }
  const hidePreview = () => preview.classList.remove('show');

  function openPost(slug: string, push: boolean) {
    const p = data.posts[slug];
    if (!p) return;
    hidePreview();
    const isRef = p.type === 'reflection';
    const paras = p.desc
      .split(/\n{2,}/)
      .map((t) => `<p>${esc(t.trim())}</p>`)
      .join('');
    postCard.className = isRef ? 'post reflection' : 'post';
    postCard.innerHTML =
      photoHTML(p.large, p.date, p.title, isRef ? p.title : undefined) +
      (isRef ? '' : `<h2>${esc(p.title)}</h2>`) +
      `<div class="meta">${esc(p.place)} · ${fmtDMY(new Date(p.date))}</div>
       ${paras}
       <button class="close" id="closeBtn">back to the route</button>`;
    overlay.classList.add('open');
    const c = document.getElementById('closeBtn')!;
    c.focus();
    c.addEventListener('click', () => closePost(true));
    if (push) history.pushState({ slug }, '', `${data.base}p/${slug}/`);
  }
  function closePost(push: boolean) {
    overlay.classList.remove('open');
    if (push) history.pushState({}, '', data.base);
  }

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closePost(true);
  });
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (overlay.classList.contains('open')) closePost(true);
      else if (overview) {
        overview = false;
        btnOverview.classList.remove('active');
        update(false);
      }
    }
  });
  addEventListener('popstate', () => {
    const m = location.pathname.match(/\/p\/([^/]+)\/?$/);
    if (m) openPost(m[1]!, false);
    else closePost(false);
  });

  /* posts: keyframes + dots are real links; intercept for the overlay */
  for (const el of Array.from(world.querySelectorAll<HTMLElement>('[data-post]'))) {
    const slug = el.dataset.post!;
    el.addEventListener('click', (e) => {
      e.preventDefault();
      openPost(slug, true);
    });
    if (finePointer && el.classList.contains('dot')) {
      el.addEventListener('mouseenter', () => showPreview(el, data.posts[slug]!));
      el.addEventListener('mouseleave', hidePreview);
    }
  }
  /* place labels jump back to the start of their trip */
  for (const el of Array.from(world.querySelectorAll<HTMLElement>('[data-jump]'))) {
    el.addEventListener('click', () => jumpTo(parseFloat(el.dataset.jump!)));
  }

  /* ---------- boot ---------- */
  history.scrollRestoration = 'manual';
  const openSlug = document.body.dataset.openSlug;
  if (openSlug && data.posts[openSlug]) {
    scrollTo(0, data.posts[openSlug]!.s);
    update(true);
    openPost(openSlug, false);
  } else {
    scrollTo(0, 0);
    update(true);
  }
  requestAnimationFrame(frame);
}

boot();
