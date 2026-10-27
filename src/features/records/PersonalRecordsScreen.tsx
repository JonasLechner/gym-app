import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { CORE_LIFTS, type CoreLiftId } from '../../coreLifts';
import { prettyDate, useStore } from '../../store';
import { s } from '../../styles';
import { C } from '../../theme';
import { Empty, Header } from '../../ui';
import { bigThreeTotal, personalRecords, type RecordAchievement } from './personalRecords';
import { fs } from './styles';

const weightText = (weight: number) => String(Number(weight.toFixed(6)));

export function PersonalRecordsScreen({ onBack }: { onBack: () => void }) {
  const { data } = useStore();
  const [selectedId, setSelectedId] = useState<CoreLiftId>('squat');
  const [view, setView] = useState<'reps' | 'timeline'>('reps');
  const lifts = useMemo(
    () =>
      CORE_LIFTS.map((lift) => ({ ...lift, ...personalRecords(data.workouts, lift.exerciseName) })),
    [data.workouts],
  );
  const total = bigThreeTotal(lifts);
  const selected = lifts.find((lift) => lift.id === selectedId)!;
  const rows = view === 'reps' ? selected.repRecords : selected.timeline;

  const renderRecord = ({ item }: { item: RecordAchievement }) => {
    if (view === 'reps') {
      return (
        <View style={fs.repRow}>
          <Text style={fs.repWeight}>
            {weightText(item.weight)} <Text style={fs.unit}>kg</Text>
          </Text>
          <View style={fs.repBadge}>
            <Text style={fs.repCount}>{item.reps}</Text>
          </View>
          <Text style={fs.repDate}>{prettyDate(item.date)}</Text>
        </View>
      );
    }
    const label = item.record.weight
      ? item.record.reps
        ? 'Weight + rep record'
        : 'Weight record'
      : 'Rep record at this weight';
    return (
      <View style={fs.timelineRow}>
        <View style={[fs.recordIcon, item.record.weight && fs.weightRecordIcon]}>
          <Ionicons name="trophy" size={18} color={item.record.weight ? C.amber : C.blue} />
        </View>
        <View style={s.flex}>
          <Text style={fs.recordKind}>{label}</Text>
          <Text style={fs.recordSet}>
            {weightText(item.weight)} kg <Text style={fs.times}>×</Text> {item.reps} reps
          </Text>
          <Text style={fs.recordDate}>{prettyDate(item.date)}</Text>
        </View>
      </View>
    );
  };

  return (
    <FlatList
      style={s.flex}
      contentContainerStyle={s.content}
      data={rows}
      extraData={view}
      keyExtractor={(item) => `${selectedId}:${view}:${item.key}`}
      renderItem={renderRecord}
      ListHeaderComponent={
        <View>
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Back to More"
            style={({ pressed }) => [fs.back, pressed && { opacity: 0.55 }]}
          >
            <Ionicons name="chevron-back" size={20} color={C.blue} />
            <Text style={s.link}>More</Text>
          </Pressable>
          <Header title="Personal records" />
          <View style={fs.intro}>
            <Ionicons name="trophy" size={15} color={C.amber} />
            <Text style={fs.introLabel}>THE BIG THREE</Text>
            <Text style={fs.completedOnly}>Completed workouts only</Text>
          </View>
          <View style={fs.liftCards}>
            {lifts.map((lift) => {
              const active = lift.id === selectedId;
              return (
                <Pressable
                  key={lift.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Show ${lift.label} records`}
                  accessibilityState={{ selected: active }}
                  onPress={() => setSelectedId(lift.id)}
                  style={({ pressed }) => [
                    fs.liftCard,
                    active && fs.liftCardActive,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={[fs.liftLabel, active && fs.liftLabelActive]}>{lift.label}</Text>
                  <Text
                    style={fs.liftWeight}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.5}
                  >
                    {lift.heaviest ? weightText(lift.heaviest.weight) : '—'}
                  </Text>
                  <Text style={fs.liftUnit}>KG · HEAVIEST</Text>
                  <Text style={fs.liftReps}>
                    {lift.heaviest ? `${lift.heaviest.reps} reps` : 'No sets yet'}
                  </Text>
                  <Text style={fs.liftDate}>
                    {lift.heaviest ? prettyDate(lift.heaviest.date) : '—'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={fs.totalCard}>
            <View style={fs.totalRow}>
              <View style={fs.totalLabelRow}>
                <Ionicons name="trophy" size={18} color={C.amber} />
                <Text style={fs.totalLabel}>SBD TOTAL</Text>
              </View>
              <Text style={fs.totalWeight} numberOfLines={1} adjustsFontSizeToFit>
                {total === null ? '—' : weightText(total)} <Text style={fs.unit}>kg</Text>
              </Text>
            </View>
            <Text style={fs.totalHint}>
              {total === null
                ? 'Log a completed Squat, Bench, and Deadlift to see your total.'
                : 'All-time heaviest sets, not a same-day competition total.'}
            </Text>
          </View>
          <View style={fs.selectedHeading}>
            <Text style={fs.selectedTitle}>{selected.exerciseName}</Text>
            <Text style={fs.selectedMeta}>
              {selected.sessions} {selected.sessions === 1 ? 'workout' : 'workouts'} ·{' '}
              {selected.sets} {selected.sets === 1 ? 'set' : 'sets'}
            </Text>
            <Text style={fs.variantHint}>Exact exercise only · variants are kept separate</Text>
          </View>
          <View style={s.segmented}>
            {(['reps', 'timeline'] as const).map((mode) => (
              <Pressable
                key={mode}
                accessibilityRole="button"
                accessibilityState={{ selected: view === mode }}
                onPress={() => setView(mode)}
                style={[s.segment, view === mode && s.segmentActive]}
              >
                <Text style={[s.segmentText, view === mode && s.segmentTextActive]}>
                  {mode === 'reps' ? 'Rep records' : 'Record history'}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={fs.explanation}>
            {view === 'reps'
              ? 'Your most reps at each exact weight, with the first date you achieved that result.'
              : 'Every weight or rep improvement, newest first. First sets count; ties do not.'}
          </Text>
          {view === 'reps' && rows.length > 0 && (
            <View style={fs.repHeader}>
              <Text style={[fs.columnLabel, s.flex]}>WEIGHT</Text>
              <Text style={[fs.columnLabel, fs.repsColumn]}>BEST REPS</Text>
              <Text style={[fs.columnLabel, fs.dateColumn]}>ACHIEVED</Text>
            </View>
          )}
        </View>
      }
      ListEmptyComponent={
        <Empty
          icon="trophy-outline"
          title={`No ${selected.label.toLowerCase()} records yet`}
          copy={`Finish a workout with ${selected.exerciseName} and at least one rep to start your record book.`}
        />
      }
    />
  );
}
