import 'pannellum/build/pannellum.js';
import './style.css';

const $ = (id) => document.getElementById(id);
const panorama = $('panorama');
const shell = $('viewer-shell');
const helpDialog = $('help-dialog');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const defaultView = { pitch: -5, yaw: 0, hfov: 105 };
const minHfov = 55;
const maxHfov = 120;
const details = {
  lounge: {
    title: 'The lounge',
    description: 'Soft gray seating, warm rust-colored armchairs, and a round coffee table bring the conversation area together.',
    icon: 'sofa', pitch: -19, yaw: 28, viewPitch: -10, viewYaw: 24,
  },
  media: {
    title: 'Media wall',
    description: 'A wall-mounted screen sits against vertical timber detailing, with a low console keeping the space open and uncluttered.',
    icon: 'tv', pitch: 1, yaw: -49, viewPitch: 0, viewYaw: -44,
  },
  bar: {
    title: 'Breakfast bar',
    description: 'At the far end of the room, a compact counter and stools create another place to gather beneath three pendant lights.',
    icon: 'bar', pitch: 0, yaw: 0, viewPitch: 0, viewYaw: 0,
  },
};
let loaded = false;
let rotating = false;
let selectedDetail = null;
let detailTrigger = null;
let animationFrame;

function announce(message) {
  $('tour-status').textContent = message;
}

function setRotation(value) {
  rotating = loaded && value;
  if (rotating) viewer.startAutoRotate(-2);
  else viewer.stopAutoRotate();
  const label = rotating ? 'Pause automatic rotation' : 'Start automatic rotation';
  $('auto-rotate').setAttribute('aria-pressed', String(rotating));
  $('auto-rotate').setAttribute('aria-label', label);
  $('auto-rotate').title = label;
  $('rotate-symbol').setAttribute('href', rotating ? '#icon-pause' : '#icon-rotate');
}

function hideWelcome() {
  $('welcome-note').hidden = true;
}

function closeDetail(restoreFocus = false) {
  $('detail-panel').hidden = true;
  selectedDetail = null;
  document.querySelectorAll('[data-detail]').forEach((button) => button.setAttribute('aria-pressed', 'false'));
  if (restoreFocus && detailTrigger?.isConnected) detailTrigger.focus({ preventScroll: true });
}

function showDetail(key, trigger) {
  if (!loaded) return;
  const detail = details[key];
  setRotation(false);
  hideWelcome();
  selectedDetail = key;
  detailTrigger = trigger;
  $('detail-title').textContent = detail.title;
  $('detail-description').textContent = detail.description;
  $('detail-symbol').setAttribute('href', `#icon-${detail.icon}`);
  $('detail-panel').hidden = false;
  document.querySelectorAll('[data-detail]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.detail === key)));
  viewer.lookAt(detail.viewPitch, detail.viewYaw, key === 'bar' ? 65 : 90, reducedMotion.matches ? 0 : 850);
  announce(`${detail.title}. ${detail.description}`);
  if (trigger?.matches(':focus-visible')) $('close-detail').focus({ preventScroll: true });
}

function createHotspot(element, key) {
  element.setAttribute('role', 'button');
  element.setAttribute('tabindex', '0');
  element.setAttribute('aria-label', `Explore ${details[key].title.toLowerCase()}`);
  element.dataset.hotspot = key;
  element.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>';
  const label = document.createElement('span');
  label.className = 'hotspot-label';
  label.textContent = details[key].title;
  element.append(label);
  element.addEventListener('pointerdown', (event) => event.stopPropagation());
  element.addEventListener('click', (event) => {
    event.stopPropagation();
    showDetail(key, element);
  });
  element.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      showDetail(key, element);
    }
  });
}

const viewer = window.pannellum.viewer('panorama', {
  type: 'equirectangular',
  panorama: '/images/living-room.webp',
  autoLoad: true,
  showControls: false,
  showZoomCtrl: false,
  showFullscreenCtrl: false,
  compass: false,
  escapeHTML: true,
  ...defaultView,
  minHfov,
  maxHfov,
  minPitch: -80,
  maxPitch: 80,
  mouseZoom: true,
  keyboardZoom: false,
  capturedKeyNumbers: [],
  autoRotateInactivityDelay: -1,
  hotSpots: Object.entries(details).map(([key, detail]) => ({
    pitch: detail.pitch,
    yaw: detail.yaw,
    cssClass: 'room-hotspot',
    createTooltipFunc: createHotspot,
    createTooltipArgs: key,
  })),
});

function updateControls() {
  if (!loaded) return;
  const hfov = viewer.getHfov();
  $('zoom-readout').textContent = `${(defaultView.hfov / hfov).toFixed(1)}×`;
  $('zoom-in').disabled = hfov <= minHfov + 0.2;
  $('zoom-out').disabled = hfov >= maxHfov - 0.2;
}

function updateDirection() {
  const yaw = ((viewer.getYaw() % 360) + 360) % 360;
  $('direction').textContent = `${String(Math.round(yaw) % 360).padStart(3, '0')}°`;
  $('direction-needle').style.transform = `rotate(${yaw}deg)`;
  animationFrame = requestAnimationFrame(updateDirection);
}

function zoom(delta) {
  if (!loaded) return;
  setRotation(false);
  hideWelcome();
  viewer.setHfov(Math.max(minHfov, Math.min(maxHfov, viewer.getHfov() + delta)), reducedMotion.matches ? 0 : 180);
}

function resetView() {
  if (!loaded) return;
  setRotation(false);
  closeDetail();
  viewer.lookAt(defaultView.pitch, defaultView.yaw, defaultView.hfov, reducedMotion.matches ? 0 : 650);
  announce('Returned to the starting view.');
}

viewer.on('load', () => {
  loaded = true;
  $('loading-screen').classList.add('is-loaded');
  $('loading-screen').setAttribute('aria-hidden', 'true');
  shell.dataset.loaded = 'true';
  updateControls();
  updateDirection();
  announce('Living room loaded. Drag to explore or select a detail.');
});
viewer.on('error', () => {
  $('loading-screen').hidden = true;
  loaded = false;
  cancelAnimationFrame(animationFrame);
  document.querySelectorAll('.viewer-controls button, .detail-link, #scene-home').forEach((button) => { button.disabled = true; });
  announce('The panorama could not be loaded. Check that this browser supports WebGL and reload the page.');
});
viewer.on('zoomchange', updateControls);
viewer.on('animatefinished', updateControls);

$('zoom-in').addEventListener('click', () => zoom(-10));
$('zoom-out').addEventListener('click', () => zoom(10));
$('reset-view').addEventListener('click', resetView);
$('scene-home').addEventListener('click', resetView);
$('auto-rotate').addEventListener('click', () => {
  closeDetail();
  hideWelcome();
  setRotation(!rotating);
});
$('dismiss-welcome').addEventListener('click', hideWelcome);
$('close-detail').addEventListener('click', () => closeDetail(true));
document.querySelectorAll('[data-detail]').forEach((button) => {
  button.setAttribute('aria-pressed', 'false');
  button.addEventListener('click', () => showDetail(button.dataset.detail, button));
});

for (const eventName of ['pointerdown', 'wheel']) {
  panorama.addEventListener(eventName, () => {
    setRotation(false);
    hideWelcome();
  }, { passive: true });
}

panorama.addEventListener('keydown', (event) => {
  if (!loaded || event.target !== panorama) return;
  const duration = reducedMotion.matches ? 0 : 150;
  const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', '_', 'Home'];
  if (!keys.includes(event.key)) return;
  event.preventDefault();
  setRotation(false);
  hideWelcome();
  if (event.key === 'ArrowLeft') viewer.setYaw(viewer.getYaw() - 10, duration);
  if (event.key === 'ArrowRight') viewer.setYaw(viewer.getYaw() + 10, duration);
  if (event.key === 'ArrowUp') viewer.setPitch(viewer.getPitch() + 8, duration);
  if (event.key === 'ArrowDown') viewer.setPitch(viewer.getPitch() - 8, duration);
  if (event.key === '+' || event.key === '=') zoom(-10);
  if (event.key === '-' || event.key === '_') zoom(10);
  if (event.key === 'Home') resetView();
});

function openHelp() {
  setRotation(false);
  helpDialog.showModal();
}
function closeHelp() {
  helpDialog.close();
}
$('help').addEventListener('click', openHelp);
$('about-tour').addEventListener('click', openHelp);
$('close-help').addEventListener('click', closeHelp);
$('start-exploring').addEventListener('click', () => {
  closeHelp();
  panorama.focus({ preventScroll: true });
});
helpDialog.addEventListener('click', (event) => {
  const bounds = helpDialog.getBoundingClientRect();
  if (event.target === helpDialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) closeHelp();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && selectedDetail && !helpDialog.open) closeDetail(true);
});

if (!document.fullscreenEnabled) $('fullscreen').hidden = true;
$('fullscreen').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await shell.requestFullscreen();
  } catch {
    announce('Fullscreen is not available in this browser.');
  }
});
document.addEventListener('fullscreenchange', () => {
  const label = document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen';
  $('fullscreen').setAttribute('aria-label', label);
  $('fullscreen').title = label;
  viewer.resize();
});
new ResizeObserver(() => viewer.resize()).observe(shell);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    setRotation(false);
    cancelAnimationFrame(animationFrame);
  } else if (loaded) {
    cancelAnimationFrame(animationFrame);
    updateDirection();
  }
});
