import React, { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { PanResponder, Platform, Pressable, Text, View, type ViewStyle } from 'react-native';
import { colorForCategory } from './categories';
import {
  calendarMonth,
  calendarMonthIndex,
  calendarSwipeDirection,
  createCalendarWheelTracker,
  isCalendarPan,
  shiftCalendarMonth,
} from './calendar';
import { today } from './dates';
import { s } from './styles';
import { C } from './theme';
import type { CustomCategory } from './types';

type CalendarDay = { disabled?: boolean; highlighted?: boolean; categories?: string[] };
const touchStyle: ViewStyle & { touchAction?: string } =
  Platform.OS === 'web' ? { touchAction: 'pan-y pinch-zoom' } : {};

/** Shared, arrow-free month browser; only a day tap calls onSelectDate. */
export function MonthCalendar({
  month,
  onMonthChange,
  selectedDate,
  onSelectDate,
  onToday,
  maxMonth,
  getDay,
  customCategories = [],
}: {
  month: string;
  onMonthChange: (month: string) => void;
  selectedDate?: string;
  onSelectDate: (date: string) => void;
  onToday?: (date: string) => void;
  maxMonth?: string;
  getDay?: (date: string) => CalendarDay;
  customCategories?: CustomCategory[];
}) {
  const surface = useRef<View | null>(null);
  const [, refreshToday] = useReducer((revision: number) => revision + 1, 0);
  const latest = useRef({ month, maxMonth, onMonthChange });
  latest.current = { month, maxMonth, onMonthChange };
  const wheel = useMemo(createCalendarWheelTracker, []);
  const moveMonth = useCallback((direction: -1 | 1) => {
    const current = latest.current;
    const next = shiftCalendarMonth(current.month, direction, current.maxMonth);
    if (next !== current.month) {
      latest.current = { ...current, month: next };
      current.onMonthChange(next);
    }
  }, []);
  const offset = useRef({ dx: 0, dy: 0 });
  const multitouch = useRef(false);
  const panning = useRef(false);
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponderCapture: (_event, gesture) => {
          if (gesture.numberActiveTouches === 1) {
            offset.current = { dx: 0, dy: 0 };
            multitouch.current = false;
          } else multitouch.current = true;
          return false;
        },
        onMoveShouldSetPanResponderCapture: (_event, gesture) => {
          if (
            panning.current ||
            multitouch.current ||
            !isCalendarPan(gesture.dx, gesture.dy, gesture.numberActiveTouches)
          )
            return false;
          // PanResponder resets dx/dy when it takes over from a day button.
          offset.current = { dx: gesture.dx, dy: gesture.dy };
          return true;
        },
        onPanResponderGrant: () => {
          panning.current = true;
        },
        onPanResponderStart: (_event, gesture) => {
          if (gesture.numberActiveTouches > 1) multitouch.current = true;
        },
        onPanResponderMove: (_event, gesture) => {
          if (gesture.numberActiveTouches > 1) multitouch.current = true;
        },
        onPanResponderRelease: (_event, gesture) => {
          panning.current = false;
          if (multitouch.current) return;
          const direction = calendarSwipeDirection(
            gesture.dx + offset.current.dx,
            gesture.dy + offset.current.dy,
          );
          if (direction) {
            wheel.cancel(Date.now());
            moveMonth(direction);
          }
        },
        onPanResponderTerminate: () => {
          panning.current = false;
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [moveMonth, wheel],
  );

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = surface.current as unknown as HTMLElement | null;
    if (!node) return;
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey) return;
      // Shift+wheel provides horizontal navigation for a regular mouse.
      const shifted = event.shiftKey && event.deltaX === 0;
      const dx = shifted ? event.deltaY : event.deltaX;
      const dy = shifted ? 0 : event.deltaY;
      if (Math.abs(dx) <= Math.abs(dy) * 1.25) return;
      event.preventDefault();
      const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? node.clientWidth : 1;
      const direction = wheel.observe(dx * scale, dy * scale, Date.now());
      if (direction) moveMonth(direction);
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, [moveMonth, wheel]);

  const { label, cells } = calendarMonth(month);
  const currentDay = today();
  const keyboard =
    Platform.OS === 'web'
      ? {
          onKeyDown: (event: React.KeyboardEvent) => {
            if (
              event.target !== event.currentTarget ||
              event.ctrlKey ||
              event.altKey ||
              event.metaKey
            )
              return;
            const direction =
              event.key === 'PageDown' || event.key === 'ArrowRight'
                ? 1
                : event.key === 'PageUp' || event.key === 'ArrowLeft'
                  ? -1
                  : null;
            if (direction) {
              event.preventDefault();
              wheel.cancel(Date.now());
              moveMonth(direction);
            }
          },
        }
      : {};
  const maximum = calendarMonthIndex(maxMonth ?? '9999-12');

  return (
    <View
      ref={surface}
      testID="month-calendar"
      style={[s.calendar, touchStyle]}
      {...pan.panHandlers}
    >
      <View style={s.calendarNav}>
        <View
          {...keyboard}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="Calendar month"
          accessibilityHint="Swipe left for the next month or right for the previous month."
          accessibilityValue={{ min: 0, max: maximum, now: calendarMonthIndex(month), text: label }}
          aria-valuemin={0}
          aria-valuemax={maximum}
          aria-valuenow={calendarMonthIndex(month)}
          aria-valuetext={label}
          aria-orientation="horizontal"
          accessibilityActions={[
            { name: 'increment', label: 'Next month' },
            { name: 'decrement', label: 'Previous month' },
          ]}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === 'increment') moveMonth(1);
            else if (event.nativeEvent.actionName === 'decrement') moveMonth(-1);
          }}
          tabIndex={Platform.OS === 'web' ? 0 : undefined}
          style={s.calendarMonthControl}
        >
          <Text aria-live="polite" style={s.calendarTitle}>
            {label}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go to today"
          onPress={() => {
            wheel.cancel(Date.now());
            const date = today();
            // Refresh day markers/availability even when an open calendar crosses midnight.
            refreshToday();
            onMonthChange(date.slice(0, 7));
            onToday?.(date);
          }}
          style={({ pressed }) => [s.calendarTodayButton, pressed && { opacity: 0.6 }]}
        >
          <Text style={s.calendarTodayText}>Today</Text>
        </Pressable>
      </View>
      <Text style={s.calendarHint}>Swipe left or right to change month</Text>
      <View style={s.calendarGrid}>
        {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((day) => (
          <Text key={day} style={s.weekday}>
            {day}
          </Text>
        ))}
        {cells.map((day, index) => {
          if (!day) return <View key={`blank-${index}`} style={s.calendarCell} />;
          const date = `${month}-${String(day).padStart(2, '0')}`;
          const state = getDay?.(date) ?? {};
          const active = date === selectedDate;
          const isToday = date === currentDay;
          return (
            <Pressable
              key={date}
              accessibilityRole="button"
              accessibilityLabel={date.split('-').reverse().join('.')}
              accessibilityState={{ selected: active, disabled: !!state.disabled }}
              aria-pressed={active}
              disabled={state.disabled}
              onPress={() => onSelectDate(date)}
              style={s.calendarCell}
            >
              <View
                style={[
                  s.dayCircle,
                  state.highlighted && s.calendarDayAvailable,
                  active && s.daySelected,
                  isToday && !active && s.calendarDayToday,
                ]}
              >
                <Text
                  style={[
                    s.dayText,
                    state.disabled && { color: C.muted },
                    (active || state.highlighted) && s.dayTextSelected,
                  ]}
                >
                  {day}
                </Text>
                {!!state.categories?.length && (
                  <View style={s.workoutDots}>
                    {state.categories.slice(0, 5).map((category) => (
                      <View
                        key={category}
                        accessibilityLabel={category}
                        style={[
                          s.workoutDot,
                          { backgroundColor: colorForCategory(category, customCategories) },
                        ]}
                      />
                    ))}
                  </View>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
