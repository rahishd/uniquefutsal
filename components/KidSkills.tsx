// Home banner mascot: a smiling cartoon boy in an orange football kit showing off ball skills.
// One 20-second routine, then it starts again. Pure SVG + CSS keyframes (no video, no images), so it
// is tiny, sharp on every screen, and stops moving for people who prefer reduced motion.
//
// Routine: 0-4s dribble, 4-8s juggle with the feet, 8-12s headers, 12-16s ball spinning on a finger,
// 16-20s "around the world" then a jump with a full spin. The face never changes: always smiling,
// always looking at the customer.

const LOOP = 20; // seconds

type Ease = "in" | "out" | "io" | "lin";
type Pt = [t: number, v: string, e?: Ease];

const EASE: Record<Ease, string> = { in: "ease-in", out: "ease-out", io: "ease-in-out", lin: "linear" };
const pct = (t: number) => `${+((t / LOOP) * 100).toFixed(3)}%`;

function track(name: string, pts: Pt[], origin = "0 0") {
  const sorted = new Map<number, Pt>();
  for (const p of pts) sorted.set(p[0], p); // a later point at the same time wins
  const body = [...sorted.values()]
    .sort((a, b) => a[0] - b[0])
    .map(([t, v, e]) => `${pct(t)}{transform:${v};animation-timing-function:${EASE[e ?? "io"]}}`)
    .join("");
  return `@keyframes ${name}{${body}}.${name}{transform-origin:${origin};animation:${name} ${LOOP}s linear infinite}`;
}

const rot = (d: number) => `rotate(${d}deg)`;

/* ---------- ball path: [seconds, x, y] with the easing of the segment that follows ---------- */
function ballPath(): Pt[] {
  const p: [number, number, number, Ease][] = [];
  // 0-4s dribble: ball ping-pongs between the feet along the ground
  for (let k = 0; k < 4; k++) {
    p.push([k, 70, 209, "out"], [k + 0.25, 110, 188, "in"], [k + 0.5, 150, 209, "out"], [k + 0.75, 110, 188, "in"]);
  }
  // 4-8s juggle: foot to foot in high arcs
  p.push([4, 70, 209, "lin"], [4.2, 55, 190, "out"], [4.7, 110, 95, "in"], [5.2, 165, 190, "out"], [5.7, 110, 95, "in"]);
  p.push([6.2, 55, 190, "out"], [6.7, 110, 95, "in"], [7.2, 165, 190, "out"], [7.65, 118, -10, "in"]);
  // 8-12s headers
  for (let c = 8.2; c < 11.5; c += 0.8) p.push([c, 110, 16, "out"], [c + 0.4, 110, -14, "in"]);
  p.push([11.8, 110, -14, "in"]);
  // 12-16s spinning on the finger of the raised hand
  const wob: [number, number][] = [[160, 56], [163, 54], [157, 57], [162, 55], [158, 56]];
  wob.forEach(([x, y], i) => p.push([12.5 + i * 0.8, x, y, "io"]));
  p.push([16, 160, 56, "in"]);
  // 16.5-18.5 around the world: circles the lifted foot
  const orbit: [number, number][] = [[171, 164], [185, 170], [191, 184], [185, 198], [171, 204], [157, 198], [151, 184], [157, 170], [171, 164]];
  orbit.forEach(([x, y], i) => p.push([16.5 + i * 0.25, x, y, "lin"]));
  // 18.5-20 up in the jump, caught, then back to the start
  p.push([18.5, 171, 164, "out"], [19, 110, -10, "in"], [19.5, 110, 185, "out"], [20, 70, 209, "lin"]);
  return p.map(([t, x, y, e]) => [t, `translate(${x}px,${y}px)`, e]);
}

/* ---------- limbs: degrees. Left side: + swings outward. Right side: - swings outward ---------- */
function legL(): Pt[] {
  const p: Pt[] = [];
  for (let n = 0; n < 4; n++) p.push([n - 0.15, rot(0)], [n, rot(20)], [n + 0.15, rot(0)]);
  p.push([3.85, rot(0)], [4, rot(20)], [4.2, rot(39)], [4.5, rot(0)]);
  p.push([5.9, rot(0)], [6.2, rot(39)], [6.5, rot(0)]);
  p.push([18.7, rot(0)], [19, rot(25)], [19.4, rot(0)], [19.85, rot(0)], [20, rot(20)]);
  return p;
}
function legR(): Pt[] {
  const p: Pt[] = [[0, rot(0)]];
  for (let n = 0; n < 4; n++) p.push([n + 0.35, rot(0)], [n + 0.5, rot(-20)], [n + 0.65, rot(0)]);
  p.push([4.9, rot(0)], [5.2, rot(-39)], [5.5, rot(0)], [6.9, rot(0)], [7.2, rot(-39)], [7.5, rot(0)]);
  p.push([16, rot(0)], [16.4, rot(-45)], [17, rot(-50)], [17.5, rot(-42)], [18, rot(-50)], [18.5, rot(-45)]);
  p.push([18.75, rot(0)], [19, rot(-25)], [19.4, rot(0)], [20, rot(0)]);
  return p;
}
function armL(): Pt[] {
  const p: Pt[] = [];
  for (let t = 0; t < 8; t += 0.5) p.push([t, rot(Math.round(t * 2) % 2 === 0 ? 15 : 45)]);
  for (let t = 8, i = 0; t < 12; t += 0.4, i++) p.push([t, rot(i % 2 ? 65 : 55)]);
  for (let t = 12, i = 0; t < 16; t += 0.5, i++) p.push([t, rot(i % 2 ? 45 : 25)]);
  for (let t = 16, i = 0; t < 18.6; t += 0.5, i++) p.push([t, rot(i % 2 ? 60 : 50)]);
  p.push([18.7, rot(70)], [19, rot(165)], [19.5, rot(40)], [20, rot(15)]);
  return p;
}
function armR(): Pt[] {
  const p: Pt[] = [];
  for (let t = 0; t < 8; t += 0.5) p.push([t, rot(Math.round(t * 2) % 2 === 0 ? -45 : -15)]);
  for (let t = 8, i = 0; t < 12; t += 0.4, i++) p.push([t, rot(i % 2 ? -65 : -55)]);
  p.push([12, rot(-60)], [12.4, rot(-135)]);
  for (let t = 12.8, i = 0; t < 15.7; t += 0.4, i++) p.push([t, rot(i % 2 ? -140 : -128)]);
  p.push([16, rot(-135)]);
  for (let t = 16.4, i = 0; t < 18.6; t += 0.5, i++) p.push([t, rot(i % 2 ? -60 : -50)]);
  p.push([18.7, rot(-70)], [19, rot(-165)], [19.5, rot(-40)], [20, rot(-45)]);
  return p;
}

/* ---------- body: bob, head, spin ---------- */
function bob(): Pt[] {
  const p: Pt[] = [];
  for (let t = 0; t < 8; t += 0.5) p.push([t, "translateY(0px)"], [t + 0.25, "translateY(-3px)"]);
  for (let c = 8.2; c < 11.5; c += 0.8) p.push([c - 0.1, "translateY(-2px)"], [c, "translateY(2px)"], [c + 0.35, "translateY(-2px)"]);
  for (let t = 12; t < 16; t += 1) p.push([t, "translateY(0px)"], [t + 0.5, "translateY(-2px)"]);
  for (let t = 16; t < 18.5; t += 0.5) p.push([t, "translateY(0px)"], [t + 0.25, "translateY(-2px)"]);
  p.push([18.5, "translateY(0px)"], [18.6, "translateY(4px)"], [19, "translateY(-26px)"], [19.4, "translateY(0px)"], [19.5, "translateY(3px)"], [19.7, "translateY(0px)"], [20, "translateY(0px)"]);
  return p;
}
function head(): Pt[] {
  const h = (y: number, r: number) => `translateY(${y}px) rotate(${r}deg)`;
  const p: Pt[] = [];
  for (let t = 0; t < 8; t += 1) p.push([t, h(0, Math.round(t) % 2 === 0 ? 3 : -3)]);
  p.push([8, h(0, 0)]);
  for (let c = 8.2; c < 11.5; c += 0.8) p.push([c - 0.1, h(0, 0)], [c, h(5, 0)], [c + 0.15, h(0, 0)]);
  p.push([12, h(0, 0)], [12.4, h(0, -9)], [15.6, h(0, -9)], [16, h(0, 0)], [16.5, h(0, 4)], [17.5, h(0, -4)], [18.5, h(0, 0)]);
  p.push([19, h(-2, -6)], [19.4, h(3, 0)], [19.7, h(0, 0)], [20, h(0, 3)]);
  return p;
}
function spin(): Pt[] {
  return [[0, "scaleX(1)"], [18.7, "scaleX(1)"], [18.85, "scaleX(0.05)"], [19, "scaleX(-1)"], [19.15, "scaleX(0.05)"], [19.3, "scaleX(1)"], [20, "scaleX(1)"]];
}
const shadow: Pt[] = [[0, "scale(1)"], [18.6, "scale(1)"], [19, "scale(0.6)"], [19.4, "scale(1)"], [20, "scale(1)"]];
const ballSpin: Pt[] = [[0, rot(0), "lin"], [4, rot(400), "lin"], [8, rot(1000), "lin"], [12, rot(1500), "lin"], [16, rot(3300), "lin"], [20, rot(4100), "lin"]];

const CSS = [
  track("uf-ball", ballPath()),
  track("uf-ball-spin", ballSpin),
  track("uf-leg-l", legL(), "100px 150px"),
  track("uf-leg-r", legR(), "120px 150px"),
  track("uf-arm-l", armL(), "90px 104px"),
  track("uf-arm-r", armR(), "130px 104px"),
  track("uf-bob", bob()),
  track("uf-head", head(), "110px 96px"),
  track("uf-spin", spin(), "110px 0px"),
  track("uf-shadow", shadow, "110px 222px"),
  ".uf-ball{transform:translate(150px,205px)}", // pose when motion is switched off
  "@keyframes uf-blink{0%,90%{transform:scaleY(1)}94%{transform:scaleY(.1)}98%,100%{transform:scaleY(1)}}",
  ".uf-eyes{transform-origin:110px 64px;animation:uf-blink 4s infinite}",
  "@keyframes uf-twinkle{0%,100%{transform:scale(.4);opacity:.2}50%{transform:scale(1);opacity:1}}",
  ".uf-star{animation:uf-twinkle 2.4s ease-in-out infinite;transform-box:fill-box;transform-origin:center}",
  "@media (prefers-reduced-motion:reduce){.uf-kid *{animation:none!important}}",
].join("");

const SKIN = "#f0b48a";
const ORANGE = "#f5822a";
const NAVY = "#0c0b5d";

function Leg({ x, cls }: { x: number; cls: string }) {
  return (
    <g className={cls}>
      <rect x={x - 6} y={146} width={12} height={30} rx={6} fill={SKIN} />
      <rect x={x - 6.5} y={172} width={13} height={34} rx={5} fill="#fff" />
      <rect x={x - 6.5} y={180} width={13} height={5} fill={ORANGE} />
      <rect x={x - 6.5} y={188} width={13} height={3} fill={NAVY} />
      <ellipse cx={x} cy={214} rx={13} ry={7} fill="#1f2937" />
      <path d={`M${x - 9} 212 Q${x} 207 ${x + 9} 212`} stroke={ORANGE} strokeWidth={2} fill="none" strokeLinecap="round" />
    </g>
  );
}

function Arm({ x, cls }: { x: number; cls: string }) {
  return (
    <g className={cls}>
      <rect x={x - 7} y={98} width={14} height={20} rx={7} fill={ORANGE} />
      <rect x={x - 7} y={112} width={14} height={3} fill="#fff" />
      <rect x={x - 4.5} y={114} width={9} height={28} rx={4.5} fill={SKIN} />
      <circle cx={x} cy={146} r={6.5} fill={SKIN} />
    </g>
  );
}

export default function KidSkills({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 262" role="img" aria-label="A smiling boy in a football kit juggling a ball" className={`uf-kid ${className}`}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <defs>
        <clipPath id="uf-ball-clip"><circle r={13} /></clipPath>
      </defs>

      <g transform="translate(0,30)">
        {/* sparkles */}
        {[[28, 15], [200, 12], [22, 120]].map(([x, y], i) => (
          <path key={i} className="uf-star" style={{ animationDelay: `${i * 0.8}s` }} d={`M${x} ${y - 7} L${x + 2} ${y - 2} L${x + 7} ${y} L${x + 2} ${y + 2} L${x} ${y + 7} L${x - 2} ${y + 2} L${x - 7} ${y} L${x - 2} ${y - 2} Z`} fill="#fde68a" />
        ))}

        <ellipse className="uf-shadow" cx={110} cy={223} rx={42} ry={6} fill="#000" opacity={0.28} />

        <g className="uf-bob">
          <g className="uf-spin">
            <Leg x={100} cls="uf-leg-l" />
            <Leg x={120} cls="uf-leg-r" />

            {/* shorts and shirt */}
            <path d="M88 148 L132 148 L134 172 L112 172 L110 162 L108 172 L86 172 Z" fill="#fff" />
            <path d="M88 148 L86 172 L90 172 L92 148 Z M132 148 L134 172 L130 172 L128 148 Z" fill={ORANGE} />
            <path d="M86 100 Q86 94 94 94 L126 94 Q134 94 134 100 L132 152 L88 152 Z" fill={ORANGE} />
            <rect x={87} y={128} width={46} height={6} fill="#fff" opacity={0.9} />
            <path d="M100 94 Q110 108 120 94 Z" fill="#fff" />
            <circle cx={97} cy={114} r={4.5} fill="#fff" />
            <circle cx={97} cy={114} r={2} fill={NAVY} />

            <rect x={102} y={88} width={16} height={12} fill={SKIN} />

            {/* head */}
            <g className="uf-head">
              <circle cx={77} cy={66} r={6} fill={SKIN} />
              <circle cx={143} cy={66} r={6} fill={SKIN} />
              <ellipse cx={110} cy={62} rx={33} ry={32} fill={SKIN} />
              <path d="M77 58 Q74 27 110 26 Q146 27 143 58 Q132 43 110 43 Q88 43 77 58 Z" fill="#2b1b17" />
              <path d="M102 29 Q108 12 121 27 Z" fill="#2b1b17" />
              <path d="M91 51 Q98 47 105 51 M115 51 Q122 47 129 51" stroke="#2b1b17" strokeWidth={2.5} fill="none" strokeLinecap="round" />
              <g className="uf-eyes">
                <ellipse cx={98} cy={64} rx={7} ry={8} fill="#fff" />
                <ellipse cx={122} cy={64} rx={7} ry={8} fill="#fff" />
                <circle cx={98.5} cy={65} r={4.6} fill="#2b1b17" />
                <circle cx={121.5} cy={65} r={4.6} fill="#2b1b17" />
                <circle cx={100.2} cy={63} r={1.7} fill="#fff" />
                <circle cx={123.2} cy={63} r={1.7} fill="#fff" />
              </g>
              <path d="M109 71 Q110 73.5 111 71" stroke="#c98a5c" strokeWidth={1.6} fill="none" strokeLinecap="round" />
              <circle cx={91} cy={76} r={5} fill="#fb7185" opacity={0.35} />
              <circle cx={129} cy={76} r={5} fill="#fb7185" opacity={0.35} />
              <path d="M95 76 Q110 96 125 76 Q110 81 95 76 Z" fill="#7f1d1d" />
              <ellipse cx={110} cy={85.5} rx={5.5} ry={2.6} fill="#f87171" />
              <path d="M98 77.5 Q110 83 122 77.5 L121 80.5 Q110 85 99 80.5 Z" fill="#fff" />
            </g>

            <Arm x={90} cls="uf-arm-l" />
            <Arm x={130} cls="uf-arm-r" />
          </g>
        </g>

        {/* the ball: outer group travels, inner group spins */}
        <g className="uf-ball">
          <g className="uf-ball-spin">
            <circle r={13} fill="#fff" stroke="#cbd5e1" strokeWidth={0.8} />
            <g clipPath="url(#uf-ball-clip)" fill={NAVY}>
              <path d="M0 -5.5 L5.2 -1.7 L3.2 4.4 L-3.2 4.4 L-5.2 -1.7 Z" />
              <circle cx={0} cy={-13} r={4.5} />
              <circle cx={12.4} cy={-4} r={4.5} />
              <circle cx={7.6} cy={10.5} r={4.5} />
              <circle cx={-7.6} cy={10.5} r={4.5} />
              <circle cx={-12.4} cy={-4} r={4.5} />
            </g>
            <path d="M0 -5.5 V-9 M5.2 -1.7 L8.6 -2.8 M3.2 4.4 L5.3 7.3 M-3.2 4.4 L-5.3 7.3 M-5.2 -1.7 L-8.6 -2.8" stroke={NAVY} strokeWidth={1.2} fill="none" />
          </g>
        </g>
      </g>
    </svg>
  );
}
