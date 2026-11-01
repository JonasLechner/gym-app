import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScrollView, View } from 'react-native';
import { revealMovedExercise } from './useExerciseOrderScroll';

test('scrolls to the measured new position relative to the inner scroll content', () => {
  const calls: unknown[] = [];
  const scroll: Pick<ScrollView, 'getInnerViewNode' | 'scrollTo'> = {
    getInnerViewNode: () => 123,
    scrollTo: (options) => {
      calls.push(options);
    },
  };
  const exercise: Pick<View, 'measureLayout'> = {
    measureLayout: (ancestor, complete) => {
      assert.equal(ancestor, 123);
      complete(0, 800, 300, 500);
    },
  };
  revealMovedExercise(scroll, exercise, () => true);
  assert.deepEqual(calls, [{ y: 788, animated: true }]);
});

test('exercises near the top never request a negative scroll offset', () => {
  let position: unknown;
  revealMovedExercise(
    {
      getInnerViewNode: () => 123,
      scrollTo: (options) => {
        position = options;
      },
    },
    {
      measureLayout: (_ancestor, complete) => {
        complete(0, 5, 300, 500);
      },
    },
    () => true,
  );
  assert.deepEqual(position, { y: 0, animated: true });
});

test('late measurements cannot scroll a closed screen or supersede a newer move', () => {
  let callback!: Parameters<View['measureLayout']>[1];
  let current = true;
  let calls = 0;
  revealMovedExercise(
    {
      getInnerViewNode: () => 123,
      scrollTo: () => {
        calls++;
      },
    },
    {
      measureLayout: (_ancestor, complete) => {
        callback = complete;
      },
    },
    () => current,
  );
  current = false;
  callback(0, 800, 300, 500);
  assert.equal(calls, 0);
});
