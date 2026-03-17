const API_BASE = (typeof window !== "undefined" && window.API_BASE) ? window.API_BASE : "";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const ui = {
  playerHealth: document.getElementById("player-health"),
  demonTide: document.getElementById("demon-tide"),
  score: document.getElementById("score"),
  time: document.getElementById("time"),
  overlay: document.getElementById("overlay"),
  overlayTitle: document.getElementById("overlay-title"),
  overlayMessage: document.getElementById("overlay-message"),
  playerNameInput: document.getElementById("player-name-input"),
  saveScoreBtn: document.getElementById("save-score"),
  playAgainBtn: document.getElementById("play-again"),
  leaderboardList: document.getElementById("leaderboard-list")
};

// Debug helpers (enable by setting `window.DEBUG_PERF = true` in DevTools console, then refresh)
const DEBUG_PERF = typeof window !== "undefined" && !!window.DEBUG_PERF;
let debugPanel = null;
function ensureDebugPanel() {
  if (!DEBUG_PERF) return null;
  if (debugPanel) return debugPanel;
  const el = document.createElement("div");
  el.style.position = "fixed";
  el.style.left = "10px";
  el.style.top = "10px";
  el.style.zIndex = "99999";
  el.style.padding = "8px 10px";
  el.style.borderRadius = "8px";
  el.style.font = "12px/1.25 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
  el.style.color = "#f2f2f2";
  el.style.background = "rgba(0,0,0,0.65)";
  el.style.border = "1px solid rgba(255,255,255,0.12)";
  el.style.pointerEvents = "none";
  el.textContent = "debug init…";
  document.body.appendChild(el);
  debugPanel = el;
  return el;
}

const GAME_WIDTH = canvas.width;
const GAME_HEIGHT = canvas.height;

const ANIM_FPS = 20;
const ANIM_FRAME_DT = 1 / ANIM_FPS;

function animFrame(animTime, numFrames) {
  return Math.floor(animTime * ANIM_FPS) % Math.max(1, numFrames);
}

function getKnightFootYForState(state, frame) {
  const pelvisY = -12;
  const legLen = 15 + 14; // straight leg, no knee
  let legAngle = 0.06;
  if (state === "walk") {
    const phase = (frame % 4) / 4 * Math.PI * 2;
    legAngle = 0.35 * Math.sin(phase);
  } else if (state === "jump") {
    legAngle = 0.22;
  }
  return pelvisY + legLen * Math.cos(legAngle);
}

function getDemonFootY(frame, bodyScale, hunched) {
  const legLen = (14 + 14) * bodyScale;
  if (hunched) {
    const pelvisY = -3;
    const legAngle = 0.775;
    return pelvisY + legLen * Math.cos(legAngle);
  }
  const pelvisY = -11;
  const phase = (frame % 4) / 4 * Math.PI * 2;
  const legAngle = 0.36 * Math.sin(phase);
  return pelvisY + legLen * Math.cos(legAngle);
}

// Attack on Titan–style manga helpers: gritty linework, cross-hatch shadows
function drawInkShadow(ctx, centerX, centerY, radiusX, radiusY, opacity = 0.82) {
  ctx.save();
  ctx.fillStyle = `rgba(0, 0, 0, ${opacity})`;
  ctx.beginPath();
  ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCrossHatch(ctx, x, y, w, h, angle, spacing, strokeStyle = "rgba(0,0,0,0.5)", lineWidth = 0.8) {
  ctx.save();
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "butt";
  ctx.translate(x, y);
  ctx.rotate(angle);
  const len = Math.min(Math.max(w, h) * 1.5, 200);
  const step = Math.max(0.5, Number.isFinite(spacing) ? spacing : 3);
  const maxLines = 500;
  for (let n = 0, i = -len; n < maxLines && i <= len; i += step, n++) {
    ctx.beginPath();
    ctx.moveTo(i, -len);
    ctx.lineTo(i, len);
    ctx.stroke();
  }
  ctx.rotate(Math.PI / 2);
  for (let n = 0, i = -len; n < maxLines && i <= len; i += step, n++) {
    ctx.beginPath();
    ctx.moveTo(i, -len);
    ctx.lineTo(i, len);
    ctx.stroke();
  }
  ctx.restore();
}

function fillWithHatch(ctx, pathOrBounds, angle, spacing, strokeStyle = "#1a1a1a") {
  ctx.save();
  if (pathOrBounds && pathOrBounds.x != null) {
    const { x, y, w, h } = pathOrBounds;
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    drawCrossHatch(ctx, x, y, w, h, angle, spacing, strokeStyle);
  }
  ctx.restore();
}

function strokeMangaOutline(ctx, lineWidth = 3.5) {
  ctx.save();
  ctx.strokeStyle = "#0d0d0d";
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.restore();
}

function drawSpeedLines(ctx, count = 12) {
  const cx = GAME_WIDTH / 2;
  const cy = GAME_HEIGHT / 2;
  ctx.save();
  ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 0.7 + Math.PI * 0.15;
    const len = 80 + Math.random() * 120;
    const x2 = cx + Math.cos(angle) * len;
    const y2 = cy + Math.sin(angle) * len;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawLimb(ctx, x0, y0, x1, y1, thickness, stroke = "#0d0d0d") {
  ctx.save();
  ctx.strokeStyle = stroke;
  ctx.fillStyle = stroke;
  ctx.lineCap = "round";
  ctx.lineWidth = thickness;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.restore();
}

function drawCapsule(ctx, x0, y0, x1, y1, r0, r1, fillStyle, strokeStyle) {
  if (r1 == null) r1 = r0;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 0.001;
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;
  const x0L = x0 + px * r0, y0L = y0 + py * r0;
  const x0R = x0 - px * r0, y0R = y0 - py * r0;
  const x1L = x1 + px * r1, y1L = y1 + py * r1;
  const x1R = x1 - px * r1, y1R = y1 - py * r1;
  ctx.save();
  ctx.fillStyle = fillStyle;
  ctx.strokeStyle = strokeStyle || "#0a0a0c";
  ctx.lineWidth = 1.2;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x0L, y0L);
  ctx.lineTo(x1L, y1L);
  ctx.arc(x1, y1, r1, Math.atan2(py, px), Math.atan2(-py, -px));
  ctx.lineTo(x0R, y0R);
  ctx.arc(x0, y0, r0, Math.atan2(-py, -px), Math.atan2(py, px));
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// Side-view: character faces right (positive x = forward). One leg, one arm, profile body/helm.
function drawKnightHumanoid(ctx, state, frame, facing) {
  const ink = "#0a0a0c";
  const mailLit = "#6a6e72";
  const mailShadow = "#3a3e42";
  const surcoatLit = "#e8e4dc";
  const surcoatShadow = "#9a968e";
  const crossRed = "#8a2020";
  const crossDark = "#5a1414";
  const bladeLit = "#c8c6c2";
  const bladeShadow = "#404040";
  const bladeEdge = "#e8e6e4";
  const guardMetal = "#5a5a58";
  const gripColor = "#3c3428";
  const gripShadow = "#2a241c";
  const shieldLit = "#3a3835";
  const shieldShadow = "#1a1815";
  const helmLit = "#7a7e82";
  const helmShadow = "#4a4e52";

  const pelvisY = -12;
  const shoulderY = -34;
  const headY = -52;
  const thighLen = 15;
  const calfLen = 14;
  const upperArmLen = 12;
  const forearmLen = 13;
  const swordLen = 42;

  // Swing in front of crusader: wind-up behind then slash forward (positive x).
  const attackFrames = [
    { swordAngle: -0.35 },
    { swordAngle: 0.15 },
    { swordAngle: 0.55 },
    { swordAngle: 0.4 }
  ];

  // Straight legs, scissors motion (no knee)
  const phase = (frame % 4) / 4 * Math.PI * 2;
  const legAngle =
    state === "walk" ? 0.35 * Math.sin(phase) :
    state === "jump" ? 0.22 :
    0.06;
  const legLen = thighLen + calfLen;

  const swordAngle = state === "attack" ? attackFrames[Math.min(frame, 3)].swordAngle : state === "block" ? 0.4 : 0.12;
  const armA = state === "jump" ? -0.55 : state === "block" ? 0.25 : 0.1;

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const hipX = 2;
  // Front leg: straight from hip to foot
  const footX = hipX + legLen * Math.sin(legAngle);
  const footY = pelvisY + legLen * Math.cos(legAngle);
  // Back leg: straight, opposite angle (scissors)
  const backFootX = hipX - 3.2 + legLen * Math.sin(-legAngle);
  const backFootY = pelvisY + 1.5 + legLen * Math.cos(-legAngle);

  // back leg (straight, scissors)
  drawCapsule(ctx, hipX - 3.2, pelvisY + 1.5, backFootX, backFootY, 4.0, 3.2, mailShadow, ink);

  // front leg (straight, scissors)
  drawCapsule(ctx, hipX, pelvisY, footX, footY, 4.8, 2.9, mailLit, ink);
  ctx.fillStyle = mailShadow;
  ctx.beginPath();
  ctx.ellipse(footX, footY + 1.5, 3.5, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = ink;
  ctx.stroke();

  // mail texture (subtle rings)
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.lineWidth = 0.8;
  const yEnd = Number.isFinite(footY) ? footY + 2 : pelvisY + 20;
  for (let ny = 0, y = pelvisY - 2; ny < 25 && y <= yEnd; y += 3.2, ny++) {
    for (let nx = 0, x = -6; nx < 10 && x <= 12; x += 3.2, nx++) {
      ctx.beginPath();
      ctx.arc(x, y, 1.25, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();

  const backX = -6;
  // cape/surcoat mass with fold shading
  const clothGrad = ctx.createLinearGradient(backX, pelvisY, 16, shoulderY);
  clothGrad.addColorStop(0, surcoatShadow);
  clothGrad.addColorStop(0.6, surcoatLit);
  clothGrad.addColorStop(1, surcoatShadow);
  ctx.fillStyle = clothGrad;
  ctx.beginPath();
  ctx.moveTo(backX, pelvisY + 2);
  ctx.lineTo(backX + 4, pelvisY - 8);
  ctx.lineTo(backX + 8, shoulderY + 6);
  ctx.lineTo(backX + 10, headY + 8);
  ctx.lineTo(14, headY + 4);
  ctx.lineTo(12, shoulderY);
  ctx.lineTo(10, pelvisY);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.fillStyle = surcoatLit;
  ctx.beginPath();
  ctx.moveTo(backX + 2, pelvisY);
  ctx.lineTo(4, pelvisY - 6);
  ctx.lineTo(6, shoulderY + 4);
  ctx.lineTo(8, headY + 6);
  ctx.lineTo(12, headY + 2);
  ctx.lineTo(10, shoulderY + 2);
  ctx.lineTo(8, pelvisY - 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // cloth hatching shadow under arm/torso
  ctx.save();
  ctx.globalAlpha = 0.35;
  drawCrossHatch(ctx, backX + 1, shoulderY - 6, 18, 26, 0.65, 3.2, "rgba(0,0,0,0.35)", 0.7);
  ctx.restore();

  ctx.fillStyle = crossRed;
  ctx.strokeStyle = crossDark;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(7, shoulderY - 4);
  ctx.lineTo(7, pelvisY - 2);
  ctx.moveTo(5, shoulderY + 8);
  ctx.lineTo(9, shoulderY + 8);
  ctx.moveTo(5, pelvisY - 10);
  ctx.lineTo(9, pelvisY - 10);
  ctx.stroke();
  ctx.fillStyle = crossRed;
  ctx.fillRect(6, shoulderY + 6, 2, 6);
  ctx.fillRect(6, pelvisY - 12, 2, 6);

  const neckTop = headY - 6;
  drawCapsule(ctx, 8, shoulderY + 4, 9, neckTop, 2.2, 2.5, mailLit, ink);

  const helmBack = headY - 4;
  const helmFront = headY + 2;
  const helmW = 10;
  const helmH = 14;
  // great helm: steel specular + rim light
  const g = ctx.createLinearGradient(4, headY - 6, 16, headY + 6);
  g.addColorStop(0, helmShadow);
  g.addColorStop(0.35, helmLit);
  g.addColorStop(0.55, "#b9bdc0");
  g.addColorStop(1, helmShadow);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(9, headY, helmW / 2, helmH / 2, 0.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(7.2, headY - 2.8, 5.2, -1.3, 0.1);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = "rgba(0,0,0,0.85)";
  ctx.fillRect(10.5, headY - 2, 2, 4);
  ctx.strokeStyle = ink;
  ctx.strokeRect(10.5, headY - 2, 2, 4);

  // helm breathing holes
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  for (let i = 0; i < 4; i++) ctx.fillRect(11.2 + i * 0.7, headY + 2.2, 0.4, 0.6);
  ctx.restore();

  const shoulderX = 8;
  const elbowX = shoulderX + upperArmLen * Math.sin(armA);
  const elbowY = shoulderY + upperArmLen * Math.cos(armA);
  const handX = elbowX + forearmLen * Math.sin(swordAngle);
  const handY = elbowY + forearmLen * Math.cos(swordAngle);

  // back arm (depth)
  drawCapsule(ctx, shoulderX - 3.8, shoulderY + 2, elbowX - 3.4, elbowY + 2.6, 3.0, 2.6, mailShadow, ink);
  drawCapsule(ctx, elbowX - 3.4, elbowY + 2.6, handX - 3.0, handY + 2.8, 2.4, 1.8, mailShadow, ink);

  // front arm
  drawCapsule(ctx, shoulderX, shoulderY, elbowX, elbowY, 3.3, 2.9, mailLit, ink);
  drawCapsule(ctx, elbowX, elbowY, handX, handY, 2.7, 2.1, mailLit, ink);

  if (state === "block") {
    ctx.save();
    // Big body-covering shield on the facing side.
    ctx.translate(14, pelvisY - 20);
    ctx.rotate(-0.08);
    const sg = ctx.createLinearGradient(-14, 0, 14, 0);
    sg.addColorStop(0, shieldShadow);
    sg.addColorStop(1, shieldLit);
    ctx.fillStyle = sg;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    // Kite shield silhouette (covers most of torso/legs)
    ctx.moveTo(-12, -30);
    ctx.quadraticCurveTo(14, -22, 12, -4);
    ctx.quadraticCurveTo(10, 18, 0, 34);
    ctx.quadraticCurveTo(-10, 18, -12, -4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // rim highlight
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(-10, -24);
    ctx.quadraticCurveTo(10, -20, 10, -4);
    ctx.quadraticCurveTo(8, 16, 0, 30);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
  } else {
    const swordAngleTip = swordAngle - 0.04;
    const swordTipX = handX + swordLen * Math.sin(swordAngleTip);
    const swordTipY = handY + swordLen * Math.cos(swordAngleTip);

    // White crescent swing trail (attack only), drawn in front of the blade.
    // Use a thin filled ring-slice so it reads as a long sweeping crescent (not a thick bent stroke).
    if (state === "attack") {
      const arcRadiusOuter = swordLen * 1.22;
      const arcThickness = 3.0;
      const arcRadiusInner = Math.max(2, arcRadiusOuter - arcThickness);
      const arcStart = swordAngle - 0.95;
      const arcEnd = swordAngle + 0.22;
      ctx.save();
      ctx.translate(handX, handY);
      ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
      ctx.beginPath();
      ctx.arc(0, 0, arcRadiusOuter, arcStart, arcEnd);
      ctx.arc(0, 0, arcRadiusInner, arcEnd, arcStart, true);
      ctx.closePath();
      ctx.fill();
      // soft outer glow for readability
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
      ctx.beginPath();
      ctx.arc(0, 0, arcRadiusOuter + 2.2, arcStart, arcEnd);
      ctx.arc(0, 0, arcRadiusInner - 1.2, arcEnd, arcStart, true);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Crusader sword: cross guard, grip, long straight blade.
    const bladeW = 1.8;
    const guardLen = 10;
    const gripLen = 10;
    const bladeLen = swordLen - gripLen;
    const perpX = Math.cos(swordAngle);
    const perpY = -Math.sin(swordAngle);
    const guardTipX = handX + guardLen * 0.5 * perpX;
    const guardTipY = handY + guardLen * 0.5 * perpY;
    const guardBaseX = handX - guardLen * 0.5 * perpX;
    const guardBaseY = handY - guardLen * 0.5 * perpY;
    const gripEndX = handX + gripLen * Math.sin(swordAngle);
    const gripEndY = handY + gripLen * Math.cos(swordAngle);
    const bladeBaseX = gripEndX;
    const bladeBaseY = gripEndY;
    const bladeHalf = bladeW / 2;
    const bladeLeftX = bladeBaseX + perpX * bladeHalf;
    const bladeLeftY = bladeBaseY + perpY * bladeHalf;
    const bladeRightX = bladeBaseX - perpX * bladeHalf;
    const bladeRightY = bladeBaseY - perpY * bladeHalf;
    const tipLeftX = swordTipX + perpX * 0.6;
    const tipLeftY = swordTipY + perpY * 0.6;
    const tipRightX = swordTipX - perpX * 0.6;
    const tipRightY = swordTipY - perpY * 0.6;

    const bladeDirX = Math.sin(swordAngle);
    const bladeDirY = Math.cos(swordAngle);
    const guardThick = 1.2;
    const g1x = guardBaseX + bladeDirX * guardThick;
    const g1y = guardBaseY + bladeDirY * guardThick;
    const g2x = guardBaseX - bladeDirX * guardThick;
    const g2y = guardBaseY - bladeDirY * guardThick;
    const g3x = guardTipX - bladeDirX * guardThick;
    const g3y = guardTipY - bladeDirY * guardThick;
    const g4x = guardTipX + bladeDirX * guardThick;
    const g4y = guardTipY + bladeDirY * guardThick;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1;
    ctx.fillStyle = guardMetal;
    ctx.beginPath();
    ctx.moveTo(g1x, g1y);
    ctx.lineTo(g2x, g2y);
    ctx.lineTo(g3x, g3y);
    ctx.lineTo(g4x, g4y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    const gripGrad = ctx.createLinearGradient(handX, handY, gripEndX, gripEndY);
    gripGrad.addColorStop(0, gripShadow);
    gripGrad.addColorStop(0.5, gripColor);
    gripGrad.addColorStop(1, gripShadow);
    ctx.fillStyle = gripGrad;
    ctx.beginPath();
    ctx.moveTo(handX + perpX * 1.2, handY + perpY * 1.2);
    ctx.lineTo(handX - perpX * 1.2, handY - perpY * 1.2);
    ctx.lineTo(gripEndX - perpX * 1.2, gripEndY - perpY * 1.2);
    ctx.lineTo(gripEndX + perpX * 1.2, gripEndY + perpY * 1.2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    const bladeGrad = ctx.createLinearGradient(bladeBaseX, bladeBaseY, swordTipX, swordTipY);
    bladeGrad.addColorStop(0, bladeShadow);
    bladeGrad.addColorStop(0.2, bladeLit);
    bladeGrad.addColorStop(0.5, bladeEdge);
    bladeGrad.addColorStop(0.8, bladeLit);
    bladeGrad.addColorStop(1, bladeShadow);
    ctx.fillStyle = bladeGrad;
    ctx.beginPath();
    ctx.moveTo(bladeLeftX, bladeLeftY);
    ctx.lineTo(bladeRightX, bladeRightY);
    ctx.lineTo(tipRightX, tipRightY);
    ctx.lineTo(tipLeftX, tipLeftY);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
}

function drawFootSoldierDemon(ctx, state, frame, stunned, flash) {
  const ink = flash ? "#fff" : "#0a0a0c";
  const skinLit = flash ? "#fff" : "#c83830";
  const skinShadow = flash ? "#fff" : "#781818";
  const wingScale = 0.6;
  const hunched = state === "windup";
  drawDemonHumanoidBase(ctx, frame, ink, skinLit, skinShadow, 1, wingScale, 1, 0, undefined, hunched, flash);
}

function drawBrimstoneDemon(ctx, state, chargeTime, frame, flash) {
  const ink = flash ? "#fff" : "#0a0a0c";
  const skinLit = flash ? "#fff" : "#4a4038";
  const skinShadow = flash ? "#fff" : "#2a2218";
  const eyeGlow = flash ? "#fff" : "rgba(255, 60, 40, 0.95)";
  const bellyGlow = flash ? 0 : (chargeTime > 0 ? Math.min(1, chargeTime / 0.6) : 0);
  const hunched = state === "charge";
  drawDemonHumanoidBase(ctx, frame, ink, skinLit, skinShadow, 1, 1.4, 1, bellyGlow, eyeGlow, hunched, flash);
}

function drawVanguardDemon(ctx, state, chargeTime, frame, flash) {
  const ink = flash ? "#fff" : "#0a0a0c";
  const skinLit = flash ? "#fff" : "#8a5040";
  const skinShadow = flash ? "#fff" : "#4a2820";
  const eyeGlow = flash ? "#fff" : "rgba(255, 40, 30, 0.95)";
  const scale = 1.45;
  const hunched = state === "roar" || state === "windup_claw";
  // NOTE: do not double-scale: bodyScale already accounts for size
  drawDemonHumanoidBase(ctx, frame, ink, skinLit, skinShadow, scale, 0.5, 1.8, 0, eyeGlow, hunched, flash);
}

// Side-view demon: faces right (positive x = forward). One leg, one arm, profile head with horns, one wing, tail.
function drawDemonHumanoidBase(ctx, frame, ink, skinLit, skinShadow, bodyScale, wingScale, hornScale, bellyGlow, eyeGlow, hunched, flash) {
  const eyeGlowColor = eyeGlow || "rgba(40,38,36,0.9)";
  // Hunched pose is handled by adjusting the skeleton (not by translating the whole body down).
  const pelvisY = hunched ? -3 : -11;
  const shoulderY = hunched ? -20 : -30;
  const headY = hunched ? -35 : -46;
  const hipX = 2 * bodyScale;
  const thighLen = 14 * bodyScale;
  const calfLen = 14 * bodyScale;
  const armLen = 11 * bodyScale;
  const thighR = 4.2 * bodyScale;
  const calfRTop = 3.4 * bodyScale;
  const calfRBottom = 2.6 * bodyScale;
  const armR = 3 * bodyScale;
  const wristR = 2.2 * bodyScale;

  // Straight legs, scissors motion (no knee)
  let legAngle;
  let armA;
  if (hunched) {
    // Crouch: legs angled out so the back can drop without sinking into the ground.
    legAngle = 0.775;
    armA = 0.35;
  } else {
    const phase = (frame % 4) / 4 * Math.PI * 2;
    legAngle = 0.36 * Math.sin(phase);
    armA = -0.22 * Math.sin(phase + Math.PI);
  }
  const legLen = thighLen + calfLen;
  const footX = hipX + legLen * Math.sin(legAngle);
  const footY = pelvisY + legLen * Math.cos(legAngle);
  const backFootX = hipX - 3.4 * bodyScale + legLen * Math.sin(-legAngle);
  const backFootY = pelvisY + 1.4 * bodyScale + legLen * Math.cos(-legAngle);

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const backX = -6 * bodyScale;
  // silhouette shadow pass (adds weight)
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = "rgba(0,0,0,0.8)";
  ctx.beginPath();
  ctx.ellipse(4 * bodyScale, pelvisY - 14, 14 * bodyScale, 22 * bodyScale, -0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = skinShadow;
  ctx.beginPath();
  ctx.moveTo(backX, pelvisY + 2);
  ctx.lineTo(backX + 3, pelvisY - 6);
  ctx.lineTo(backX + 6, shoulderY + 5);
  ctx.lineTo(backX + 7, headY + 6);
  ctx.lineTo(12 * bodyScale, headY + 3);
  ctx.lineTo(10 * bodyScale, shoulderY + 2);
  ctx.lineTo(8 * bodyScale, pelvisY);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // muscle shading hatch
  ctx.save();
  ctx.globalAlpha = 0.35;
  drawCrossHatch(ctx, backX + 1, shoulderY - 4, 20 * bodyScale, 30 * bodyScale, 0.7, 3.0, "rgba(0,0,0,0.35)", 0.7);
  ctx.restore();

  ctx.fillStyle = skinLit;
  ctx.beginPath();
  ctx.moveTo(backX + 2, pelvisY);
  ctx.lineTo(3 * bodyScale, pelvisY - 4);
  ctx.lineTo(5 * bodyScale, shoulderY + 4);
  ctx.lineTo(6 * bodyScale, headY + 4);
  ctx.lineTo(10 * bodyScale, headY + 2);
  ctx.lineTo(8 * bodyScale, shoulderY + 2);
  ctx.lineTo(6 * bodyScale, pelvisY - 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  if (bellyGlow > 0) {
    ctx.save();
    const g = ctx.createRadialGradient(4 * bodyScale, pelvisY - 6, 0, 4 * bodyScale, pelvisY - 6, 12);
    g.addColorStop(0, `rgba(255, 80, 40, ${0.6 * bellyGlow})`);
    g.addColorStop(0.6, `rgba(200, 40, 20, ${0.3 * bellyGlow})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(4 * bodyScale, pelvisY - 4, 5, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // back leg (straight, scissors)
  drawCapsule(ctx, hipX - 3.4 * bodyScale, pelvisY + 1.4 * bodyScale, backFootX, backFootY, thighR * 0.95, calfRBottom * 0.85, skinShadow, ink);

  // front leg (straight, scissors)
  drawCapsule(ctx, hipX, pelvisY, footX, footY, thighR, calfRBottom, skinLit, ink);
  ctx.fillStyle = skinShadow;
  ctx.beginPath();
  ctx.ellipse(footX, footY + 1.2, 3 * bodyScale, 1.8 * bodyScale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = ink;
  ctx.stroke();

  // claws
  ctx.save();
  ctx.fillStyle = ink;
  ctx.globalAlpha = 0.9;
  for (let i = 0; i < 3; i++) {
    const cx = footX + (1.2 + i * 0.9) * bodyScale;
    const cy = footY + (0.6 + i * 0.1) * bodyScale;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + 2.2 * bodyScale, cy - 0.6 * bodyScale);
    ctx.lineTo(cx + 1.1 * bodyScale, cy + 0.9 * bodyScale);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  const tailLen = 14 * bodyScale;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 2 * bodyScale;
  ctx.beginPath();
  ctx.moveTo(backX + 1, pelvisY - 4);
  ctx.quadraticCurveTo(backX - 6, pelvisY + 4, backX - tailLen * 0.6, pelvisY + tailLen * 0.5);
  ctx.stroke();
  // tail spike
  ctx.save();
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.moveTo(backX - tailLen * 0.6, pelvisY + tailLen * 0.5);
  ctx.lineTo(backX - tailLen * 0.6 - 3 * bodyScale, pelvisY + tailLen * 0.5 + 1.5 * bodyScale);
  ctx.lineTo(backX - tailLen * 0.6 - 1.2 * bodyScale, pelvisY + tailLen * 0.5 - 2.8 * bodyScale);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  const neckTop = headY - 5;
  drawCapsule(ctx, 6 * bodyScale, shoulderY + 4, 7 * bodyScale, neckTop, 2.2 * bodyScale, 2.6 * bodyScale, skinLit, ink);

  const headW = 10 * bodyScale;
  const headH = 11 * bodyScale;
  ctx.fillStyle = skinLit;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(7.5 * bodyScale, headY, headW / 2, headH / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  const eyeX = 8.5 * bodyScale;
  const eyeY = headY - 1.5;
  ctx.fillStyle = flash ? skinLit : "rgba(255,252,248,0.4)";
  ctx.beginPath();
  ctx.ellipse(eyeX, eyeY, 2.5, 2.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = ink;
  ctx.stroke();
  ctx.fillStyle = flash ? skinLit : eyeGlowColor;
  ctx.beginPath();
  ctx.ellipse(eyeX, eyeY, 1.6, 1.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // eye bloom
  if (!flash && eyeGlow) {
    ctx.save();
    ctx.globalAlpha = 0.35;
    const eg = ctx.createRadialGradient(eyeX, eyeY, 0, eyeX, eyeY, 10 * bodyScale);
    eg.addColorStop(0, eyeGlowColor);
    eg.addColorStop(1, "rgba(255,0,0,0)");
    ctx.fillStyle = eg;
    ctx.beginPath();
    ctx.ellipse(eyeX + 2 * bodyScale, eyeY, 10 * bodyScale, 7 * bodyScale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.fillStyle = flash ? skinLit : "#1a1815";
  ctx.beginPath();
  ctx.moveTo(6 * bodyScale, headY + 3);
  ctx.quadraticCurveTo(8 * bodyScale, headY + 10, 10 * bodyScale, headY + 3);
  ctx.lineTo(10 * bodyScale, headY + 5);
  ctx.quadraticCurveTo(8 * bodyScale, headY + 14, 6 * bodyScale, headY + 5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // teeth (all demons)
  if (!flash) {
    ctx.save();
    ctx.fillStyle = "rgba(255, 245, 230, 0.9)";
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const tx = (7.0 + i * 1.25) * bodyScale;
      const ty = headY + 6.4 + i * 0.35;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx + 0.9 * bodyScale, ty + 2.4 * bodyScale);
      ctx.lineTo(tx - 0.9 * bodyScale, ty + 2.3 * bodyScale);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  if (!flash && hornScale > 1.4) {
    ctx.save();
    ctx.fillStyle = "rgba(255, 245, 230, 0.9)";
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const tx = (7.1 + i * 1.2) * bodyScale;
      const ty = headY + 6 + i * 0.4;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx + 0.8 * bodyScale, ty + 2.2 * bodyScale);
      ctx.lineTo(tx - 0.8 * bodyScale, ty + 2.1 * bodyScale);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  const hornLen = 10 * hornScale;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.8 * hornScale;
  ctx.beginPath();
  ctx.moveTo(5 * bodyScale, headY - 4);
  ctx.lineTo(3 * bodyScale - hornLen * 0.4, headY - 10 - hornLen);
  ctx.moveTo(10 * bodyScale, headY - 3);
  ctx.lineTo(11 * bodyScale + hornLen * 0.3, headY - 8 - hornLen * 0.8);
  ctx.stroke();

  const shoulderX = 7 * bodyScale;
  const elbowX = shoulderX + armLen * Math.sin(armA);
  const elbowY = shoulderY + armLen * Math.cos(armA);
  const handX = elbowX + armLen * 0.85 * Math.sin(armA + 0.15);
  const handY = elbowY + armLen * 0.85 * Math.cos(armA + 0.15);
  drawCapsule(ctx, shoulderX, shoulderY, elbowX, elbowY, armR, armR * 0.9, skinLit, ink);
  drawCapsule(ctx, elbowX, elbowY, handX, handY, wristR, wristR * 0.7, skinLit, ink);
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.moveTo(handX + 2, handY);
  ctx.lineTo(handX + 3.5, handY - 1.5);
  ctx.lineTo(handX + 3, handY + 1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  const wingSpan = 18 * wingScale;
  // wing with membrane fill
  ctx.save();
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.6;
  ctx.fillStyle = flash ? skinLit : "rgba(0,0,0,0.22)";
  ctx.beginPath();
  ctx.moveTo(backX + 4, shoulderY - 2);
  ctx.quadraticCurveTo(backX - wingSpan, shoulderY - 12, backX - wingSpan * 0.55, shoulderY + 7);
  ctx.quadraticCurveTo(backX - wingSpan * 0.1, shoulderY + 4, backX + 4, shoulderY - 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.globalAlpha = 0.3;
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(backX + 2, shoulderY - 2 + i * 2.4);
    ctx.quadraticCurveTo(backX - wingSpan * 0.55, shoulderY - 8 + i * 1.8, backX - wingSpan * 0.22, shoulderY + 7);
    ctx.stroke();
  }
  ctx.restore();

}

const keys = {
  left: false,
  right: false,
  up: false,
  keyW: false,
  space: false,
  attack: false,
  block: false
};

const GAME_KEY_CODES = ["KeyA", "KeyD", "KeyW", "Space", "KeyJ", "KeyK"];

function isGameKey(code) {
  return GAME_KEY_CODES.includes(code);
}

function isTypingInOverlay() {
  const overlay = ui.overlay;
  if (!overlay || overlay.classList.contains("hidden")) return false;
  const el = document.activeElement;
  return el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA");
}

function isTypingInTitleInput() {
  const el = document.activeElement;
  if (!el || (el.tagName !== "INPUT" && el.tagName !== "TEXTAREA")) return false;
  const titleEl = document.getElementById("title-screen");
  return titleEl && titleEl.contains(el);
}

window.addEventListener("keydown", e => {
  if (isTypingInOverlay()) return;
  if (isTypingInTitleInput()) return;
  if (isGameKey(e.code)) e.preventDefault();

  if (e.code === "KeyA") keys.left = true;
  if (e.code === "KeyD") keys.right = true;
  if (e.code === "KeyW") { keys.keyW = true; keys.up = true; }
  if (e.code === "Space") { keys.space = true; keys.up = true; }
  if (e.code === "KeyJ") keys.attack = true;
  if (e.code === "KeyK") keys.block = true;
});

window.addEventListener("keyup", e => {
  if (isTypingInOverlay()) return;
  if (isTypingInTitleInput()) return;
  if (isGameKey(e.code)) e.preventDefault();

  if (e.code === "KeyA") keys.left = false;
  if (e.code === "KeyD") keys.right = false;
  if (e.code === "KeyW") { keys.keyW = false; keys.up = keys.space; }
  if (e.code === "Space") { keys.space = false; keys.up = keys.keyW; }
  if (e.code === "KeyJ") keys.attack = false;
  if (e.code === "KeyK") keys.block = false;
});

class Entity {
  constructor(x, y, w, h) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
  }

  get left() {
    return this.x;
  }
  get right() {
    return this.x + this.w;
  }
  get top() {
    return this.y;
  }
  get bottom() {
    return this.y + this.h;
  }
}

class Knight extends Entity {
  constructor() {
    const w = 38;
    const h = 68;
    super(120, GAME_HEIGHT - h - 40, w, h);
    this.maxHealth = 100;
    this.health = this.maxHealth;
    this.facing = 1;
    this.attackCooldown = 0;
    this.blocking = false;
    this.invulnTime = 0;
    this.score = 0;
    this.animTime = 0;
    this.deathAnimTime = 0;
    this.stunTime = 0;
  }

  getState() {
    if (this.deathAnimTime > 0) return "death";
    if (this.stunTime > 0) return "block";
    if (this.blocking) return "block";
    if (this.attackCooldown > 0.05) return "attack";
    if (!this.onGround) return "jump";
    if (Math.abs(this.vx) > 20) return "walk";
    return "idle";
  }

  update(dt, demons) {
    if (this.deathAnimTime > 0) {
      this.deathAnimTime -= dt;
      this.animTime += dt;
      return;
    }
    if (this.stunTime > 0) {
      this.stunTime -= dt;
      this.vx *= 0.85;
      this.animTime += dt;
      return;
    }
    const accel = 750;
    const maxSpeed = 260;
    const jumpVelocity = -430;
    const gravity = 1150;

    if (keys.left) this.vx -= accel * dt;
    if (keys.right) this.vx += accel * dt;
    if (!keys.left && !keys.right) this.vx *= 0.8;

    if (this.vx > maxSpeed) this.vx = maxSpeed;
    if (this.vx < -maxSpeed) this.vx = -maxSpeed;

    if (this.vx > 10) this.facing = 1;
    else if (this.vx < -10) this.facing = -1;

    if (keys.up && this.onGround) {
      this.vy = jumpVelocity;
      this.onGround = false;
    }

    this.vy += gravity * dt;

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    const groundY = GROUND_Y;
    if (this.bottom >= groundY) {
      this.y = groundY - this.h;
      this.vy = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }

    if (this.left < 40) {
      this.x = 40;
      this.vx = 0;
    }
    if (this.right > GAME_WIDTH - 40) {
      this.x = GAME_WIDTH - 40 - this.w;
      this.vx = 0;
    }

    this.blocking = keys.block;

    if (this.attackCooldown > 0) this.attackCooldown -= dt;
    if (this.invulnTime > 0) this.invulnTime -= dt;

    if (keys.attack && this.attackCooldown <= 0) {
      this.performAttack(demons);
      this.attackCooldown = 0.45;
    }

    this.animTime += dt;
  }

  performAttack(demons) {
    const reach = 64;
    const hitX = this.facing === 1 ? this.right : this.left - reach;
    const hitY = this.top + 10;
    const hitW = reach;
    const hitH = this.h - 20;
    const hitbox = {
      left: hitX,
      right: hitX + hitW,
      top: hitY,
      bottom: hitY + hitH
    };
    const swordDamage = 5;
    const knightCenterX = this.x + this.w / 2;

    demons.forEach(demon => {
      if (!demon.alive) return;
      if (rectsOverlap(hitbox, demon)) {
        demon.takeHit(swordDamage, knightCenterX);
        this.score += 25;
      }
    });
  }

  takeHit(damage, game) {
    if (this.invulnTime > 0) return;
    if (this.deathAnimTime > 0) return;
    let finalDamage = damage;
    if (this.blocking) {
      finalDamage = Math.round(damage * 0.35);
    }
    this.health -= finalDamage;
    if (this.health < 0) this.health = 0;
    if (this.health <= 0) this.deathAnimTime = KNIGHT_DEATH_DURATION;
    else this.invulnTime = 0.8;
    if (game && typeof game.crusaderHurtUntil !== "undefined") game.crusaderHurtUntil = game.time + 1.5;
  }

  draw(ctx) {
    const groundY = GROUND_Y;
    const shadowY = groundY - 4;
    const centerX = this.x + this.w / 2;

    ctx.save();
    drawInkShadow(ctx, centerX, shadowY, this.w * 0.55, 14, 0.68);
    ctx.restore();

    const dying = this.deathAnimTime > 0;
    const deathProgress = dying ? 1 - this.deathAnimTime / KNIGHT_DEATH_DURATION : 0;

    const state = this.getState();
    let frame = 0;
    if (state === "death") {
      frame = 0;
    } else if (state === "attack") {
      const attackProgress = Math.max(0, 0.45 - this.attackCooldown);
      frame = Math.min(3, Math.floor(attackProgress * ANIM_FPS));
    } else if (state === "walk") {
      frame = animFrame(this.animTime, 4);
    } else if (state === "jump") {
      frame = this.vy < 0 ? 0 : 1;
    } else if (state === "block") {
      frame = animFrame(this.animTime, 2);
    } else {
      frame = animFrame(this.animTime, 2);
    }

    const footYLocal = getKnightFootYForState(state === "death" ? "idle" : state, frame);
    ctx.save();
    ctx.translate(this.x + this.w / 2, groundY - footYLocal);
    ctx.scale(this.facing, 1);

    if (dying) {
      ctx.translate(0, deathProgress * 28);
      ctx.rotate(deathProgress * 0.95);
      ctx.globalAlpha = 1 - deathProgress * 0.5;
    }

    if (this.invulnTime > 0 && !dying && Math.floor(this.invulnTime * 20) % 2 === 0) {
      ctx.globalAlpha = 0.4;
    }

    drawKnightHumanoid(ctx, state === "death" ? "idle" : state, frame, this.facing);

    if (this.stunTime > 0 && !dying) {
      ctx.save();
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = "rgba(100, 140, 255, 0.55)";
      ctx.beginPath();
      ctx.ellipse(0, -this.h / 2 - 2, this.w / 2 + 6, this.h / 2 + 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }
}

const DEMON_TYPES = { FOOT: "footsoldier", BRIMSTONE: "brimstone", VANGUARD: "vanguard" };

const CAMPAIGN_STAGES = [
  {
    title: "The Road to Jerusalem",
    waves: [
      [{ type: DEMON_TYPES.FOOT, delay: 0 }],
      [{ type: DEMON_TYPES.FOOT, delay: 0 }, { type: DEMON_TYPES.BRIMSTONE, delay: 2 }],
      [
        { type: DEMON_TYPES.FOOT, delay: 0 },
        { type: DEMON_TYPES.FOOT, delay: 1.3 },
        { type: DEMON_TYPES.BRIMSTONE, delay: 3 },
        { type: DEMON_TYPES.BRIMSTONE, delay: 5 }
      ]
    ]
  },
  {
    title: "The Gate of Jerusalem",
    waves: [
      [
        { type: DEMON_TYPES.FOOT, delay: 0 },
        { type: DEMON_TYPES.FOOT, delay: 1 },
        { type: DEMON_TYPES.FOOT, delay: 2 },
        { type: DEMON_TYPES.FOOT, delay: 3 },
        { type: DEMON_TYPES.BRIMSTONE, delay: 4.5 }
      ],
      [
        { type: DEMON_TYPES.FOOT, delay: 0 },
        { type: DEMON_TYPES.FOOT, delay: 1 },
        { type: DEMON_TYPES.FOOT, delay: 2 },
        { type: DEMON_TYPES.FOOT, delay: 3 },
        { type: DEMON_TYPES.FOOT, delay: 4 },
        { type: DEMON_TYPES.FOOT, delay: 5 },
        { type: DEMON_TYPES.BRIMSTONE, delay: 3.5 },
        { type: DEMON_TYPES.BRIMSTONE, delay: 6 }
      ],
      [
        { type: DEMON_TYPES.FOOT, delay: 0 },
        { type: DEMON_TYPES.FOOT, delay: 1.2 },
        { type: DEMON_TYPES.FOOT, delay: 2.4 },
        { type: DEMON_TYPES.FOOT, delay: 3.6 },
        { type: DEMON_TYPES.FOOT, delay: 4.8 },
        { type: DEMON_TYPES.BRIMSTONE, delay: 4 },
        { type: DEMON_TYPES.BRIMSTONE, delay: 6 },
        { type: DEMON_TYPES.VANGUARD, delay: 8 }
      ]
    ]
  },
  {
    title: "Inside the Holy Sepulcher",
    waves: [
      [
        { type: DEMON_TYPES.FOOT, delay: 0 },
        { type: DEMON_TYPES.FOOT, delay: 0.8 },
        { type: DEMON_TYPES.FOOT, delay: 1.6 },
        { type: DEMON_TYPES.FOOT, delay: 2.4 },
        { type: DEMON_TYPES.FOOT, delay: 3.2 },
        { type: DEMON_TYPES.FOOT, delay: 4 },
        { type: DEMON_TYPES.FOOT, delay: 4.8 },
        { type: DEMON_TYPES.BRIMSTONE, delay: 4 },
        { type: DEMON_TYPES.BRIMSTONE, delay: 5.5 }
      ],
      [
        { type: DEMON_TYPES.FOOT, delay: 0 },
        { type: DEMON_TYPES.FOOT, delay: 0.9 },
        { type: DEMON_TYPES.FOOT, delay: 1.8 },
        { type: DEMON_TYPES.FOOT, delay: 2.7 },
        { type: DEMON_TYPES.FOOT, delay: 3.6 },
        { type: DEMON_TYPES.FOOT, delay: 4.5 },
        { type: DEMON_TYPES.FOOT, delay: 5.4 },
        { type: DEMON_TYPES.FOOT, delay: 6.3 },
        { type: DEMON_TYPES.FOOT, delay: 7.2 },
        { type: DEMON_TYPES.FOOT, delay: 8.1 },
        { type: DEMON_TYPES.BRIMSTONE, delay: 6 },
        { type: DEMON_TYPES.BRIMSTONE, delay: 8 },
        { type: DEMON_TYPES.VANGUARD, delay: 10 }
      ],
      [
        { type: DEMON_TYPES.FOOT, delay: 0 },
        { type: DEMON_TYPES.FOOT, delay: 1.2 },
        { type: DEMON_TYPES.FOOT, delay: 2.4 },
        { type: DEMON_TYPES.FOOT, delay: 3.6 },
        { type: DEMON_TYPES.FOOT, delay: 4.8 },
        { type: DEMON_TYPES.FOOT, delay: 6 },
        { type: DEMON_TYPES.BRIMSTONE, delay: 5 },
        { type: DEMON_TYPES.BRIMSTONE, delay: 7 },
        { type: DEMON_TYPES.VANGUARD, delay: 7 },
        { type: DEMON_TYPES.VANGUARD, delay: 8.5 },
        { type: DEMON_TYPES.VANGUARD, delay: 10 }
      ]
    ]
  }
];

const GROUND_Y = GAME_HEIGHT - 40;
const ARENA_LEFT = 60;
const ARENA_RIGHT = GAME_WIDTH - 60;
const STUN_KNOCKBACK_SPEED = 280;
const STUN_DURATION = 0.5;
const DEMON_FLASH_DURATION = 0.12;
const DEMON_DEATH_DURATION = 0.45;
const KNIGHT_DEATH_DURATION = 1.0;
const BRIMSTONE_BARRAGE_MIN_INTERVAL = 5.0;
const BRIMSTONE_BARRAGE_MAX_INTERVAL = 8.0;
const BRIMSTONE_BARRAGE_SHOTS = 3;
const BRIMSTONE_BARRAGE_SHOT_GAP = 0.18;
const VANGUARD_SLAM_SCAR_DURATION = 1.0;
const SHOCKWAVE_DURATION = 0.35;
const KNIGHT_STUN_DURATION = 1.0;
const DIRT_GRAVITY = 980;

class Demon extends Entity {
  constructor(x, level, type) {
    const stats = getDemonStats(type);
    const w = stats.w;
    const h = stats.h;
    super(x, GROUND_Y - h, w, h);
    this.type = type;
    this.level = level;
    this.maxHealth = stats.maxHealth;
    this.health = stats.maxHealth;
    this.alive = true;
    this.animTime = 0;
    this.facing = x < GAME_WIDTH / 2 ? 1 : -1;
    this.attackCooldown = 0;
    this.stunTime = 0;
    this.speed = stats.speed;
    this.damage = stats.damage;
    this.ramDamage = stats.ramDamage != null ? stats.ramDamage : stats.damage;
    this.meleeDamage = stats.meleeDamage != null ? stats.meleeDamage : stats.damage;
    this.state = stats.initialState || "approach";
    this.stateTime = 0;
    this.chargeTime = 0;
    this.hasRammed = false;
    this.edgeX = x < GAME_WIDTH / 2 ? ARENA_LEFT : ARENA_RIGHT;
    this.flashUntil = 0;
    this.deathAnimTime = 0;
    this.standHold = 0;
    this.barrageCooldown = BRIMSTONE_BARRAGE_MIN_INTERVAL + Math.random() * (BRIMSTONE_BARRAGE_MAX_INTERVAL - BRIMSTONE_BARRAGE_MIN_INTERVAL);
    this.barrageShotsLeft = 0;
    this.barrageShotTimer = 0;
    this.retreatTime = 0;
  }

  takeHit(damage, knightCenterX) {
    if (!this.alive) return;
    this.health -= damage;
    this.flashUntil = DEMON_FLASH_DURATION;
    if (this.health <= 0) {
      this.state = "dying";
      this.deathAnimTime = 0;
      return;
    }
    if (this.type === DEMON_TYPES.FOOT || this.type === DEMON_TYPES.BRIMSTONE) {
      this.stunTime = STUN_DURATION;
      const myCenterX = this.x + this.w / 2;
      this.vx = Math.sign(myCenterX - knightCenterX) * STUN_KNOCKBACK_SPEED;
    }
  }

  update(dt, knight, game) {
    if (!this.alive) return;

    this.animTime += dt;
    const groundY = GROUND_Y;
    this.y = groundY - this.h;

    if (this.state === "dying") {
      this.deathAnimTime += dt;
      if (this.deathAnimTime >= DEMON_DEATH_DURATION) this.alive = false;
      return;
    }

    if (this.flashUntil > 0) this.flashUntil -= dt;
    if (this.stunTime > 0) {
      this.stunTime -= dt;
      this.x += this.vx * dt;
      this.vx *= 0.92;
      if (this.x < ARENA_LEFT) this.x = ARENA_LEFT;
      if (this.x > ARENA_RIGHT - this.w) this.x = ARENA_RIGHT - this.w;
      return;
    }

    const knightCenterX = knight.x + knight.w / 2;
    const myCenterX = this.x + this.w / 2;
    const distToKnight = Math.abs(myCenterX - knightCenterX);
    if (game && game.crusaderHurtUntil > game.time && this.retreatTime <= 0 && distToKnight < 180) {
      this.retreatTime = 1.5;
    }
    const RETREAT_SPEED = 38;
    if (this.retreatTime > 0) {
      this.retreatTime -= dt;
      this.facing = knightCenterX > myCenterX ? 1 : -1;
      this.vx = -this.facing * RETREAT_SPEED;
    } else {
      this.facing = knight.x < myCenterX ? -1 : 1;
      if (this.type === DEMON_TYPES.FOOT) {
        this.updateFootSoldier(dt, knight);
      } else if (this.type === DEMON_TYPES.BRIMSTONE) {
        this.updateBrimstone(dt, knight, game);
      } else if (this.type === DEMON_TYPES.VANGUARD) {
        this.updateVanguard(dt, knight, game);
      }
    }

    this.x += this.vx * dt;
    if (this.x < ARENA_LEFT) this.x = ARENA_LEFT;
    if (this.x > ARENA_RIGHT - this.w) this.x = ARENA_RIGHT - this.w;
  }

  updateFootSoldier(dt, knight) {
    const approachSpeed = this.speed;
    const plungeSpeed = 420;
    const standDuration = 0.35;
    const windupDuration = 0.45;
    const plungeDuration = 0.25;

    if (this.state === "approach") {
      const dist = Math.abs((this.x + this.w / 2) - knight.x);
      if (dist < 90) {
        this.state = "stand";
        this.stateTime = 0;
        this.vx = 0;
        this.standHold = 0.5 + Math.random() * 1.5;
      } else {
        this.vx = this.facing * approachSpeed;
      }
    } else if (this.state === "stand") {
      this.vx = 0;
      this.stateTime += dt;
      if (this.stateTime >= standDuration + (this.standHold || 0)) {
        this.state = "windup";
        this.stateTime = 0;
      }
    } else if (this.state === "windup") {
      this.vx = 0;
      this.stateTime += dt;
      if (this.stateTime >= windupDuration) {
        this.state = "plunge";
        this.stateTime = 0;
        this.vx = this.facing * plungeSpeed;
      }
    } else if (this.state === "plunge") {
      this.stateTime += dt;
      if (this.stateTime >= plungeDuration) {
        this.vx = 0;
        this.state = "approach";
      }
      if (rectsOverlap(this, knight) && this.attackCooldown <= 0) {
        if (knight.blocking) {
          knight.x += this.facing * 16;
          if (knight.left < 40) knight.x = 40;
          if (knight.right > GAME_WIDTH - 40) knight.x = GAME_WIDTH - 40 - knight.w;
          const midX = (this.x + this.w / 2 + knight.x + knight.w / 2) / 2;
          const midY = GROUND_Y - 24;
          if (game && typeof game.spawnShockwave === "function") game.spawnShockwave(midX, midY);
        } else {
          knight.takeHit(this.damage, game);
        }
        this.attackCooldown = 0.9;
      }
    }

    if (this.attackCooldown > 0) this.attackCooldown -= dt;
  }

  updateBrimstone(dt, knight, game) {
    const walkSpeed = 35;
    const chargeDuration = 0.8;

    this.vx = 0;
    const centerX = this.x + this.w / 2;
    const distToEdge = Math.abs(centerX - this.edgeX);
    if (distToEdge > 15) {
      this.vx = Math.sign(this.edgeX - centerX) * walkSpeed;
    }

    if (this.state === "idle") {
      this.barrageCooldown -= dt;
      if (this.barrageCooldown <= 0) {
        this.state = "charge";
        this.stateTime = 0;
        this.chargeTime = 0;
      }
    } else if (this.state === "charge") {
      this.chargeTime += dt;
      this.stateTime += dt;
      if (this.stateTime >= chargeDuration) {
        this.state = "barrage";
        this.barrageShotsLeft = BRIMSTONE_BARRAGE_SHOTS;
        this.barrageShotTimer = 0;
        this.stateTime = 0;
      }
    } else if (this.state === "barrage") {
      this.vx = 0;
      this.barrageShotTimer -= dt;
      if (this.barrageShotTimer <= 0 && this.barrageShotsLeft > 0) {
        this.fireFlame(knight, game, this.barrageShotsLeft);
        this.barrageShotsLeft--;
        this.barrageShotTimer = BRIMSTONE_BARRAGE_SHOT_GAP;
      }
      if (this.barrageShotsLeft <= 0) {
        this.state = "idle";
        this.chargeTime = 0;
        this.barrageCooldown = BRIMSTONE_BARRAGE_MIN_INTERVAL + Math.random() * (BRIMSTONE_BARRAGE_MAX_INTERVAL - BRIMSTONE_BARRAGE_MIN_INTERVAL);
      }
    }
  }

  fireFlame(knight, game, shotIndex = 1) {
    const cx = this.x + this.w / 2;
    const cy = this.y + this.h / 2;
    const dx = knight.x + knight.w / 2 - cx;
    const dy = knight.y + knight.h / 2 - cy;
    const len = Math.hypot(dx, dy) || 1;
    const speed = 320;
    const spread = (Math.random() - 0.5) * 0.12 + (shotIndex - 2) * 0.06;
    const ndx = dx / len;
    const ndy = dy / len;
    const ang = Math.atan2(ndy, ndx) + spread;
    const vx = Math.cos(ang) * speed;
    const vy = Math.sin(ang) * speed;
    game.projectiles.push({
      x: cx,
      y: cy,
      vx,
      vy,
      damage: 8,
      w: 14,
      h: 14,
      life: 1.5,
      t: 0,
      kind: "fire"
    });
  }

  updateVanguard(dt, knight, game) {
    const walkSpeed = 28;
    const roarDuration = 2.5;
    const ramSpeed = 380;
    const ramDuration = 0.6;

    if (this.state === "roar") {
      this.vx = 0;
      this.stateTime += dt;
      this.chargeTime += dt;
      if (this.stateTime >= roarDuration) {
        this.state = "ram";
        this.stateTime = 0;
        this.vx = this.facing * ramSpeed;
      }
    } else if (this.state === "ram") {
      this.stateTime += dt;
      if (this.stateTime >= ramDuration) {
        this.vx = 0;
        this.hasRammed = true;
        this.state = "approach";
      }
      if (rectsOverlap(this, knight)) {
        knight.takeHit(this.ramDamage, game);
        this.vx = 0;
        this.state = "approach";
      }
    } else if (this.state === "windup_claw") {
      this.vx = 0;
      this.stateTime += dt;
      this.chargeTime += dt;
      if (this.stateTime >= 2.0) {
        this.doVanguardSlam(knight, game);
        this.attackCooldown = 1.2;
        this.state = "approach";
        this.chargeTime = 0;
      }
    } else if (this.state === "approach") {
      const dist = Math.abs((this.x + this.w / 2) - (knight.x + knight.w / 2));
      if (dist < 70 && this.attackCooldown <= 0) {
        this.state = "windup_claw";
        this.stateTime = 0;
        this.chargeTime = 0;
        this.vx = 0;
      } else {
        this.vx = this.facing * walkSpeed;
      }
    }

    if (this.attackCooldown > 0) this.attackCooldown -= dt;
  }

  doVanguardSlam(knight, game) {
    const impactX = this.x + this.w / 2 + this.facing * 68;
    const slamRect = {
      left: impactX - 55,
      right: impactX + 55,
      top: GROUND_Y - 46,
      bottom: GROUND_Y
    };
    const kRect = { left: knight.left, right: knight.right, top: knight.top, bottom: knight.bottom };
    if (rectsOverlap(slamRect, kRect)) {
      if (knight.blocking) {
        knight.stunTime = KNIGHT_STUN_DURATION;
      } else {
        knight.takeHit(this.meleeDamage, game);
      }
    }
    if (game && typeof game.spawnDirtBurst === "function") game.spawnDirtBurst(impactX, GROUND_Y - 6, this.facing);
    if (game && typeof game.spawnGroundScar === "function") game.spawnGroundScar(impactX, GROUND_Y - 5);
  }

  draw(ctx) {
    if (!this.alive) return;
    const shadowY = GROUND_Y - 4;
    const centerX = this.x + this.w / 2;

    ctx.save();
    drawInkShadow(ctx, centerX, shadowY, this.w * 0.5, 12, 0.75);
    ctx.restore();

    const baseScale = this.type === DEMON_TYPES.VANGUARD ? 1.45 : 1;
    const hunched = this.type === DEMON_TYPES.FOOT ? this.state === "windup" : this.type === DEMON_TYPES.BRIMSTONE ? this.state === "charge" : (this.state === "roar" || this.state === "windup_claw");
    const footYLocal = getDemonFootY(animFrame(this.animTime, 4), baseScale, hunched);
    ctx.save();
    ctx.translate(this.x + this.w / 2, GROUND_Y - footYLocal);
    ctx.scale(this.facing, 1);

    const dying = this.state === "dying";
    const deathProgress = dying ? Math.min(1, this.deathAnimTime / DEMON_DEATH_DURATION) : 0;
    if (dying) {
      ctx.translate(0, deathProgress * 22);
      ctx.scale(1, 1 - deathProgress * 0.65);
      ctx.globalAlpha = 1 - deathProgress * 0.85;
    }

    if (this.type === DEMON_TYPES.FOOT) {
      drawFootSoldierDemon(ctx, dying ? "stand" : this.state, animFrame(this.animTime, 4), this.stunTime > 0, false);
    } else if (this.type === DEMON_TYPES.BRIMSTONE) {
      drawBrimstoneDemon(ctx, dying ? "idle" : this.state, 0, animFrame(this.animTime, 4), false);
    } else {
      drawVanguardDemon(ctx, dying ? "approach" : this.state, 0, animFrame(this.animTime, 4), false);
    }

    const windupWarning = !dying && (
      (this.type === DEMON_TYPES.FOOT && this.state === "windup" && this.stateTime >= 0) ||
      (this.type === DEMON_TYPES.BRIMSTONE && this.state === "charge" && this.stateTime >= 0.3) ||
      (this.type === DEMON_TYPES.VANGUARD && this.state === "windup_claw" && this.stateTime >= 1.5) ||
      (this.type === DEMON_TYPES.VANGUARD && this.state === "roar" && this.stateTime >= 2.0)
    );
    if (windupWarning) {
      ctx.save();
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = "rgba(255, 90, 90, 0.5)";
      ctx.beginPath();
      ctx.ellipse(4 * baseScale, -12 * baseScale, 14 * baseScale, 32 * baseScale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      const flashHz = 6;
      const showExcl = Math.floor(this.stateTime * flashHz) % 2 === 0;
      if (showExcl) {
        const exclX = 8 * baseScale;
        const exclY = -52 * baseScale;
        const fontSize = Math.round(22 * baseScale);
        ctx.save();
        ctx.font = "bold " + fontSize + "px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.strokeStyle = "#1a0000";
        ctx.lineWidth = 2.5;
        ctx.lineJoin = "round";
        ctx.strokeText("!", exclX, exclY);
        ctx.fillStyle = "#ff3333";
        ctx.fillText("!", exclX, exclY);
        ctx.restore();
      }
    }

    if (this.flashUntil > 0 && !dying) {
      ctx.save();
      ctx.globalAlpha = 0.75;
      if (this.type === DEMON_TYPES.FOOT) {
        drawFootSoldierDemon(ctx, this.state, animFrame(this.animTime, 4), this.stunTime > 0, true);
      } else if (this.type === DEMON_TYPES.BRIMSTONE) {
        drawBrimstoneDemon(ctx, this.state, this.chargeTime, animFrame(this.animTime, 4), true);
      } else {
        drawVanguardDemon(ctx, this.state, this.chargeTime, animFrame(this.animTime, 4), true);
      }
      ctx.restore();
    }

    ctx.restore();
  }
}

function getDemonStats(type) {
  if (type === DEMON_TYPES.FOOT) {
    return {
      w: 38,
      h: 68,
      maxHealth: 10,
      speed: 95,
      damage: 12,
      initialState: "approach"
    };
  }
  if (type === DEMON_TYPES.BRIMSTONE) {
    return {
      w: 40,
      h: 62,
      maxHealth: 6,
      speed: 35,
      damage: 0,
      initialState: "idle"
    };
  }
  if (type === DEMON_TYPES.VANGUARD) {
    return {
      w: 58,
      h: 88,
      maxHealth: 25,
      speed: 30,
      damage: 25,
      ramDamage: 25,
      meleeDamage: 18,
      initialState: "roar"
    };
  }
  return { w: 42, h: 54, maxHealth: 10, speed: 90, damage: 12, initialState: "approach" };
}

function rectsOverlap(a, b) {
  return !(
    a.right <= b.left ||
    a.left >= b.right ||
    a.bottom <= b.top ||
    a.top >= b.bottom
  );
}

function getKnightShieldRect(knight) {
  // Big body-covering shield on the facing side.
  const shieldW = 18;
  const shieldH = knight.h * 0.95;
  const top = knight.y + knight.h * 0.02;
  const bottom = top + shieldH;
  if (knight.facing >= 0) {
    const left = knight.x + knight.w * 0.55;
    return { left, right: left + shieldW, top, bottom };
  }
  const right = knight.x + knight.w * 0.45;
  return { left: right - shieldW, right, top, bottom };
}

class Game {
  constructor() {
    this.knight = new Knight();
    this.demons = [];
    this.projectiles = [];
    this.particles = [];
    this.scars = [];
    this.shockwaves = [];
    this.spawnTimer = 0;
    this.spawnInterval = 2.4;
    this.level = 1;
    this.time = 0;
    this.gameOver = false;
    this.lastTimestamp = 0;
    this.demonPressure = 0;
    this.crusaderHurtUntil = 0;
    this.campaignStageIndex = -1;
    this.campaignWaveIndex = -1;
    this.campaignWaveQueue = [];
    this.waveStartTime = 0;
    this.campaignCinematicActive = false;
    this.loop = this.loop.bind(this);

    // Debug counters
    this._dbgFrame = 0;
    this._dbgLastLogAt = 0;
    this._dbgUpdateMs = 0;
    this._dbgDrawMs = 0;
  }

  reset() {
    this.knight = new Knight();
    this.demons = [];
    this.projectiles = [];
    this.particles = [];
    this.scars = [];
    this.shockwaves = [];
    this.spawnTimer = 0;
    this.spawnInterval = 2.4;
    this.level = 1;
    this.time = 0;
    this.demonPressure = 0;
    this.gameOver = false;
    this.crusaderHurtUntil = 0;
    this.lastTimestamp = performance.now();
    if (this.mode === "campaign" && this.campaignStageIndex >= 0) {
      this.campaignWaveIndex = 0;
      this.waveStartTime = 0;
      const stage = CAMPAIGN_STAGES[this.campaignStageIndex];
      this.campaignWaveQueue = (stage.waves[0] || []).map((e) => ({ type: e.type, delay: e.delay }));
      if (typeof startStageMusic === "function") startStageMusic(this.campaignStageIndex);
    } else {
      this.campaignStageIndex = -1;
      this.campaignWaveIndex = -1;
      this.campaignWaveQueue = [];
      this.waveStartTime = 0;
    }
    ui.overlay.classList.add("hidden");
    canvas.focus();
    requestAnimationFrame(this.loop);
  }

  start(mode, campaignStageIndex) {
    this.mode = mode || "campaign";
    this.gameOver = false;
    this.lastTimestamp = performance.now();
    if (this.mode === "campaign" && campaignStageIndex >= 0 && campaignStageIndex < CAMPAIGN_STAGES.length) {
      this.campaignStageIndex = campaignStageIndex;
      this.campaignWaveIndex = 0;
      this.waveStartTime = this.time;
      const stage = CAMPAIGN_STAGES[campaignStageIndex];
      this.campaignWaveQueue = (stage.waves[0] || []).map((e) => ({ type: e.type, delay: e.delay }));
      if (typeof startStageMusic === "function") startStageMusic(campaignStageIndex);
    }
    this.campaignCinematicActive = false;
    canvas.focus();
    requestAnimationFrame(this.loop);
  }

  showCampaignTransitionAndPause() {
    this.campaignCinematicActive = true;
    if (typeof showCampaignTransitionCinematic === "function") {
      showCampaignTransitionCinematic(this.campaignStageIndex);
    }
  }

  advanceCampaignToStage(stageIndex) {
    this.campaignCinematicActive = false;
    this.campaignStageIndex = stageIndex;
    this.campaignWaveIndex = 0;
    this.waveStartTime = this.time;
    const stage = CAMPAIGN_STAGES[stageIndex];
    this.campaignWaveQueue = (stage.waves[0] || []).map((e) => ({ type: e.type, delay: e.delay }));
    if (typeof startStageMusic === "function") startStageMusic(stageIndex);
  }

  spawnDemon() {
    // Endless mode: foot = easiest, vanguard = hardest. Weights shift with level.
    const level = this.level;
    let footW = Math.max(0.12, 1.25 - level * 0.035);
    let brimstoneW = level >= 2 ? Math.min(0.55, (level - 2) * 0.025) : 0;
    let vanguardW = level >= 5 ? Math.min(0.55, (level - 5) * 0.02) : 0;
    const total = footW + brimstoneW + vanguardW;
    footW /= total;
    brimstoneW /= total;
    vanguardW /= total;
    const roll = Math.random();
    let type = DEMON_TYPES.FOOT;
    if (roll < footW) type = DEMON_TYPES.FOOT;
    else if (roll < footW + brimstoneW) type = DEMON_TYPES.BRIMSTONE;
    else type = DEMON_TYPES.VANGUARD;
    this.spawnDemonByType(type);
  }

  spawnDemonByType(type) {
    const spawnLeft = Math.random() < 0.5;
    let x;
    if (type === DEMON_TYPES.BRIMSTONE || type === DEMON_TYPES.VANGUARD) {
      x = spawnLeft ? ARENA_LEFT : ARENA_RIGHT - getDemonStats(type).w;
    } else {
      x = spawnLeft ? ARENA_LEFT + 30 : ARENA_RIGHT - getDemonStats(type).w - 30;
    }
    this.demons.push(new Demon(x, this.level, type));
  }

  update(dt) {
    if (this.gameOver) return;
    if (this.campaignCinematicActive) return;
    if (!this.knight || !Number.isFinite(dt) || dt <= 0) return;

    this.time += dt;
    this.demons = this.demons || [];
    this.projectiles = this.projectiles || [];
    this.particles = this.particles || [];
    this.scars = this.scars || [];

    if (this.mode === "campaign" && this.campaignStageIndex >= 0) {
      const stage = CAMPAIGN_STAGES[this.campaignStageIndex];
      const elapsed = this.time - this.waveStartTime;
      while (this.campaignWaveQueue.length && this.campaignWaveQueue[0].delay <= elapsed) {
        const entry = this.campaignWaveQueue.shift();
        this.spawnDemonByType(entry.type);
      }
      const aliveCount = this.demons.filter((d) => d.alive).length;
      if (this.campaignWaveQueue.length === 0 && aliveCount === 0) {
        this.campaignWaveIndex++;
        if (this.campaignWaveIndex >= (stage.waves || []).length) {
          this.showCampaignTransitionAndPause();
          return;
        }
        this.waveStartTime = this.time;
        this.campaignWaveQueue = (stage.waves[this.campaignWaveIndex] || []).map((e) => ({ type: e.type, delay: e.delay }));
      }
    } else {
      // Endless: level rises with time forever (no cap). Spawns get faster and harder.
      this.level = 1 + Math.floor(this.time / 25);
      const baseInterval = 2.8;
      const minInterval = 0.5;
      this.spawnInterval = Math.max(minInterval, baseInterval - this.level * 0.04);
      this.spawnTimer += dt;
      if (this.spawnTimer >= this.spawnInterval) {
        this.spawnTimer = 0;
        this.spawnDemon();
        // At high levels, sometimes spawn an extra demon so count keeps rising.
        if (this.level >= 15 && Math.random() < 0.2) this.spawnDemon();
        if (this.level >= 35 && Math.random() < 0.15) this.spawnDemon();
      }
    }

    this.knight.update(dt, this.demons);

    this.demons.forEach(demon => {
      try { demon.update(dt, this.knight, this); } catch (e) { console.error("Demon update error:", e); }
    });

    this.projectiles.forEach(p => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.t != null) p.t += dt;
      if (p.life <= 0) return;
      const pr = { left: p.x - p.w / 2, right: p.x + p.w / 2, top: p.y - p.h / 2, bottom: p.y + p.h / 2 };
      // Shield blocks fireballs completely and creates deflection particles.
      if (p.kind === "fire" && this.knight.blocking) {
        const sr = getKnightShieldRect(this.knight);
        if (rectsOverlap(pr, sr)) {
          this.spawnFireDeflect(p.x, p.y, this.knight.facing);
          p.life = 0;
          return;
        }
      }
      if (rectsOverlap(pr, this.knight)) {
        this.knight.takeHit(p.damage, this);
        p.life = 0;
      }
    });
    this.projectiles = this.projectiles.filter(p => p.life > 0 && p.x > -50 && p.x < GAME_WIDTH + 50);

    this.particles.forEach(pt => {
      if (pt.kind === "fire") {
        pt.vy += 260 * dt;
        pt.vx *= 0.985;
      } else {
        pt.vy += DIRT_GRAVITY * dt;
      }
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
      if (pt.kind !== "fire" && pt.y > GROUND_Y - 2) {
        pt.y = GROUND_Y - 2;
        pt.vx *= 0.65;
        pt.vy *= -0.25;
      }
    });
    this.particles = this.particles.filter(pt => pt.life > 0);

    this.scars.forEach(s => {
      s.t += dt;
    });
    this.scars = this.scars.filter(s => s.t < s.life);

    this.shockwaves.forEach(sw => { sw.t += dt; });
    this.shockwaves = this.shockwaves.filter(sw => sw.t < sw.life);

    this.demons = this.demons.filter(d => d.alive || d.x > -80 && d.x < GAME_WIDTH + 80);

    const baseScore = dt * 12;
    const demonsNearby = this.demons.filter(d => d.alive && Math.abs(d.x - this.knight.x) < 220).length;
    const pressureMultiplier = 1 + demonsNearby * 0.32;
    this.knight.score += baseScore * pressureMultiplier;

    if (this.knight.health <= 0 && this.knight.deathAnimTime <= 0) {
      this.endGame(false);
    }

    const pressure = Math.min(1, this.demons.length / 10 + demonsNearby / 6);
    this.demonPressure = this.demonPressure * 0.92 + pressure * 0.08;

    this.updateHud();
  }

  updateHud() {
    if (!this.knight) return;
    const healthRatio = Math.max(0, this.knight.health / this.knight.maxHealth);
    if (ui.playerHealth) ui.playerHealth.style.width = `${healthRatio * 100}%`;
    const tideRatio = Math.min(1, this.demonPressure);
    if (ui.demonTide) ui.demonTide.style.width = `${tideRatio * 100}%`;
    if (ui.score) ui.score.textContent = Math.round(this.knight.score).toString();
    if (ui.time) ui.time.textContent = `${Math.floor(this.time)}s`;
  }

  drawBackground(ctx, campaignStage) {
    if (typeof ctx.setTransform === "function") ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const groundY = GAME_HEIGHT - 40;
    const groundGrad = ctx.createLinearGradient(0, 0, 0, 50);
    groundGrad.addColorStop(0, "#1a1c20");
    groundGrad.addColorStop(0.5, "#0e1014");
    groundGrad.addColorStop(1, "#06080a");
    const drawGround = () => {
      ctx.fillStyle = groundGrad;
      ctx.fillRect(0, groundY, GAME_WIDTH, 40);
      ctx.fillStyle = "#25282e";
      ctx.fillRect(0, groundY, GAME_WIDTH, 3);
      ctx.strokeStyle = "#0d0f12";
      ctx.lineWidth = 1;
      for (let i = 0; i < 12; i++) {
        ctx.beginPath();
        ctx.moveTo(0, groundY + i * 3.5);
        ctx.lineTo(GAME_WIDTH, groundY + i * 3.5);
        ctx.stroke();
      }
    };

    if (campaignStage === 0) {
      this.drawBackgroundStage1Dusk(ctx, groundY, drawGround);
    } else if (campaignStage === 1) {
      this.drawBackgroundStage2Walls(ctx, groundY, drawGround);
    } else if (campaignStage === 2) {
      this.drawBackgroundStage3Cathedral(ctx, groundY, drawGround);
    } else {
      this.drawBackgroundDefault(ctx, groundY, drawGround);
    }

    const vignette = ctx.createRadialGradient(
      GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_HEIGHT * 0.25,
      GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH * 0.9
    );
    vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
    vignette.addColorStop(0.6, "rgba(0, 0, 0, 0.15)");
    vignette.addColorStop(1, "rgba(0, 0, 0, 0.4)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  }

  drawBackgroundStage1Dusk(ctx, groundY, drawGround) {
    const skyGrad = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    skyGrad.addColorStop(0, "#2a2438");
    skyGrad.addColorStop(0.25, "#1e1828");
    skyGrad.addColorStop(0.5, "#16121c");
    skyGrad.addColorStop(0.85, "#0e0c12");
    skyGrad.addColorStop(1, "#08060a");
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    const duskGlow = ctx.createLinearGradient(0, GAME_HEIGHT * 0.6, 0, GAME_HEIGHT);
    duskGlow.addColorStop(0, "rgba(120, 80, 60, 0.25)");
    duskGlow.addColorStop(0.4, "rgba(80, 50, 40, 0.12)");
    duskGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = duskGlow;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    const cityY = groundY - 80;
    const cityH = 120;
    ctx.fillStyle = "#0a0808";
    ctx.beginPath();
    ctx.moveTo(0, GAME_HEIGHT);
    ctx.lineTo(0, cityY + cityH);
    ctx.lineTo(GAME_WIDTH * 0.18, cityY + 60);
    ctx.lineTo(GAME_WIDTH * 0.32, cityY + cityH);
    ctx.lineTo(GAME_WIDTH * 0.45, cityY + 40);
    ctx.lineTo(GAME_WIDTH * 0.55, cityY + 90);
    ctx.lineTo(GAME_WIDTH * 0.68, cityY + 30);
    ctx.lineTo(GAME_WIDTH * 0.82, cityY + 70);
    ctx.lineTo(GAME_WIDTH, cityY + cityH * 0.8);
    ctx.lineTo(GAME_WIDTH, GAME_HEIGHT);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(30, 22, 28, 0.8)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "#121018";
    ctx.fillRect(0, cityY + cityH - 20, GAME_WIDTH * 0.22, 24);
    ctx.fillRect(GAME_WIDTH * 0.28, cityY + cityH - 35, GAME_WIDTH * 0.15, 40);
    ctx.fillRect(GAME_WIDTH * 0.5, cityY + cityH - 28, GAME_WIDTH * 0.2, 32);
    ctx.fillRect(GAME_WIDTH * 0.78, cityY + cityH - 22, GAME_WIDTH * 0.25, 26);
    drawGround();
  }

  drawBackgroundStage2Walls(ctx, groundY, drawGround) {
    const skyGrad = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    skyGrad.addColorStop(0, "#1a0c0c");
    skyGrad.addColorStop(0.3, "#280808");
    skyGrad.addColorStop(0.6, "#180404");
    skyGrad.addColorStop(1, "#0c0202");
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    const fireGlow = ctx.createRadialGradient(GAME_WIDTH / 2, GAME_HEIGHT + 80, 0, GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH * 0.8);
    fireGlow.addColorStop(0, "rgba(255, 100, 30, 0.4)");
    fireGlow.addColorStop(0.3, "rgba(200, 50, 20, 0.25)");
    fireGlow.addColorStop(0.6, "rgba(120, 30, 10, 0.1)");
    fireGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = fireGlow;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    const wallW = 200;
    ctx.fillStyle = "#1a1816";
    ctx.fillRect(0, 0, wallW, GAME_HEIGHT);
    ctx.fillStyle = "#141210";
    ctx.fillRect(GAME_WIDTH - wallW, 0, wallW, GAME_HEIGHT);
    ctx.strokeStyle = "#0a0806";
    ctx.lineWidth = 2;
    for (let i = 0; i < 35; i++) {
      const py = (i / 35) * (GAME_HEIGHT + 80) - 10;
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(wallW, py + 50);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(GAME_WIDTH - wallW, py + 50);
      ctx.lineTo(GAME_WIDTH, py);
      ctx.stroke();
    }
    for (let i = 0; i < 12; i++) {
      const px = (i / 12) * wallW;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px + 8, GAME_HEIGHT);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(GAME_WIDTH - wallW + px, 0);
      ctx.lineTo(GAME_WIDTH - wallW + px + 8, GAME_HEIGHT);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(255, 80, 20, 0.15)";
    ctx.fillRect(0, groundY - 60, wallW * 0.3, 80);
    ctx.fillRect(GAME_WIDTH - wallW * 0.3, groundY - 80, wallW * 0.3, 100);
    drawGround();
  }

  drawBackgroundStage3Cathedral(ctx, groundY, drawGround) {
    const skyGrad = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    skyGrad.addColorStop(0, "#1c1810");
    skyGrad.addColorStop(0.4, "#242018");
    skyGrad.addColorStop(0.8, "#181410");
    skyGrad.addColorStop(1, "#0e0c08");
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    const pillarW = 42;
    const pillarSpacing = GAME_WIDTH / 6;
    for (let side = 0; side < 2; side++) {
      const baseX = side === 0 ? 0 : GAME_WIDTH - pillarW;
      for (let i = 0; i < 4; i++) {
        const x = baseX + (side === 0 ? i * pillarSpacing : -i * pillarSpacing);
        const grad = ctx.createLinearGradient(x, 0, x + pillarW, 0);
        grad.addColorStop(0, "#2a2620");
        grad.addColorStop(0.3, "#3a3630");
        grad.addColorStop(0.7, "#3a3630");
        grad.addColorStop(1, "#1e1a16");
        ctx.fillStyle = grad;
        ctx.fillRect(x, 0, pillarW, GAME_HEIGHT);
        ctx.strokeStyle = "#0a0806";
        ctx.lineWidth = 1;
        ctx.strokeRect(x, 0, pillarW, GAME_HEIGHT);
      }
    }
    const windowW = 80;
    const windowH = 140;
    const windows = [
      { x: GAME_WIDTH * 0.12, y: 40 },
      { x: GAME_WIDTH * 0.38, y: 30 },
      { x: GAME_WIDTH * 0.62, y: 30 },
      { x: GAME_WIDTH * 0.88, y: 40 }
    ];
    windows.forEach((w, i) => {
      const g = ctx.createLinearGradient(w.x, w.y, w.x + windowW, w.y + windowH);
      g.addColorStop(0, "rgba(255, 220, 120, 0.5)");
      g.addColorStop(0.2, "rgba(255, 200, 80, 0.45)");
      g.addColorStop(0.5, "rgba(255, 180, 60, 0.35)");
      g.addColorStop(0.8, "rgba(200, 140, 40, 0.2)");
      g.addColorStop(1, "rgba(160, 100, 30, 0.1)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(w.x + windowW / 2, w.y);
      ctx.lineTo(w.x + windowW, w.y + windowH * 0.3);
      ctx.lineTo(w.x + windowW, w.y + windowH);
      ctx.lineTo(w.x, w.y + windowH);
      ctx.lineTo(w.x, w.y + windowH * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(80, 60, 30, 0.6)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "rgba(40, 30, 20, 0.5)";
      ctx.beginPath();
      ctx.moveTo(w.x + windowW / 2, w.y + 10);
      ctx.lineTo(w.x + windowW / 2 + 2, w.y + windowH - 10);
      ctx.moveTo(w.x + 10, w.y + windowH * 0.35);
      ctx.lineTo(w.x + windowW - 10, w.y + windowH * 0.35);
      ctx.stroke();
    });
    const goldenLight = ctx.createRadialGradient(GAME_WIDTH / 2, 0, 0, GAME_WIDTH / 2, 0, GAME_WIDTH * 0.7);
    goldenLight.addColorStop(0, "rgba(255, 230, 180, 0.12)");
    goldenLight.addColorStop(0.5, "rgba(255, 200, 120, 0.06)");
    goldenLight.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = goldenLight;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    drawGround();
  }

  drawBackgroundDefault(ctx, groundY, drawGround) {
    const lightX = GAME_WIDTH * 0.35;
    const lightY = 20;
    const skyGrad = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    skyGrad.addColorStop(0, "#2a2d32");
    skyGrad.addColorStop(0.3, "#1e2025");
    skyGrad.addColorStop(0.7, "#12141a");
    skyGrad.addColorStop(1, "#0a0c0e");
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    const lightGrad = ctx.createRadialGradient(lightX, lightY, 0, lightX, lightY, 380);
    lightGrad.addColorStop(0, "rgba(255, 252, 245, 0.35)");
    lightGrad.addColorStop(0.15, "rgba(240, 236, 228, 0.18)");
    lightGrad.addColorStop(0.4, "rgba(180, 178, 172, 0.06)");
    lightGrad.addColorStop(0.7, "rgba(80, 78, 75, 0.02)");
    lightGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = lightGrad;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    const wallLeft = 0;
    const wallW = 140;
    ctx.fillStyle = "#0c0e12";
    ctx.fillRect(wallLeft, 0, wallW, GAME_HEIGHT);
    ctx.strokeStyle = "#15181e";
    ctx.lineWidth = 1;
    for (let i = 0; i < 28; i++) {
      const py = (i / 28) * (GAME_HEIGHT + 60) - 20;
      ctx.beginPath();
      ctx.moveTo(wallLeft, py);
      ctx.lineTo(wallLeft + wallW, py + 40);
      ctx.stroke();
    }
    for (let i = 0; i < 8; i++) {
      const px = wallLeft + (i / 8) * wallW;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, GAME_HEIGHT);
      ctx.stroke();
    }
    ctx.fillStyle = "#080a0e";
    ctx.fillRect(GAME_WIDTH - 120, 0, 120, GAME_HEIGHT);
    ctx.strokeStyle = "#101218";
    ctx.lineWidth = 1;
    for (let i = 0; i < 20; i++) {
      ctx.beginPath();
      ctx.moveTo(GAME_WIDTH - 120 + (i % 5) * 28, Math.floor(i / 5) * 120);
      ctx.lineTo(GAME_WIDTH - 120 + (i % 5) * 28 + 24, GAME_HEIGHT);
      ctx.stroke();
    }
    drawGround();
  }

  draw(ctx) {
    if (!ctx) return;
    // Hard reset canvas state each frame so a mismatched save/restore or transform
    // can't permanently shift drawing offscreen (common "visual freeze" cause).
    if (typeof ctx.setTransform === "function") ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    const campaignStage = this.mode === "campaign" && this.campaignStageIndex >= 0 ? this.campaignStageIndex : -1;
    this.drawBackground(ctx, campaignStage);
    this.drawGroundScars(ctx);
    this.drawShockwaves(ctx);
    if (this.knight) this.knight.draw(ctx);
    (this.projectiles || []).forEach(p => this.drawProjectile(ctx, p));
    this.drawDirtParticles(ctx);
    (this.demons || []).forEach(d => {
      if (!d || d.alive === false) return;
      try { d.draw(ctx); } catch (e) { console.error("Demon draw error:", e); }
    });
  }

  drawProjectile(ctx, p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    const t = p.t || 0;
    const flick = 0.75 + 0.25 * Math.sin(t * 18 + p.x * 0.03);
    const w = (p.w || 14) * (0.85 + 0.25 * flick);
    const h = (p.h || 14) * (1.05 + 0.35 * flick);
    ctx.rotate(Math.atan2(p.vy, p.vx) + Math.sin(t * 10) * 0.05);
    const core = ctx.createRadialGradient(3, 0, 0, 3, 0, w);
    core.addColorStop(0, `rgba(255, 245, 220, ${0.95 * flick})`);
    core.addColorStop(0.22, `rgba(255, 170, 60, ${0.9 * flick})`);
    core.addColorStop(0.55, `rgba(255, 90, 30, ${0.75 * flick})`);
    core.addColorStop(1, "rgba(120, 20, 10, 0)");
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.moveTo(-w * 0.2, 0);
    ctx.quadraticCurveTo(w * 0.4, -h * 0.55, w * 0.9, 0);
    ctx.quadraticCurveTo(w * 0.4, h * 0.55, -w * 0.2, 0);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.65;
    const outer = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 1.35);
    outer.addColorStop(0, `rgba(255, 150, 50, ${0.35 * flick})`);
    outer.addColorStop(0.55, `rgba(200, 40, 20, ${0.18 * flick})`);
    outer.addColorStop(1, "rgba(120, 20, 10, 0)");
    ctx.fillStyle = outer;
    ctx.beginPath();
    ctx.ellipse(w * 0.15, 0, w * 1.05, h * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  spawnDirtBurst(x, y, dir) {
    const count = 18 + Math.floor(Math.random() * 10);
    for (let i = 0; i < count; i++) {
      const a = (-Math.PI / 2) + (Math.random() - 0.5) * 1.35;
      const sp = 140 + Math.random() * 260;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 6,
        vx: Math.cos(a) * sp + dir * (40 + Math.random() * 60),
        vy: Math.sin(a) * sp,
        life: 0.6 + Math.random() * 0.45,
        size: 1.5 + Math.random() * 2.8,
        shade: 0.25 + Math.random() * 0.4
      });
    }
  }

  spawnGroundScar(x, y) {
    this.scars.push({ x, y, t: 0, life: VANGUARD_SLAM_SCAR_DURATION });
  }

  spawnShockwave(x, y) {
    this.shockwaves.push({ x, y, t: 0, life: SHOCKWAVE_DURATION });
  }

  drawShockwaves(ctx) {
    if (!this.shockwaves.length) return;
    ctx.save();
    for (const sw of this.shockwaves) {
      const p = Math.min(1, sw.t / sw.life);
      const r = 8 + p * 42;
      const a = 0.5 * (1 - p);
      ctx.strokeStyle = `rgba(255, 255, 255, ${a})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  spawnFireDeflect(x, y, facing) {
    const count = 14 + Math.floor(Math.random() * 10);
    for (let i = 0; i < count; i++) {
      const a = (Math.random() - 0.5) * 1.1;
      const sp = 140 + Math.random() * 240;
      const vx = -facing * (220 + Math.random() * 220) + Math.cos(a) * sp * 0.35;
      const vy = (-120 + Math.random() * 180) + Math.sin(a) * sp * 0.25;
      this.particles.push({
        kind: "fire",
        x: x + (Math.random() - 0.5) * 6,
        y: y + (Math.random() - 0.5) * 6,
        vx,
        vy,
        life: 0.35 + Math.random() * 0.35,
        size: 1.4 + Math.random() * 2.6,
        heat: 0.6 + Math.random() * 0.4
      });
    }
  }

  drawDirtParticles(ctx) {
    if (!this.particles.length) return;
    ctx.save();
    for (const pt of this.particles) {
      if (pt.kind === "fire") {
        const a = Math.max(0, Math.min(1, pt.life / 0.7));
        const heat = pt.heat || 1;
        ctx.globalAlpha = 0.9 * a;
        const r = 255;
        const g = Math.floor(160 + 70 * heat);
        const b = Math.floor(40 + 30 * heat);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.35 * a;
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.beginPath();
        ctx.arc(pt.x + 0.6, pt.y - 0.4, pt.size * 0.45, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const a = Math.max(0, Math.min(1, pt.life / 1.0));
        ctx.globalAlpha = 0.85 * a;
        const c = Math.floor(40 + 120 * pt.shade);
        ctx.fillStyle = `rgb(${c}, ${c - 6}, ${c - 14})`;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  drawGroundScars(ctx) {
    if (!this.scars.length) return;
    ctx.save();
    for (const s of this.scars) {
      const p = Math.min(1, s.t / s.life);
      const a = 0.75 * (1 - p);
      ctx.globalAlpha = a;
      ctx.strokeStyle = "rgba(0,0,0,0.85)";
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      const y = s.y;
      ctx.moveTo(s.x - 34, y);
      ctx.quadraticCurveTo(s.x - 10, y + 3, s.x + 6, y - 1);
      ctx.quadraticCurveTo(s.x + 18, y - 4, s.x + 34, y + 1);
      ctx.stroke();
      ctx.globalAlpha = a * 0.45;
      ctx.strokeStyle = "rgba(255, 250, 240, 0.25)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(s.x - 18, y - 1);
      ctx.lineTo(s.x + 18, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  loop(timestamp) {
    const now = Number.isFinite(timestamp) ? timestamp : performance.now();
    const rawDt = (now - this.lastTimestamp) / 1000;
    const dt = Number.isFinite(rawDt) ? Math.max(0, Math.min(0.05, rawDt)) : 0.016;
    this.lastTimestamp = now;

    try {
      if (!this.gameOver) {
        const t0 = DEBUG_PERF ? performance.now() : 0;
        this.update(dt);
        if (DEBUG_PERF) this._dbgUpdateMs = performance.now() - t0;
      }
      if (!this.gameOver) {
        const t1 = DEBUG_PERF ? performance.now() : 0;
        this.draw(ctx);
        if (DEBUG_PERF) this._dbgDrawMs = performance.now() - t1;
      }
    } catch (err) {
      console.error("Game loop error:", err);
    }

    // Heartbeat: proves the loop is alive even if visuals freeze.
    if (DEBUG_PERF) {
      this._dbgFrame++;
      const panel = ensureDebugPanel();
      if (panel) {
        panel.textContent =
          `tick frame=${this._dbgFrame}\n` +
          `dt=${dt.toFixed(4)}s\n` +
          `update=${this._dbgUpdateMs.toFixed(1)}ms draw=${this._dbgDrawMs.toFixed(1)}ms\n` +
          `demons=${(this.demons && this.demons.length) || 0} proj=${(this.projectiles && this.projectiles.length) || 0}\n` +
          `gameOver=${this.gameOver}`;
      }
      if (now - this._dbgLastLogAt > 1000) {
        this._dbgLastLogAt = now;
        console.log("[tick]", {
          frame: this._dbgFrame,
          dt,
          updateMs: this._dbgUpdateMs,
          drawMs: this._dbgDrawMs,
          demons: (this.demons && this.demons.length) || 0,
          proj: (this.projectiles && this.projectiles.length) || 0
        });
      }
    }

    try {
      requestAnimationFrame(this.loop);
    } catch (e) {
      console.error("requestAnimationFrame error:", e);
    }
  }

  endGame(victory) {
    this.gameOver = true;
    if (typeof stopStageMusic === "function") stopStageMusic();
    if (ui.overlayTitle) ui.overlayTitle.textContent = victory ? "Victory" : "Fallen Crusader";
    const finalScore = this.knight ? Math.round(this.knight.score) : 0;
    const survivedSeconds = Math.floor(this.time);
    ui.overlayMessage.textContent = `Score: ${finalScore} · Time: ${survivedSeconds}s`;
    if (typeof currentCrusaderName !== "undefined" && ui.playerNameInput) {
      ui.playerNameInput.value = currentCrusaderName;
    }
    ui.overlay.classList.remove("hidden");
    this.updateHud();
    this.lastResult = { score: finalScore, survivedSeconds };
    fetchLeaderboard();
  }
}

// ---------- Title screen with animated flames ----------
const titleScreen = document.getElementById("title-screen");
const titleFlamesCanvas = document.getElementById("title-flames");
const titleFlamesCtx = titleFlamesCanvas ? titleFlamesCanvas.getContext("2d") : null;

let flameTime = 0;
let titleScreenActive = true;

const titleParticles = [];
const TITLE_PARTICLE_COUNT = 70;
function initTitleParticles() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  titleParticles.length = 0;
  for (let i = 0; i < TITLE_PARTICLE_COUNT; i++) {
    titleParticles.push({
      x: Math.random() * w,
      y: Math.random() * h,
      size: 1.2 + Math.random() * 2.5,
      speed: 0.35 + Math.random() * 0.7,
      drift: (Math.random() - 0.5) * 0.6,
      opacity: 0.3 + Math.random() * 0.5
    });
  }
}

function resizeTitleFlames() {
  if (!titleFlamesCanvas || !titleFlamesCtx) return;
  const scale = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;
  titleFlamesCanvas.width = w * scale;
  titleFlamesCanvas.height = h * scale;
  titleFlamesCanvas.style.width = w + "px";
  titleFlamesCanvas.style.height = h + "px";
  titleFlamesCtx.setTransform(scale, 0, 0, scale, 0, 0);
}
if (titleFlamesCanvas) {
  resizeTitleFlames();
  window.addEventListener("resize", resizeTitleFlames);
}

// Same 9s keyframe curve as title-fire-reflection, for synced background flicker (phase 0–1)
const FLICKER_KEYFRAMES = [
  [0, 0.9], [0.02, 0.5], [0.03, 0.92], [0.08, 0.55], [0.09, 0.88], [0.15, 0.42], [0.18, 0.78],
  [0.24, 0.52], [0.27, 1], [0.31, 0.48], [0.35, 0.82], [0.42, 0.45], [0.44, 0.95], [0.51, 0.58],
  [0.56, 0.72], [0.63, 0.44], [0.67, 0.9], [0.74, 0.5], [0.78, 0.85], [0.85, 0.54], [0.89, 0.78],
  [0.96, 0.46], [1, 0.88]
];
function getFlickerOpacity(phase) {
  for (let i = 0; i < FLICKER_KEYFRAMES.length - 1; i++) {
    const [p0, o0] = FLICKER_KEYFRAMES[i];
    const [p1, o1] = FLICKER_KEYFRAMES[i + 1];
    if (phase >= p0 && phase <= p1) return o0 + (o1 - o0) * (phase - p0) / (p1 - p0);
  }
  return FLICKER_KEYFRAMES[FLICKER_KEYFRAMES.length - 1][1];
}

function drawFlames() {
  if (!titleFlamesCtx || !titleScreenActive) return;

  flameTime += 0.02;
  const w = window.innerWidth;
  const h = window.innerHeight;

  if (titleParticles.length === 0) initTitleParticles();

  const flickerPhase = ((performance.now() / 1000) % 9) / 9;
  const flickerO = getFlickerOpacity(flickerPhase);
  const glowMult = 0.78 + 0.22 * flickerO;

  // Dark base
  titleFlamesCtx.fillStyle = "#0a0600";
  titleFlamesCtx.fillRect(0, 0, w, h);

  // Fire glow from bottom (subtle flicker synced to letter reflection)
  const fireGrad = titleFlamesCtx.createLinearGradient(0, h, 0, 0);
  fireGrad.addColorStop(0, `rgba(255, 200, 80, ${0.45 * glowMult})`);
  fireGrad.addColorStop(0.2, `rgba(248, 180, 70, ${0.35 * glowMult})`);
  fireGrad.addColorStop(0.45, `rgba(220, 140, 50, ${0.18 * glowMult})`);
  fireGrad.addColorStop(0.7, `rgba(160, 90, 30, ${0.06 * glowMult})`);
  fireGrad.addColorStop(1, "rgba(40, 20, 5, 0)");
  titleFlamesCtx.fillStyle = fireGrad;
  titleFlamesCtx.fillRect(0, 0, w, h);

  // Extra radial glow at bottom center (subtle flicker)
  const cx = w / 2;
  const bottomY = h + 80;
  const radGrad = titleFlamesCtx.createRadialGradient(cx, bottomY, 0, cx, bottomY, h * 1.2);
  radGrad.addColorStop(0, `rgba(255, 220, 120, ${0.5 * glowMult})`);
  radGrad.addColorStop(0.35, `rgba(248, 190, 90, ${0.25 * glowMult})`);
  radGrad.addColorStop(0.6, `rgba(200, 130, 50, ${0.08 * glowMult})`);
  radGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
  titleFlamesCtx.fillStyle = radGrad;
  titleFlamesCtx.fillRect(0, 0, w, h);

  // Golden particles rising from bottom to top
  for (let i = 0; i < titleParticles.length; i++) {
    const p = titleParticles[i];
    p.y -= p.speed;
    p.x += p.drift;
    if (p.y < -20) {
      p.y = h + Math.random() * 40;
      p.x = Math.random() * w;
    }
    if (p.x < -10) p.x = w + 10;
    if (p.x > w + 10) p.x = -10;
    const fade = Math.min(1, (h - p.y) / h);
    titleFlamesCtx.globalAlpha = p.opacity * (0.4 + 0.6 * fade);
    titleFlamesCtx.fillStyle = p.y > h * 0.6 ? "rgba(255, 200, 80, 0.9)" : "rgba(255, 230, 150, 0.85)";
    titleFlamesCtx.beginPath();
    titleFlamesCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    titleFlamesCtx.fill();
  }
  titleFlamesCtx.globalAlpha = 1;

  requestAnimationFrame(drawFlames);
}

const titleMusic = document.getElementById("title-music");

function startTitleMusic() {
  if (!titleMusic) return;
  const p = titleMusic.play();
  if (p && typeof p.catch === "function") p.catch(() => {});
}

function stopTitleMusic() {
  if (titleMusic) {
    titleMusic.pause();
    titleMusic.currentTime = 0;
  }
}

const STAGE_MUSIC_IDS = ["stage-music-0", "stage-music-1", "stage-music-2"];

function stopStageMusic() {
  STAGE_MUSIC_IDS.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.pause();
      el.currentTime = 0;
    }
  });
}

function startStageMusic(stageIndex) {
  if (stageIndex < 0 || stageIndex >= STAGE_MUSIC_IDS.length) return;
  stopStageMusic();
  const el = document.getElementById(STAGE_MUSIC_IDS[stageIndex]);
  if (!el) return;
  if (titleMusic) el.muted = titleMusic.muted;
  el.currentTime = 0;
  const p = el.play();
  if (p && typeof p.catch === "function") p.catch(() => {});
}

function startFromTitleScreen(mode, campaignStageIndex) {
  if (!titleScreenActive) return;
  titleScreenActive = false;
  stopTitleMusic();
  if (titleScreen) titleScreen.classList.add("hidden");
  canvas.focus();
  game.start(mode, campaignStageIndex);
}

const CRUSADER_STORAGE_KEY = "crusader_characters";

function getCrusaderCharacters() {
  try {
    const raw = localStorage.getItem(CRUSADER_STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveCrusaderCharacter(name, score) {
  const list = getCrusaderCharacters();
  const trimmed = (name || "").trim() || "Anonymous";
  const existing = list.find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
  const highScore = Math.max(existing ? existing.highScore : 0, score);
  const rest = list.filter((c) => c.name.toLowerCase() !== trimmed.toLowerCase());
  rest.push({ name: trimmed, highScore });
  rest.sort((a, b) => b.highScore - a.highScore);
  try {
    localStorage.setItem(CRUSADER_STORAGE_KEY, JSON.stringify(rest));
  } catch (e) {
    console.warn("Could not save crusader list", e);
  }
}

function clearAllCrusaderProgress() {
  try {
    localStorage.setItem(CRUSADER_STORAGE_KEY, "[]");
  } catch (e) {
    console.warn("Could not clear crusader list", e);
  }
}

let currentCrusaderName = "";

const titleMainMenu = document.getElementById("title-main-menu");
const titleOptionsPanel = document.getElementById("title-options-panel");
const titleOptionsBack = document.getElementById("title-options-back");
const titleNameScreen = document.getElementById("title-name-screen");
const titleNameList = document.getElementById("title-name-list");
const titleNameInput = document.getElementById("title-name-input");
const titleNameContinue = document.getElementById("title-name-continue");
const titleNameErase = document.getElementById("title-name-erase");
const titleEraseConfirm = document.getElementById("title-erase-confirm");
const titleEraseCancel = document.getElementById("title-erase-cancel");
const titleEraseConfirmBtn = document.getElementById("title-erase-confirm-btn");

function renderCrusaderList() {
  if (!titleNameList) return;
  const chars = getCrusaderCharacters();
  titleNameList.innerHTML = "";
  chars.forEach((c) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "title-name-char-btn";
    btn.innerHTML = `<span>${escapeHtml(c.name)}</span><span class="char-score">${Math.round(c.highScore)} pts</span>`;
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      currentCrusaderName = c.name;
      titleScreen.classList.remove("show-name");
      titleScreen.classList.add("show-menu");
    });
    li.appendChild(btn);
    titleNameList.appendChild(li);
  });
  if (titleNameErase) {
    if (chars.length === 0) {
      titleNameErase.setAttribute("disabled", "");
    } else {
      titleNameErase.removeAttribute("disabled");
    }
  }
  const listLabel = titleNameScreen ? titleNameScreen.querySelector(".title-name-list-label") : null;
  const newLabel = titleNameScreen ? titleNameScreen.querySelector(".title-name-new-label") : null;
  if (listLabel) {
    listLabel.textContent = chars.length === 0 ? "" : "Select a Crusader";
    listLabel.style.display = chars.length === 0 ? "none" : "";
  }
  if (newLabel) {
    newLabel.textContent = chars.length === 0 ? "Create a new Crusader" : "Or create a new Crusader";
  }
}

function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

function goToNameScreen() {
  renderCrusaderList();
  if (titleNameInput) {
    titleNameInput.value = "";
    titleNameContinue.disabled = true;
  }
}

if (titleNameInput) {
  titleNameInput.addEventListener("input", () => {
    if (titleNameContinue) titleNameContinue.disabled = !titleNameInput.value.trim();
  });
  titleNameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (titleNameInput.value.trim()) titleNameContinue.click();
    }
  });
}

if (titleNameContinue) {
  titleNameContinue.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const name = titleNameInput.value.trim();
    if (!name) return;
    currentCrusaderName = name;
    const list = getCrusaderCharacters();
    if (!list.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      saveCrusaderCharacter(name, 0);
    }
    titleScreen.classList.remove("show-name");
    titleScreen.classList.add("show-menu");
  });
}

if (titleNameErase) {
  titleNameErase.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (titleNameErase.hasAttribute("disabled")) return;
    if (titleEraseConfirm) titleEraseConfirm.classList.remove("hidden");
  });
}

if (titleEraseCancel) {
  titleEraseCancel.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (titleEraseConfirm) titleEraseConfirm.classList.add("hidden");
  });
}

if (titleEraseConfirmBtn) {
  titleEraseConfirmBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    clearAllCrusaderProgress();
    renderCrusaderList();
    if (titleEraseConfirm) titleEraseConfirm.classList.add("hidden");
  });
}

const VOLUME_MEDIA_KEYS = new Set(["VolumeUp", "VolumeDown", "VolumeMute", "AudioVolumeUp", "AudioVolumeDown", "AudioVolumeMute"]);

if (titleScreen) {
  titleScreen.addEventListener("click", (e) => {
    if (e.target.closest("#title-music-toggle")) return;
    if (!titleScreen.classList.contains("show-menu") && !titleScreen.classList.contains("show-name")) {
      startTitleMusic();
      titleScreen.classList.add("show-name");
      goToNameScreen();
      e.preventDefault();
      return;
    }
  });
}

window.addEventListener("keydown", (e) => {
  if (!titleScreenActive) return;
  if (VOLUME_MEDIA_KEYS.has(e.key)) return;
  if (!titleScreen.classList.contains("show-menu") && !titleScreen.classList.contains("show-name")) {
    startTitleMusic();
    titleScreen.classList.add("show-name");
    goToNameScreen();
    e.preventDefault();
    return;
  }
  if (titleOptionsPanel && !titleOptionsPanel.classList.contains("hidden")) {
    if (e.key === "Escape") {
      titleOptionsPanel.classList.add("hidden");
      e.preventDefault();
    }
    return;
  }
});

const campaignStageSelect = document.getElementById("campaign-stage-select");
const campaignStageBack = document.getElementById("campaign-stage-back");

function showCampaignStageSelect() {
  if (!campaignStageSelect) return;
  campaignStageSelect.classList.remove("hidden");
}

function hideCampaignStageSelect() {
  if (campaignStageSelect) campaignStageSelect.classList.add("hidden");
}

if (campaignStageSelect) {
  campaignStageSelect.addEventListener("click", (e) => {
    const btn = e.target.closest(".campaign-stage-btn[data-stage]");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const stageIndex = parseInt(btn.getAttribute("data-stage"), 10);
    if (stageIndex >= 0 && stageIndex < CAMPAIGN_STAGES.length) {
      hideCampaignStageSelect();
      startFromTitleScreen("campaign", stageIndex);
    }
  });
}
if (campaignStageBack) {
  campaignStageBack.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    hideCampaignStageSelect();
  });
}

const campaignTransitionCinematic = document.getElementById("campaign-transition-cinematic");
const campaignTransitionPanels = document.querySelectorAll(".campaign-transition-panel");

function showCampaignTransitionCinematic(transitionIndex) {
  if (!campaignTransitionCinematic || transitionIndex < 0 || transitionIndex > 2) return;
  campaignTransitionPanels.forEach((p, i) => p.classList.toggle("active", i === transitionIndex));
  campaignTransitionCinematic.classList.remove("hidden");

  function continueTransition() {
    campaignTransitionCinematic.classList.add("hidden");
    campaignTransitionPanels.forEach((p) => p.classList.remove("active"));
    campaignTransitionCinematic.removeEventListener("click", onTransitionClick);
    window.removeEventListener("keydown", onTransitionKey);

    if (transitionIndex < 2) {
      game.advanceCampaignToStage(transitionIndex + 1);
    } else {
      returnToTitleAfterCampaign();
    }
  }

  function onTransitionClick(e) {
    e.preventDefault();
    e.stopPropagation();
    continueTransition();
  }
  function onTransitionKey(e) {
    if (VOLUME_MEDIA_KEYS.has(e.key)) return;
    e.preventDefault();
    continueTransition();
  }

  campaignTransitionCinematic.addEventListener("click", onTransitionClick);
  window.addEventListener("keydown", onTransitionKey, { once: false });
}

function returnToTitleAfterCampaign() {
  game.gameOver = true;
  if (typeof stopStageMusic === "function") stopStageMusic();
  if (campaignTransitionCinematic) campaignTransitionCinematic.classList.add("hidden");
  if (ui.overlay) ui.overlay.classList.add("hidden");
  if (titleScreen) titleScreen.classList.remove("hidden");
  titleScreenActive = true;
  if (titleMusic) {
    titleMusic.currentTime = 0;
    const p = titleMusic.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
  }
}

const campaignCinematic = document.getElementById("campaign-cinematic");
const campaignPanels = document.querySelectorAll(".campaign-panel");
const CAMPAIGN_PANEL_COUNT = campaignPanels ? campaignPanels.length : 0;

function showCampaignCinematic() {
  if (!campaignCinematic || !campaignPanels.length) {
    startFromTitleScreen("campaign");
    return;
  }
  campaignCinematic.classList.remove("hidden");
  let currentPanel = 0;
  campaignPanels.forEach((p, i) => p.classList.toggle("active", i === 0));

  function advance() {
    campaignPanels[currentPanel].classList.remove("active");
    currentPanel++;
    if (currentPanel >= CAMPAIGN_PANEL_COUNT) {
      campaignCinematic.classList.add("hidden");
      removeAdvanceListeners();
      startFromTitleScreen("campaign");
      return;
    }
    campaignPanels[currentPanel].classList.add("active");
  }

  function removeAdvanceListeners() {
    campaignCinematic.removeEventListener("click", onAdvanceClick);
    window.removeEventListener("keydown", onAdvanceKey);
  }

  function onAdvanceClick(e) {
    e.preventDefault();
    e.stopPropagation();
    advance();
  }

  function onAdvanceKey(e) {
    if (VOLUME_MEDIA_KEYS.has(e.key)) return;
    e.preventDefault();
    advance();
  }

  campaignCinematic.addEventListener("click", onAdvanceClick);
  window.addEventListener("keydown", onAdvanceKey, { once: false });
}

if (titleMainMenu) {
  titleMainMenu.addEventListener("click", (e) => {
    const btn = e.target.closest(".title-menu-btn[data-menu]");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const menu = btn.getAttribute("data-menu");
    if (menu === "campaign") {
      showCampaignStageSelect();
    } else if (menu === "endless") {
      startFromTitleScreen("endless");
    } else if (menu === "options") {
      if (titleOptionsPanel) titleOptionsPanel.classList.remove("hidden");
    } else if (menu === "exit") {
      titleScreen.classList.remove("show-menu");
      titleScreen.classList.remove("show-name");
    }
  });
}

if (titleOptionsBack) {
  titleOptionsBack.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (titleOptionsPanel) titleOptionsPanel.classList.add("hidden");
  });
}

startTitleMusic();

const titleMusicToggle = document.getElementById("title-music-toggle");
const titleMusicToggleIcon = document.querySelector(".title-music-toggle-icon");
if (titleMusicToggle && titleMusic && titleMusicToggleIcon) {
  function updateMusicToggleLabel() {
    const muted = titleMusic.muted;
    titleMusicToggle.classList.toggle("is-muted", muted);
    titleMusicToggleIcon.textContent = muted ? "🔇" : "🔊";
    titleMusicToggle.setAttribute("aria-label", muted ? "Unmute music" : "Mute music");
    titleMusicToggle.setAttribute("title", muted ? "Unmute music" : "Mute music");
  }
  titleMusicToggle.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    titleMusic.muted = !titleMusic.muted;
    if (!titleMusic.muted) {
      const p = titleMusic.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    }
    updateMusicToggleLabel();
  });
  updateMusicToggleLabel();
}

if (titleFlamesCtx) requestAnimationFrame(drawFlames);

const game = new Game();

ui.playAgainBtn.addEventListener("click", () => {
  game.reset();
});

ui.saveScoreBtn.addEventListener("click", async () => {
  if (!game.lastResult) return;
  const nameRaw = ui.playerNameInput.value.trim();
  const name = nameRaw || "Anonymous";
  try {
    await fetch(API_BASE + "/api/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        score: game.lastResult.score,
        survivedSeconds: game.lastResult.survivedSeconds
      })
    });
    saveCrusaderCharacter(name, game.lastResult.score);
    await fetchLeaderboard();
  } catch (err) {
    console.error("Failed to save score", err);
  }
});

async function fetchLeaderboard() {
  try {
    const res = await fetch(API_BASE + "/api/leaderboard");
    if (!res.ok) throw new Error("Bad response");
    const data = await res.json();
    const scores = Array.isArray(data.scores) ? data.scores : [];
    ui.leaderboardList.innerHTML = "";
    scores.forEach((entry, idx) => {
      const li = document.createElement("li");
      const nameSpan = document.createElement("span");
      nameSpan.className = "name";
      nameSpan.textContent = `${idx + 1}. ${entry.name}`;
      const scoreSpan = document.createElement("span");
      scoreSpan.className = "score";
      scoreSpan.textContent = `${Math.round(entry.score)} · ${Math.floor(
        entry.survivedSeconds || 0
      )}s`;
      li.appendChild(nameSpan);
      li.appendChild(scoreSpan);
      ui.leaderboardList.appendChild(li);
    });
  } catch (err) {
    console.error("Failed to fetch leaderboard", err);
  }
}

