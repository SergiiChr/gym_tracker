/**
 * <finish-runner> countdown indicator.
 * A stick figure sprints in place while the ground scrolls under him and a finish line comes in from off-screen.
 * The line reaches him exactly when the countdown ends.
 * `reset()` restarts the countdown: a bar flies in, knocks him down, he gets up and still makes it on time.
 *
 * Everything is driven by timestamps, so the finish lands on the exact millisecond at any refresh rate.
 * The canvas only redraws while something moves, and stops redrawing when scrolled out of view.
 */

const TAU = Math.PI * 2;
const DEFAULT_DURATION = 3000;

// Reset timeline in ms.
// The bar flies in for BAR_IN before contact, so the hit reads as a collision rather than a teleport.
const BAR_IN = 130;
const HIT_STOP = 70;
const RECOVER = 1350; // contact until he is back in the blocks, hit-stop included
const BLEND = 150; // cross-fade into the cheer
const SET_HOLD = 150; // pause in the blocks before the first launch
const LAUNCH = 400; // ramp from standstill to full sprint
const RISE = 300; // rise out of the blocks into the stride
const BAR_FALL = 380;
const BURST = 260;
const SHAKE = 220;
const DECEL = 500; // runs on past the line while slowing down
const CHEER = 450; // arms-up celebration after he stops
const DIP = 0.35; // extra lean as his chest crosses the line
const DIP_WIDTH = 110; // ms

// Body proportions in figure heights.
const TORSO = 0.3;
const NECK = 0.13;
const HEAD = 0.075;
const THIGH = 0.24;
const SHIN = 0.24;
const UPPER_ARM = 0.17;
const FOREARM = 0.16;
const STROKE = 0.085;
const SOLE = STROKE / 2; // lifts stroke ends onto the ground line instead of sinking half the stroke into it

// Sprint stride, in figure heights.
const STRIDE_HZ = 2.6;
const CYCLE = 1000 / STRIDE_HZ;
const STANCE = 0.3; // share of the cycle each foot is planted, the rest of a step is airborne
const LIFT = 0.12; // airborne peak above the line between push-off and strike heights
const STRIKE_X = 0.14; // planted foot relative to the hip
const PUSH_X = -0.32; // far enough back that foot, hip and head line up at push-off
const LEAN = 0.85;
const DUST = 0.1; // share of the cycle a toe-off dust kick lasts
/** Ground speed in figure heights per ms, set so a planted foot moves exactly with the ground. */
const SPEED = (STRIKE_X - PUSH_X) / (STANCE * CYCLE);

/*
 * Pose slots: [x, y, lean, headTilt, frontShoulder, frontElbow, backShoulder, backElbow, frontHip, frontKnee, backHip, backKnee].
 * x and y place the hip in figure heights, for keyframes y is only a minimum because poses are pushed up out of the ground.
 * Limb angles are relative to the torso and positive swings forward.
 * Elbows bend forward, knees bend backward.
 */
const POSE_SIZE = 12;

/** Crouched in the blocks: hips up, hands down under the shoulders, front foot under the hip, back leg behind. */
const SET = setPose();

function setPose() {
  const p = [0, 0.42, 1.75, -0.2, 1.58, 0.35, 1.53, 0.35, 0, 0, 0, 0];
  legIk(0, SOLE - p[1], p, 8);
  legIk(-0.25, SOLE - p[1], p, 10);
  p[8] += p[2];
  p[10] += p[2];
  ground(p, new Float64Array(22), false);
  return p;
}

/** @type {[number, number[]][]} ms after contact → pose, ending back in the blocks */
const FALL = [
  [0, [0, 0.47, -0.35, -0.5, 1.9, 0.2, 1.3, 0.3, 0.7, 0.2, -0.2, 0.6]],
  [HIT_STOP, [0, 0.47, -0.35, -0.5, 1.9, 0.2, 1.3, 0.3, 0.7, 0.2, -0.2, 0.6]],
  [230, [-0.25, 0.55, -1.0, -0.3, 2.6, 0.4, 2.2, 0.6, 1.5, 0.3, 1.0, 0.8]],
  [400, [-0.45, 0, -1.55, 0.1, 2.9, 0.3, 2.5, 0.4, 1.6, 0.7, 1.3, 1.0]],
  [480, [-0.45, 0.08, -1.45, 0, 1.2, 0.3, 0.8, 0.3, 1.2, 1.2, 0.9, 1.4]],
  [600, [-0.45, 0, -1.57, 0.15, 0.3, 0.2, -0.2, 0.3, 0.9, 1.6, 0.7, 1.8]],
  [760, [-0.45, 0, -1.55, 0.25, 0.35, 0.3, -0.15, 0.3, 0.95, 1.7, 0.75, 1.8]],
  [950, [-0.35, 0, -0.1, 0.25, -0.6, 0.1, -0.4, 0.2, 2.1, 2.1, 1.8, 1.9]],
  [1100, [-0.1, 0, 1.0, 0, 1.2, 0.2, 0.9, 0.3, 1.8, 1.6, 0.6, 1.5]],
  [1250, SET],
];
const CHEER_POSE = [0, 0, -0.05, -0.25, 2.3, 0.3, 3.95, 0.3, 0.3, 0.15, -0.1, 0.35];
const LAUNCH_PHASE = 0.1; // front foot planted, back knee about to drive, matches the blocks
const RAYS = [0.1, 0.8, 1.5, 2.2, 2.8, 3.5, 4.1, 4.8, 5.5].map((a, i) => [a, 0.75 + 0.25 * ((i * 7) % 3)]);

const clamp01 = (/** @type {number} */ v) => Math.min(1, Math.max(0, v));
const lerp = (/** @type {number} */ a, /** @type {number} */ b, /** @type {number} */ k) => a + (b - a) * k;
const easeOut = (/** @type {number} */ k) => 1 - (1 - k) ** 3;
const easeInOut = (/** @type {number} */ k) => (k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2);

/**
 * Hip height over the planted foot, so the hip vaults over it like a pendulum.
 * The leg is almost straight at strike and push-off and gives a little mid-stance.
 * @param {number} k stance progress in [0, 1]
 */
function stanceHip(k) {
  const leg = (THIGH + SHIN) * (0.97 - 0.08 * Math.sin(Math.PI * k));
  const x = lerp(STRIKE_X, PUSH_X, k);
  return SOLE + Math.sqrt(leg * leg - x * x);
}

/**
 * Two-bone leg reaching a foot target relative to the hip, knee pointing forward.
 * Writes [thigh angle from vertical, knee bend] at out[i].
 * @param {number} x
 * @param {number} y
 * @param {number[]} out
 * @param {number} i
 */
function legIk(x, y, out, i) {
  const open = Math.acos(Math.min(Math.hypot(x, y), THIGH + SHIN - 1e-4) / (THIGH + SHIN)); // thigh and shin are equal
  out[i] = Math.atan2(x, -y) + open;
  out[i + 1] = 2 * open;
}

/**
 * Swing leg keys [thigh angle from vertical, knee bend], from push-off to the next strike.
 * The ends come from the planted-foot solve so swing and stance meet without a pop.
 */
const SWING = [
  [0, 0], // push-off
  [-1.0, 1.4], // toe-off, heel starts to rise
  [-0.45, 2.7], // heel kicks up to the butt
  [0.7, 2.5], // knee drives forward
  [1.65, 1.9], // high knee, thigh past horizontal
  [1.1, 0.8], // shin reaches out
  [0, 0], // strike
];
legIk(PUSH_X, SOLE - stanceHip(1), SWING[0], 0);
legIk(STRIKE_X, SOLE - stanceHip(0), SWING[SWING.length - 1], 0);

/**
 * Catmull-Rom through SWING with clamped ends.
 * @param {number} k swing progress in [0, 1]
 * @param {number[]} out
 * @param {number} i
 */
function swing(k, out, i) {
  const last = SWING.length - 1;
  const f = k * last;
  const j = Math.min(Math.floor(f), last - 1);
  const t = f - j;
  for (let c = 0; c < 2; c++) {
    const p0 = SWING[Math.max(j - 1, 0)][c];
    const p1 = SWING[j][c];
    const p2 = SWING[j + 1][c];
    const p3 = SWING[Math.min(j + 2, last)][c];
    out[i + c] = 0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t);
  }
}

/**
 * Writes joint positions relative to the hip, in figure heights with y up.
 * Layout: hip, shoulder, head, front elbow, front hand, back elbow, back hand, front knee, front foot, back knee, back foot.
 * @param {number[]} p
 * @param {Float64Array} out
 */
function solve(p, out) {
  const lean = p[2];
  out[0] = 0;
  out[1] = 0;
  out[2] = Math.sin(lean) * TORSO;
  out[3] = Math.cos(lean) * TORSO;
  out[4] = out[2] + Math.sin(lean + p[3]) * NECK;
  out[5] = out[3] + Math.cos(lean + p[3]) * NECK;
  limb(out, 2, p[4] - lean, p[5], UPPER_ARM, FOREARM, 6);
  limb(out, 2, p[6] - lean, p[7], UPPER_ARM, FOREARM, 10);
  limb(out, 0, p[8] - lean, -p[9], THIGH, SHIN, 14);
  limb(out, 0, p[10] - lean, -p[11], THIGH, SHIN, 18);
}

/**
 * Angles are measured from straight down, rotating toward forward.
 * @param {Float64Array} out
 * @param {number} from
 * @param {number} angle
 * @param {number} bend
 * @param {number} upper
 * @param {number} lower
 * @param {number} at
 */
function limb(out, from, angle, bend, upper, lower, at) {
  const jx = out[from] + Math.sin(angle) * upper;
  const jy = out[from + 1] - Math.cos(angle) * upper;
  out[at] = jx;
  out[at + 1] = jy;
  out[at + 2] = jx + Math.sin(angle + bend) * lower;
  out[at + 3] = jy - Math.cos(angle + bend) * lower;
}

/**
 * Sets the hip height so the pose touches the ground without sinking into it.
 * Feet-only mode glues the lowest foot to the ground.
 * @param {number[]} p
 * @param {Float64Array} pts
 * @param {boolean} feetOnly
 */
function ground(p, pts, feetOnly) {
  solve(p, pts);
  let low = Math.min(pts[17], pts[21]) - SOLE;
  if (feetOnly) {
    p[1] = -low;
    return;
  }
  for (let i = 1; i < 22; i += 2) low = Math.min(low, pts[i] - SOLE);
  low = Math.min(low, pts[5] - HEAD);
  p[1] = Math.max(p[1], -low);
}

/**
 * Extra lean goes into the leg solve too, so a finish dip never drags a planted foot.
 * @param {number} phase stride cycle in [0, 1), front foot strikes at 0
 * @param {number[]} out
 * @param {number} dip extra forward lean
 */
function runPose(phase, out, dip) {
  const step = (phase % 0.5) * 2;
  const planted = STANCE * 2;
  out[0] = 0;
  const air = (step - planted) / (1 - planted);
  out[1] =
    step < planted
      ? stanceHip(step / planted)
      : lerp(stanceHip(1), stanceHip(0), air) + LIFT * Math.sin(Math.PI * air);
  // The hip sinks into each push and the airborne part launches it back up.
  out[2] = LEAN + 0.05 * Math.sin(TAU * step) + dip;
  out[3] = -0.5 - dip * 0.5;
  runSide(phase, out, 4, 8);
  runSide((phase + 0.5) % 1, out, 6, 10);
  out[4] -= dip * 2;
  out[6] -= dip * 2;
}

/**
 * A planted foot slides back from STRIKE_X to PUSH_X at exactly SPEED, so it stays put on the scrolling ground.
 * Each arm pumps against the leg on its own side: forward while that leg pushes off behind.
 * @param {number} u this side's stride cycle in [0, 1)
 * @param {number[]} out
 * @param {number} arm
 * @param {number} leg
 */
function runSide(u, out, arm, leg) {
  const pump = Math.cos(TAU * (u - STANCE));
  out[arm] = 0.3 + 1.6 * pump;
  out[arm + 1] = 1.5 + 0.4 * pump;
  if (u < STANCE) legIk(lerp(STRIKE_X, PUSH_X, u / STANCE), SOLE - out[1], out, leg);
  else swing((u - STANCE) / (1 - STANCE), out, leg);
  out[leg] += out[2];
}

/**
 * @param {number} t ms after contact
 * @param {number[]} out
 * @param {Float64Array} pts
 */
function fallPose(t, out, pts) {
  let i = 1;
  while (i < FALL.length - 1 && FALL[i][0] < t) i++;
  const [t0, a] = FALL[i - 1];
  const [t1, b] = FALL[i];
  const k = easeInOut(clamp01((t - t0) / (t1 - t0)));
  for (let j = 0; j < POSE_SIZE; j++) out[j] = lerp(a[j], b[j], k);
  ground(out, pts, false);
}

/**
 * @param {number[]} a
 * @param {number[]} b
 * @param {number} k
 * @param {number[]} out
 */
function blend(a, b, k, out) {
  for (let j = 0; j < POSE_SIZE; j++) out[j] = lerp(a[j], b[j], k);
}

/** @typedef {{start: number, end: number}} Run launch time and countdown end, in ms */

/**
 * Distance covered τ ms after launch while the pace ramps up linearly over LAUNCH, in figure heights.
 * @param {number} t
 */
function covered(t) {
  return t < LAUNCH ? (SPEED * t * t) / (2 * LAUNCH) : SPEED * (t - LAUNCH / 2);
}

/**
 * Distance run since launch, including the slow-down past the line.
 * @param {Run} run
 * @param {number} t
 */
function travel(run, t) {
  const past = Math.min(Math.max(0, t - run.end), DECEL);
  return covered(Math.min(Math.max(0, t - run.start), run.end - run.start)) + SPEED * (past - (past * past) / (2 * DECEL));
}

/**
 * Finish line distance ahead of the runner.
 * It starts exactly as far as he can cover by the deadline, which puts it off-screen, and goes negative once he is past it.
 * @param {Run} run
 * @param {number} t
 */
function aheadIn(run, t) {
  return covered(run.end - run.start) - travel(run, t);
}

/**
 * Running speed as a share of a full sprint.
 * @param {Run} run
 * @param {number} t
 */
function paceIn(run, t) {
  if (t < run.start) return 0;
  if (t < run.end) return Math.min(1, (t - run.start) / LAUNCH);
  return Math.max(0, 1 - (t - run.end) / DECEL);
}

const STYLE = `
:host { display: block; position: relative; height: 48px; contain: strict; pointer-events: none; }
:host([hidden]) { display: none; }
canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
`;

export class FinishRunner extends HTMLElement {
  static observedAttributes = ["duration"];

  #canvas = document.createElement("canvas");
  #ctx = /** @type {CanvasRenderingContext2D} */ (this.#canvas.getContext("2d"));
  #pts = new Float64Array(22);
  #pose = new Array(POSE_SIZE).fill(0);
  #poseB = new Array(POSE_SIZE).fill(0);
  #cheer = [...CHEER_POSE];

  // Layout in CSS px.
  #w = 0;
  #h = 0;
  #s = 0; // figure height
  #figX = 0;
  #groundY = 0;
  #near = 0;
  #headX = 0;
  #headY = 0;

  #color = "#fff";
  #hitColor = "#ff453a";
  #doneColor = "#30d158";
  #calm = false;

  #active = false;
  #visible = true;
  #raf = 0;
  #timer = 0;
  #last = 0;
  #phase = 0;
  #dash = 0;
  #rs = 1; // shrinks the reset choreography when the duration is too short for it

  // Running happens from `start` to `end`; the finish line sits SPEED × (end - now) ahead of him.
  #seg = { start: 0, end: 0 };
  #prev = { start: 0, end: 0 }; // run before the latest reset, still in effect while the bar flies in
  #hitAt = -Infinity;
  #hitAhead = 0;

  #resize = new ResizeObserver(() => this.#layout());
  #view = new IntersectionObserver(([e]) => {
    this.#visible = e.isIntersecting;
    this.#kick();
  });

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = STYLE;
    root.append(style, this.#canvas);
  }

  connectedCallback() {
    this.#calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.#resize.observe(this);
    this.#view.observe(this);
    this.#kick();
  }

  /** Only pauses drawing: a countdown survives being moved in the page, and `stop()` ends it for good. */
  disconnectedCallback() {
    this.#resize.disconnect();
    this.#view.disconnect();
    cancelAnimationFrame(this.#raf);
    this.#raf = 0;
  }

  /** Countdown length in ms. */
  get duration() {
    return Number(this.getAttribute("duration")) || DEFAULT_DURATION;
  }

  set duration(ms) {
    this.setAttribute("duration", String(ms));
  }

  /** True while counting down; false once the finish line is reached. */
  get running() {
    return this.#active && performance.now() < this.#seg.end;
  }

  /** Starts a full countdown with no knockdown. */
  start() {
    const now = performance.now();
    this.#readColors();
    this.#rs = Math.min(1, (this.duration * 0.7) / (BAR_IN + RECOVER + LAUNCH));
    this.#seg = { start: now + SET_HOLD, end: now + this.duration };
    this.#hitAt = -Infinity;
    this.#phase = 0;
    this.#arm(now);
  }

  /** Restarts the countdown with a knockdown; acts as start() when not running. */
  reset() {
    const now = performance.now();
    if (!this.running) return this.start();
    if (now < this.#seg.start) {
      // Already down or about to be, so only the deadline moves.
      this.#seg.end = now + this.duration;
    } else {
      this.#hitAhead = this.#ahead(now + BAR_IN * this.#rs);
      this.#prev = this.#seg;
      this.#hitAt = now + BAR_IN * this.#rs;
      this.#seg = { start: this.#hitAt + RECOVER * this.#rs, end: now + this.duration };
    }
    this.#arm(now);
  }

  /** Cancels the countdown and clears the canvas. */
  stop() {
    this.#active = false;
    clearTimeout(this.#timer);
    cancelAnimationFrame(this.#raf);
    this.#raf = 0;
    this.#ctx.clearRect(0, 0, this.#canvas.width, this.#canvas.height);
  }

  /** @param {number} now */
  #arm(now) {
    this.#active = true;
    clearTimeout(this.#timer);
    // A timer rather than the render loop fires the event, so it still arrives while the tile is scrolled away.
    this.#timer = window.setTimeout(() => this.dispatchEvent(new Event("finish")), this.#seg.end - now);
    this.#last = now;
    this.#kick();
  }

  #kick() {
    if (this.#active && this.#visible && !this.#raf) this.#raf = requestAnimationFrame(this.#frame);
  }

  #readColors() {
    const css = getComputedStyle(this);
    this.#color = css.color;
    this.#hitColor = css.getPropertyValue("--finish-runner-hit").trim() || this.#hitColor;
    this.#doneColor = css.getPropertyValue("--finish-runner-done").trim() || this.#doneColor;
  }

  #layout() {
    const { width, height } = this.getBoundingClientRect();
    const dpr = Math.min(3, devicePixelRatio || 1);
    this.#w = width;
    this.#h = height;
    this.#canvas.width = Math.round(width * dpr);
    this.#canvas.height = Math.round(height * dpr);
    this.#ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.#s = height * 0.74;
    this.#groundY = height - 3;
    this.#figX = this.#s * 1.15;
    this.#near = this.#figX + this.#s * 0.15; // his chest
    runPose(LAUNCH_PHASE, this.#poseB, 0);
    solve(this.#poseB, this.#pts);
    this.#headX = this.#figX + (this.#pts[4] + HEAD) * this.#s;
    this.#headY = this.#groundY - (this.#poseB[1] + this.#pts[5]) * this.#s;
    if (this.#active) this.#draw(this.#last);
  }

  /**
   * Finish line distance ahead of the runner at time t, in figure heights.
   * It starts far enough out that he covers it at sprint speed in exactly the time left, which puts it off-screen.
   * @param {number} t
   */
  #ahead(t) {
    if (t < this.#hitAt) return aheadIn(this.#prev, t);
    if (t < this.#seg.start && this.#hitAt !== -Infinity) {
      // He is down, so the line backs off to where the new countdown needs it.
      const from = this.#hitAt + HIT_STOP * this.#rs;
      const k = easeInOut(clamp01((t - from) / (this.#seg.start - from)));
      return lerp(this.#hitAhead, aheadIn(this.#seg, this.#seg.start), k);
    }
    return aheadIn(this.#seg, t);
  }

  /**
   * Running speed as a share of a full sprint.
   * @param {number} t
   */
  #pace(t) {
    if (t < this.#hitAt) return paceIn(this.#prev, t);
    return t < this.#seg.start ? 0 : paceIn(this.#seg, t);
  }

  /** @param {number} t */
  #dip(t) {
    return DIP * Math.exp(-(((t - this.#seg.end) / DIP_WIDTH) ** 2));
  }

  /** @param {number} now */
  #frame = (now) => {
    this.#raf = 0;
    const dt = Math.max(0, Math.min(50, now - this.#last));
    this.#last = now;
    const pace = this.#pace(now);
    if (pace > 0) {
      // Stride and ground advance by the same pace × dt, which is what keeps planted feet locked to the ground.
      this.#phase = (this.#phase + (dt * pace) / CYCLE) % 1;
      this.#dash += SPEED * this.#s * dt * pace;
    } else if (now < this.#seg.start) {
      this.#phase = LAUNCH_PHASE;
    }
    this.#draw(now);
    if (now < this.#seg.end + DECEL + CHEER) this.#kick();
  };

  /** @param {number} t */
  #draw(t) {
    const ctx = this.#ctx;
    const s = this.#s;
    const sinceHit = t - this.#hitAt;
    const done = t >= this.#seg.end;
    const since = t - this.#seg.end;
    const lineX = this.#near + this.#ahead(t) * s;
    ctx.clearRect(0, 0, this.#w, this.#h);
    ctx.save();

    const shakeT = sinceHit - HIT_STOP * this.#rs;
    if (!this.#calm && shakeT > 0 && shakeT < SHAKE) {
      const amp = s * 0.06 * (1 - shakeT / SHAKE);
      ctx.translate(amp * Math.sin(t * 0.09), amp * Math.cos(t * 0.13));
    }

    this.#drawGround();
    this.#drawFinishLine(lineX, done);
    this.#drawBar(t);

    const pose = this.#pose;
    if (since >= DECEL) {
      runPose(this.#phase, this.#poseB, 0);
      blend(this.#poseB, this.#groundedCheer(), clamp01((since - DECEL) / BLEND), pose);
      pose[1] += 0.12 * Math.max(0, Math.sin((Math.PI * (since - DECEL)) / 350));
    } else if (sinceHit >= 0 && t < this.#seg.start) {
      fallPose(sinceHit / this.#rs, pose, this.#pts);
    } else if (t >= this.#hitAt && t < this.#seg.start) {
      for (let j = 0; j < POSE_SIZE; j++) pose[j] = SET[j];
    } else {
      // Out of the blocks: the crouch straightens into the stride while the pace builds.
      const rise = (t - (t < this.#hitAt ? this.#prev : this.#seg).start) / RISE;
      runPose(this.#phase, rise < 1 ? this.#poseB : pose, this.#dip(t));
      if (rise < 1) blend(SET, this.#poseB, easeInOut(clamp01(rise)), pose);
      const pace = this.#pace(t);
      if (pace > 0.5) this.#drawStreaks();
      if (pace > 0) this.#drawDust();
    }
    this.#drawFigure(pose);

    if (sinceHit >= 0 && sinceHit < BURST) this.#drawBurst(this.#headX, this.#headY, sinceHit, this.#hitColor, true);
    if (done && since < CHEER) this.#drawBurst(lineX, this.#groundY - s * 0.9, since, this.#doneColor, false);
    ctx.restore();
  }

  #groundedCheer() {
    this.#cheer[1] = 0;
    ground(this.#cheer, this.#pts, true);
    return this.#cheer;
  }

  #drawGround() {
    const ctx = this.#ctx;
    const gap = this.#s * 0.5;
    const y = Math.round(this.#groundY) + 0.5;
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = this.#color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = -(this.#dash % gap); x < this.#w; x += gap) {
      ctx.moveTo(x, y);
      ctx.lineTo(x + gap * 0.36, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  /**
   * @param {number} x
   * @param {boolean} done
   */
  #drawFinishLine(x, done) {
    const ctx = this.#ctx;
    const cell = Math.max(2, Math.round(this.#s * 0.09));
    const left = Math.round(x - cell);
    if (left > this.#w) return;
    const rows = Math.ceil((this.#s * 1.05) / cell);
    const top = Math.round(this.#groundY) - rows * cell;
    ctx.fillStyle = done ? this.#doneColor : this.#color;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < 2; c++) {
        ctx.globalAlpha = (r + c) % 2 ? 0.16 : 0.9;
        ctx.fillRect(left + c * cell, top + r * cell, cell, cell);
      }
    }
    ctx.globalAlpha = 1;
  }

  /** @param {number} t */
  #drawBar(t) {
    const sinceHit = t - this.#hitAt;
    const inFor = BAR_IN * this.#rs;
    if (this.#hitAt === -Infinity || sinceHit <= -inFor) return;
    const s = this.#s;
    const ctx = this.#ctx;
    const len = s * 0.6;
    const thick = s * 0.075;
    let x = this.#headX;
    let y = this.#headY;
    let turn = 0;
    if (sinceHit < 0) {
      x = lerp(this.#w + 4, this.#headX, 1 + sinceHit / inFor);
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = this.#color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const dy of [-thick * 1.5, thick * 1.5]) {
        ctx.moveTo(x + len, y + dy);
        ctx.lineTo(x + len + s * 0.8, y + dy);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else {
      const k = clamp01((sinceHit - HIT_STOP * this.#rs) / (BAR_FALL * this.#rs));
      x += s * 0.5 * easeOut(k);
      y = lerp(this.#headY, this.#groundY - thick / 2, k * k);
      turn = -Math.PI * easeOut(k);
      // Once he is back up, the fallen bar scrolls past with the ground.
      if (t > this.#seg.start) x -= s * travel(this.#seg, t);
      if (x + len < 0) return;
    }
    ctx.save();
    ctx.translate(x + len / 2, y);
    ctx.rotate(turn);
    const stripe = len / 5;
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i % 2 ? this.#color : this.#hitColor;
      ctx.fillRect(-len / 2 + i * stripe, -thick / 2, stripe + 0.5, thick);
    }
    ctx.restore();
  }

  /** Grit kicked back from each toe-off, left behind on the ground as it scrolls away. */
  #drawDust() {
    const ctx = this.#ctx;
    const s = this.#s;
    ctx.strokeStyle = this.#color;
    ctx.lineWidth = Math.max(1, s * 0.03);
    ctx.beginPath();
    let any = false;
    for (const u of [this.#phase, (this.#phase + 0.5) % 1]) {
      const k = (u - STANCE) / DUST;
      if (k < 0 || k >= 1) continue;
      any = true;
      const x = this.#figX + (PUSH_X - (u - STANCE) * CYCLE * SPEED) * s;
      for (const a of [0.35, 0.7, 1.05]) {
        const r0 = s * (0.04 + 0.12 * k);
        const r1 = s * (0.1 + 0.28 * k) * (1.2 - a * 0.4);
        ctx.moveTo(x - Math.cos(a) * r0, this.#groundY - Math.sin(a) * r0);
        ctx.lineTo(x - Math.cos(a) * r1, this.#groundY - Math.sin(a) * r1);
      }
      ctx.globalAlpha = 0.6 * (1 - k);
    }
    if (any) ctx.stroke();
    ctx.globalAlpha = 1;
  }

  #drawStreaks() {
    const ctx = this.#ctx;
    const s = this.#s;
    ctx.strokeStyle = this.#color;
    ctx.lineWidth = Math.max(1, s * 0.03);
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    [0.35, 0.58, 0.78].forEach((h, i) => {
      const end = this.#figX - s * 0.3;
      const len = s * (0.3 + 0.18 * Math.sin(this.#phase * TAU + i * 2));
      const y = this.#groundY - h * s;
      ctx.moveTo(end - len, y);
      ctx.lineTo(end, y);
    });
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  /** @param {number[]} pose */
  #drawFigure(pose) {
    const ctx = this.#ctx;
    const s = this.#s;
    const pts = this.#pts;
    solve(pose, pts);
    const ox = this.#figX + pose[0] * s;
    const oy = this.#groundY - pose[1] * s;
    const line = (/** @type {number[]} */ ...idx) => {
      ctx.moveTo(ox + pts[idx[0] * 2] * s, oy - pts[idx[0] * 2 + 1] * s);
      for (const i of idx.slice(1)) ctx.lineTo(ox + pts[i * 2] * s, oy - pts[i * 2 + 1] * s);
    };
    ctx.strokeStyle = ctx.fillStyle = this.#color;
    ctx.lineWidth = s * STROKE;
    ctx.lineCap = ctx.lineJoin = "round";

    // Far-side limbs sit back in a dimmer tone so the silhouette stays readable at this size.
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    line(1, 5, 6);
    line(0, 9, 10);
    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.beginPath();
    line(8, 7, 0, 1, 3, 4);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(ox + pts[4] * s, oy - pts[5] * s, HEAD * s, 0, TAU);
    ctx.fill();
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} t ms since the burst began
   * @param {string} color
   * @param {boolean} flash
   */
  #drawBurst(x, y, t, color, flash) {
    const ctx = this.#ctx;
    const s = this.#s;
    const k = easeOut(clamp01(t / (flash ? BURST : CHEER)));
    if (flash && t < HIT_STOP * this.#rs) {
      ctx.fillStyle = this.#color;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(x, y, s * 0.16, 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, s * 0.05 * (1 - k));
    ctx.globalAlpha = 1 - k;
    ctx.beginPath();
    for (const [a, reach] of RAYS) {
      const r0 = s * (0.1 + 0.35 * k) * reach;
      const r1 = s * (0.22 + 0.7 * k) * reach;
      ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0);
      ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

if (!customElements.get("finish-runner")) customElements.define("finish-runner", FinishRunner);
