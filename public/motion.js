/* Optional presentation effects: passive scrolling, no framework or scroll hijack. */
(() => {
  'use strict';
  const body = document.body;
  const root = document.documentElement;
  const toggle = document.querySelector('#motion-toggle');
  if (!toggle || !window.matchMedia || !window.requestAnimationFrame) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
  const readY = () => Math.max(0, window.scrollY || 0);
  let userPaused = false;
  try { userPaused = localStorage.getItem('shikkha-motion-paused') === 'true'; } catch {}
  let enabled = false;
  let frameId = 0;
  let lastTime = 0;
  let metricsDirty = true;
  let viewport = window.innerHeight;
  let maxScroll = 1;
  let drive = 0;
  let tilt = null;
  const pointer = { x: 0, y: 0, tx: 0, ty: 0, cx: -500, cy: -500, tcx: -500, tcy: -500 };

  const story = document.querySelector('.story-art');
  const contact = document.querySelector('.contact-panel');
  const visual = document.querySelector('.experience-visual');
  if (story) { story.dataset.motionScene = 'story'; story.dataset.tilt = ''; story.dataset.tiltStrength = '3'; }
  if (contact) contact.dataset.motionScene = 'contact';
  if (visual) { visual.dataset.tilt = ''; visual.dataset.tiltStrength = '3'; }

  const scenes = [...document.querySelectorAll('[data-motion-scene]')].map(el => ({ el, start: 0, length: 1, top: 0, height: 0, current: 0, target: 0, visible: false }));
  const revealTargets = [...document.querySelectorAll('.section-heading, .about-copy, .story-art, .experience-options, .journey-grid > article, .faq-intro, .faq-list, .contact-panel')];
  let revealObserver;
  if ('IntersectionObserver' in window) {
    revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) { entry.target.classList.add('is-visible'); revealObserver.unobserve(entry.target); }
      });
    }, { threshold: .08, rootMargin: '0px 0px -5% 0px' });
    revealTargets.forEach((el, index) => {
      el.dataset.motionReveal = '';
      el.style.setProperty('--reveal-delay', `${index % 3 * 60}ms`);
      revealObserver.observe(el);
    });
  }

  function measure() {
    viewport = Math.max(1, window.innerHeight);
    maxScroll = Math.max(1, root.scrollHeight - viewport);
    const y = readY();
    scenes.forEach(scene => {
      const rect = scene.el.getBoundingClientRect();
      scene.top = rect.top + y;
      scene.height = rect.height;
      if (scene.el.dataset.motionScene === 'hero') {
        scene.start = 0;
        scene.length = Math.max(viewport, document.querySelector('.hero').offsetHeight);
      } else {
        scene.start = scene.top - viewport;
        scene.length = Math.max(1, scene.height + viewport);
      }
    });
    metricsDirty = false;
  }

  function updateTargets() {
    const y = readY();
    root.style.setProperty('--reading-progress', clamp(y / maxScroll).toFixed(4));
    scenes.forEach(scene => {
      scene.target = clamp((y - scene.start) / scene.length);
      scene.visible = scene.top < y + viewport + 100 && scene.top + scene.height > y - 100;
      scene.el.classList.toggle('scene-in-view', scene.visible);
    });
  }

  function schedule() {
    if (!frameId && !document.hidden) frameId = window.requestAnimationFrame(render);
  }

  function clearTilt() {
    if (!tilt) return;
    tilt.el.classList.remove('is-tilting');
    ['--tilt-x', '--tilt-y', '--shine-x', '--shine-y'].forEach(key => tilt.el.style.removeProperty(key));
    tilt = null;
  }

  function clearPointer() {
    pointer.tx = 0; pointer.ty = 0;
    if (body.classList.contains('pointer-active')) body.classList.remove('pointer-active');
    clearTilt();
  }

  function render(time) {
    frameId = 0;
    const elapsed = lastTime ? clamp((time - lastTime) / 16.667, .25, 3) : 1;
    lastTime = time;
    if (metricsDirty) measure();
    updateTargets();
    if (!enabled || document.hidden || body.classList.contains('dialog-open')) { drive = 0; clearPointer(); lastTime = 0; return; }
    const ease = 1 - Math.pow(.82, elapsed);
    let unsettled = false;
    const approach = (value, target, epsilon = .001) => {
      if (Math.abs(target - value) < epsilon) return target;
      unsettled = true;
      return value + (target - value) * ease;
    };
    pointer.x = approach(pointer.x, pointer.tx);
    pointer.y = approach(pointer.y, pointer.ty);
    pointer.cx = approach(pointer.cx, pointer.tcx, .1);
    pointer.cy = approach(pointer.cy, pointer.tcy, .1);
    root.style.setProperty('--cursor-x', `${pointer.cx.toFixed(2)}px`);
    root.style.setProperty('--cursor-y', `${pointer.cy.toFixed(2)}px`);
    drive *= Math.pow(.88, elapsed);
    if (Math.abs(drive) < .002) drive = 0;
    if (drive) unsettled = true;
    scenes.forEach(scene => {
      scene.current = approach(scene.current, scene.target);
      scene.el.style.setProperty('--scene-progress', scene.current.toFixed(4));
      scene.el.style.setProperty('--scene-x', pointer.x.toFixed(4));
      scene.el.style.setProperty('--scene-y', pointer.y.toFixed(4));
      scene.el.style.setProperty('--wheel-drive', drive.toFixed(4));
      if (scene.el.dataset.motionScene === 'hero') root.style.setProperty('--hero-progress', scene.current.toFixed(4));
    });
    if (tilt && tilt.el.isConnected) {
      tilt.x = approach(tilt.x, tilt.tx, .01);
      tilt.y = approach(tilt.y, tilt.ty, .01);
      tilt.el.style.setProperty('--tilt-x', `${tilt.x.toFixed(2)}deg`);
      tilt.el.style.setProperty('--tilt-y', `${tilt.y.toFixed(2)}deg`);
      tilt.el.style.setProperty('--shine-x', `${tilt.sx.toFixed(2)}%`);
      tilt.el.style.setProperty('--shine-y', `${tilt.sy.toFixed(2)}%`);
    } else if (tilt) clearTilt();
    if (unsettled) schedule(); else lastTime = 0;
  }

  function applyPreference() {
    enabled = !reduced.matches && !userPaused;
    body.classList.toggle('motion-enabled', enabled);
    body.classList.toggle('motion-paused', !enabled);
    body.classList.toggle('reveal-enabled', enabled && Boolean(revealObserver));
    toggle.hidden = reduced.matches;
    toggle.setAttribute('aria-pressed', String(userPaused));
    toggle.setAttribute('aria-label', enabled ? 'Pause motion effects' : 'Enable motion effects');
    toggle.querySelector('.motion-label').textContent = enabled ? 'Motion on' : 'Motion off';
    if (!enabled) {
      clearPointer(); drive = 0;
      scenes.forEach(scene => { ['--scene-progress','--scene-x','--scene-y','--wheel-drive'].forEach(key => scene.el.style.removeProperty(key)); });
      root.style.setProperty('--hero-progress', '0');
      // Never leave unrevealed content hidden after opting out.
      revealTargets.forEach(el => el.classList.add('is-visible'));
    }
    metricsDirty = true;
    schedule();
  }

  toggle.addEventListener('click', () => {
    userPaused = !userPaused;
    try { localStorage.setItem('shikkha-motion-paused', String(userPaused)); } catch {}
    applyPreference();
  });
  reduced.addEventListener('change', applyPreference);
  finePointer.addEventListener('change', () => { if (!finePointer.matches) clearPointer(); schedule(); });
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', () => { metricsDirty = true; schedule(); }, { passive: true });
  window.addEventListener('load', () => { metricsDirty = true; schedule(); }, { once: true });

  // Wheel impulses decorate native scrolling. Do not preventDefault or change scroll position.
  window.addEventListener('wheel', event => {
    if (!enabled || event.ctrlKey || event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY) || body.classList.contains('dialog-open')) return;
    if (event.target instanceof Element && event.target.closest('dialog, input, textarea, select, [contenteditable], .course-filters')) return;
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport : 1;
    drive = clamp(drive + clamp(event.deltaY * unit, -90, 90) / 150, -1, 1);
    schedule();
  }, { passive: true });

  document.addEventListener('pointermove', event => {
    if (!enabled || !finePointer.matches || (event.pointerType && event.pointerType !== 'mouse' && event.pointerType !== 'pen') || body.classList.contains('dialog-open')) return;
    pointer.tx = clamp(event.clientX / Math.max(1, window.innerWidth) * 2 - 1, -1, 1);
    pointer.ty = clamp(event.clientY / viewport * 2 - 1, -1, 1);
    pointer.tcx = event.clientX - 200; pointer.tcy = event.clientY - 200;
    body.classList.add('pointer-active');
    const el = event.target instanceof Element ? event.target.closest('[data-tilt]') : null;
    if (el !== tilt?.el) { clearTilt(); if (el) { tilt = { el, x: 0, y: 0, tx: 0, ty: 0, sx: 50, sy: 50 }; el.classList.add('is-tilting'); } }
    if (tilt) {
      const rect = tilt.el.getBoundingClientRect();
      const x = clamp((event.clientX - rect.left) / Math.max(1, rect.width));
      const y = clamp((event.clientY - rect.top) / Math.max(1, rect.height));
      const strength = clamp(Number(tilt.el.dataset.tiltStrength || 6), 0, 8);
      tilt.tx = (x * 2 - 1) * strength; tilt.ty = (1 - y * 2) * strength;
      tilt.sx = x * 100; tilt.sy = y * 100;
    }
    schedule();
  }, { passive: true });
  document.addEventListener('pointerout', event => {
    if (!event.relatedTarget) { clearPointer(); schedule(); }
    else if (tilt && event.relatedTarget instanceof Node && !tilt.el.contains(event.relatedTarget)) { clearTilt(); schedule(); }
  }, { passive: true });
  window.addEventListener('blur', () => { clearPointer(); schedule(); });
  document.addEventListener('visibilitychange', () => {
    body.classList.toggle('motion-suspended', document.hidden);
    if (document.hidden) { if (frameId) cancelAnimationFrame(frameId); frameId = 0; clearPointer(); }
    else { metricsDirty = true; lastTime = 0; schedule(); }
  });
  document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('close', () => { drive = 0; metricsDirty = true; schedule(); }));
  const main = document.querySelector('main');
  if (main && 'ResizeObserver' in window) new ResizeObserver(() => { metricsDirty = true; schedule(); }).observe(main);
  else if (main && 'MutationObserver' in window) new MutationObserver(() => { metricsDirty = true; schedule(); }).observe(main, { childList: true, subtree: true });
  // Stop JavaScript movement as soon as an existing course or admissions modal opens.
  if ('MutationObserver' in window) new MutationObserver(() => { if (body.classList.contains('dialog-open')) { clearPointer(); drive = 0; } schedule(); }).observe(body, { attributes: true, attributeFilter: ['class'] });
  applyPreference();
})();
