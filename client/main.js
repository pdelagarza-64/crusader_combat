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

const GAME_WIDTH = canvas.width;
const GAME_HEIGHT = canvas.height;

const ANIM_FPS = 20;
const ANIM_FRAME_DT = 1 / ANIM_FPS;

function animFrame(animTime, numFrames) {
  return Math.floor(animTime * ANIM_FPS) % Math.max(1, numFrames);
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
  const len = Math.max(w, h) * 1.5;
  for (let i = -len; i <= len; i += spacing) {
    ctx.beginPath();
    ctx.moveTo(i, -len);
    ctx.lineTo(i, len);
    ctx.stroke();
  }
  ctx.rotate(Math.PI / 2);
  for (let i = -len; i <= len; i += spacing) {
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

function drawKnightHumanoid(ctx, state, frame, facing) {
  const ink = "#0a0a0c";
  const skinLit = "#c4b8a8";
  const skinShadow = "#8a7e70";
  const uniformLit = "#4a5248";
  const uniformShadow = "#2a3028";
  const cloakLit = "#e8e4dc";
  const cloakShadow = "#9a968e";
  const strapLit = "#5c4a38";
  const strapShadow = "#2a2218";
  const bladeLit = "#b0acaa";
  const bladeShadow = "#505050";
  const shieldLit = "#3a3835";
  const shieldShadow = "#1a1815";

  const pelvisY = -12;
  const shoulderY = -36;
  const shoulderX = 11;
  const hipX = 5.5;
  const thighLen = 15;
  const calfLen = 15;
  const upperArmLen = 13;
  const forearmLen = 14;
  const neckLen = 5;
  const headH = 14;
  const headW = 11;
  const headY = -54;
  const thighR = 5.5;
  const calfRTop = 4.5;
  const calfRBottom = 3.2;
  const upperArmR = 4.2;
  const forearmR = 3.2;
  const wristR = 2.4;

  const idleFrame = { lThigh: 0, lCalf: 0.05, rThigh: 0, rCalf: -0.05, lArm: 0.12, rArm: -0.12 };
  const walkFrames = [
    { lThigh: -0.55, lCalf: 0.9, rThigh: 0.5, rCalf: -0.65, lArm: 0.4, rArm: -0.35 },
    { lThigh: -0.2, lCalf: 0.3, rThigh: 0.2, rCalf: -0.2, lArm: 0.1, rArm: -0.1 },
    { lThigh: 0.5, lCalf: -0.65, rThigh: -0.55, rCalf: 0.9, lArm: -0.35, rArm: 0.4 },
    { lThigh: 0.2, lCalf: -0.2, rThigh: -0.2, rCalf: 0.3, lArm: -0.1, rArm: 0.1 }
  ];
  const attackFrames = [
    { swordAngle: 0.4 },
    { swordAngle: 0.0 },
    { swordAngle: -0.5 },
    { swordAngle: -1.0 }
  ];
  const jumpFrames = [
    { armRaise: 0.7 },
    { armRaise: 0.3 }
  ];

  const w = state === "walk" ? walkFrames[frame % 4] : state === "attack" ? attackFrames[Math.min(frame, 3)] : state === "jump" ? jumpFrames[frame % 2] : idleFrame;

  function legEnd(hipX, hipY, thighA, calfA) {
    const kx = Math.sin(thighA);
    const ky = -Math.cos(thighA);
    const kneeX = hipX + thighLen * kx;
    const kneeY = hipY + thighLen * ky;
    const calfA2 = thighA + calfA;
    const kx2 = Math.sin(calfA2);
    const ky2 = -Math.cos(calfA2);
    return { kneeX, kneeY, footX: kneeX + calfLen * kx2, footY: kneeY + calfLen * ky2 };
  }

  const leftLeg = legEnd(-hipX, pelvisY, w.lThigh ?? 0, w.lCalf ?? 0);
  const rightLeg = legEnd(hipX, pelvisY, w.rThigh ?? 0, w.rCalf ?? 0);

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  drawCapsule(ctx, -hipX, pelvisY, leftLeg.kneeX, leftLeg.kneeY, thighR, thighR * 0.95, skinLit, ink);
  drawCapsule(ctx, leftLeg.kneeX, leftLeg.kneeY, leftLeg.footX, leftLeg.footY, calfRTop, calfRBottom, skinLit, ink);
  drawCapsule(ctx, hipX, pelvisY, rightLeg.kneeX, rightLeg.kneeY, thighR, thighR * 0.95, skinShadow, ink);
  drawCapsule(ctx, rightLeg.kneeX, rightLeg.kneeY, rightLeg.footX, rightLeg.footY, calfRTop, calfRBottom, skinShadow, ink);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-11, pelvisY - 24);
  ctx.lineTo(-12, headY + 4);
  ctx.lineTo(0, headY - 2);
  ctx.lineTo(12, headY + 4);
  ctx.lineTo(11, pelvisY - 24);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = cloakShadow;
  ctx.fillRect(-14, pelvisY - 30, 28, 50);
  ctx.fillStyle = cloakLit;
  ctx.fillRect(-10, pelvisY - 26, 14, 48);
  drawCrossHatch(ctx, 2, pelvisY - 28, 12, 46, 0.4, 3, "rgba(0,0,0,0.35)", 0.6);
  ctx.restore();
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-11, pelvisY - 24);
  ctx.lineTo(-12, headY + 4);
  ctx.lineTo(0, headY - 2);
  ctx.lineTo(12, headY + 4);
  ctx.lineTo(11, pelvisY - 24);
  ctx.closePath();
  ctx.stroke();

  const chestTop = shoulderY + 4;
  const waistW = 10;
  const chestW = 14;
  ctx.fillStyle = uniformLit;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-waistW / 2, pelvisY);
  ctx.lineTo(-chestW / 2, chestTop);
  ctx.quadraticCurveTo(-chestW / 2 - 1, shoulderY - 2, -shoulderX - 2, shoulderY);
  ctx.lineTo(shoulderX + 2, shoulderY);
  ctx.quadraticCurveTo(chestW / 2 + 1, shoulderY - 2, chestW / 2, chestTop);
  ctx.lineTo(waistW / 2, pelvisY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-waistW / 2, pelvisY);
  ctx.lineTo(-chestW / 2, chestTop);
  ctx.quadraticCurveTo(-chestW / 2 - 1, shoulderY - 2, -shoulderX - 2, shoulderY);
  ctx.lineTo(shoulderX + 2, shoulderY);
  ctx.quadraticCurveTo(chestW / 2 + 1, shoulderY - 2, chestW / 2, chestTop);
  ctx.lineTo(waistW / 2, pelvisY);
  ctx.closePath();
  ctx.clip();
  drawCrossHatch(ctx, 2, pelvisY - 26, 8, 26, 0.5, 2.5, "rgba(0,0,0,0.3)", 0.5);
  ctx.restore();

  ctx.fillStyle = strapLit;
  ctx.fillRect(-9.5, pelvisY - 16, 2.5, 12);
  ctx.fillRect(7, pelvisY - 16, 2.5, 12);
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1;
  ctx.strokeRect(-9.5, pelvisY - 16, 2.5, 12);
  ctx.strokeRect(7, pelvisY - 16, 2.5, 12);

  const neckTop = headY - headH / 2 + 2;
  drawCapsule(ctx, 0, shoulderY + 6, 0, neckTop, 3, 3.5, skinLit, ink);
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, headY, headW / 2, headH / 2, 0, 0, Math.PI * 2);
  ctx.clip();
  drawCrossHatch(ctx, 2, headY - headH / 2, headW * 0.5, headH, -0.2, 2, "rgba(0,0,0,0.2)", 0.5);
  ctx.restore();
  ctx.fillStyle = skinLit;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(0, headY, headW / 2, headH / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  const lArmA = (state === "walk" && w.lArm != null) ? w.lArm : state === "jump" ? (w.armRaise ?? 0) : state === "block" ? -0.2 : 0.15;
  const rArmA = (state === "walk" && w.rArm != null) ? w.rArm : state === "attack" && w.swordAngle != null ? w.swordAngle : state === "jump" ? -(w.armRaise ?? 0) : -0.15;

  const lShoulderX = -shoulderX;
  const lElbowX = lShoulderX + upperArmLen * Math.sin(lArmA);
  const lElbowY = shoulderY + upperArmLen * Math.cos(lArmA);
  const rShoulderX = shoulderX;
  const rElbowX = rShoulderX + upperArmLen * Math.sin(rArmA);
  const rElbowY = shoulderY + upperArmLen * Math.cos(rArmA);

  const blockAngle = state === "block" ? -0.15 : 0;
  const lForearmA = state === "block" ? lArmA + 0.5 : lArmA;
  const lHandX = lElbowX + forearmLen * Math.sin(lForearmA);
  const lHandY = lElbowY + forearmLen * Math.cos(lForearmA);

  drawCapsule(ctx, lShoulderX, shoulderY, lElbowX, lElbowY, upperArmR, upperArmR * 0.9, skinLit, ink);
  drawCapsule(ctx, lElbowX, lElbowY, lHandX, lHandY, forearmR, wristR, skinLit, ink);
  drawCapsule(ctx, rShoulderX, shoulderY, rElbowX, rElbowY, upperArmR, upperArmR * 0.9, skinShadow, ink);

  if (state === "block") {
    ctx.save();
    ctx.translate((lHandX + lElbowX) / 2, (lHandY + lElbowY) / 2);
    ctx.rotate(lForearmA);
    const sg = ctx.createLinearGradient(-10, 0, 10, 0);
    sg.addColorStop(0, shieldLit);
    sg.addColorStop(1, shieldShadow);
    ctx.fillStyle = sg;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.roundRect(-8, -18, 16, 36, 4);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,250,240,0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(0, 14);
    ctx.moveTo(-6, 0);
    ctx.lineTo(6, 0);
    ctx.stroke();
    ctx.restore();
  } else {
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.5;
  }

  const swordAngle = state === "attack" && w.swordAngle != null ? w.swordAngle : -0.25;
  const rHandX = rElbowX + forearmLen * Math.sin(swordAngle);
  const rHandY = rElbowY + forearmLen * Math.cos(swordAngle);
  const swordLen = 44;
  const swordTipX = rHandX + swordLen * Math.sin(swordAngle - 0.08);
  const swordTipY = rHandY + swordLen * Math.cos(swordAngle - 0.08);

  drawCapsule(ctx, rElbowX, rElbowY, rHandX, rHandY, forearmR, wristR, skinShadow, ink);
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(rHandX, rHandY);
  ctx.lineTo(swordTipX, swordTipY);
  ctx.stroke();
  const bladeGrad = ctx.createLinearGradient(rHandX, rHandY, swordTipX, swordTipY);
  bladeGrad.addColorStop(0, bladeShadow);
  bladeGrad.addColorStop(0.3, bladeLit);
  bladeGrad.addColorStop(0.7, bladeLit);
  bladeGrad.addColorStop(1, bladeShadow);
  ctx.strokeStyle = bladeGrad;
  ctx.lineWidth = 2.2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(rHandX, rHandY);
  ctx.lineTo(swordTipX, swordTipY);
  ctx.stroke();
  ctx.fillStyle = strapShadow;
  ctx.fillRect(rHandX - 2.5, rHandY - 3, 5, 8);
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1;
  ctx.strokeRect(rHandX - 2.5, rHandY - 3, 5, 8);
}

function drawDemonHumanoid(ctx, frame) {
  const ink = "#0a0a0c";
  const skinLit = "#d4c8b8";
  const skinShadow = "#9a8e7e";
  const muscleShadow = "#2a2520";
  const eyeWhite = "rgba(255,252,248,0.5)";
  const eyeHollow = "rgba(40,38,36,0.9)";

  const pelvisY = -11;
  const shoulderY = -30;
  const shoulderX = 9;
  const hipX = 5;
  const thighLen = 14;
  const calfLen = 14;
  const armLen = 12;
  const headY = -48;
  const headW = 10;
  const headH = 12;
  const thighR = 4.8;
  const calfRTop = 3.8;
  const calfRBottom = 2.8;
  const armR = 3.5;
  const wristR = 2.6;

  const walkFrames = [
    { lThigh: -0.5, lCalf: 0.85, rThigh: 0.45, rCalf: -0.6, lArm: 0.35, rArm: -0.3 },
    { lThigh: -0.15, lCalf: 0.25, rThigh: 0.15, rCalf: -0.2, lArm: 0.08, rArm: -0.08 },
    { lThigh: 0.45, lCalf: -0.6, rThigh: -0.5, rCalf: 0.85, lArm: -0.3, rArm: 0.35 },
    { lThigh: 0.15, lCalf: -0.2, rThigh: -0.15, rCalf: 0.25, lArm: -0.08, rArm: 0.08 }
  ];
  const w = walkFrames[frame % 4];

  function legEnd(hipX, hipY, thighA, calfA) {
    const kx = Math.sin(thighA);
    const ky = -Math.cos(thighA);
    const kneeX = hipX + thighLen * kx;
    const kneeY = hipY + thighLen * ky;
    const calfA2 = thighA + calfA;
    const kx2 = Math.sin(calfA2);
    const ky2 = -Math.cos(calfA2);
    return { kneeX, kneeY, footX: kneeX + calfLen * kx2, footY: kneeY + calfLen * ky2 };
  }

  const leftLeg = legEnd(-hipX, pelvisY, w.lThigh, w.lCalf);
  const rightLeg = legEnd(hipX, pelvisY, w.rThigh, w.rCalf);

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  drawCapsule(ctx, -hipX, pelvisY, leftLeg.kneeX, leftLeg.kneeY, thighR, thighR * 0.9, skinLit, ink);
  drawCapsule(ctx, leftLeg.kneeX, leftLeg.kneeY, leftLeg.footX, leftLeg.footY, calfRTop, calfRBottom, skinLit, ink);
  drawCapsule(ctx, hipX, pelvisY, rightLeg.kneeX, rightLeg.kneeY, thighR, thighR * 0.9, skinShadow, ink);
  drawCapsule(ctx, rightLeg.kneeX, rightLeg.kneeY, rightLeg.footX, rightLeg.footY, calfRTop, calfRBottom, skinShadow, ink);

  const chestTop = shoulderY + 4;
  const waistW = 9;
  const chestW = 12;
  ctx.fillStyle = skinLit;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-waistW / 2, pelvisY);
  ctx.lineTo(-chestW / 2, chestTop);
  ctx.quadraticCurveTo(-chestW / 2 - 0.5, shoulderY - 1, -shoulderX - 1, shoulderY);
  ctx.lineTo(shoulderX + 1, shoulderY);
  ctx.quadraticCurveTo(chestW / 2 + 0.5, shoulderY - 1, chestW / 2, chestTop);
  ctx.lineTo(waistW / 2, pelvisY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-waistW / 2, pelvisY);
  ctx.lineTo(-chestW / 2, chestTop);
  ctx.quadraticCurveTo(-chestW / 2 - 0.5, shoulderY - 1, -shoulderX - 1, shoulderY);
  ctx.lineTo(shoulderX + 1, shoulderY);
  ctx.quadraticCurveTo(chestW / 2 + 0.5, shoulderY - 1, chestW / 2, chestTop);
  ctx.lineTo(waistW / 2, pelvisY);
  ctx.closePath();
  ctx.clip();
  drawCrossHatch(ctx, 2, pelvisY - 22, 7, 22, 0.4, 2.5, "rgba(0,0,0,0.35)", 0.5);
  ctx.restore();

  const neckTop = headY - headH / 2 + 1;
  drawCapsule(ctx, 0, shoulderY + 5, 0, neckTop, 2.8, 3.2, skinLit, ink);
  ctx.fillStyle = skinLit;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(0, headY, headW / 2, headH / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, headY, headW / 2, headH / 2, 0, 0, Math.PI * 2);
  ctx.clip();
  drawCrossHatch(ctx, 2, headY - headH / 2, headW * 0.5, headH, -0.15, 2, "rgba(0,0,0,0.28)", 0.5);
  ctx.restore();

  const lHandX = -shoulderX + armLen * Math.sin(w.lArm);
  const lHandY = shoulderY + armLen * Math.cos(w.lArm);
  const rHandX = shoulderX + armLen * Math.sin(w.rArm);
  const rHandY = shoulderY + armLen * Math.cos(w.rArm);

  drawCapsule(ctx, -shoulderX, shoulderY, lHandX, lHandY, armR, wristR, skinLit, ink);
  drawCapsule(ctx, shoulderX, shoulderY, rHandX, rHandY, armR, wristR, skinShadow, ink);

  ctx.fillStyle = eyeWhite;
  ctx.beginPath();
  ctx.arc(-5, headY - 2, 3.5, 0, Math.PI * 2);
  ctx.arc(5, headY - 2, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = ink;
  ctx.stroke();
  ctx.fillStyle = eyeHollow;
  ctx.beginPath();
  ctx.arc(-5, headY - 2, 2.2, 0, Math.PI * 2);
  ctx.arc(5, headY - 2, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = muscleShadow;
  ctx.beginPath();
  ctx.moveTo(-7, headY + 2);
  ctx.quadraticCurveTo(0, headY + 12, 7, headY + 2);
  ctx.lineTo(7, headY + 5);
  ctx.quadraticCurveTo(0, headY + 16, -7, headY + 5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = "#1a1815";
  ctx.beginPath();
  ctx.moveTo(-4, headY + 6);
  ctx.lineTo(-2, headY + 14);
  ctx.lineTo(0, headY + 10);
  ctx.lineTo(2, headY + 14);
  ctx.lineTo(4, headY + 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-12, headY - 2);
  ctx.lineTo(-6, headY - 14);
  ctx.moveTo(12, headY - 2);
  ctx.lineTo(6, headY - 14);
  ctx.stroke();
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

window.addEventListener("keydown", e => {
  if (isTypingInOverlay()) return;
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
  }

  getState() {
    if (this.blocking) return "block";
    if (this.attackCooldown > 0.05) return "attack";
    if (!this.onGround) return "jump";
    if (Math.abs(this.vx) > 20) return "walk";
    return "idle";
  }

  update(dt, demons) {
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

    const groundY = GAME_HEIGHT - 40;
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

    demons.forEach(demon => {
      if (!demon.alive) return;
      if (rectsOverlap(hitbox, demon)) {
        demon.takeHit();
        this.score += 25;
      }
    });
  }

  takeHit(damage) {
    if (this.invulnTime > 0) return;
    let finalDamage = damage;
    if (this.blocking) {
      finalDamage = Math.round(damage * 0.35);
    }
    this.health -= finalDamage;
    if (this.health < 0) this.health = 0;
    this.invulnTime = 0.8;
  }

  draw(ctx) {
    const groundY = GAME_HEIGHT - 40;
    const shadowY = groundY - 4;
    const centerX = this.x + this.w / 2;

    ctx.save();
    drawInkShadow(ctx, centerX, shadowY, this.w * 0.55, 14, 0.68);
    ctx.restore();

    const footOffsetY = 42;
    ctx.save();
    ctx.translate(this.x + this.w / 2, this.y + this.h + footOffsetY);
    ctx.scale(this.facing, 1);

    if (this.invulnTime > 0 && Math.floor(this.invulnTime * 20) % 2 === 0) {
      ctx.globalAlpha = 0.4;
    }

    const state = this.getState();
    let frame = 0;
    if (state === "attack") {
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

    drawKnightHumanoid(ctx, state, frame, this.facing);
    ctx.restore();
  }
}

class Demon extends Entity {
  constructor(x, level) {
    const w = 42;
    const h = 54;
    const groundY = GAME_HEIGHT - 40;
    super(x, groundY - h, w, h);
    this.speed = 90 + level * 12 + Math.random() * 15;
    this.damage = 12 + level * 2;
    this.alive = true;
    this.attackCooldown = 0;
    this.animTime = 0;
    this.facing = -1;
  }

  update(dt, knight) {
    if (!this.alive) return;
    const dir = knight.x < this.x ? -1 : 1;
    this.facing = dir;
    this.vx = dir * this.speed;

    this.x += this.vx * dt;

    const groundY = GAME_HEIGHT - 40;
    this.y = groundY - this.h;

    if (this.attackCooldown > 0) this.attackCooldown -= dt;

    if (rectsOverlap(this, knight) && this.attackCooldown <= 0) {
      knight.takeHit(this.damage);
      this.attackCooldown = 0.9;
    }

    this.animTime += dt;
  }

  takeHit() {
    this.alive = false;
  }

  draw(ctx) {
    if (!this.alive) return;
    const groundY = GAME_HEIGHT - 40;
    const shadowY = groundY - 4;
    const centerX = this.x + this.w / 2;

    ctx.save();
    drawInkShadow(ctx, centerX, shadowY, this.w * 0.5, 12, 0.75);
    ctx.restore();

    const footOffsetY = 39;
    ctx.save();
    ctx.translate(this.x + this.w / 2, this.y + this.h + footOffsetY);
    ctx.scale(this.facing, 1);

    const frame = animFrame(this.animTime, 4);
    drawDemonHumanoid(ctx, frame);

    ctx.restore();
  }
}

function rectsOverlap(a, b) {
  return !(
    a.right <= b.left ||
    a.left >= b.right ||
    a.bottom <= b.top ||
    a.top >= b.bottom
  );
}

class Game {
  constructor() {
    this.knight = new Knight();
    this.demons = [];
    this.spawnTimer = 0;
    this.spawnInterval = 2.4;
    this.level = 1;
    this.time = 0;
    this.gameOver = false;
    this.lastTimestamp = 0;
    this.demonPressure = 0;
    this.loop = this.loop.bind(this);
  }

  reset() {
    this.knight = new Knight();
    this.demons = [];
    this.spawnTimer = 0;
    this.spawnInterval = 2.4;
    this.level = 1;
    this.time = 0;
    this.demonPressure = 0;
    this.gameOver = false;
    this.lastTimestamp = performance.now();
    ui.overlay.classList.add("hidden");
    canvas.focus();
    requestAnimationFrame(this.loop);
  }

  start() {
    this.lastTimestamp = performance.now();
    canvas.focus();
    requestAnimationFrame(this.loop);
  }

  spawnDemon() {
    const margin = 80;
    const spawnLeft = Math.random() < 0.5;
    const x = spawnLeft ? 20 : GAME_WIDTH - margin;
    this.demons.push(new Demon(x, this.level));
  }

  update(dt) {
    if (this.gameOver) return;

    this.time += dt;

    const baseInterval = 2.0;
    const difficultyFactor = 0.08;
    this.spawnInterval = Math.max(0.6, baseInterval - this.level * difficultyFactor);
    this.spawnTimer += dt;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      this.spawnDemon();
      if (this.time > 5 && this.time % 15 < 0.04) {
        this.level++;
      }
    }

    this.knight.update(dt, this.demons);

    this.demons.forEach(demon => demon.update(dt, this.knight));

    this.demons = this.demons.filter(d => d.alive || d.x > -80 && d.x < GAME_WIDTH + 80);

    const baseScore = dt * 12;
    const demonsNearby = this.demons.filter(d => d.alive && Math.abs(d.x - this.knight.x) < 220).length;
    const pressureMultiplier = 1 + demonsNearby * 0.32;
    this.knight.score += baseScore * pressureMultiplier;

    if (this.knight.health <= 0) {
      this.endGame(false);
    }

    const pressure = Math.min(1, this.demons.length / 10 + demonsNearby / 6);
    this.demonPressure = this.demonPressure * 0.92 + pressure * 0.08;

    this.updateHud();
  }

  updateHud() {
    const healthRatio = Math.max(0, this.knight.health / this.knight.maxHealth);
    ui.playerHealth.style.width = `${healthRatio * 100}%`;
    const tideRatio = Math.min(1, this.demonPressure);
    ui.demonTide.style.width = `${tideRatio * 100}%`;

    ui.score.textContent = Math.round(this.knight.score).toString();
    ui.time.textContent = `${Math.floor(this.time)}s`;
  }

  drawBackground(ctx) {
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

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

    const groundGrad = ctx.createLinearGradient(0, 0, 0, 50);
    groundGrad.addColorStop(0, "#1a1c20");
    groundGrad.addColorStop(0.5, "#0e1014");
    groundGrad.addColorStop(1, "#06080a");
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, GAME_HEIGHT - 40, GAME_WIDTH, 40);
    ctx.fillStyle = "#25282e";
    ctx.fillRect(0, GAME_HEIGHT - 40, GAME_WIDTH, 3);
    ctx.strokeStyle = "#0d0f12";
    ctx.lineWidth = 1;
    for (let i = 0; i < 12; i++) {
      ctx.beginPath();
      ctx.moveTo(0, GAME_HEIGHT - 40 + i * 3.5);
      ctx.lineTo(GAME_WIDTH, GAME_HEIGHT - 40 + i * 3.5);
      ctx.stroke();
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

  draw(ctx) {
    this.drawBackground(ctx);
    this.knight.draw(ctx);
    this.demons.forEach(d => d.draw(ctx));
  }

  loop(timestamp) {
    const dt = Math.min(0.05, (timestamp - this.lastTimestamp) / 1000);
    this.lastTimestamp = timestamp;
    this.update(dt);
    this.draw(ctx);
    if (!this.gameOver) {
      requestAnimationFrame(this.loop);
    }
  }

  endGame(victory) {
    this.gameOver = true;
    ui.overlayTitle.textContent = victory ? "Victory" : "Fallen Crusader";
    const finalScore = Math.round(this.knight.score);
    const survivedSeconds = Math.floor(this.time);
    ui.overlayMessage.textContent = `Score: ${finalScore} · Time: ${survivedSeconds}s`;
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

function drawFlames() {
  if (!titleFlamesCtx || !titleScreenActive) return;

  flameTime += 0.025;
  const w = window.innerWidth;
  const h = window.innerHeight;

  const baseGrad = titleFlamesCtx.createLinearGradient(0, h, 0, 0);
  baseGrad.addColorStop(0, "#0a0400");
  baseGrad.addColorStop(0.15, "#1a0800");
  baseGrad.addColorStop(0.35, "#4a1800");
  baseGrad.addColorStop(0.55, "#8a3000");
  baseGrad.addColorStop(0.75, "#c85000");
  baseGrad.addColorStop(0.9, "#e87820");
  baseGrad.addColorStop(1, "#2a1000");
  titleFlamesCtx.fillStyle = baseGrad;
  titleFlamesCtx.fillRect(0, 0, w, h);

  const layerCount = 12;
  for (let i = 0; i < layerCount; i++) {
    const phase = (i / layerCount) * Math.PI * 2 + flameTime * 2;
    const yBase = h * (0.4 + 0.5 * (i / layerCount)) + Math.sin(flameTime + i * 0.7) * 15;
    const xOff = Math.sin(flameTime * 1.3 + i * 0.5) * 80 + Math.cos(flameTime * 0.8) * 40;
    const peak = 80 + Math.sin(flameTime + i) * 40;
    const grad = titleFlamesCtx.createRadialGradient(
      w / 2 + xOff, yBase + peak, 0,
      w / 2 + xOff, yBase + peak, 120 + i * 25
    );
    const alpha = 0.15 + 0.12 * (Math.sin(phase) * 0.5 + 0.5);
    grad.addColorStop(0, `rgba(255, 180, 80, ${alpha})`);
    grad.addColorStop(0.4, `rgba(220, 100, 20, ${alpha * 0.6})`);
    grad.addColorStop(0.8, "rgba(120, 40, 0, 0)");
    grad.addColorStop(1, "rgba(0, 0, 0, 0)");
    titleFlamesCtx.fillStyle = grad;
    titleFlamesCtx.fillRect(0, 0, w, h);
  }

  for (let i = 0; i < 8; i++) {
    const t = flameTime + i * 0.8;
    const x = (w / 2) + Math.sin(t) * 200 + Math.cos(t * 0.6) * 100;
    const y = h - 60 + (i % 3) * 25 + Math.sin(t * 1.2) * 20;
    const r = 60 + Math.sin(t * 0.9) * 25;
    const grad = titleFlamesCtx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, "rgba(255, 200, 100, 0.35)");
    grad.addColorStop(0.5, "rgba(240, 120, 40, 0.2)");
    grad.addColorStop(1, "rgba(80, 20, 0, 0)");
    titleFlamesCtx.fillStyle = grad;
    titleFlamesCtx.beginPath();
    titleFlamesCtx.ellipse(x, y, r * 0.8, r, 0, 0, Math.PI * 2);
    titleFlamesCtx.fill();
  }

  requestAnimationFrame(drawFlames);
}

function startFromTitleScreen() {
  if (!titleScreenActive) return;
  titleScreenActive = false;
  if (titleScreen) titleScreen.classList.add("hidden");
  canvas.focus();
  game.start();
}

if (titleScreen) {
  titleScreen.addEventListener("click", startFromTitleScreen);
}
window.addEventListener("keydown", (e) => {
  if (titleScreenActive) {
    e.preventDefault();
    startFromTitleScreen();
  }
});

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

