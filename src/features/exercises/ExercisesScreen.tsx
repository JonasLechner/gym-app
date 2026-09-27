import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { colorForCategory } from '../../categories';
import { useStore } from '../../store';
import { s } from '../../styles';
import { fs } from './styles';
import { C } from '../../theme';
import { confirmAction, Empty, Header } from '../../ui';
import { ExercisePicker } from '../workout/components';
import type { ExerciseDefinition } from '../../types';
import { ExerciseHistoryScreen } from './ExerciseHistoryScreen';

export function ExercisesScreen() {
  const { data, deleteExercise } = useStore();
  const [query, setQuery] = useState('');
  const [picker, setPicker] = useState(false);
  const [category, setCategory] = useState('All');
  const [selectedExercise, setSelectedExercise] = useState<ExerciseDefinition | null>(null);
  const categories = [...new Set(data.exercises.map((e) => e.category))].sort();
  const activeCategory = category === 'All' || categories.includes(category) ? category : 'All';
  const list = data.exercises.filter(
    (e) =>
      (activeCategory === 'All' || e.category === activeCategory) &&
      `${e.name}${e.category}`.toLowerCase().includes(query.toLowerCase()),
  );
  if (selectedExercise) {
    return (
      <ExerciseHistoryScreen exercise={selectedExercise} onBack={() => setSelectedExercise(null)} />
    );
  }

  return (
    <View style={s.flex}>
      <View style={[s.content, s.flex]}>
        <Header
          title="Exercises"
          action={
            <Pressable onPress={() => setPicker(true)}>
              <Ionicons name="add-circle" size={28} color={C.blue} />
            </Pressable>
          }
        />
        <View style={s.search}>
          <Ionicons name="search" size={18} color={C.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search"
            placeholderTextColor={C.muted}
            style={s.searchInput}
          />
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={fs.exerciseFilters}
          contentContainerStyle={s.filterRow}
        >
          <Pressable
            onPress={() => setCategory('All')}
            style={[s.filterChip, activeCategory === 'All' && s.filterChipActive]}
          >
            <Text style={[s.filterChipText, activeCategory === 'All' && s.filterChipTextActive]}>
              All
            </Text>
          </Pressable>
          {categories.map((name) => (
            <Pressable
              key={name}
              onPress={() => setCategory(name)}
              style={[s.filterChip, activeCategory === name && s.filterChipActive]}
            >
              <View
                style={[
                  s.categorySwatch,
                  { backgroundColor: colorForCategory(name, data.customCategories) },
                ]}
              />
              <Text style={[s.filterChipText, activeCategory === name && s.filterChipTextActive]}>
                {name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <FlatList
          style={s.flex}
          data={list}
          keyExtractor={(e) => e.id}
          contentContainerStyle={{ paddingBottom: 180 }}
          ListEmptyComponent={
            <Empty
              icon="barbell-outline"
              title="No exercises"
              copy="Import a CSV or create an exercise."
            />
          }
          renderItem={({ item }) => (
            <View style={s.row}>
              <Pressable
                onPress={() => setSelectedExercise(item)}
                accessibilityRole="button"
                accessibilityLabel={`View history for ${item.name}`}
                style={fs.exerciseRowButton}
              >
                <View
                  style={[
                    s.exerciseIcon,
                    { backgroundColor: colorForCategory(item.category, data.customCategories) },
                  ]}
                >
                  <Ionicons name="barbell" size={18} color={C.white} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowTitle}>{item.name}</Text>
                  <Text style={s.rowSub}>{item.category}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={C.muted} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Delete ${item.name}`}
                hitSlop={8}
                onPress={() =>
                  confirmAction('Delete exercise?', item.name, () => deleteExercise(item.id))
                }
              >
                <Ionicons name="trash-outline" size={19} color={C.muted} />
              </Pressable>
            </View>
          )}
        />
      </View>
      <ExercisePicker visible={picker} onClose={() => setPicker(false)} onPick={() => {}} />
    </View>
  );
}
