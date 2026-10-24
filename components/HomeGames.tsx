"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AppLanguage } from "@/lib/i18n";

type Game = "runner";
type Board = { signedIn: boolean; top: { username: string; score: number; me: boolean }[]; mine: number | null };

const text = (language: AppLanguage, he: string, en: string) => (language === "he" ? he : en);

const CONFETTI = ["💧", "🎵", "✨", "🎉", "🔷", "🎶", "⭐"];

const MAX_CONFETTI = 80;

// Pieces are DOM elements, so there is a hard limit on how many may exist at once: pressing a lot can never pile them up.
function throwConfetti(count: number) {
  const room = MAX_CONFETTI - document.querySelectorAll(".home-confetti").length;

  for (let i = 0; i < Math.min(count, room); i += 1) {
    const piece = document.createElement("div");

    piece.className = "home-confetti";
    piece.textContent = CONFETTI[Math.floor(Math.random() * CONFETTI.length)];
    piece.style.left = `${Math.random() * 100}vw`;
    piece.style.animationDuration = `${2 + Math.random() * 1.6}s`;
    piece.style.fontSize = `${16 + Math.random() * 16}px`;
    piece.addEventListener("animationend", () => piece.remove(), { once: true });
    document.body.appendChild(piece);
  }
}

// The onion runs away from the pointer. The more often it is caught, the earlier and the further it runs, and
// every so often it runs out of breath for a moment, which is the chance to catch it.
const HELLO: [string, string] = ["היי! אני הבצל. נסו לתפוס אותי.", "Hi! I'm the onion. Try to catch me."];
const FLEE_LINES: [string, string][] = [
  ["לא תתפסו אותי!", "You'll never catch me!"],
  ["אופס, פספסתם.", "Oops, missed me."],
  ["אני מהיר יותר מבצל רגיל.", "I'm faster than a regular onion."],
  ["יותר לאט, אני עדיין מתחמם.", "Slow down, I'm still warming up."],
  ["חשבתם שזה יהיה קל?", "Did you think it'd be easy?"],
  ["אין דמעות, רק ריצה!", "No tears, only running!"],
  ["שכבה אחרי שכבה, אבל אתם לא תוקפים אותי!", "Layer by layer, but you can't get me!"],
  ["ווש!", "Whoosh!"],
  ["בדרך לצד השני...", "Off to the other side..."],
  ["נראה אתכם מנסים שוב.", "Let's see you try again."],
];
const TIRED_LINES: [string, string][] = [
  ["אוף... נגמר לי האוויר. תתפסו אותי עכשיו!", "Phew... out of breath. Catch me now!"],
  ["רגע, אני מתנשף...", "Wait, I'm panting..."],
  ["אני צריך הפסקה. רק שלא תלחצו!", "I need a break. Just don't click!"],
];
const CAUGHT_LINES: [string, string][] = [
  ["תפסתם אותי! 🎉", "You caught me! 🎉"],
  ["טוב, טוב, ניצחתם.", "Okay, okay, you win."],
  ["איך עשיתם את זה?!", "How did you do that?!"],
];
const KONAMI = "ArrowUp,ArrowUp,ArrowDown,ArrowDown,ArrowLeft,ArrowRight,ArrowLeft,ArrowRight,b,a";

const pick = <T,>(list: T[], not?: T): T => {
  let item: T;

  do {
    item = list[Math.floor(Math.random() * list.length)];
  } while (item === not && list.length > 1);

  return item;
};

export function Mascot({ language, logo }: { language: AppLanguage; logo: React.ReactNode }) {
  const [hint, setHint] = useState<string | null>(null);
  const [bouncing, setBouncing] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [tired, setTired] = useState(false);
  const [caught, setCaught] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef({ x: 0, y: 0 });
  const touching = useRef(false);
  const state = useRef({ flees: 0, tiredUntil: 0, lastFlee: 0, lastLine: null as [string, string] | null, caught: 0, tired: false, celebrating: false });
  const timers = useRef<number[]>([]);

  const say = useCallback(
    (pair: [string, string]) => {
      state.current.lastLine = pair;
      setHint(text(language, pair[0], pair[1]));
    },
    [language],
  );

  const moveTo = useCallback((x: number, y: number) => {
    offsetRef.current = { x, y };
    setOffset({ x, y });
  }, []);

  // Where the onion may roam: the whole hero area, below the header.
  const roam = useCallback(() => {
    const wrap = wrapRef.current;

    if (!wrap) return null;

    // the whole visible screen below the header: the onion never goes where it cannot be seen or pressed
    const box = wrap.getBoundingClientRect();
    const naturalLeft = box.left - offsetRef.current.x;
    const naturalTop = box.top - offsetRef.current.y;
    const header = document.querySelector(".site-header")?.getBoundingClientRect().bottom ?? 0;
    const top = Math.max(8, header + 8);
    const room = 8;

    return {
      box,
      minX: room - naturalLeft,
      maxX: window.innerWidth - room - naturalLeft - box.width,
      minY: top - naturalTop,
      maxY: window.innerHeight - room - naturalTop - box.height,
    };
  }, []);

  // While the onion is on the move the hero cannot be selected; a couple of seconds after it rests, copying works again.
  const chaseTimer = useRef<number | undefined>(undefined);
  const markChasing = useCallback(() => {
    const hero = wrapRef.current?.closest(".home-hero");  // the whole hero is only marked while it moves

    if (!hero) return;

    if (!hero.classList.contains("is-chasing")) window.getSelection()?.removeAllRanges();

    hero.classList.add("is-chasing");
    window.clearTimeout(chaseTimer.current);
    chaseTimer.current = window.setTimeout(() => hero.classList.remove("is-chasing"), 2500);
  }, []);

  const flee = useCallback(
    (fromX: number, fromY: number) => {
      markChasing();
      const area = roam();
      const st = state.current;

      if (!area) return;

      const level = st.caught;
      const centerX = area.box.left + area.box.width / 2;
      const centerY = area.box.top + area.box.height / 2;
      let dx = centerX - fromX;
      let dy = centerY - fromY;
      const length = Math.hypot(dx, dy) || 1;
      const jump = 130 + Math.random() * 100 + level * 25;

      dx = (dx / length) * jump;
      dy = (dy / length) * jump;

      // cornered: dodge to the other side instead of pressing against the wall
      let x = offsetRef.current.x + dx;
      let y = offsetRef.current.y + dy;

      if (x < area.minX || x > area.maxX) x = area.minX + Math.random() * (area.maxX - area.minX);
      if (y < area.minY || y > area.maxY) y = area.minY + Math.random() * (area.maxY - area.minY);

      moveTo(Math.min(area.maxX, Math.max(area.minX, x)), Math.min(area.maxY, Math.max(area.minY, y)));
      st.flees += 1;
      st.lastFlee = performance.now();
      setBouncing(false);
      window.requestAnimationFrame(() => setBouncing(true));

      // out of breath after a while: a short chance to catch it (a bit shorter every time it was caught)
      if (st.flees >= 5 + level * 2) {
        st.flees = 0;
        st.tired = true;
        st.tiredUntil = performance.now() + Math.max(1800, 3400 - level * 400);
        setTired(true);
        say(pick(TIRED_LINES));
        timers.current.push(
          window.setTimeout(() => {
            st.tired = false;
            setTired(false);
          }, Math.max(1800, 3400 - level * 400)),
        );

        return;
      }

      say(pick(FLEE_LINES, st.lastLine ?? undefined));
    },
    [markChasing, moveTo, roam, say],
  );

  const catchIt = useCallback(() => {
    const st = state.current;

    // pressing it again and again while it celebrates does nothing more (no pile of confetti, no pile of timers)
    if (st.celebrating) return;

    markChasing();
    st.celebrating = true;
    st.caught += 1;
    st.flees = 0;
    st.tired = false;
    setTired(false);
    setCaught(st.caught);
    say(pick(CAUGHT_LINES));
    throwConfetti(Math.min(45, 25 + st.caught * 4));
    setBouncing(false);
    window.requestAnimationFrame(() => setBouncing(true));
    // and off it goes again, a little braver
    timers.current.push(
      window.setTimeout(() => {
        const area = roam();

        if (area) moveTo(area.minX + Math.random() * (area.maxX - area.minX), area.minY + Math.random() * (area.maxY - area.minY));
        say([`נתפסתי ${st.caught} פעמים. עוד פעם?`, `Caught ${st.caught} time${st.caught === 1 ? "" : "s"}. Again?`]);
        st.celebrating = false;
      }, 1500),
    );
  }, [markChasing, moveTo, roam, say]);

  useEffect(() => {
    const pending = timers.current;

    return () => {
      pending.forEach((id) => window.clearTimeout(id));
      window.clearTimeout(chaseTimer.current);
    };
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const onMove = (event: PointerEvent) => {
      const wrap = wrapRef.current;
      const st = state.current;

      if (!wrap || st.tired || st.celebrating) return;

      const now = performance.now();

      if (now - st.lastFlee < 320) return;

      const box = wrap.getBoundingClientRect();
      const dist = Math.hypot(event.clientX - (box.left + box.width / 2), event.clientY - (box.top + box.height / 2));

      // it senses you from further away the more often it was caught
      if (dist < 105 + st.caught * 15) flee(event.clientX, event.clientY);
    };

    const onDown = (event: PointerEvent) => {
      if (event.pointerType === "touch") onMove(event);
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerdown", onDown);

    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [flee]);

  useEffect(() => {
    let typed: string[] = [];
    const onKey = (event: KeyboardEvent) => {
      typed = [...typed, event.key].slice(-10);

      if (typed.join(",") === KONAMI) {
        throwConfetti(120);
        setHint(text(language, "סוד נחשף! 🎮", "Secret unlocked! 🎮"));
      }
    };

    document.addEventListener("keydown", onKey);

    return () => document.removeEventListener("keydown", onKey);
  }, [language]);

  return (
    <div className="home-mascot-wrap" ref={wrapRef} onMouseDown={(event) => event.preventDefault()} style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}>
      <div className="home-bubble" key={hint ?? "intro"} role="status">
        {hint ?? text(language, HELLO[0], HELLO[1])}
      </div>
      <div
        className={`home-mascot${bouncing ? " bounce" : ""}${tired ? " tired" : ""}`}
        role="button"
        tabIndex={0}
        aria-label={text(language, "הבצל. לחצו כדי לתפוס אותו", "The onion. Press to catch it")}
        data-caught={caught}
        onPointerDown={(event) => {
          touching.current = event.pointerType === "touch";
          // a finger cannot hover first, so the onion also runs when a touch lands on it
          if (event.pointerType === "touch" && !state.current.tired && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            event.preventDefault();
            flee(event.clientX, event.clientY);
          }
        }}
        onClick={(event) => {
          if (event.detail === 0 || state.current.tired || window.matchMedia("(prefers-reduced-motion: reduce)").matches || !touching.current) catchIt();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            catchIt();
          }
        }}
      >
        {logo}
      </div>
      {caught > 0 ? (
        <div className="home-counter" aria-live="polite">
          {text(language, `נתפס ${caught}`, `Caught ${caught}`)}
        </div>
      ) : null}
    </div>
  );
}

function Standings({ language, board, title }: { language: AppLanguage; board: Board | null; title?: string }) {
  return (
    <>
      <div className="home-board-title">{title ?? text(language, "מובילים", "Top players")}</div>
      <ol className="home-board">
        {(board?.top ?? []).map((row, index) => (
          <li key={`${row.username}-${index}`} className={row.me ? "me" : undefined}>
            <span className="rank">{index + 1}</span>
            <span className="name">{row.username}</span>
            <span>{row.score}</span>
          </li>
        ))}
      </ol>
      <div className="home-board-note">
        {!board
          ? ""
          : !board.signedIn
            ? text(language, "התחברו כדי להופיע בדירוג.", "Sign in to appear in the ranking.")
            : board.mine != null
              ? `${text(language, "השיא שלך: ", "Your best: ")}${board.mine}`
              : board.top.length === 0
                ? text(language, "עוד אין תוצאות. אפשר להיות הראשונים!", "No results yet. Be the first!")
                : ""}
      </div>
    </>
  );
}

// Rankings live on the account site (one per signed-in person). The browser talks to it with the account's cookie.
function useStandings(accountUrl: string, game: Game) {
  const [board, setBoard] = useState<Board | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`${accountUrl}/api/scores?game=${game}`, { credentials: "include" });
      const data = (await response.json()) as Board;

      if (Array.isArray(data.top)) setBoard(data);
    } catch {
      // the ranking is optional
    }
  }, [accountUrl, game]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = useCallback(
    async (score: number) => {
      try {
        const response = await fetch(`${accountUrl}/api/scores`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ game, score }),
        });
        const data = (await response.json()) as Board;

        if (Array.isArray(data.top)) setBoard(data);
      } catch {
        // the ranking is optional
      }
    },
    [accountUrl, game],
  );

  return { board, submit };
}

// A side-scrolling run, like the dinosaur of Chrome. Rocks are jumped over. Big birds fly too high to jump over, so the
// onion ducks under them, but only for a moment at a time (it cannot just be held down). Stars give a shield, and the
// further the run goes the more happens: speed, a day that turns into night, sparkles and a message at every milestone.
// The world is 900 wide on a computer and 420 wide on a phone (shown at the same width on the screen, so everything
// is almost twice as big there), and a little slower to compensate for the shorter way the obstacles come.
const WIDE = { w: 900, h: 260, ground: 210, pace: 1 };
const COMPACT = { w: 420, h: 300, ground: 250, pace: 0.75 };
const L = { ...WIDE };
const JUMP = 7.5;
const GRAVITY = 0.42;
const DUCK_MAX = 650;
const DUCK_REST = 750;
const HELP_KEY = "bz-home-runner-help";

type Obstacle = { x: number; kind: "rock" | "bird" | "star" | "bolt" | "snail"; w: number; h: number; y: number };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number };

const MILESTONES: [number, string, string][] = [
  [100, "מאה! 🔥", "100! 🔥"],
  [250, "אתם על אש!", "You're on fire!"],
  [500, "בצל-על! 🦸", "Super onion! 🦸"],
  [1000, "אלף! אסור לעצור", "A thousand! Don't stop"],
  [2000, "אגדה חיה 👑", "Living legend 👑"],
];

export function OnionRunner({ language, accountUrl }: { language: AppLanguage; accountUrl: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const game = useRef({
    run: false,
    over: false,
    y: 0,
    vy: 0,
    obstacles: [] as Obstacle[],
    particles: [] as Particle[],
    speed: 4,
    distance: 0,
    next: 0,
    last: 0,
    frame: 0,
    paused: false,
    duckKey: false,
    duckStart: 0,
    duckRestUntil: 0,
    ducking: false,
    shield: false,
    shake: 0,
    banner: "",
    bannerUntil: 0,
    milestone: 0,
    time: 0,
    starNext: 900,
    turboUntil: 0,
    slowUntil: 0,
  });
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [phase, setPhase] = useState<"idle" | "running" | "paused" | "over">("idle");
  // The instructions show before the first run, until someone asks not to see them again. The "i" button brings them back.
  const [helpOpen, setHelpOpen] = useState(true);
  const touchRef = useRef<{ y: number; swiped: boolean } | null>(null);
  const [compact, setCompact] = useState(false);
  const { board, submit } = useStandings(accountUrl, "runner");

  useEffect(() => {
    try {
      if (window.localStorage.getItem(HELP_KEY) === "hidden") setHelpOpen(false);
    } catch {
      // no storage: the instructions simply show every time
    }
  }, []);

  // a phone gets the compact world; it changes only while no run is going
  useEffect(() => {
    const query = window.matchMedia("(max-width: 700px)");
    const apply = () => {
      if (game.current.run) return;

      Object.assign(L, query.matches ? COMPACT : WIDE);
      setCompact(query.matches);
    };

    apply();
    query.addEventListener("change", apply);

    return () => query.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    try {
      setBest(Number(window.localStorage.getItem("bz-home-runner")) || 0);
    } catch {
      // no storage, no personal best on this device
    }
  }, []);

  const burst = (x: number, y: number, count: number, colors: string[], power = 4) => {
    const g = game.current;

    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * power + 1;

      g.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 1, life: 1, color: colors[i % colors.length], size: 2 + Math.random() * 3 });
    }
  };

  const draw = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");

    if (!ctx) return;

    const g = game.current;
    const family = getComputedStyle(document.body).fontFamily;
    const km = g.distance / 10;
    // day turns into dusk and night every 400 metres, and back again
    const phaseOfDay = (Math.sin(km / 400 * Math.PI) + 1) / 2;
    const dark = phaseOfDay > 0.55;

    ctx.save();
    // the page is right-to-left; the canvas draws left to right, so emoji and numbers sit where they are placed
    ctx.direction = "ltr";
    ctx.textAlign = "left";
    ctx.clearRect(0, 0, L.w, L.h);

    if (g.shake > 0) ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);

    const sky = ctx.createLinearGradient(0, 0, 0, L.h);

    sky.addColorStop(0, `rgba(${Math.round(120 - phaseOfDay * 90)}, ${Math.round(160 - phaseOfDay * 120)}, ${Math.round(255 - phaseOfDay * 140)}, ${0.1 + phaseOfDay * 0.5})`);
    sky.addColorStop(1, "rgba(75, 112, 245, 0.04)");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, L.w, L.h);

    // stars at night, a moon and a few clouds drifting by
    ctx.fillStyle = "#fff";

    if (phaseOfDay > 0.45) {
      ctx.globalAlpha = Math.min(1, (phaseOfDay - 0.45) * 3);

      for (let i = 0; i < 24; i += 1) ctx.fillRect((i * 97 + 31 - (km * 0.4) % L.w + L.w) % L.w, (i * 53) % 120 + 10, 2, 2);

      ctx.globalAlpha = 1;
      ctx.font = "30px sans-serif";
      ctx.fillText("🌙", L.w - 140, 60);
    } else {
      ctx.font = "30px sans-serif";
      ctx.fillText("☁️", (L.w + 200 - (km * 1.2) % (L.w + 300)) % (L.w + 300) - 100, 50);
      ctx.fillText("☁️", (L.w + 500 - (km * 0.8) % (L.w + 300)) % (L.w + 300) - 100, 90);
    }

    const ink = dark ? "#f4f1ec" : "#1f1e1d";

    ctx.strokeStyle = ink;
    ctx.fillStyle = ink;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.moveTo(0, L.ground + 2);
    ctx.lineTo(L.w, L.ground + 2);
    ctx.stroke();

    // ground marks and distant hills that move at different speeds
    for (let x = -(g.distance * 3) % 60; x < L.w; x += 60) ctx.fillRect(x, L.ground + 10, 14, 2);

    ctx.globalAlpha = 1;
    ctx.textBaseline = "alphabetic";

    for (const obstacle of g.obstacles) {
      if (obstacle.kind === "bird") {
        ctx.font = "62px sans-serif";
        ctx.fillText("🦅", obstacle.x - 4, obstacle.y + obstacle.h);
      } else if (obstacle.kind === "star" || obstacle.kind === "bolt" || obstacle.kind === "snail") {
        ctx.font = "34px sans-serif";
        ctx.fillText(obstacle.kind === "star" ? "⭐" : obstacle.kind === "bolt" ? "⚡" : "🐌", obstacle.x, obstacle.y + obstacle.h + Math.sin(g.time / 8) * 4);
      } else {
        ctx.font = "44px sans-serif";
        ctx.fillText("🪨", obstacle.x, obstacle.y + obstacle.h);
      }
    }

    // the onion squashes when ducking, stretches in the air, and wears a ring while the shield holds
    const onionY = L.ground - g.y;
    const squash = g.ducking ? 0.55 : g.y > 4 ? 1.12 : 1;

    ctx.save();
    // squash and stretch around the middle of the onion (x 75), standing on the ground line
    ctx.translate(75, onionY);
    ctx.scale(g.ducking ? 1.3 : 1, squash);
    ctx.font = "52px sans-serif";
    ctx.fillText("🧅", -35, 0);
    ctx.restore();

    if (g.shield) {
      ctx.strokeStyle = "#ffd24a";
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.6 + Math.sin(g.time / 4) * 0.3;
      ctx.beginPath();

      // the ring follows the onion: round when standing, wide and low when ducking, a bit taller in the air
      if (g.ducking) ctx.ellipse(75, onionY - 14, 36, 19, 0, 0, Math.PI * 2);
      else ctx.ellipse(75, onionY - 22 - (g.y > 4 ? 2 : 0), 31, g.y > 4 ? 34 : 31, 0, 0, Math.PI * 2);

      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    if (g.time < g.turboUntil) {
      ctx.strokeStyle = "#ff7a18";
      ctx.lineWidth = 4;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.ellipse(75, onionY - 22, 40, 38, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    if (g.time < g.slowUntil) {
      ctx.fillStyle = "rgba(120, 180, 255, 0.14)";
      ctx.fillRect(0, 0, L.w, L.h);
    }

    for (const particle of g.particles) {
      ctx.globalAlpha = Math.max(0, particle.life);
      ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
    }

    ctx.globalAlpha = 1;
    ctx.fillStyle = ink;
    ctx.font = `bold 16px ${family}`;

    // what is active right now, with the seconds left
    let hud = 14;

    for (const [label, until] of [["⚡", g.turboUntil], ["🐌", g.slowUntil]] as [string, number][]) {
      if (g.time < until) {
        ctx.fillText(`${label} ${((until - g.time) / 60).toFixed(1)}`, hud, 26);
        hud += 70;
      }
    }

    if (g.shield) ctx.fillText("⭐", hud, 26);

    ctx.font = `bold 18px ${family}`;
    ctx.textAlign = "end";
    ctx.fillText(String(Math.floor(km)).padStart(5, "0"), L.w - 14, 26);
    ctx.textAlign = "left";

    if (g.bannerUntil > g.time) {
      const fade = Math.min(1, (g.bannerUntil - g.time) / 30);

      ctx.globalAlpha = fade;
      ctx.fillStyle = "#ffd24a";
      ctx.font = `800 ${30 + (1 - fade) * 6}px ${family}`;
      ctx.textAlign = "center";
      ctx.fillText(g.banner, L.w / 2, 70);
      ctx.textAlign = "left";
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }, []);

  const end = useCallback(() => {
    const g = game.current;
    const final = Math.floor(g.distance / 10);

    g.run = false;
    g.over = true;
    g.shake = 14;
    burst(75, L.ground - 20, 40, ["#ff6b6b", "#ffd24a", "#fff"], 6);
    setPhase("over");
    setScore(final);

    // a short shake and a spray of sparks before the board comes up
    const settle = () => {
      g.shake *= 0.82;

      for (const particle of g.particles) {
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vy += 0.2;
        particle.life -= 0.03;
      }

      g.particles = g.particles.filter((particle) => particle.life > 0);
      draw();

      if (g.shake > 0.5 || g.particles.length) g.frame = window.requestAnimationFrame(settle);
    };

    settle();

    if (final > 0) void submit(final);

    setBest((previous) => {
      if (final <= previous) return previous;

      try {
        window.localStorage.setItem("bz-home-runner", String(final));
      } catch {
        // fine
      }

      if (final > 50) throwConfetti(30);

      return final;
    });
  }, [draw, submit]);

  const loop = useCallback(
    (now: number) => {
      const g = game.current;

      if (!g.run) return;

      const dt = Math.min(40, now - g.last) / 16;

      g.last = now;
      g.time += dt;
      const turbo = g.time < g.turboUntil;
      const slow = g.time < g.slowUntil;
      // the speed everything moves at right now: turbo is faster, the snail slows the world down
      const eff = g.speed * (turbo ? 1.45 : 1) * (slow ? 0.6 : 1) * (L.w < 700 ? COMPACT.pace : 1);

      g.distance += eff * dt * (turbo ? 1.5 : 1);
      g.speed = 4 + Math.min(11, g.distance / 650);
      // slow motion slows physics too: a jump lasts longer, so the rocks can still be cleared at the usual moment
      const world = dt * (slow ? 0.6 : 1);

      g.vy -= GRAVITY * world;
      g.y = Math.max(0, g.y + g.vy * world);

      if (g.y === 0) {
        if (g.vy < -4) burst(55, L.ground, 6, ["#c9c4bb", "#8a857d"], 2);

        g.vy = 0;
      }

      // ducking: held down it lasts a moment, then the onion has to stand up and rest, so it can never be held
      if (g.duckKey && g.y === 0 && now > g.duckRestUntil) {
        if (!g.ducking) {
          g.ducking = true;
          g.duckStart = now;
        } else if (now - g.duckStart > DUCK_MAX) {
          g.ducking = false;
          g.duckKey = false;
          g.duckRestUntil = now + DUCK_REST;
        }
      } else if (g.ducking && !g.duckKey) {
        g.ducking = false;
      }

      // dust behind the onion
      if (g.y === 0 && Math.random() < 0.5) g.particles.push({ x: 60, y: L.ground, vx: -eff * 0.4, vy: -Math.random(), life: 0.8, color: "#a39e96", size: 2 + Math.random() * 2 });

      if (turbo && Math.random() < 0.8) g.particles.push({ x: 55, y: L.ground - 10 - g.y - Math.random() * 20, vx: -eff * 0.6, vy: (Math.random() - 0.5) * 1.5, life: 0.7, color: Math.random() < 0.5 ? "#ff7a18" : "#ffd24a", size: 3 + Math.random() * 3 });

      g.next -= eff * dt;
      g.starNext -= eff * dt;

      if (g.next <= 0) {
        const bird = g.distance > 2000 && Math.random() < 0.35;

        g.obstacles.push(
          bird
            ? { x: L.w + 20, kind: "bird", w: 52, h: 64, y: L.ground - 88 }
            : { x: L.w + 20, kind: "rock", w: 34, h: 34, y: L.ground - 34 },
        );
        g.next = 260 + Math.random() * 300 + g.speed * 14;

        // A bonus is only placed in the middle of a long empty stretch, so it is never squeezed against a rock or an eagle.
        if (g.starNext <= 0 && g.next >= 560) {
          const roll = Math.random();
          const kind = roll < 0.55 ? "star" : roll < 0.8 ? "bolt" : "snail";

          g.obstacles.push({ x: L.w + 20 + g.next / 2, kind, w: 30, h: 30, y: L.ground - 70 - Math.random() * 20 });
          g.starNext = 1300 + Math.random() * 1500;
        }
      }

      for (const obstacle of g.obstacles) obstacle.x -= eff * dt;

      g.obstacles = g.obstacles.filter((obstacle) => obstacle.x > -70);

      // hitbox of the onion: about 30 wide, 34 tall (only 18 tall while ducking)
      const height = g.ducking ? 18 : 34;
      const top = L.ground - g.y - height;
      const bottom = L.ground - g.y;

      for (const obstacle of g.obstacles) {
        const hitsX = obstacle.x + 8 < 88 && obstacle.x + obstacle.w - 8 > 62;
        const hitsY = obstacle.y + 6 < bottom && obstacle.y + obstacle.h - 4 > top;

        if (!hitsX || !hitsY) continue;

        if (obstacle.kind === "star" || obstacle.kind === "bolt" || obstacle.kind === "snail") {
          g.obstacles = g.obstacles.filter((item) => item !== obstacle);

          if (obstacle.kind === "star") {
            g.shield = true;
            g.banner = text(language, "מגן! ⭐", "Shield! ⭐");
            burst(obstacle.x + 15, obstacle.y + 15, 24, ["#ffd24a", "#fff3b0"], 5);
          } else if (obstacle.kind === "bolt") {
            g.turboUntil = g.time + 240;
            g.banner = text(language, "טורבו! שוברים הכול ⚡", "Turbo! Smash everything ⚡");
            burst(obstacle.x + 15, obstacle.y + 15, 30, ["#ff7a18", "#ffd24a", "#fff"], 6);
          } else {
            g.slowUntil = g.time + 300;
            g.banner = text(language, "הילוך איטי 🐌", "Slow motion 🐌");
            burst(obstacle.x + 15, obstacle.y + 15, 24, ["#78b4ff", "#cfe6ff"], 4);
          }

          g.bannerUntil = g.time + 70;
          break;
        }

        // in turbo the onion goes straight through: rocks and eagles blow up and add distance
        if (turbo) {
          g.obstacles = g.obstacles.filter((item) => item !== obstacle);
          g.distance += 30;
          g.shake = Math.max(g.shake, 6);
          burst(obstacle.x + obstacle.w / 2, obstacle.y + obstacle.h / 2, 18, ["#ff7a18", "#ffd24a", "#c9c4bb"], 5);
          break;
        }

        if (g.shield) {
          g.shield = false;
          g.shake = 8;
          g.obstacles = g.obstacles.filter((item) => item !== obstacle);
          g.banner = text(language, "המגן קיבל את המכה!", "The shield took the hit!");
          g.bannerUntil = g.time + 70;
          burst(75, onionBottom(g), 30, ["#ffd24a", "#fff"], 5);
          break;
        }

        end();

        return;
      }

      // milestones
      const km = Math.floor(g.distance / 10);

      for (const [mark, he, en] of MILESTONES) {
        if (km >= mark && g.milestone < mark) {
          g.milestone = mark;
          g.banner = text(language, he, en);
          g.bannerUntil = g.time + 110;
          burst(L.w / 2, 60, 50, ["#4b70f5", "#ffd24a", "#35c58b", "#ff6b6b"], 7);
        }
      }

      for (const particle of g.particles) {
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.life -= 0.04;
      }

      g.particles = g.particles.filter((particle) => particle.life > 0);
      g.shake *= 0.85;
      setScore(km);
      draw();
      g.frame = window.requestAnimationFrame(loop);
    },
    [draw, end, language],
  );

  const start = useCallback(() => {
    const g = game.current;

    window.cancelAnimationFrame(g.frame);
    Object.assign(g, {
      run: true, over: false, paused: false, y: 0, vy: 0, obstacles: [], particles: [], speed: 4, distance: 0, next: 320, last: performance.now(),
      duckKey: false, ducking: false, duckRestUntil: 0, shield: false, shake: 0, banner: "", bannerUntil: 0, milestone: 0, time: 0, starNext: 900, turboUntil: 0, slowUntil: 0,
    });
    setScore(0);
    setHelpOpen(false);
    setPhase("running");
    g.frame = window.requestAnimationFrame(loop);
  }, [loop]);

  const pause = useCallback(() => {
    const g = game.current;

    if (!g.run) return;

    window.cancelAnimationFrame(g.frame);
    g.run = false;
    g.paused = true;
    g.duckKey = false;
    g.ducking = false;
    setPhase("paused");
    draw();
  }, [draw]);

  const resume = useCallback(() => {
    const g = game.current;

    if (!g.paused) return;

    g.paused = false;
    g.run = true;
    g.last = performance.now();
    setPhase("running");
    g.frame = window.requestAnimationFrame(loop);
  }, [loop]);

  const jump = useCallback(() => {
    const g = game.current;

    if (g.paused) {
      resume();

      return;
    }

    if (!g.run) {
      start();

      return;
    }

    if (g.y === 0 && !g.ducking) g.vy = JUMP;
  }, [resume, start]);

  useEffect(() => {
    draw();
  }, [compact, draw]);

  useEffect(() => {
    draw();

    const g = game.current;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;

      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;

      // after a fall, space or the up arrow starts a new run, as long as the game is on screen (so the page can still scroll)
      const box = canvasRef.current?.getBoundingClientRect();
      const onScreen = Boolean(box && box.top < window.innerHeight * 0.8 && box.bottom > window.innerHeight * 0.2);
      const playing = g.run || document.activeElement === canvasRef.current || ((g.over || g.paused) && onScreen);

      // while a run is on (or the game has the focus) the arrows and space belong to the game, not to the page
      if (playing && (event.key === " " || event.key === "ArrowUp" || event.key === "ArrowDown")) event.preventDefault();

      if (playing && (event.key === " " || event.key === "ArrowUp")) jump();

      if (g.run && event.key === "ArrowDown") {
        g.duckKey = true;

        if (g.y > 0) g.vy = Math.min(g.vy, -7);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === "ArrowDown") g.duckKey = false;
    };

    const onHide = () => {
      if (document.hidden && g.run) pause();
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("keyup", onKeyUp);
    document.addEventListener("visibilitychange", onHide);

    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("visibilitychange", onHide);
      window.cancelAnimationFrame(g.frame);
      g.run = false;
    };
  }, [draw, jump, pause, resume]);

  return (
    <section className="home-panel">
      <h3>{text(language, "הבצל רץ", "Onion run")}</h3>
      <div className="home-bar">
        <span>
          {text(language, "מרחק", "Distance")}: {score}
        </span>
        <span className="home-bar-tools">
          {phase === "running" || phase === "paused" ? (
            <button type="button" className="home-btn" onClick={start}>
              {text(language, "מחדש", "Restart")}
            </button>
          ) : null}
          <button
            type="button"
            className="home-info"
            aria-label={text(language, "הוראות", "Instructions")}
            title={text(language, "הוראות", "Instructions")}
            disabled={phase === "running"}
            onClick={() => setHelpOpen((open) => !open)}
          >
            i
          </button>
        </span>
      </div>
      <div className="home-run-stage">
        <canvas
          ref={canvasRef}
          className={`home-run${phase === "running" ? " is-running" : ""}`}
          width={compact ? COMPACT.w : WIDE.w}
          height={compact ? COMPACT.h : WIDE.h}
          style={{ aspectRatio: compact ? `${COMPACT.w} / ${COMPACT.h}` : `${WIDE.w} / ${WIDE.h}` }}
          tabIndex={0}
          onPointerDown={(event) => {
            event.currentTarget.focus();

            if (event.pointerType === "touch") {
              // a tap jumps (when the finger lifts), a swipe down ducks
              touchRef.current = { y: event.clientY, swiped: false };
              (event.currentTarget as HTMLCanvasElement).setPointerCapture?.(event.pointerId);

              return;
            }

            jump();
          }}
          onPointerMove={(event) => {
            const touch = touchRef.current;

            if (event.pointerType !== "touch" || !touch || touch.swiped || !game.current.run) return;

            if (event.clientY - touch.y > 16) {
              touch.swiped = true;
              game.current.duckKey = true;

              if (game.current.y > 0) game.current.vy = Math.min(game.current.vy, -7);
            }
          }}
          onPointerUp={(event) => {
            const touch = touchRef.current;

            touchRef.current = null;

            if (event.pointerType !== "touch" || !touch) return;

            game.current.duckKey = false;

            if (!touch.swiped) jump();
          }}
          onPointerCancel={() => {
            touchRef.current = null;
            game.current.duckKey = false;
          }}
        />
        {phase === "idle" && !helpOpen ? <div className="home-startnote">{text(language, "לחצו על המסך כדי להתחיל", "Click the screen to start")}</div> : null}
        {phase === "paused" && !helpOpen ? (
          <div className="home-over" role="status" onClick={resume}>
            <strong>{text(language, "מושהה", "Paused")}</strong>
            <span>{text(language, "לחצו על המסך כדי להמשיך", "Click the screen to continue")}</span>
          </div>
        ) : null}
        {helpOpen && phase !== "running" ? (
          <div className="home-help" role="dialog" aria-label={text(language, "הוראות", "Instructions")} onClick={start}>
            <strong>{text(language, "איך משחקים", "How to play")}</strong>
            <ul onClick={(event) => event.stopPropagation()}>
              <li>⬆️ {text(language, "קפיצה: רווח, חץ למעלה או לחיצה על המסך", "Jump: space, up arrow or tap the screen")}</li>
              <li>⬇️ {text(language, "התכופפות מתחת לנשרים 🦅: חץ למטה (רק לרגע!), במגע: החלקה למטה על המשחק", "Duck under eagles 🦅: down arrow (only for a moment!), on touch: swipe down on the game")}</li>
              <li>🪨 {text(language, "לקפוץ מעל סלעים", "Jump over rocks")}</li>
              <li>⭐ {text(language, "מגן שסופג מכה", "A shield that takes one hit")} · ⚡ {text(language, "טורבו ששובר הכול", "Turbo that smashes everything")} · 🐌 {text(language, "הילוך איטי", "Slow motion")}</li>
            </ul>
            <span className="home-help-go">{text(language, "לחצו על המסך כדי להתחיל", "Click the screen to start")}</span>
            <button
              type="button"
              className="home-help-hide"
              onClick={(event) => {
                event.stopPropagation();

                try {
                  window.localStorage.setItem(HELP_KEY, "hidden");
                } catch {
                  // fine
                }

                setHelpOpen(false);
              }}
            >
              {text(language, "אל תציגו שוב את ההוראות", "Don't show the instructions again")}
            </button>
          </div>
        ) : null}
        {phase === "over" && !helpOpen ? (
          <div className="home-over" role="status" onClick={start}>
            <strong>{text(language, "נפלתם!", "You tripped!")}</strong>
            <span>
              {text(language, "המרחק שלכם", "Your distance")}: <b>{score}</b>
              {score > 0 && score >= best ? ` · ${text(language, "שיא חדש!", "New best!")}` : ""}
            </span>
            <button
              type="button"
              className="home-btn"
              onClick={(event) => {
                event.stopPropagation();
                start();
              }}
            >
              {text(language, "עוד פעם", "Run again")}
            </button>
          </div>
        ) : null}
      </div>
      <Standings language={language} board={board} />
    </section>
  );
}

const onionBottom = (g: { y: number }) => L.ground - g.y - 18;
