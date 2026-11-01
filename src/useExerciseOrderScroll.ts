import { useCallback, useLayoutEffect, useRef } from 'react';
import type { ScrollView, View } from 'react-native';

type ExerciseScrollView = Pick<ScrollView, 'getInnerViewNode' | 'scrollTo'>;
type ExerciseView = Pick<View, 'measureLayout'>;

export function revealMovedExercise(
  scroll: ExerciseScrollView,
  exercise: ExerciseView,
  isCurrent: () => boolean,
): void {
  exercise.measureLayout(scroll.getInnerViewNode(), (_x, y) => {
    if (isCurrent()) scroll.scrollTo({ y: Math.max(0, y - 12), animated: true });
  });
}

/** Measure after the reordered views commit, including exercises nested inside History cards. */
export function useExerciseOrderScroll(order: unknown) {
  const scrollRef = useRef<ScrollView | null>(null);
  const exercises = useRef(new Map<string, View>());
  const pending = useRef<string | null>(null);
  const exerciseRef = useCallback(
    (id: string) => (view: View | null) => {
      if (view) exercises.current.set(id, view);
      else exercises.current.delete(id);
    },
    [],
  );
  const scrollAfterMove = useCallback((id: string) => {
    pending.current = id;
  }, []);

  useLayoutEffect(() => {
    const id = pending.current;
    if (!id) return;
    pending.current = null;
    let cancelled = false;
    let layoutFrame: number | undefined;
    const frame = requestAnimationFrame(() => {
      // Let native layout and browser scroll anchoring settle after the reordered commit.
      layoutFrame = requestAnimationFrame(() => {
        const scroll = scrollRef.current;
        const exercise = exercises.current.get(id);
        if (!scroll || !exercise) return;
        revealMovedExercise(
          scroll,
          exercise,
          () =>
            !cancelled && scrollRef.current === scroll && exercises.current.get(id) === exercise,
        );
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      if (layoutFrame !== undefined) cancelAnimationFrame(layoutFrame);
    };
  }, [order]);

  return { scrollRef, exerciseRef, scrollAfterMove };
}
