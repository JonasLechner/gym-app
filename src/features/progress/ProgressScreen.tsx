import Svg, { Circle, Line, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import React, { useEffect, useMemo, useState } from 'react';
import { Dimensions, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colorForCategory } from '../../categories';
import {
  bestSetsByRepRange,
  exerciseProgress,
  rollingAverage,
  weeklyTotalVolume,
  type ProgressPoint,
} from '../../progress';
import { prettyDate, today, useStore } from '../../store';
import { s } from '../../styles';
import { fs } from './styles';
import { C } from '../../theme';
import type { Workout } from '../../types';
import { Empty, fmt, Header } from '../../ui';

const localDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

function ProgressLineChart({
  points,
  mode,
}: {
  points: ProgressPoint[];
  mode: 'weight' | 'oneRM';
}) {
  const [selected, setSelected] = useState<ProgressPoint | null>(null);
  useEffect(() => setSelected(null), [points, mode]);
  const width = Math.max(280, Math.min(620, Dimensions.get('window').width - 62));
  const height = 230,
    padL = 42,
    padR = 12,
    padT = 18,
    padB = 36;
  const values = points.map((p) => p.value);
  const minValue = Math.min(...values),
    maxValue = Math.max(...values);
  const range = Math.max(1, maxValue - minValue);
  const x = (i: number) =>
    padL +
    (points.length === 1
      ? (width - padL - padR) / 2
      : (i * (width - padL - padR)) / (points.length - 1));
  const y = (value: number) => padT + ((maxValue - value) / range) * (height - padT - padB);
  const polyline = points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ');
  if (!points.length)
    return (
      <Empty
        icon="stats-chart"
        title="No valid data"
        copy={
          mode === 'oneRM'
            ? 'Projected 1RM requires sets of 1–30 completed reps.'
            : 'Complete at least one rep to record a result.'
        }
      />
    );
  return (
    <View>
      <View style={fs.lineChart}>
        <Svg width={width} height={height}>
          <Line x1={padL} y1={padT} x2={padL} y2={height - padB} stroke={C.line} strokeWidth="1" />
          <Line
            x1={padL}
            y1={height - padB}
            x2={width - padR}
            y2={height - padB}
            stroke={C.line}
            strokeWidth="1"
          />
          <SvgText x={padL - 6} y={padT + 4} textAnchor="end" fill={C.muted} fontSize="10">
            {fmt(maxValue)}
          </SvgText>
          <SvgText x={padL - 6} y={height - padB + 4} textAnchor="end" fill={C.muted} fontSize="10">
            {fmt(minValue)}
          </SvgText>
          <SvgText x={padL} y={height - 8} fill={C.muted} fontSize="10">
            {prettyDate(points[0]!.date)}
          </SvgText>
          <SvgText x={width - padR} y={height - 8} textAnchor="end" fill={C.muted} fontSize="10">
            {prettyDate(points.at(-1)!.date)}
          </SvgText>
          {points.length > 1 && (
            <Polyline
              points={polyline}
              fill="none"
              stroke={C.blue}
              strokeWidth="3"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
          {points.map((point, i) => (
            <React.Fragment key={`${point.date}-${i}`}>
              <Circle
                cx={x(i)}
                cy={y(point.value)}
                r={16}
                fill="transparent"
                onPress={() => setSelected(point)}
              />
              <Circle
                cx={x(i)}
                cy={y(point.value)}
                r={selected === point ? 7 : 5}
                fill={selected === point ? C.white : C.blue}
                stroke={C.blueDim}
                strokeWidth="3"
                pointerEvents="none"
              />
            </React.Fragment>
          ))}
        </Svg>
      </View>
      {selected && (
        <View style={fs.graphTooltip}>
          <View>
            <Text style={s.overline}>{prettyDate(selected.date)}</Text>
            <Text style={fs.tooltipValue}>{fmt(selected.value)} KG</Text>
          </View>
          <Text style={fs.tooltipSet}>
            {fmt(selected.weight)} kg × {selected.reps} rep{selected.reps === 1 ? '' : 's'}
          </Text>
        </View>
      )}
    </View>
  );
}
function SimpleLineChart({
  points,
  title,
  suffix = 'kg',
}: {
  points: { date: string; value: number }[];
  title: string;
  suffix?: string;
}) {
  const [selected, setSelected] = useState<{ date: string; value: number } | null>(null);
  const width = Math.max(280, Math.min(620, Dimensions.get('window').width - 62)),
    height = 190,
    pad = 34;
  const values = points.map((p) => p.value),
    low = Math.min(...values),
    high = Math.max(...values),
    range = Math.max(1, high - low);
  const x = (i: number) =>
    pad +
    (points.length === 1 ? (width - pad * 2) / 2 : (i * (width - pad * 2)) / (points.length - 1));
  const y = (v: number) => 16 + ((high - v) / range) * (height - 50);
  if (!points.length) return null;
  return (
    <View style={fs.statSection}>
      <Text style={s.cardTitle}>{title}</Text>
      <View style={fs.lineChart}>
        <Svg width={width} height={height}>
          <Line x1={pad} y1={height - 34} x2={width - pad} y2={height - 34} stroke={C.line} />
          <Polyline
            points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ')}
            fill="none"
            stroke={C.blue}
            strokeWidth="3"
          />
          {points.map((p, i) => (
            <React.Fragment key={`${p.date}-${i}`}>
              <Circle
                cx={x(i)}
                cy={y(p.value)}
                r={14}
                fill="transparent"
                onPress={() => setSelected(p)}
              />
              <Circle
                cx={x(i)}
                cy={y(p.value)}
                r={4}
                fill={selected === p ? C.white : C.blue}
                pointerEvents="none"
              />
            </React.Fragment>
          ))}
          <SvgText x={pad} y={height - 10} fill={C.muted} fontSize="10">
            {prettyDate(points[0]!.date)}
          </SvgText>
          <SvgText x={width - pad} y={height - 10} textAnchor="end" fill={C.muted} fontSize="10">
            {prettyDate(points.at(-1)!.date)}
          </SvgText>
        </Svg>
      </View>
      {selected && (
        <Text style={fs.chartSelection}>
          {prettyDate(selected.date)} · {fmt(selected.value)} {suffix}
        </Text>
      )}
    </View>
  );
}
function DistributionRing({ workouts }: { workouts: Workout[] }) {
  const { data } = useStore();
  const counts = new Map<string, number>();
  workouts.forEach((w) =>
    w.exercises.forEach((e) => {
      const count = e.sets.filter((set) => set.reps >= 1).length;
      if (count) counts.set(e.category, (counts.get(e.category) ?? 0) + count);
    }),
  );
  const slices = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const total = slices.reduce((sum, [, count]) => sum + count, 0),
    radius = 52,
    circumference = 2 * Math.PI * radius;
  let offset = 0;
  if (!total)
    return (
      <Empty
        icon="pie-chart-outline"
        title="No completed sets"
        copy="No data exists for this period."
      />
    );
  return (
    <View style={fs.ringLayout}>
      <Svg width={130} height={130} viewBox="0 0 130 130">
        <Circle cx="65" cy="65" r={radius} fill="none" stroke={C.line} strokeWidth="16" />
        {slices.map(([name, count]) => {
          const length = (count / total) * circumference;
          const element = (
            <Circle
              key={name}
              cx="65"
              cy="65"
              r={radius}
              fill="none"
              stroke={colorForCategory(name, data.customCategories)}
              strokeWidth="16"
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-offset}
              rotation="-90"
              origin="65,65"
            />
          );
          offset += length;
          return element;
        })}
        <SvgText x="65" y="62" textAnchor="middle" fill={C.text} fontSize="22" fontWeight="800">
          {total}
        </SvgText>
        <SvgText x="65" y="80" textAnchor="middle" fill={C.muted} fontSize="10">
          SETS
        </SvgText>
      </Svg>
      <View style={fs.ringLegend}>
        {slices.map(([name, count]) => (
          <View key={name} style={fs.legendRow}>
            <View
              style={[
                s.categorySwatch,
                { backgroundColor: colorForCategory(name, data.customCategories) },
              ]}
            />
            <Text style={[s.rowSub, { flex: 1, marginTop: 0 }]}>{name}</Text>
            <Text style={fs.legendValue}>{Math.round((count / total) * 100)}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
function WorkoutHeatmap({ workouts, startDate }: { workouts: Workout[]; startDate: string }) {
  const end = today();
  const start = new Date(`${startDate}T00:00:00`);
  const startOffset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - startOffset);
  const days = Math.max(
    1,
    Math.floor((new Date(`${end}T00:00:00`).getTime() - start.getTime()) / 86400000) + 1,
  );
  const weeks = Math.ceil(days / 7);
  const counts = new Map<string, number>();
  workouts.forEach((w) => counts.set(w.date, (counts.get(w.date) ?? 0) + 1));
  const cell = 13,
    gap = 3,
    width = weeks * (cell + gap) + 6,
    height = 7 * (cell + gap) + 6;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator>
      <Svg width={Math.max(width, Dimensions.get('window').width - 50)} height={height}>
        {Array.from({ length: weeks * 7 }, (_, i) => {
          const date = new Date(start);
          date.setDate(start.getDate() + i);
          const key = localDateKey(date);
          const count = key <= end ? (counts.get(key) ?? 0) : 0;
          return (
            <Rect
              key={key}
              x={Math.floor(i / 7) * (cell + gap) + 3}
              y={(i % 7) * (cell + gap) + 3}
              width={cell}
              height={cell}
              rx="3"
              fill={count > 1 ? C.blue : count === 1 ? C.blueDim : C.raised}
            />
          );
        })}
      </Svg>
    </ScrollView>
  );
}
function RangeSelector({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: any) => void;
  options: [string, string][];
}) {
  return (
    <View style={fs.miniSegments}>
      {options.map(([id, label]) => (
        <Pressable
          key={id}
          onPress={() => onChange(id)}
          style={[fs.miniSegment, value === id && fs.miniSegmentActive]}
        >
          <Text style={[fs.miniSegmentText, value === id && { color: C.white }]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}
export function ProgressScreen() {
  const { data } = useStore();
  const completedWorkouts = useMemo(() => data.workouts.filter((w) => !w.draft), [data.workouts]);
  const defaults = ['Barbell Squat', 'Flat Barbell Bench Press', 'Deadlift'];
  const [selectedExercise, setSelectedExercise] = useState(defaults[0]!);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'weight' | 'oneRM'>('weight');
  const [ringRange, setRingRange] = useState<'30d' | '90d' | 'all'>('90d');
  const [heatRange, setHeatRange] = useState<'30d' | '12m' | 'all'>('12m');
  const allNames = [...new Set(data.exercises.map((e) => e.name))];
  const searchResults = query.trim()
    ? allNames
        .filter(
          (name) =>
            !defaults.includes(name) && name.toLowerCase().includes(query.trim().toLowerCase()),
        )
        .slice(0, 20)
    : [];
  const { weightRecords, projectedPoints } = useMemo(
    () => exerciseProgress(completedWorkouts, selectedExercise),
    [completedWorkouts, selectedExercise],
  );
  const chartPoints = mode === 'weight' ? weightRecords : projectedPoints;
  const rangeBests = useMemo(
    () => bestSetsByRepRange(completedWorkouts, selectedExercise),
    [completedWorkouts, selectedExercise],
  );
  const weeklyPoints = useMemo(() => weeklyTotalVolume(completedWorkouts), [completedWorkouts]);
  const firstProjected = projectedPoints[0],
    latestProjected = projectedPoints.at(-1);
  const oneRMChange =
    firstProjected && latestProjected ? latestProjected.value - firstProjected.value : 0;
  const oneRMPercent = firstProjected?.value ? (oneRMChange / firstProjected.value) * 100 : 0;
  const smoothPoints = useMemo(() => rollingAverage(projectedPoints, 5), [projectedPoints]);
  const cutoff = (range: string) => {
    if (range === 'all') return '0000-00-00';
    const date = new Date();
    date.setDate(date.getDate() - (range === '30d' ? 29 : range === '90d' ? 89 : 364));
    return localDateKey(date);
  };
  const ringWorkouts = completedWorkouts.filter((w) => w.date >= cutoff(ringRange));
  const heatStart =
    heatRange === 'all'
      ? (completedWorkouts.map((w) => w.date).sort()[0] ?? today())
      : cutoff(heatRange);
  return (
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Header title="Progress" />
      <Text style={s.label}>CORE LIFTS</Text>
      <View style={fs.coreLiftRow}>
        {defaults.map((name) => (
          <Pressable
            key={name}
            onPress={() => {
              setSelectedExercise(name);
              setQuery('');
            }}
            style={[fs.coreLift, name === selectedExercise && fs.coreLiftActive]}
          >
            <Text style={[fs.coreLiftText, name === selectedExercise && { color: C.white }]}>
              {name === 'Flat Barbell Bench Press' ? 'Bench Press' : name.replace('Barbell ', '')}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={s.search}>
        <Ionicons name="search" size={18} color={C.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search other exercises"
          placeholderTextColor={C.muted}
          style={s.searchInput}
        />
      </View>
      {searchResults.length > 0 && (
        <View style={fs.searchResults}>
          {searchResults.map((name) => (
            <Pressable
              key={name}
              style={fs.searchResult}
              onPress={() => {
                setSelectedExercise(name);
                setQuery('');
              }}
            >
              <Text style={s.rowTitle}>{name}</Text>
              <Ionicons name="chevron-forward" size={17} color={C.muted} />
            </Pressable>
          ))}
        </View>
      )}
      <View style={fs.progressHeading}>
        <View style={{ flex: 1 }}>
          <Text style={s.overline}>SELECTED EXERCISE</Text>
          <Text style={s.cardTitle}>{selectedExercise}</Text>
        </View>
      </View>
      <View style={s.segmented}>
        <Pressable
          onPress={() => setMode('weight')}
          style={[s.segment, mode === 'weight' && s.segmentActive]}
        >
          <Text style={[s.segmentText, mode === 'weight' && s.segmentTextActive]}>
            Maximum weight
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setMode('oneRM')}
          style={[s.segment, mode === 'oneRM' && s.segmentActive]}
        >
          <Text style={[s.segmentText, mode === 'oneRM' && s.segmentTextActive]}>
            Projected 1RM
          </Text>
        </Pressable>
      </View>
      <Text style={fs.chartCaption}>
        {mode === 'weight'
          ? 'Personal records only'
          : 'All valid workouts · Strength Level percentages'}
      </Text>
      <ProgressLineChart points={chartPoints} mode={mode} />
      {mode === 'weight' && weightRecords.length > 0 && (
        <View style={s.card}>
          <Text style={s.cardTitle}>Records</Text>
          {weightRecords
            .slice()
            .reverse()
            .slice(0, 8)
            .map((point, i) => (
              <View style={fs.record} key={`${point.date}-${i}`}>
                <Text style={s.setNo}>#{i + 1}</Text>
                <Text style={[s.rowTitle, { flex: 1 }]}>{fmt(point.value)} kg</Text>
                <Text style={s.rowSub}>
                  {point.reps} rep{point.reps === 1 ? '' : 's'} · {prettyDate(point.date)}
                </Text>
              </View>
            ))}
        </View>
      )}
      <View style={fs.statSection}>
        <Text style={s.cardTitle}>Best sets by rep range</Text>
        <View style={fs.bestSetGrid}>
          {rangeBests.map(({ label, set }) => (
            <View style={fs.bestSetCard} key={label}>
              <Text style={s.overline}>{label} REPS</Text>
              <Text style={fs.bestSetValue}>{set ? `${fmt(set.weight)} kg` : '—'}</Text>
              {set && (
                <Text style={s.rowSub}>
                  {set.reps} rep{set.reps === 1 ? '' : 's'}
                </Text>
              )}
            </View>
          ))}
        </View>
      </View>
      <SimpleLineChart points={weeklyPoints} title="Weekly total volume" suffix="tonnes" />
      {firstProjected && latestProjected && (
        <View style={fs.statSection}>
          <Text style={s.cardTitle}>Projected 1RM improvement</Text>
          <View style={fs.improvementRow}>
            <View>
              <Text style={s.overline}>SINCE FIRST WORKOUT</Text>
              <Text style={[fs.heroValue, { fontSize: 34 }]}>
                {oneRMChange >= 0 ? '+' : ''}
                {fmt(oneRMChange)} <Text style={fs.heroUnit}>KG</Text>
              </Text>
            </View>
            <Text style={[fs.improvementPercent, { color: oneRMChange >= 0 ? C.green : C.red }]}>
              {oneRMPercent >= 0 ? '+' : ''}
              {oneRMPercent.toFixed(1)}%
            </Text>
          </View>
          <Text style={s.rowSub}>
            {fmt(firstProjected.value)} kg → {fmt(latestProjected.value)} kg
          </Text>
        </View>
      )}
      <SimpleLineChart points={smoothPoints} title="Smoothed strength trend · 5 workouts" />
      <View style={fs.statSection}>
        <View style={fs.statTitleRow}>
          <Text style={s.cardTitle}>Muscle-group distribution</Text>
          <Text style={s.rowSub}>Completed sets</Text>
        </View>
        <RangeSelector
          value={ringRange}
          onChange={setRingRange}
          options={[
            ['30d', '30 days'],
            ['90d', '90 days'],
            ['all', 'All time'],
          ]}
        />
        <DistributionRing workouts={ringWorkouts} />
      </View>
      <View style={fs.statSection}>
        <Text style={s.cardTitle}>Workout frequency</Text>
        <RangeSelector
          value={heatRange}
          onChange={setHeatRange}
          options={[
            ['30d', '30 days'],
            ['12m', '12 months'],
            ['all', 'All time'],
          ]}
        />
        <WorkoutHeatmap workouts={completedWorkouts} startDate={heatStart} />
        <View style={fs.heatLegend}>
          <Text style={s.rowSub}>Less</Text>
          <View style={[fs.heatCell, { backgroundColor: C.raised }]} />
          <View style={[fs.heatCell, { backgroundColor: C.blueDim }]} />
          <View style={[fs.heatCell, { backgroundColor: C.blue }]} />
          <Text style={s.rowSub}>More</Text>
        </View>
      </View>
    </ScrollView>
  );
}
