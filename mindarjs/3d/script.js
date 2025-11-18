// Global variables
let sceneEl;
let currentModel = null;
let currentTargetIndex = null;
let captureBtn;
let statusDiv;
let isInitialized = false;

// Create canvases for OpenCV processing
let screenshotCanvas = document.createElement("canvas");
screenshotCanvas.id = "screenshotCanvas";
screenshotCanvas.style.display = "none";
let resultCanvas = document.createElement("canvas");
resultCanvas.id = "resultCanvas";
resultCanvas.style.display = "none";

// Wait until body exists before appending
function appendCanvases() {
  if (document.body) {
    document.body.appendChild(screenshotCanvas);
    document.body.appendChild(resultCanvas);
  } else {
    setTimeout(appendCanvases, 10);
  }
}
appendCanvases();

// Initialize when everything is ready
function init() {
  if (isInitialized) return;
  
  console.log('Initializing...');
  
  sceneEl = document.querySelector("a-scene");
  captureBtn = document.getElementById('capture-btn');
  statusDiv = document.getElementById('status');
  
  if (!sceneEl || !captureBtn || !statusDiv) {
    console.log('Waiting for elements...', {
      sceneEl: !!sceneEl, 
      captureBtn: !!captureBtn, 
      statusDiv: !!statusDiv,
      bodyExists: !!document.body
    });
    setTimeout(init, 100);
    return;
  }
  
  console.log('All elements found, setting up listeners');
  isInitialized = true;
  setupTargetListeners();
  setupCaptureButton();
}

// Start initialization - handle multiple scenarios
if (document.readyState === 'loading') {
  console.log('Document still loading, waiting for DOMContentLoaded');
  document.addEventListener('DOMContentLoaded', init);
} else if (document.readyState === 'interactive' || document.readyState === 'complete') {
  console.log('Document already loaded, initializing now');
  init();
}

function setupTargetListeners() {
  // Wait a bit for MindAR to fully initialize
  setTimeout(() => {
    const mermaidEntity = document.querySelector('#mermaid-model');
    const turtleEntity = document.querySelector('#turtle-model');
    const gokuEntity = document.querySelector('#goku-model');
    
    console.log('Setting up listeners for:', mermaidEntity, turtleEntity, gokuEntity);
    
    // Debug: Check if models have UV maps and textures
  
    
    if (mermaidEntity) {
      mermaidEntity.addEventListener('model-loaded', () => {
        console.log('Mermaid model loaded, checking UV maps...');
        mermaidEntity.object3D.traverse((node) => {
          if (node.isMesh) {
            console.log('Mermaid mesh found:', node.name);
            console.log('  - Has UV coords:', node.geometry.attributes.uv !== undefined);
            console.log('  - Current texture:', node.material.map);
            console.log('  - Material:', node.material);
          }
        });
      });
    }

    if (turtleEntity) {
      turtleEntity.addEventListener('model-loaded', () => {
        console.log('Turtle model loaded, checking UV maps...');
        turtleEntity.object3D.traverse((node) => {
          if (node.isMesh) {
            console.log('Turtle mesh found:', node.name);
            console.log('  - Has UV coords:', node.geometry.attributes.uv !== undefined);
            console.log('  - Current texture:', node.material.map);
            console.log('  - Material:', node.material);
          }
        });
      });
    }

    if (gokuEntity) {
      gokuEntity.addEventListener('model-loaded', () => {
        console.log('Goku model loaded, checking UV maps...');
        gokuEntity.object3D.traverse((node) => {
          if (node.isMesh) {
            console.log('Goku mesh found:', node.name);
            console.log('  - Has UV coords:', node.geometry.attributes.uv !== undefined);
            console.log('  - Current texture:', node.material.map);
            console.log('  - Material:', node.material);
          }
        });
      });
    }
    
    if (turtleEntity) {
      const turtleTarget = turtleEntity.parentElement;
      console.log('Turtle target element:', turtleTarget);
      
      turtleTarget.addEventListener('targetFound', () => {
        console.log('Turtle target found!');
        currentModel = turtleEntity;
        currentTargetIndex = 1;
        captureBtn.disabled = false;
        captureBtn.style.background = '#4CAF50';
        console.log('Button enabled:', !captureBtn.disabled, 'Model set:', !!currentModel);
        showStatus('Turtle detected! Ready to capture.');
      });
      
      turtleTarget.addEventListener('targetLost', () => {
        console.log('Turtle target lost');
        if (currentTargetIndex === 1) {
          currentModel = null;
          currentTargetIndex = null;
          captureBtn.disabled = true;
          captureBtn.style.background = '#cccccc';
          showStatus('Target lost');
        }
      });
    } else {
      console.warn('Turtle entity not found');
    }

    if (gokuEntity) {
      const gokuTarget = gokuEntity.parentElement;
      console.log('Goku target element:', gokuTarget);
      
      gokuTarget.addEventListener('targetFound', () => {
        console.log('Goku target found!');
        currentModel = gokuEntity;
        currentTargetIndex = 2;
        captureBtn.disabled = false;
        captureBtn.style.background = '#4CAF50';
        console.log('Button enabled:', !captureBtn.disabled, 'Model set:', !!currentModel);
        showStatus('Goku detected! Ready to capture.');
      });
      
      gokuTarget.addEventListener('targetLost', () => {
        console.log('Goku target lost');
        if (currentTargetIndex === 2) {
          currentModel = null;
          currentTargetIndex = null;
          captureBtn.disabled = true;
          captureBtn.style.background = '#cccccc';
          showStatus('Target lost');
        }
      });
    } else {
      console.warn('Goku entity not found');
    }
    
    
    if (mermaidEntity) {
      const mermaidTarget = mermaidEntity.parentElement;
      console.log('Mermaid target element:', mermaidTarget);
      
      mermaidTarget.addEventListener('targetFound', () => {
        console.log('Mermaid target found!');
        currentModel = mermaidEntity;
        currentTargetIndex = 0;
        captureBtn.disabled = false;
        captureBtn.style.background = '#4CAF50';
        console.log('Button enabled:', !captureBtn.disabled, 'Model set:', !!currentModel);
        showStatus('Mermaid detected! Ready to capture.');
      });
      
      mermaidTarget.addEventListener('targetLost', () => {
        console.log('Mermaid target lost');
        if (currentTargetIndex === 0) {
          currentModel = null;
          currentTargetIndex = null;
          captureBtn.disabled = true;
          captureBtn.style.background = '#cccccc';
          showStatus('Target lost');
        }
      });
    } else {
      console.warn('Mermaid entity not found');
    }
  }, 1000);
}

function setupCaptureButton() {
  captureBtn.addEventListener('click', () => {
    if (currentModel && typeof cv !== 'undefined') {
      processColoringPage();
    } else if (typeof cv === 'undefined') {
      showStatus('OpenCV not loaded yet. Please wait...');
    } else {
      showStatus('No target detected');
    }
  });
  console.log('Capture button listener added');
  
  // Add reset button to restore original textures
  const resetBtn = document.getElementById('reset-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (currentModel) {
        resetModelTexture(currentModel);
        showStatus('Texture reset to original');
      } else {
        showStatus('Please point at a target first');
      }
    });
  }
}

function resetModelTexture(modelEntity) {
  // Clean up any existing textures first
  modelEntity.object3D.traverse((node) => {
    if (node.isMesh && node.material) {
      if (node.material.map && node.material.map.dispose) {
        node.material.map.dispose();
      }
      if (node.material.dispose) {
        node.material.dispose();
      }
    }
  });
  
  // Reload the model by removing and re-adding the gltf-model attribute
  const modelPath = modelEntity.getAttribute('gltf-model');
  modelEntity.removeAttribute('gltf-model');
  
  // Small delay to ensure cleanup
  setTimeout(() => {
    modelEntity.setAttribute('gltf-model', modelPath);
  }, 100);
}

function showStatus(message) {
  statusDiv.textContent = message;
  statusDiv.style.display = 'block';
  setTimeout(() => {
    statusDiv.style.display = 'none';
  }, 3000);
}

function processColoringPage() {
  showStatus('Processing coloring...');
  
  // Get video element from MindAR
  const video = document.querySelector("video");
  if (!video) {
    showStatus('Camera not available');
    return;
  }
  
  // Create canvas and capture current frame
  const captureCanvas = document.createElement("canvas");
  captureCanvas.width = video.videoWidth;
  captureCanvas.height = video.videoHeight;
  
  const context = captureCanvas.getContext("2d");
  context.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);
  
  // Process with OpenCV
  let mats = [];
  try {
    let img = cv.imread(captureCanvas); mats.push(img);
    let gray = new cv.Mat(); mats.push(gray);
    let blurred = new cv.Mat(); mats.push(blurred);
    let edgeDetected = new cv.Mat(); mats.push(edgeDetected);
    let contours = new cv.MatVector(); mats.push(contours);
    let hierarchy = new cv.Mat(); mats.push(hierarchy);
    
    // Convert to grayscale and blur to reduce noise
    cv.cvtColor(img, gray, cv.COLOR_RGBA2GRAY, 0);
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
    
    // Edge detection with adjusted parameters
    cv.Canny(blurred, edgeDetected, 50, 150, 3, false);
    
    // Dilate to close gaps in edges
    let kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3)); mats.push(kernel);
    cv.dilate(edgeDetected, edgeDetected, kernel);
    
    cv.findContours(
      edgeDetected,
      contours,
      hierarchy,
      cv.RETR_EXTERNAL,
      cv.CHAIN_APPROX_SIMPLE
    );
    
    console.log('Found', contours.size(), 'contours');
    
    const width = img.cols;
    const height = img.rows;
    
    // Find the coloring page contour
    let target = getApprox(contours, width, height);
    if (target) mats.push(target);
    if (!target) {
      showStatus('Could not detect coloring page. Make sure it has clear edges and good lighting.');
      
      // Show debug images
      scaleAndShowImage(img, 640, "screenshotCanvas");
      scaleAndShowImage(edgeDetected, 640, "resultCanvas");
      screenshotCanvas.style.display = 'block';
      resultCanvas.style.display = 'block';
      screenshotCanvas.style.position = 'fixed';
      screenshotCanvas.style.top = '10px';
      screenshotCanvas.style.left = '10px';
      screenshotCanvas.style.zIndex = '2000';
      resultCanvas.style.position = 'fixed';
      resultCanvas.style.top = '10px';
      resultCanvas.style.right = '10px';
      resultCanvas.style.zIndex = '2000';
      
      return;
    }
    
    // Hide debug canvases
    screenshotCanvas.style.display = 'none';
    resultCanvas.style.display = 'none';
    
    console.log('Found target contour with 4 corners');
    
    // Rectify perspective
    let [srcTri, dstTri, dSize] = rectify(target);
    mats.push(srcTri); mats.push(dstTri);
    let M = cv.getPerspectiveTransform(srcTri, dstTri); mats.push(M);
    
    let transformed = new cv.Mat(); mats.push(transformed);
    cv.warpPerspective(img, transformed, M, dSize);
    
    console.log('Transformed size:', transformed.cols, 'x', transformed.rows);
    
    // Convert to texture
    scaleAndShowImage(transformed, 1024, "resultCanvas");
    let textureImage = resultCanvas.toDataURL("image/jpeg", 0.95);
    
    // Apply texture to 3D model
    applyTextureToModel(currentModel, textureImage);
    
    showStatus('Coloring applied successfully!');
    
  } catch (error) {
    console.error('OpenCV processing error:', error);
    showStatus('Error processing image. Please try again.');
  } finally {
    cleanup(mats);
  }
}

function applyTextureToModel(modelEntity, textureDataUrl) {
  // Load the texture
  const loader = new THREE.TextureLoader();
  loader.load(textureDataUrl, (texture) => {
    texture.flipY = false;
    texture.needsUpdate = true;
    
    // Apply to all meshes in the model
    modelEntity.object3D.traverse((node) => {
      if (node.isMesh) {
        // Clone the material(s) and dispose the old ones to avoid GPU leaks
        const oldMat = node.material;
        if (Array.isArray(oldMat)) {
          // Clone first so we have bases for new materials
          const newMats = oldMat.map(m => m.clone());
          // Assign texture to new materials
          newMats.forEach(m => {
            m.map = texture;
            m.needsUpdate = true;
          });
          // Dispose old materials and their textures
          oldMat.forEach(m => {
            if (m && m.map && m.map.dispose) m.map.dispose();
            if (m && m.dispose) m.dispose();
          });
          node.material = newMats;
        } else if (oldMat) {
          const newMat = oldMat.clone();
          newMat.map = texture;
          newMat.needsUpdate = true;
          if (oldMat.map && oldMat.map.dispose) oldMat.map.dispose();
          if (oldMat.dispose) oldMat.dispose();
          node.material = newMat;
        } else {
          // No existing material, create a basic one
          node.material = new THREE.MeshBasicMaterial({ map: texture });
        }
      }
    });
  });
}

function getApprox(contours, width, height) {
  const sorted = [];
  // Collect arc lengths and indices, delete temporary Mats immediately
  for (let i = 0; i < contours.size(); i++) {
    const cnt = contours.get(i);
    const arcLength = cv.arcLength(cnt, true);
    sorted.push({ arcLength, index: i });
    if (cnt && cnt.delete) cnt.delete();
  }

  sorted.sort((a, b) => b.arcLength - a.arcLength);

  const imagePerimeter = 2 * (width + height);
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].arcLength >= imagePerimeter) continue;

    const cnt = contours.get(sorted[i].index);
    let approx = new cv.Mat();
    cv.approxPolyDP(
      cnt,
      approx,
      0.02 * sorted[i].arcLength,
      true
    );
    if (cnt && cnt.delete) cnt.delete();

    if (approx.size().height == 4) {
      return approx;
    }
    approx.delete();
  }
  return null;
}

function rectify(target) {
  const vertex = [];
  for (let i = 0; i < 4; i++) {
    vertex.push(new cv.Point(
      target.data32S[i * 2], 
      target.data32S[i * 2 + 1]
    ));
  }
  
  let xMin = vertex[0].x, yMin = vertex[0].y;
  let xMax = vertex[0].x, yMax = vertex[0].y;
  
  for (let i = 1; i < vertex.length; i++) {
    if (vertex[i].x < xMin) xMin = vertex[i].x;
    if (vertex[i].x > xMax) xMax = vertex[i].x;
    if (vertex[i].y < yMin) yMin = vertex[i].y;
    if (vertex[i].y > yMax) yMax = vertex[i].y;
  }
  
  const width = Math.floor(Math.abs(xMax - xMin));
  const height = Math.floor(Math.abs(yMax - yMin));
  
  // Sort vertices by position to find corners
  vertex.sort((a, b) => a.x - b.x);
  
  let nWest, sWest, nEast, sEast;
  if (vertex[0].y < vertex[1].y) {
    nWest = vertex[0];
    sWest = vertex[1];
  } else {
    nWest = vertex[1];
    sWest = vertex[0];
  }
  
  if (vertex[2].y > vertex[3].y) {
    sEast = vertex[2];
    nEast = vertex[3];
  } else {
    sEast = vertex[3];
    nEast = vertex[2];
  }
  
  const src = [
    nWest.x, nWest.y,
    nEast.x, nEast.y,
    sEast.x, sEast.y,
    sWest.x, sWest.y,
  ];
  const dst = [0, 0, width, 0, width, height, 0, height];
  
  const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, src);
  const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, dst);
  const dSize = new cv.Size(width, height);
  
  return [srcTri, dstTri, dSize];
}

function scaleAndShowImage(image, maxWidth, canvasId) {
  let longerSide = Math.max(image.cols, image.rows);
  let exponent = 0;
  
  while (longerSide > maxWidth) {
    longerSide /= 2;
    exponent++;
  }
  
  const divisor = Math.pow(2, exponent);
  const dSize = new cv.Size(
    Math.floor(image.cols / divisor), 
    Math.floor(image.rows / divisor)
  );
  
  let resized = new cv.Mat();
  cv.resize(image, resized, dSize, 0, 0, cv.INTER_AREA);
  cv.imshow(canvasId, resized);
  resized.delete();
}

function cleanup(mats) {
  mats.forEach(mat => {
    if (mat && mat.delete) {
      mat.delete();
    }
  });
}