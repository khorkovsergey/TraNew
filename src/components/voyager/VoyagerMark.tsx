import styles from './Voyager.module.css';

/**
 * Voyager's face, in the small places.
 *
 * The floating widget carried the v1 CSS orb — a white sphere with gradient
 * eyes, designed for a light page. On the dark portal it was the brightest
 * thing on any screen it appeared on, and on the home page it sat in the
 * bottom corner while the *robot* looked out of the hero card: two different
 * assistants, in one view, both called Voyager.
 *
 * One mark now, and it is the rendered robot the redesign ships. The orb
 * component stays in the repository — it is the v1 identity and the Brand Kit
 * still describes it — but nothing renders it any more.
 */
export function VoyagerMark({ size = 26, className }: { size?: number; className?: string }) {
  return (
    /* eslint-disable-next-line @next/next/no-img-element --
       a fixed-size decorative PNG; next/image would add a wrapper and a loader
       for an asset that is never resized and never the LCP element. */
    <img
      className={`${styles.mark} ${className ?? ''}`}
      src="/redesign/voyager-robot.png"
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      style={{ width: size, height: size }}
    />
  );
}
