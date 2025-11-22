let sceneEl = document.querySelector("a-scene");
const example3D = document.querySelector('#example-3D');
let captureButton = document.getElementById("capture-btn");
let statusDiv = document.getElementById("status");
let isInitialized = false;
let currentModel = null;
let currentTargetIndex = null;

// Texture cache management
let currentTexture = null;
let textureCache = new Map();
const MAX_TEXTURE_CACHE = 5;

// Create canvas for using with OpenCV
let screenshotCanvas = document.createElement("canvas");
screenshotCanvas.id = "screenshotCanvas";
screenshotCanvas.style.display = "none";
let resultCanvas = document.createElement("canvas");
resultCanvas.id = "resultCanvas";
resultCanvas.style.display = "none";
document.body.appendChild(screenshotCanvas);
document.body.appendChild(resultCanvas);

// Cleanup function for OpenCV matrices
function cleanupMats(...mats) {
  mats.forEach(mat => {
    if (mat && typeof mat.delete === 'function') {
      try {
        mat.delete();
      } catch (e) {
        console.warn('Error deleting mat:', e);
      }
    }
  });
}

// Cleanup old textures to prevent memory leaks
function cleanupTexture(texture) {
  if (texture && texture.dispose) {
    texture.dispose();
  }
}

// Manage texture cache
function manageCachedTextures() {
  if (textureCache.size >= MAX_TEXTURE_CACHE) {
    const firstKey = textureCache.keys().next().value;
    const oldTexture = textureCache.get(firstKey);
    cleanupTexture(oldTexture);
    textureCache.delete(firstKey);
  }
}

// Wait for scene to load before accessing elements
document.addEventListener('DOMContentLoaded', function() {
  setupAnalyticsExport();
  
  // Wait for A-Frame to fully initialize
  sceneEl = document.querySelector("a-scene");
  if (sceneEl.hasLoaded) {
    initializeApp();
  } else {
    sceneEl.addEventListener('loaded', initializeApp);
  }
});

function initializeApp() {
  targetListener();
  setupClickListener();
}

function setupClickListener() {
  const example3DElement = document.querySelector('#example-3D');
  if (example3DElement) {
    example3DElement.addEventListener("click", () => {
      if (currentModel) {
        onOpenCvReady();
      } else {
        showStatus('Please detect the raccoon target first!');
      }
    });
  }
}

function setupAnalyticsExport() {
  const exportButton = document.getElementById("export-analytics");
  if (exportButton) {
    exportButton.addEventListener("click", () => {
      if (window.arAnalytics) {
        arAnalytics.exportCSV();
        arAnalytics.printSummary();
        showStatus('Analytics exported successfully!');
      } else {
        console.error("Analytics not initialized.");
        showStatus('Analytics not available');
      }
    });
  }
}

function targetListener() {
  const raccoonEntity = document.querySelector("#example-3D");
  
  if (!raccoonEntity) {
    console.warn("Raccoon entity not found, retrying...");
    setTimeout(targetListener, 500);
    return;
  }

  const raccoonTarget = raccoonEntity.closest('[mindar-image-target]');
  
  if (!raccoonTarget) {
    console.warn("Raccoon target not found, retrying...");
    setTimeout(targetListener, 500);
    return;
  }

  console.log("Setting up listener for raccoon target:", raccoonTarget);

  raccoonTarget.addEventListener("targetFound", () => {
    console.log("Raccoon target found!");
    if (window.arAnalytics) {
      arAnalytics.trackTargetFound('raccoon', 0);
    }
    currentModel = raccoonEntity;
    currentTargetIndex = 0;
    showStatus('Raccoon detected! Click the raccoon to apply texture.');
  });

  raccoonTarget.addEventListener("targetLost", () => {
    console.log("Raccoon target lost!");
    if (window.arAnalytics) {
      arAnalytics.trackTargetLost('raccoon', 0);
    }
    currentModel = null;
    currentTargetIndex = null;
    showStatus('Raccoon target lost');
  });
}

function showStatus(message) {
  if (!statusDiv) {
    statusDiv = document.getElementById("status");
  }
  if (statusDiv) {
    statusDiv.textContent = message;
    statusDiv.style.display = 'block';
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 3000);
  } else {
    console.log("Status:", message);
  }
}

function onOpenCvReady() {
  showStatus('Processing image...');
  
  // Get screenshot
  const video = document.querySelector("video");
  if (!video) {
    showStatus('Camera not available');
    return;
  }
  
  const myCanvas = document.createElement("canvas");

  // Set the canvas dimensions to match the video
  myCanvas.width = video.videoWidth;
  myCanvas.height = video.videoHeight;

  // Draw the current frame of the video onto the canvas
  const context = myCanvas.getContext("2d");
  context.clearRect(0, 0, myCanvas.width, myCanvas.height);
  context.drawImage(video, 0, 0, myCanvas.width, myCanvas.height);

  // Initialize OpenCV matrices
  let img = null;
  let edgeDetected = null;
  let contours = null;
  let hierarchy = null;
  let target = null;
  let srcTri = null;
  let dstTri = null;
  let M = null;
  let transformed = null;
  let grayed = null;
  let finalImage = null;

  try {
    img = cv.imread(myCanvas);
    edgeDetected = new cv.Mat();
    contours = new cv.MatVector();
    hierarchy = new cv.Mat();
    
    cv.Canny(img, edgeDetected, 100, 200, 3, true);
    cv.findContours(
      edgeDetected,
      contours,
      hierarchy,
      cv.RETR_EXTERNAL,
      cv.CHAIN_APPROX_NONE
    );

    const width = img.cols;
    const height = img.rows;

    target = getApprox(contours, width, height);
    if (!target) {
      console.log("Failed to find a target.");
      showStatus('No coloring page detected');
      if (window.arAnalytics) {
        arAnalytics.trackDetectionFailure();
      }
      scaleAndShowImage(img, 640, "screenshotCanvas");
      scaleAndShowImage(edgeDetected, 640, "resultCanvas");
      return;
    }

    [srcTri, dstTri, dSize] = rectify(target);

    M = cv.getPerspectiveTransform(srcTri, dstTri);

    transformed = new cv.Mat();
    cv.warpPerspective(img, transformed, M, dSize);

    grayed = new cv.Mat();
    cv.cvtColor(transformed, grayed, cv.COLOR_RGBA2GRAY, 0);

    finalImage = new cv.Mat();
    cv.adaptiveThreshold(
      grayed,
      finalImage,
      255,
      cv.ADAPTIVE_THRESH_GAUSSIAN_C,
      cv.THRESH_BINARY,
      5,
      3
    );

    scaleAndShowImage(img, 640, "screenshotCanvas");
    scaleAndShowImage(transformed, 640, "resultCanvas");
    let image = resultCanvas.toDataURL("image/jpeg", 1.0);
    
    // Cleanup old texture before creating new one
    if (currentTexture) {
      cleanupTexture(currentTexture);
      currentTexture = null;
    }
    
    // Manage texture cache
    manageCachedTextures();
    
    // Create new texture
    var newTexture = new THREE.TextureLoader().load(image, 
      // onLoad callback
      function(texture) {
        currentTexture = texture;
        const cacheKey = Date.now().toString();
        textureCache.set(cacheKey, texture);
      },
      // onProgress callback
      undefined,
      // onError callback
      function(err) {
        console.error('Error loading texture:', err);
        if (window.arAnalytics) {
          arAnalytics.trackCapture(false);
        }
      }
    );
    
    newTexture.flipY = false;

    if (example3D && example3D.object3D) {
      example3D.object3D.traverse(function (node) {
        if (node.isMesh) {
          // Dispose old material's texture if it exists
          if (node.material.map && node.material.map !== newTexture) {
            cleanupTexture(node.material.map);
          }
          
          node.material.map = newTexture;
          node.material.needsUpdate = true;
        }
      });
      
      showStatus('Texture applied successfully!');
      if (window.arAnalytics) {
        arAnalytics.trackCapture(true);
      }
    } else {
      showStatus('Failed to apply texture');
      if (window.arAnalytics) {
        arAnalytics.trackCapture(false);
      }
    }
  } catch (error) {
    console.error('Error in onOpenCvReady:', error);
    showStatus('Processing error occurred');
    if (window.arAnalytics) {
      arAnalytics.trackCapture(false);
    }
  } finally {
    // CRITICAL: Clean up all OpenCV matrices
    cleanupMats(
      transformed,
      grayed,
      finalImage,
      M,
      srcTri,
      dstTri,
      target,
      hierarchy,
      contours,
      edgeDetected,
      img
    );
    
    // Clear temporary canvas context
    if (context) {
      context.clearRect(0, 0, myCanvas.width, myCanvas.height);
    }
  }
}

function getApprox(contours, width, height) {
  const sorted = new Array();
  for (let i = 0; i < contours.size(); i++) {
    const arcLength = cv.arcLength(contours.get(i), true);
    sorted.push({
      arcLength,
      element: contours.get(i),
    });
  }
  sorted.sort((a, b) =>
    a.arcLength < b.arcLength ? 1 : b.arcLength < a.arcLength ? -1 : 0
  );
  const imagePerimeter = 2 * (width + height);
  for (let i = 0; i < contours.size(); i++) {
    if (sorted[i].arcLength >= imagePerimeter) continue;
    let approx = new cv.Mat();
    cv.approxPolyDP(
      sorted[i].element,
      approx,
      0.02 * sorted[i].arcLength,
      true
    );
    if (approx.size().height == 4) return approx;
    // Clean up approx if it doesn't match our criteria
    approx.delete();
  }
  return null;
}

function rectify(target) {
  const vertex = new Array();
  vertex.push(new cv.Point(target.data32S[0 * 4], target.data32S[0 * 4 + 1]));
  vertex.push(
    new cv.Point(target.data32S[0 * 4 + 2], target.data32S[0 * 4 + 3])
  );
  vertex.push(new cv.Point(target.data32S[1 * 4], target.data32S[1 * 4 + 1]));
  vertex.push(
    new cv.Point(target.data32S[1 * 4 + 2], target.data32S[1 * 4 + 3])
  );

  let xMin = vertex[0].x,
    yMin = vertex[0].y,
    xMax = vertex[0].x,
    yMax = vertex[0].y;
  for (let i = 1; i < vertex.length; i++) {
    if (vertex[i].x < xMin) xMin = vertex[i].x;
    if (vertex[i].x > xMax) xMax = vertex[i].x;
    if (vertex[i].y < yMin) yMin = vertex[i].y;
    if (vertex[i].y > yMax) yMax = vertex[i].y;
  }
  const width = Math.floor(Math.abs(xMax - xMin));
  const height = Math.floor(Math.abs(yMax - yMin));

  let nWest, nEast, sEast, sWest;
  vertex.sort((a, b) => (a.x > b.x ? 1 : b.x > a.x ? -1 : 0));
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
    nWest.x,
    nWest.y,
    nEast.x,
    nEast.y,
    sEast.x,
    sEast.y,
    sWest.x,
    sWest.y,
  ];
  const dst = [0, 0, width, 0, width, height, 0, height];
  const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, src);
  const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, dst);
  const dSize = new cv.Size(width, height);
  return [srcTri, dstTri, dSize];
}

function scaleAndShowImage(image, maxWidth, canvasId) {
  let resized = null;
  try {
    longerSide = image.cols > image.rows ? image.cols : image.rows;
    longerSide = image.cols;
    exponent = 0;
    while (longerSide > maxWidth) {
      longerSide /= 2;
      exponent++;
    }
    divisor = Math.pow(2, exponent);
    let dSize = new cv.Size(image.cols / divisor, image.rows / divisor);
    resized = new cv.Mat();
    cv.resize(image, resized, dSize, 0, 0, cv.INTER_AREA);
    cv.imshow(canvasId, resized);
  } catch (error) {
    console.error('Error in scaleAndShowImage:', error);
  } finally {
    // Clean up the resized matrix
    if (resized) {
      resized.delete();
    }
  }
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  // Cleanup all cached textures
  textureCache.forEach((texture) => {
    cleanupTexture(texture);
  });
  textureCache.clear();
  
  // Cleanup current texture
  if (currentTexture) {
    cleanupTexture(currentTexture);
  }
  
  // Clear canvas contexts
  if (screenshotCanvas) {
    const ctx = screenshotCanvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, screenshotCanvas.width, screenshotCanvas.height);
    }
  }
  if (resultCanvas) {
    const ctx = resultCanvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, resultCanvas.width, resultCanvas.height);
    }
  }
});