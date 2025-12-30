const canvas = document.getElementById('editor-canvas');
const ctx = canvas.getContext('2d');
const fileInput = document.getElementById('file-input');
const dropZone = document.getElementById('drop-zone');
const dropOverlay = document.getElementById('drop-overlay');

const controls = {
  zoom: document.getElementById('zoom'),
  rotate: document.getElementById('rotate'),
  brightness: document.getElementById('brightness'),
  contrast: document.getElementById('contrast'),
  saturation: document.getElementById('saturation'),
  blur: document.getElementById('blur'),
  vignette: document.getElementById('vignette'),
  sharpen: document.getElementById('sharpen'),
  brushSize: document.getElementById('brush-size'),
  brushColor: document.getElementById('brush-color')
};

const info = {
  name: document.getElementById('image-name'),
  size: document.getElementById('image-size')
};

const actionButtons = {
  reset: document.getElementById('reset-btn'),
  exportPng: document.getElementById('export-btn'),
  exportJpg: document.getElementById('export-jpg'),
  exportWebp: document.getElementById('export-webp'),
  undo: document.getElementById('undo-btn'),
  redo: document.getElementById('redo-btn'),
  apply: document.getElementById('apply-btn'),
  flipX: document.getElementById('flip-x'),
  flipY: document.getElementById('flip-y'),
  sample: document.getElementById('sample-btn')
};

const toolButtons = document.querySelectorAll('[data-tool]');
const presetButtons = document.querySelectorAll('[data-preset]');

const baseCanvas = document.createElement('canvas');
const baseCtx = baseCanvas.getContext('2d');

const state = {
  image: null,
  name: 'Untitled',
  zoom: 1,
  rotation: 0,
  flipX: 1,
  flipY: 1,
  brightness: 0,
  contrast: 0,
  saturation: 0,
  blur: 0,
  vignette: 0,
  sharpen: 0,
  tool: 'brush',
  brushSize: 14,
  brushColor: '#7df6ff',
  strokes: []
};

const history = [];
let historyIndex = -1;
let isDrawing = false;
let currentStroke = null;

const sampleImage = new Image();
sampleImage.crossOrigin = 'anonymous';
sampleImage.src =
  'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80';

const updateInfo = () => {
  if (!state.image) {
    info.name.textContent = 'No image loaded';
    info.size.textContent = '—';
    return;
  }
  info.name.textContent = state.name;
  info.size.textContent = `${state.image.width} × ${state.image.height}`;
};

const setCanvasSize = (width, height) => {
  canvas.width = width;
  canvas.height = height;
};

const applyFilters = () => {
  const brightness = 100 + state.brightness;
  const contrast = 100 + state.contrast;
  const saturation = 100 + state.saturation;
  const blur = state.blur;

  ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) blur(${blur}px)`;
};

const applySharpen = (imageData, amount) => {
  if (amount <= 0) return imageData;
  const w = imageData.width;
  const h = imageData.height;
  const data = imageData.data;
  const copy = new Uint8ClampedArray(data);
  const strength = amount / 100;
  const kernel = [
    0,
    -1 * strength,
    0,
    -1 * strength,
    1 + 4 * strength,
    -1 * strength,
    0,
    -1 * strength,
    0
  ];

  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      for (let c = 0; c < 3; c += 1) {
        let sum = 0;
        let i = 0;
        for (let ky = -1; ky <= 1; ky += 1) {
          for (let kx = -1; kx <= 1; kx += 1) {
            const idx = ((y + ky) * w + (x + kx)) * 4 + c;
            sum += copy[idx] * kernel[i];
            i += 1;
          }
        }
        const index = (y * w + x) * 4 + c;
        data[index] = Math.max(0, Math.min(255, sum));
      }
    }
  }
  return imageData;
};

const drawVignette = () => {
  if (state.vignette <= 0) return;
  const intensity = state.vignette / 100;
  const gradient = ctx.createRadialGradient(
    canvas.width / 2,
    canvas.height / 2,
    canvas.width * 0.15,
    canvas.width / 2,
    canvas.height / 2,
    canvas.width * 0.65
  );
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, `rgba(0,0,0,${0.65 * intensity})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
};

const drawStrokes = () => {
  ctx.save();
  state.strokes.forEach((stroke) => {
    ctx.beginPath();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size;
    ctx.globalCompositeOperation = stroke.mode === 'eraser' ? 'destination-out' : 'source-over';
    stroke.points.forEach((point, index) => {
      if (index === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });
    ctx.stroke();
  });
  ctx.restore();
};

const render = () => {
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!state.image) {
    ctx.restore();
    return;
  }
  applyFilters();
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  ctx.translate(centerX, centerY);
  ctx.rotate((state.rotation * Math.PI) / 180);
  ctx.scale(state.zoom * state.flipX, state.zoom * state.flipY);
  ctx.translate(-centerX, -centerY);
  ctx.drawImage(baseCanvas, 0, 0, canvas.width, canvas.height);
  ctx.restore();

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate((state.rotation * Math.PI) / 180);
  ctx.scale(state.zoom * state.flipX, state.zoom * state.flipY);
  ctx.translate(-centerX, -centerY);
  drawStrokes();
  ctx.restore();

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const sharpened = applySharpen(imageData, state.sharpen);
  ctx.putImageData(sharpened, 0, 0);
  drawVignette();
};

const syncControls = () => {
  controls.zoom.value = state.zoom;
  controls.rotate.value = state.rotation;
  controls.brightness.value = state.brightness;
  controls.contrast.value = state.contrast;
  controls.saturation.value = state.saturation;
  controls.blur.value = state.blur;
  controls.vignette.value = state.vignette;
  controls.sharpen.value = state.sharpen;
  controls.brushSize.value = state.brushSize;
  controls.brushColor.value = state.brushColor;
};

const pushHistory = () => {
  const snapshot = JSON.stringify({
    zoom: state.zoom,
    rotation: state.rotation,
    flipX: state.flipX,
    flipY: state.flipY,
    brightness: state.brightness,
    contrast: state.contrast,
    saturation: state.saturation,
    blur: state.blur,
    vignette: state.vignette,
    sharpen: state.sharpen,
    strokes: state.strokes
  });
  history.splice(historyIndex + 1);
  history.push(snapshot);
  historyIndex = history.length - 1;
  updateUndoRedo();
};

const loadHistory = (index) => {
  if (index < 0 || index >= history.length) return;
  const snapshot = JSON.parse(history[index]);
  state.zoom = snapshot.zoom;
  state.rotation = snapshot.rotation;
  state.flipX = snapshot.flipX;
  state.flipY = snapshot.flipY;
  state.brightness = snapshot.brightness;
  state.contrast = snapshot.contrast;
  state.saturation = snapshot.saturation;
  state.blur = snapshot.blur;
  state.vignette = snapshot.vignette;
  state.sharpen = snapshot.sharpen;
  state.strokes = snapshot.strokes || [];
  syncControls();
  render();
  historyIndex = index;
  updateUndoRedo();
};

const updateUndoRedo = () => {
  actionButtons.undo.disabled = historyIndex <= 0;
  actionButtons.redo.disabled = historyIndex >= history.length - 1;
};

const loadImage = (image, name = 'Untitled') => {
  state.image = image;
  state.name = name;
  baseCanvas.width = image.width;
  baseCanvas.height = image.height;
  baseCtx.clearRect(0, 0, baseCanvas.width, baseCanvas.height);
  baseCtx.drawImage(image, 0, 0);
  setCanvasSize(image.width, image.height);
  state.zoom = 1;
  state.rotation = 0;
  state.flipX = 1;
  state.flipY = 1;
  state.strokes = [];
  render();
  updateInfo();
  syncControls();
  pushHistory();
};

const getPointerPosition = (event) => {
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) * (canvas.width / rect.width);
  const y = (event.clientY - rect.top) * (canvas.height / rect.height);
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;

  const matrix = new DOMMatrix()
    .translate(centerX, centerY)
    .rotate(state.rotation)
    .scale(state.zoom * state.flipX, state.zoom * state.flipY)
    .translate(-centerX, -centerY);
  const inverse = matrix.inverse();
  const point = new DOMPoint(x, y).matrixTransform(inverse);
  return { x: point.x, y: point.y };
};

const startDrawing = (event) => {
  if (!state.image || state.tool === 'move') return;
  isDrawing = true;
  const point = getPointerPosition(event);
  currentStroke = {
    mode: state.tool,
    color: state.brushColor,
    size: state.brushSize,
    points: [point]
  };
  state.strokes.push(currentStroke);
  render();
};

const continueDrawing = (event) => {
  if (!isDrawing || !currentStroke) return;
  const point = getPointerPosition(event);
  currentStroke.points.push(point);
  render();
};

const endDrawing = () => {
  if (!isDrawing) return;
  isDrawing = false;
  currentStroke = null;
  pushHistory();
};

const handleWheel = (event) => {
  if (!state.image) return;
  event.preventDefault();
  const delta = Math.sign(event.deltaY) * -0.05;
  state.zoom = Math.min(2.5, Math.max(0.5, state.zoom + delta));
  controls.zoom.value = state.zoom;
  render();
};

const handleFile = (file) => {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const image = new Image();
    image.onload = () => loadImage(image, file.name);
    image.src = reader.result;
  };
  reader.readAsDataURL(file);
};

const exportImage = (type, quality = 0.92) => {
  if (!state.image) return;
  const link = document.createElement('a');
  link.download = `${state.name.split('.')[0]}-${type}`;
  link.href = canvas.toDataURL(`image/${type}`, quality);
  link.click();
};

controls.zoom.addEventListener('input', (event) => {
  state.zoom = parseFloat(event.target.value);
  render();
});

controls.rotate.addEventListener('input', (event) => {
  state.rotation = parseFloat(event.target.value);
  render();
});

['brightness', 'contrast', 'saturation', 'blur', 'vignette', 'sharpen'].forEach((key) => {
  controls[key].addEventListener('input', (event) => {
    state[key] = parseFloat(event.target.value);
    render();
  });
});

controls.brushSize.addEventListener('input', (event) => {
  state.brushSize = parseInt(event.target.value, 10);
});

controls.brushColor.addEventListener('input', (event) => {
  state.brushColor = event.target.value;
});

fileInput.addEventListener('change', (event) => {
  const [file] = event.target.files;
  handleFile(file);
});

actionButtons.sample.addEventListener('click', () => {
  if (sampleImage.complete) {
    loadImage(sampleImage, 'sample.jpg');
  } else {
    sampleImage.onload = () => loadImage(sampleImage, 'sample.jpg');
  }
});

actionButtons.flipX.addEventListener('click', () => {
  state.flipX *= -1;
  render();
  pushHistory();
});

actionButtons.flipY.addEventListener('click', () => {
  state.flipY *= -1;
  render();
  pushHistory();
});

actionButtons.reset.addEventListener('click', () => {
  if (!state.image) return;
  Object.assign(state, {
    zoom: 1,
    rotation: 0,
    flipX: 1,
    flipY: 1,
    brightness: 0,
    contrast: 0,
    saturation: 0,
    blur: 0,
    vignette: 0,
    sharpen: 0,
    strokes: []
  });
  syncControls();
  render();
  pushHistory();
});

actionButtons.exportPng.addEventListener('click', () => exportImage('png'));
actionButtons.exportJpg.addEventListener('click', () => exportImage('jpeg', 0.92));
actionButtons.exportWebp.addEventListener('click', () => exportImage('webp', 0.92));

actionButtons.undo.addEventListener('click', () => {
  loadHistory(historyIndex - 1);
});

actionButtons.redo.addEventListener('click', () => {
  loadHistory(historyIndex + 1);
});

actionButtons.apply.addEventListener('click', () => {
  pushHistory();
});

presetButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const preset = button.dataset.preset;
    if (preset === 'cinematic') {
      state.brightness = -10;
      state.contrast = 20;
      state.saturation = 10;
      state.vignette = 45;
    }
    if (preset === 'mono') {
      state.saturation = -40;
      state.contrast = 15;
      state.brightness = 5;
      state.vignette = 20;
    }
    if (preset === 'vivid') {
      state.saturation = 30;
      state.contrast = 20;
      state.brightness = 8;
      state.vignette = 10;
    }
    syncControls();
    render();
    pushHistory();
  });
});

toolButtons.forEach((button) => {
  button.addEventListener('click', () => {
    toolButtons.forEach((btn) => btn.classList.remove('is-active'));
    button.classList.add('is-active');
    state.tool = button.dataset.tool;
  });
});

canvas.addEventListener('pointerdown', (event) => {
  canvas.setPointerCapture(event.pointerId);
  startDrawing(event);
});

canvas.addEventListener('pointermove', (event) => {
  if (state.tool === 'move') return;
  continueDrawing(event);
});

canvas.addEventListener('pointerup', endDrawing);
canvas.addEventListener('pointerleave', endDrawing);
canvas.addEventListener('pointercancel', endDrawing);
canvas.addEventListener('wheel', handleWheel, { passive: false });

['dragenter', 'dragover'].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropOverlay.classList.add('is-visible');
  });
});

['dragleave', 'drop'].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropOverlay.classList.remove('is-visible');
  });
});

dropZone.addEventListener('drop', (event) => {
  const file = event.dataTransfer.files[0];
  handleFile(file);
});

updateInfo();
updateUndoRedo();
