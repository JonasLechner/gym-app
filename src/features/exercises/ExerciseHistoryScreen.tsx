import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { projectedOneRepMax } from '../../progress';
import { prettyDate, useStore } from '../../store';
import { s } from '../../styles';
import { C } from '../../theme';
import type { ExerciseDefinition } from '../../types';
import { Empty, fmt } from '../../ui';
import { exerciseHistory, type ExerciseHistoryDay } from './exerciseHistory';
import { fs } from './styles';

export function ExerciseHistoryScreen({
  exercise,
  onBack,
}: {
  exercise: ExerciseDefinition;
  onBack: () => void;
}) {
  const { data } = useStore();
  const days = useMemo(
    () => exerciseHistory(data.workouts, exercise.name),
    [data.workouts, exercise.name],
  );
  const totalSets = days.reduce((total, day) => total + day.sets.length, 0);

  const renderDay = ({ item: day }: { item: ExerciseHistoryDay }) => (
    <View style={s.card}>
      <View style={fs.historyDayHeader}>
        <Text style={fs.historyDate}>{prettyDate(day.date)}</Text>
        <Text style={fs.historySetCount}>
          {day.sets.length} {day.sets.length === 1 ? 'SET' : 'SETS'}
        </Text>
      </View>
      <View style={fs.historyColumnHeader}>
        <Text style={fs.historySetNumber}>SET</Text>
        <Text style={fs.historyWeightColumn}>WEIGHT × REPS</Text>
        <Text style={fs.historyOneRmColumn}>EST. 1RM</Text>
      </View>
      {day.sets.map(({ key, set, draft }, index) => {
        const oneRm = projectedOneRepMax(set.weight, set.reps);
        return (
          <View key={key} style={fs.historySet}>
            <View style={fs.historySetValues}>
              <Text style={fs.historySetNumber}>{index + 1}</Text>
              <Text style={fs.historyWeight}>
                {fmt(set.weight)} kg <Text style={fs.historyTimes}>×</Text> {set.reps}
              </Text>
              <Text style={fs.historyOneRm}>
                {oneRm === null ? '—' : `${fmt(Math.round(oneRm * 10) / 10)} kg`}
              </Text>
            </View>
            {(draft || set.comment) && (
              <View style={fs.historySetDetails}>
                {draft && <Text style={fs.historyDraft}>DRAFT</Text>}
                {!!set.comment && <Text style={fs.historyComment}>{set.comment}</Text>}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );

  return (
    <FlatList
      style={s.flex}
      data={days}
      keyExtractor={(day) => day.date}
      renderItem={renderDay}
      contentContainerStyle={s.content}
      ListHeaderComponent={
        <View>
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Back to exercises"
            style={fs.historyBack}
          >
            <Ionicons name="chevron-back" size={20} color={C.blue} />
            <Text style={s.link}>Exercises</Text>
          </Pressable>
          <Text style={s.overline}>{exercise.category.toUpperCase()} / EXERCISE HISTORY</Text>
          <Text style={fs.historyTitle}>{exercise.name}</Text>
          <Text style={fs.historySummary}>
            {days.length} {days.length === 1 ? 'day' : 'days'} · {totalSets}{' '}
            {totalSets === 1 ? 'set' : 'sets'}
          </Text>
          <Text style={fs.historyHint}>Estimated 1RM is available for sets of 1–30 reps.</Text>
        </View>
      }
      ListEmptyComponent={
        <Empty
          icon="barbell-outline"
          title="No sets yet"
          copy="Logged sets for this exercise will appear here."
        />
      }
    />
  );
}
