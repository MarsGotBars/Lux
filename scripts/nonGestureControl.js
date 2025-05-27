import {
  onGestureChange,
  onHandMove,
  onPinchAmountChange,
  onShapeSelection,
  onFingerCountChange,
  getScalingSession,
  switchShapeMode,
  onHandRotation,
  normalizeRotation,
} from "./gestureControl.js";





// Waardes die je aan mag passen, dit heeft allemaal invloed op de vormen en sterren

// Start positie van de vormen en sterren
let initialY = 0;
let initialX = 0;

// Start schaal van de vormen en sterren (grootte)
let initialScale = 1;

// Minimale schaal van de vormen en sterren
const minZoom = 0.5;

// Maximale schaal van de vormen en sterren
const maxZoom = 2;

// Lerping snelheid van de vormen en sterren (hoe sneller de vormen en sterren bewegen)
const POSITION_LERP_SPEED = 0.15;

// Lerping snelheid van de schaal van de vormen en sterren (hoe sneller de vormen en sterren groter of kleiner worden) hoger is sneller
const ZOOM_LERP_SPEED = 0.1;

// Threshold voor de vormen en sterren (hoe sneller de vormen en sterren bewegen)
const POSITION_THRESHOLD = 0.5;

// Threshold voor de schaal van de vormen en sterren (hoe sneller de vormen en sterren groter of kleiner worden) hoger is sneller
const ZOOM_THRESHOLD = 0.01;

// Boundary voor de vormen en sterren (hoe sneller de vormen en sterren bewegen)
const boundary = 0.9;






// Lerping variables
let targetPos = { x: 0, y: 0 };
let currentPos = { x: 0, y: 0 };
let currentRotation = 0;
let targetRotation = 0;
const ROTATION_LERP_SPEED = 0.1;
const ROTATION_THRESHOLD = 0.1;

// Constants
const FORM_TYPE_MAPPING = {
  star: "ster",
  shape: "vorm",
};

// Cache DOM elements
const fakeCanvas = document.querySelector("main");
const previewContainer = document.querySelector("main svg");
const formSelectorGroup = document.querySelector("fieldset");
const previewSection = document.querySelector("section");
const fingerCountText = previewSection.querySelector("p:nth-child(2)");
const shapePreviewText = previewSection.querySelector("p:nth-child(3)");

let currentScale = 1;
let targetScale = 1;
let formLabels = {};

// --- Performance optimizations ---
let animationFrameId = null;
let needsPositionUpdate = false;
let needsZoomUpdate = false;
let needsRotationUpdate = false;
let lastGestureState = ["None", "None"];

// --- Shape selection state ---
let currentShapePreview = null;

// --- Cache management ---
let cachedSelectedValue = null;
let lastActiveLabel = null;

const clearCache = () => {
  cachedSelectedValue = null;
  lastActiveLabel = null;
};

const getActiveLabel = () => {
  return Object.values(formLabels).find(
    (label) => label.style.display !== "none"
  );
};

// --- Store each form label by its data-form attribute ---
const storeFormLabels = (labels) => {
  labels.forEach((label) => {
    const formType = label.dataset.form;
    if (formType) {
      formLabels[formType] = label;
    }
  });
};

// --- Show shape preview ---
const showShapePreview = (shapeInfo, fingerCount) => {
  if (!shapeInfo) return;

  fingerCountText.textContent = `${fingerCount} vingers opgestoken`;
  shapePreviewText.textContent = shapeInfo.label;
  currentShapePreview = shapeInfo;
  previewSection.classList.add("visible");
};

// --- Hide shape preview ---
const hideShapePreview = () => {
  fingerCountText.textContent = "0 vingers opgestoken";
  shapePreviewText.textContent = "Geen vorm";
  currentShapePreview = null;
  previewSection.classList.remove("visible");
};

// --- Enhanced shape/star selection ---
const selectShapeByValue = (value, type) => {
  const targetFormKey = FORM_TYPE_MAPPING[type] || "vorm";
  activateForm(targetFormKey);

  setTimeout(() => {
    const activeLabel = formLabels[targetFormKey];
    if (activeLabel) {
      const selectElement = activeLabel.querySelector("select");
      if (selectElement) {
        const targetOption = selectElement.querySelector(
          `option[value="${value}"]`
        );
        if (targetOption) {
          selectElement.value = value;
          selectElement.dispatchEvent(new Event("change", { bubbles: true }));
          clearCache();
          updateSvg();
        }
      }
    }
  }, 100);
};

// --- SVG update ---
const updateSvg = () => {
  const activeLabel = getActiveLabel();
  if (!activeLabel) return;

  const selectElement = activeLabel.querySelector("select");
  const selectedOption = selectElement?.selectedOptions[0];
  if (!selectedOption) return;

  const svgElement = selectedOption.querySelector("svg > *");
  if (!previewContainer) {
    console.warn("No <svg> found in <main>");
    return;
  }

  previewContainer.innerHTML = svgElement ? svgElement.outerHTML : "";
};

// --- Animation loop ---
const animate = () => {
  let hasUpdates = false;

  if (needsPositionUpdate) {
    const dx = targetPos.x - currentPos.x;
    const dy = targetPos.y - currentPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > POSITION_THRESHOLD) {
      currentPos.x += dx * POSITION_LERP_SPEED;
      currentPos.y += dy * POSITION_LERP_SPEED;
      hasUpdates = true;
    } else {
      currentPos = { ...targetPos };
      needsPositionUpdate = false;
    }

    fakeCanvas.style.setProperty("--x", `${currentPos.x}px`);
    fakeCanvas.style.setProperty("--y", `${currentPos.y}px`);
  }

  if (needsZoomUpdate) {
    const scaleDiff = targetScale - currentScale;

    if (Math.abs(scaleDiff) > ZOOM_THRESHOLD) {
      currentScale += scaleDiff * ZOOM_LERP_SPEED;
      hasUpdates = true;
    } else {
      currentScale = targetScale;
      needsZoomUpdate = false;
    }

    fakeCanvas.style.setProperty("--scale", currentScale);
  }

  if (needsRotationUpdate) {
    const rotationDiff = targetRotation - currentRotation;

    if (Math.abs(rotationDiff) > ROTATION_THRESHOLD) {
      currentRotation += rotationDiff * ROTATION_LERP_SPEED;
      hasUpdates = true;
    } else {
      currentRotation = targetRotation;
      needsRotationUpdate = false;
    }

    fakeCanvas.style.setProperty("--rotate", `${currentRotation}deg`);
  }

  if (hasUpdates || needsPositionUpdate || needsZoomUpdate || needsRotationUpdate) {
    animationFrameId = requestAnimationFrame(animate);
  } else {
    animationFrameId = null;
  }
};

// --- Handle gestures ---
const handleGesture = (handIndex, gesture) => {
  const formKeys = Object.keys(formLabels);
  if (formKeys.length < 2) return;

  switch (gesture) {
    case "Thumb_Down":
      switchShapeMode("basic");
      activateForm(FORM_TYPE_MAPPING.shape);
      break;
    case "Thumb_Up":
      switchShapeMode("star");
      activateForm(FORM_TYPE_MAPPING.star);
      break;
    case "Victory":
      const currentForm = formKeys.find((key) => {
        const label = formLabels[key];
        return label && label.style.display !== "none";
      });
      // If no form is selected, start with the first one
      const currentIndex = currentForm ? formKeys.indexOf(currentForm) : -1;
      const nextIndex = (currentIndex + 1) % formKeys.length;
      activateForm(formKeys[nextIndex]);
      break;
    case "ILoveYou":
      // Reset schaal
      setZoom(1);

      // Reset rotatie
      setRotation(0); 
      break;
    case "Closed_Fist":
      // Als er een vorm geselecteerd is (met aantal vingers), selecteer deze
      if (currentShapePreview?.value) {
        selectShapeByValue(currentShapePreview.value, currentShapePreview.type);
        hideShapePreview();
      }
      break;
  }
};

// --- Movement and zoom ---
const startAnimation = () => {
  if (animationFrameId === null) {
    animationFrameId = requestAnimationFrame(animate);
  }
};

const ensureWithinBounds = () => {
  const parentRect = fakeCanvas.getBoundingClientRect();
  const elemRect = previewContainer.getBoundingClientRect();

  const maxX = parentRect.width - elemRect.width / boundary;
  const maxY = parentRect.height - elemRect.height / boundary;

  // Ensure current position is within bounds
  currentPos.x = Math.min(Math.max(0, currentPos.x), maxX);
  currentPos.y = Math.min(Math.max(0, currentPos.y), maxY);

  // Update target position to match if it was out of bounds
  targetPos.x = Math.min(Math.max(0, targetPos.x), maxX);
  targetPos.y = Math.min(Math.max(0, targetPos.y), maxY);

  // Apply the corrected position
  fakeCanvas.style.setProperty("--x", `${currentPos.x}px`);
  fakeCanvas.style.setProperty("--y", `${currentPos.y}px`);
};

const moveObject = ({ handIndex, x, y }) => {
  if (handIndex !== 0) return;

  if (
    typeof x !== "number" ||
    typeof y !== "number" ||
    x < 0 ||
    x > 1 ||
    y < 0 ||
    y > 1
  )
    return;

  const parentRect = fakeCanvas.getBoundingClientRect();
  const elemRect = previewContainer.getBoundingClientRect();

  const maxX = parentRect.width - elemRect.width / boundary;
  const maxY = parentRect.height - elemRect.height / boundary;

  let posX = (1 - x) * parentRect.width;
  let posY = y * parentRect.height;

  posX = Math.min(Math.max(0, posX), maxX);
  posY = Math.min(Math.max(0, posY), maxY);

  targetPos = { x: posX, y: posY };
  needsPositionUpdate = true;
  startAnimation();
};

const setZoom = (scale) => {
  const newScale = Math.min(Math.max(minZoom, scale), maxZoom);

  if (Math.abs(newScale - targetScale) > ZOOM_THRESHOLD) {
    targetScale = newScale;
    needsZoomUpdate = true;
    startAnimation();
  }
};

// Add rotation setter function
const setRotation = (degrees) => {
  const normalizedDegrees = normalizeRotation(degrees);
  const currentNormalized = normalizeRotation(currentRotation);
  
  // Calculate the difference and choose the shortest rotation path
  let diff = normalizedDegrees - currentNormalized;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  
  const newTarget = currentRotation + diff;
  
  if (Math.abs(newTarget - targetRotation) > ROTATION_THRESHOLD) {
    targetRotation = newTarget;
    needsRotationUpdate = true;
    startAnimation();
  }
};

// --- Form handling ---
const showForm = (formKey) => {
  const switchForm = () => {
    Object.entries(formLabels).forEach(([key, label]) => {
      const isActive = key === formKey;
      label.style.display = isActive ? "block" : "none";
      label.classList.toggle("remove", !isActive);
    });
    clearCache();
    updateSvg();
  };

  if (document.startViewTransition) {
    document.startViewTransition(switchForm);
  } else {
    switchForm();
  }
};

const activateForm = (formKey) => {
  const radioInput = formSelectorGroup.querySelector(
    `input[type="radio"][value="${formKey}"]`
  );
  if (radioInput && !radioInput.checked) {
    radioInput.checked = true;
    radioInput.dispatchEvent(new Event("change", { bubbles: true }));
  }
};

// --- Event Listeners ---
document.querySelectorAll("label[data-form] select").forEach((select) => {
  select.addEventListener("change", () => {
    clearCache();
    updateSvg();
  });
});

formSelectorGroup.addEventListener("change", (e) => {
  if (e.target.name === "weergave") {
    showForm(e.target.value);
  }
});

// Add resize handler
window.addEventListener("resize", () => {
  ensureWithinBounds();
});

// --- Gesture Control ---
onHandMove(moveObject);

// Add hand rotation handler
onHandRotation(({ handIndex, rotation }) => {
  if (handIndex === 0) {
    setRotation(rotation);
  }
});

// Add gesture change handler
onGestureChange(({ handIndex, gesture }) => {
  if (gesture !== lastGestureState[handIndex]) {
    handleGesture(handIndex, gesture);
    lastGestureState[handIndex] = gesture;
  }
});

// Add finger count change handler
onFingerCountChange(({ hand0, hand1, total }) => {
  fingerCountText.textContent = `${total} vingers opgestoken`;
});

// --- Pinch zoom handling ---
onPinchAmountChange((distance) => {
  const scalingSession = getScalingSession();

  if (
    distance !== null &&
    scalingSession.active &&
    scalingSession.initialDistance
  ) {
    const scaleRatio = distance / scalingSession.initialDistance;
    const newScale = scalingSession.baseScale * scaleRatio;
    setZoom(newScale);
  }
});

// --- Shape selection handling ---
onShapeSelection((selectionData) => {
  const { type, fingerCount, shapeInfo } = selectionData;

  if (type === "preview") {
    showShapePreview(shapeInfo, fingerCount);
  } else if (type === "confirm" && shapeInfo) {
    hideShapePreview();
    selectShapeByValue(shapeInfo.value, shapeInfo.type);
  }
});

// --- Initialize the application ---
const initializeApp = () => {
  // Initialize CSS custom properties
  fakeCanvas.style.setProperty("--x", `${initialX}px`);
  fakeCanvas.style.setProperty("--y", `${initialY}px`);
  fakeCanvas.style.setProperty("--scale", initialScale);
  fakeCanvas.style.setProperty("--rotate", "0deg");

  // Initialize form labels
  storeFormLabels(document.querySelectorAll("form > label"));

  // Ensure preview is hidden initially
  previewSection.classList.remove("visible");
};

// Run initialization when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApp);
} else {
  initializeApp();
}
