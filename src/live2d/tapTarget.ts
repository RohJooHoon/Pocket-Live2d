export type TapTarget = 'face' | 'body';

/** Prefer the face when its bounds overlap a body HitArea or drawable. */
export function selectTapTarget(hitNames: Iterable<string>): TapTarget | null {
  let target: TapTarget | null = null;
  for (const name of hitNames) {
    if (/head|face|eye|mouth|brow|nose|顔|頭|目|口/iu.test(name)) return 'face';
    target = 'body';
  }
  return target;
}
