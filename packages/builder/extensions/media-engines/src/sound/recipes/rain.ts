/* «مطر» Rain: a filtered hiss, a soft low rumble, and scattered droplets on a timer. */
import { noiseBuffer, recipeKit, span, type Recipe } from './kit';

export const rain: Recipe = (rc) => {
  const k = recipeKit(rc);
  const { intensity, tone, tempo } = rc.tuning;
  const { ctx } = rc;
  k.chain(
    k.noise('white'),
    k.filter('highpass', 900),
    k.filter('lowpass', span(tone, 4500, 9000)),
    k.gain(0.24 * intensity),
    rc.out,
  );
  k.chain(k.noise('brown'), k.filter('lowpass', 360), k.gain(0.3 * intensity), rc.out);
  const drop = (): void => {
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer(ctx, 'white', rc.random);
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = span(rc.random(), 1800, 6000);
    band.Q.value = 3;
    const envelope = ctx.createGain();
    const now = ctx.currentTime;
    envelope.gain.setValueAtTime(0, now);
    envelope.gain.linearRampToValueAtTime(span(rc.random(), 0.05, 0.16) * intensity, now + 0.004);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
    source.connect(band);
    band.connect(envelope);
    envelope.connect(rc.out);
    source.onended = () => {
      envelope.disconnect();
    };
    k.track(source);
    source.start(now, rc.random() * 3, 0.06);
    k.later(drop, span(rc.random(), 50, 160) / span(tempo, 0.5, 1.6));
  };
  k.later(drop, 120);
  return k;
};
