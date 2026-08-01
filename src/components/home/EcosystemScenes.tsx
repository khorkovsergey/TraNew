import { VoyagerOrb } from '@/components/voyager/VoyagerOrb';
import { wave } from '@/lib/wave';
import type { EcosystemCard } from '@/content/ecosystem';
import styles from './Ecosystem.module.css';

/**
 * The scene inside each carousel card.
 *
 * These are product demonstrations, not abstract illustrations: each one shows the
 * thing actually being used, with real labels and real-looking figures. In
 * production these become the first frame of a short screen recording, which is
 * why every scene is composed to sit at the bottom of the card and be croppable.
 *
 * Two layers per card. The decor sits behind everything, clipped to the card's
 * radius and inert to the pointer; the scene sits in front of it.
 */

/* ------------------------------------------------------------ Small pieces */

function MiniCard({
  children,
  width,
  maxWidth,
}: {
  children: React.ReactNode;
  width?: number;
  maxWidth?: number;
}) {
  return (
    <div className={styles.miniCard} style={{ width, maxWidth }}>
      {children}
    </div>
  );
}

function Spark({
  seed,
  points = 24,
  width,
  height,
  color,
}: {
  seed: number;
  points?: number;
  width: number;
  height: number;
  color: string;
}) {
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width, height, display: 'block' }} aria-hidden="true">
      <polyline
        points={wave(seed, points, width, height)}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Bar({ label, width, color, value }: { label: string; width: string; color: string; value: string }) {
  return (
    <div className={styles.bar}>
      <div className={styles.barHead}>
        <span>{label}</span>
        <span className={styles.barValue}>{value}</span>
      </div>
      <div className={styles.barTrack}>
        <div className={styles.barFill} style={{ width, background: color }} />
      </div>
    </div>
  );
}

/** A white satellite disc carrying one icon — the recurring decor motif. */
function Satellite({
  d,
  color,
  size,
  style,
}: {
  d: string;
  color: string;
  size: number;
  style: React.CSSProperties;
}) {
  return (
    <span className={styles.satellite} style={{ width: size, height: size, ...style }}>
      <svg
        width={Math.round(size * 0.42)}
        height={Math.round(size * 0.42)}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={d} />
      </svg>
    </span>
  );
}

function Orbit({ r, color, style }: { r: number; color?: string; style: React.CSSProperties }) {
  return (
    <svg width={r * 2} height={r * 2} style={{ position: 'absolute', opacity: 0.55, ...style }} aria-hidden="true">
      <circle
        cx={r}
        cy={r}
        r={r - 2}
        fill="none"
        stroke={color ?? '#c9c3e8'}
        strokeWidth={1.5}
        strokeDasharray="3 8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Rings({ radii, color, style }: { radii: number[]; color: string; style: React.CSSProperties }) {
  const outer = radii[radii.length - 1];
  return (
    <svg width={outer * 2} height={outer * 2} style={{ position: 'absolute', opacity: 0.5, ...style }} aria-hidden="true">
      {radii.map((r) => (
        <circle
          key={r}
          cx={outer}
          cy={outer}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeDasharray="3 8"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

/** Icon paths reused across the decor layers. */
const P = {
  chart: 'M3 3v16a2 2 0 0 0 2 2h16M7 14l4-4 3 3 5-6',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14M21 21l-4.35-4.35',
  pie: 'M12 3a9 9 0 1 0 9 9h-9zM21 8a9 9 0 0 0-6-4.8V8z',
  bars: 'M3 20h18M7 20v-8M12 20V4M17 20v-6',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
  grad: 'M22 10 12 5 2 10l10 5 10-5zM6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5M22 10v6',
  target: 'M12 7a5 5 0 1 0 5 5M12 12l4-4M16 8V5l3-3v3h3l-3 3h-3M12 3a9 9 0 1 0 9 9',
  user: 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8',
  star: 'M12 3l2.6 5.3 5.9.9-4.3 4.2 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.2l5.9-.9z',
  home: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  dollar: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  bulb: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z',
};

/* ----------------------------------------------------------------- Decor */

function Decor({ card }: { card: EcosystemCard['key'] }) {
  switch (card) {
    case 'voyager':
      return (
        <>
          <Orbit r={95} style={{ left: 46, top: 150 }} />
          <Orbit r={70} color="#c9d4f5" style={{ right: 54, top: 190 }} />
          <Satellite d={P.chart} color="#7c4dff" size={46} style={{ left: 86, top: 168 }} />
          <Satellite d={P.search} color="#2962ff" size={40} style={{ left: 56, top: 268 }} />
          <Satellite d={P.pie} color="#7c4dff" size={42} style={{ right: 70, top: 226 }} />
        </>
      );
    case 'market':
      return (
        <>
          <svg width={780} height={200} style={{ position: 'absolute', left: 0, top: 150, opacity: 0.4 }} aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <path
                key={i}
                d={`M0 ${40 + i * 55} Q 390 ${i * 55 - 20} 780 ${40 + i * 55}`}
                fill="none"
                stroke="#9db8ea"
                strokeWidth={1.5}
                strokeDasharray="2 9"
                strokeLinecap="round"
              />
            ))}
          </svg>
          <Satellite d={P.bell} color="#2962ff" size={42} style={{ left: 64, top: 150 }} />
          <Satellite d={P.search} color="#1aa966" size={44} style={{ right: 60, top: 190 }} />
        </>
      );
    case 'charts':
      return (
        <>
          <svg width={780} height={440} style={{ position: 'absolute', left: 0, top: 0, opacity: 0.3 }} aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <line key={`h${i}`} x1={0} y1={90 + i * 70} x2={780} y2={90 + i * 70} stroke="#b9cdf2" strokeWidth={1} />
            ))}
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <line key={`v${i}`} x1={90 + i * 100} y1={50} x2={90 + i * 100} y2={440} stroke="#b9cdf2" strokeWidth={1} />
            ))}
          </svg>
          <Satellite d={P.target} color="#2962ff" size={42} style={{ left: 56, top: 160 }} />
          <Satellite d={P.bell} color="#7c4dff" size={40} style={{ right: 60, top: 146 }} />
        </>
      );
    case 'strategy':
      return (
        <>
          <Rings radii={[26, 52, 80]} color="#8fceaa" style={{ right: 46, top: 128 }} />
          <Satellite d={P.dollar} color="#2962ff" size={40} style={{ left: 70, top: 150 }} />
          <Satellite d={P.bulb} color="#f4a71f" size={42} style={{ left: 98, top: 248 }} />
        </>
      );
    case 'wealth':
      return (
        <>
          <svg width={780} height={440} style={{ position: 'absolute', left: 0, top: 0, opacity: 0.5 }} aria-hidden="true">
            <path d="M120 130 C 300 90, 480 90, 640 150" fill="none" stroke="#aab3c5" strokeWidth={1.5} strokeDasharray="3 8" strokeLinecap="round" />
            <path d="M110 210 C 300 250, 500 250, 660 200" fill="none" stroke="#aab3c5" strokeWidth={1.5} strokeDasharray="3 8" strokeLinecap="round" />
          </svg>
          <Satellite d={P.home} color="#131722" size={44} style={{ left: 78, top: 110 }} />
          <Satellite d={P.pie} color="#2962ff" size={40} style={{ right: 64, top: 128 }} />
          <Satellite d={P.dollar} color="#1aa966" size={42} style={{ right: 92, top: 234 }} />
        </>
      );
    case 'academy':
      return (
        <>
          <svg width={300} height={220} style={{ position: 'absolute', right: 50, top: 120, opacity: 0.55 }} aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <circle key={i} cx={20 + i * 60} cy={190 - i * 40} r={5} fill="#c9b8f2" />
            ))}
            <path d="M20 190 L80 150 L140 110 L200 70 L260 30" fill="none" stroke="#c9b8f2" strokeWidth={1.5} strokeDasharray="2 8" strokeLinecap="round" />
          </svg>
          <Satellite d={P.grad} color="#7c4dff" size={46} style={{ left: 70, top: 160 }} />
          <Satellite d={P.bulb} color="#f4a71f" size={40} style={{ left: 102, top: 256 }} />
        </>
      );
    case 'marketplace':
      return (
        <>
          {([
            [60, 150, 16, 0.9],
            [110, 244, 10, 0.6],
            [696, 140, 12, 0.75],
            [656, 250, 18, 0.9],
            [600, 104, 8, 0.5],
          ] as const).map(([x, y, size, opacity], i) => (
            <svg key={i} width={size} height={size} viewBox="0 0 24 24" style={{ position: 'absolute', left: x, top: y, opacity }} aria-hidden="true">
              <path d={P.star} fill="#f4b26b" />
            </svg>
          ))}
          <Satellite d={P.user} color="#2962ff" size={44} style={{ left: 88, top: 188 }} />
          <Satellite d={P.bars} color="#7c4dff" size={40} style={{ right: 86, top: 188 }} />
        </>
      );
  }
}

/* ----------------------------------------------------------------- Scenes */

function Scene({ card }: { card: EcosystemCard['key'] }) {
  switch (card) {
    case 'voyager':
      return (
        <div className={styles.sceneRow} style={{ gap: 16, paddingBottom: 34 }}>
          <VoyagerOrb size={64} />
          <MiniCard maxWidth={330}>
            <div className={styles.miniLabel}>You · on TSLA chart</div>
            <div className={styles.question}>“Why is Tesla moving today?”</div>
            <div className={styles.answer}>
              Deliveries beat consensus by 4%; volume is 32% above average. Open the earnings
              calendar?
            </div>
            <div className={styles.source}>AI explanation · market data 09:45 UTC</div>
          </MiniCard>
        </div>
      );

    case 'market':
      return (
        <div className={styles.sceneRow} style={{ paddingBottom: 30 }}>
          <MiniCard width={170}>
            <div className={styles.tickerHead}>
              <span>S&P 500</span>
              <span style={{ color: '#1aa966' }}>+0.4%</span>
            </div>
            <Spark seed={2.1} width={150} height={44} color="#1aa966" />
          </MiniCard>
          <MiniCard width={190}>
            <div className={styles.miniLabel}>WHY IT MOVES</div>
            <div className={styles.sceneText}>Mega-cap earnings beat; CPI release on Thursday.</div>
            <div className={styles.source}>Market data · Reuters</div>
          </MiniCard>
          <MiniCard width={150}>
            <div className={styles.tickerHead}>
              <span>BTC</span>
              <span style={{ color: '#e0492f' }}>−1.2%</span>
            </div>
            <Spark seed={3.7} width={130} height={44} color="#e0492f" />
          </MiniCard>
        </div>
      );

    case 'charts':
      return (
        <div className={styles.workspace}>
          <div className={styles.toolbar}>
            <span className={styles.toolbarSymbol}>TSLA · 1D</span>
            {['RSI', 'MA 50/200', 'Compare', 'Alert'].map((chip) => (
              <span className={styles.toolChip} key={chip}>
                {chip}
              </span>
            ))}
            <span className={`${styles.toolChip} ${styles.toolChipAi}`}>AI: explain this move</span>
          </div>
          <Spark seed={2.6} points={40} width={580} height={120} color="#2962ff" />
        </div>
      );

    case 'strategy':
      return (
        <div className={styles.sceneRow} style={{ paddingBottom: 30 }}>
          <MiniCard width={210}>
            <div className={styles.miniLabel}>YOUR PROFILE</div>
            <div className={styles.profileText}>
              Grow wealth · 5–10 years
              <br />
              Risk: wait it out · €25–100K
            </div>
          </MiniCard>
          <MiniCard width={260}>
            <div className={styles.miniLabel}>RANGES TO EXPLORE</div>
            {/* Ranges, not a single number: the product proposes a band to consider,
                never one allocation presented as the answer. */}
            <Bar label="Equity ETFs" width="55%" color="#2962ff" value="35–55%" />
            <Bar label="Bonds & cash" width="40%" color="#1aa966" value="20–40%" />
            <Bar label="Single stocks" width="15%" color="#7c4dff" value="5–15%" />
          </MiniCard>
        </div>
      );

    case 'wealth':
      return (
        <div className={styles.sceneRow} style={{ paddingBottom: 30 }}>
          <div className={styles.assetStack}>
            {['Portfolio €279K', 'Apartment €480K', 'Business €475K', 'Cash €52K'].map((asset) => (
              <div className={styles.assetRow} key={asset}>
                {asset}
              </div>
            ))}
          </div>
          <svg width={46} height={90} viewBox="0 0 46 90" fill="none" aria-hidden="true">
            <path
              d="M4 12h30M4 36h30M4 62h30M4 84h30M34 12c8 0 8 30 8 33s0 33-8 33"
              stroke="#c3cad8"
              strokeWidth={2}
              strokeLinecap="round"
            />
          </svg>
          <MiniCard width={230}>
            <div className={styles.miniLabel}>NET WEALTH</div>
            <div className={`${styles.netWealth} tn-num`}>€1.21M</div>
            <Bar label="Liquid within 30 days" width="14%" color="#f4a71f" value="€172K" />
            <div className={styles.source}>What if I sell the apartment? → scenario</div>
          </MiniCard>
        </div>
      );

    case 'academy':
      return (
        <div className={styles.sceneRow} style={{ paddingBottom: 30 }}>
          <MiniCard width={250}>
            <div className={styles.miniLabel}>LESSON 3 OF 26</div>
            <div className={styles.lessonTitle}>Why people invest</div>
            <Bar label="Your path" width="12%" color="#7c4dff" value="12%" />
            <div className={styles.sceneText}>Next: try it on a real symbol page →</div>
          </MiniCard>
          <MiniCard width={200}>
            <div className={styles.quickCheck}>QUICK CHECK</div>
            <div className={styles.sceneText}>Which of these is a stock?</div>
            <div className={styles.answerChips}>
              <span className={styles.answerRight}>Tesla ✓</span>
              <span className={styles.answerPlain}>Gold</span>
            </div>
          </MiniCard>
        </div>
      );

    case 'marketplace':
      return (
        <div className={styles.sceneRow} style={{ gap: 12, paddingBottom: 34 }}>
          {([
            ['Expert Services', P.user, '#2962ff'],
            ['Tools & Data', P.bars, '#7c4dff'],
            ['Learning & Events', P.grad, '#1aa966'],
            ['Merch', P.star, '#f4741f'],
          ] as const).map(([label, d, color]) => (
            <div className={styles.categoryCard} key={label}>
              <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
                <path d={d} />
              </svg>
              <div className={styles.categoryLabel}>{label}</div>
            </div>
          ))}
        </div>
      );
  }
}

export function EcosystemArt({ card }: { card: EcosystemCard['key'] }) {
  return (
    <>
      {/* Clipped to the card radius and inert: decor must never intercept a click
          meant for the CTA behind it. */}
      <div className={styles.decor} aria-hidden="true">
        <Decor card={card} />
      </div>
      <div className={styles.scene} aria-hidden="true">
        <Scene card={card} />
      </div>
    </>
  );
}
