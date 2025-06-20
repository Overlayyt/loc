const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('overlay');
const canvasCtx = canvasElement.getContext('2d');

let currentMode = null;
let earringImg = null;
let necklaceImg = null;
let earringSrc = '';
let necklaceSrc = '';
let lastSnapshotDataURL = '';

let leftEarPositions = [];
let rightEarPositions = [];
let chinPositions = [];

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = src;
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
  });
}

function changeEarring(filename) {
  earringSrc = `earrings/${filename}`;
  loadImage(earringSrc).then(img => {
    if (img) earringImg = img;
  });
}

function changeNecklace(filename) {
  necklaceSrc = `necklaces/${filename}`;
  loadImage(necklaceSrc).then(img => {
    if (img) necklaceImg = img;
  });
}

function selectMode(mode) {
  currentMode = mode;

  document.querySelectorAll('.options-group').forEach(group => group.style.display = 'none');

  if (mode) {
    document.getElementById(`${mode}-options`).style.display = 'flex';
  }
}

function insertJewelryOptions(type, containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  for (let i = 1; i <= 12; i++) {
    const filename = `${type}${i}.png`;
    const btn = document.createElement('button');
    const img = document.createElement('img');
    img.src = `${type}s/${filename}`;
    btn.appendChild(img);
    btn.onclick = () => {
      if (type === 'earring') changeEarring(filename);
      if (type === 'necklace') changeNecklace(filename);
    };
    container.appendChild(btn);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  insertJewelryOptions('earring', 'earring-options');
  insertJewelryOptions('necklace', 'necklace-options');
});

function smooth(positions) {
  if (positions.length === 0) return null;
  const sum = positions.reduce((acc, pos) => ({ x: acc.x + pos.x, y: acc.y + pos.y }), { x: 0, y: 0 });
  return { x: sum.x / positions.length, y: sum.y / positions.length };
}

const faceMesh = new FaceMesh({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
});

faceMesh.setOptions({
  maxNumFaces: 1,
  refineLandmarks: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});

faceMesh.onResults((results) => {
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  if (results.multiFaceLandmarks.length > 0) {
    const landmarks = results.multiFaceLandmarks[0];

    const left = {
      x: landmarks[132].x * canvasElement.width,
      y: landmarks[132].y * canvasElement.height - 20,
    };
    const right = {
      x: landmarks[361].x * canvasElement.width,
      y: landmarks[361].y * canvasElement.height - 20,
    };
    const chin = {
      x: landmarks[152].x * canvasElement.width,
      y: landmarks[152].y * canvasElement.height + 10,
    };

    leftEarPositions.push(left);
    rightEarPositions.push(right);
    chinPositions.push(chin);
    if (leftEarPositions.length > 5) leftEarPositions.shift();
    if (rightEarPositions.length > 5) rightEarPositions.shift();
    if (chinPositions.length > 5) chinPositions.shift();

    const leftSmooth = smooth(leftEarPositions);
    const rightSmooth = smooth(rightEarPositions);
    const chinSmooth = smooth(chinPositions);

    if (currentMode === 'earring' && earringImg) {
      if (leftSmooth) canvasCtx.drawImage(earringImg, leftSmooth.x - 60, leftSmooth.y, 100, 100);
      if (rightSmooth) canvasCtx.drawImage(earringImg, rightSmooth.x - 20, rightSmooth.y, 100, 100);
    }

    if (currentMode === 'necklace' && necklaceImg && chinSmooth) {
      canvasCtx.drawImage(necklaceImg, chinSmooth.x - 100, chinSmooth.y, 300, 150);
    }
  }
});

const camera = new Camera(videoElement, {
  onFrame: async () => {
    await faceMesh.send({ image: videoElement });
  },
  width: 1280,
  height: 720,
});
camera.start();

videoElement.addEventListener('loadedmetadata', () => {
  canvasElement.width = videoElement.videoWidth;
  canvasElement.height = videoElement.videoHeight;
});

function takeSnapshot() {
  const snapshotCanvas = document.createElement('canvas');
  const ctx = snapshotCanvas.getContext('2d');

  snapshotCanvas.width = videoElement.videoWidth;
  snapshotCanvas.height = videoElement.videoHeight;
  ctx.drawImage(videoElement, 0, 0, snapshotCanvas.width, snapshotCanvas.height);

  if (currentMode === 'earring' && earringImg) {
    const leftSmooth = smooth(leftEarPositions);
    const rightSmooth = smooth(rightEarPositions);
    if (leftSmooth) ctx.drawImage(earringImg, leftSmooth.x - 60, leftSmooth.y, 100, 100);
    if (rightSmooth) ctx.drawImage(earringImg, rightSmooth.x - 20, rightSmooth.y, 100, 100);
  }

  if (currentMode === 'necklace' && necklaceImg) {
    const chinSmooth = smooth(chinPositions);
    if (chinSmooth) ctx.drawImage(necklaceImg, chinSmooth.x - 100, chinSmooth.y, 300, 150);
  }

  lastSnapshotDataURL = snapshotCanvas.toDataURL('image/png');
  document.getElementById('snapshot-preview').src = lastSnapshotDataURL;
  document.getElementById('snapshot-modal').style.display = 'block';
}

function saveSnapshot() {
  const link = document.createElement('a');
  link.href = lastSnapshotDataURL;
  link.download = `jewelry-tryon-${Date.now()}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function shareSnapshot() {
  if (navigator.share) {
    fetch(lastSnapshotDataURL)
      .then(res => res.blob())
      .then(blob => {
        const file = new File([blob], 'jewelry-tryon.png', { type: 'image/png' });
        navigator.share({
          title: 'Jewelry Try-On',
          text: 'Check out my look!',
          files: [file]
        });
      })
      .catch(console.error);
  } else {
    alert('Sharing not supported on this browser.');
  }
}

function closeSnapshotModal() {
  document.getElementById('snapshot-modal').style.display = 'none';
}

function toggleInfoModal() {
  const modal = document.getElementById('info-modal');
  modal.style.display = modal.style.display === 'block' ? 'none' : 'block';
}
function toggleInfoModal() {
  const modal = document.getElementById('info-modal');
  modal.style.display = modal.style.display === 'block' ? 'none' : 'block';
}

function toggleLocationModal() {
  const modal = document.getElementById('location-modal');
  modal.style.display = modal.style.display === 'block' ? 'none' : 'block';
}
