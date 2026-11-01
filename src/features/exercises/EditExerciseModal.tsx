import { Ionicons } from '@expo/vector-icons';
import React, { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BUILT_IN_CATEGORIES, colorForCategory } from '../../categories';
import type { ExerciseChanges } from '../../exercises';
import { useStore } from '../../store';
import { s } from '../../styles';
import { C } from '../../theme';
import type { ExerciseDefinition } from '../../types';
import { Button } from '../../ui';
import { fs } from './styles';

export function EditExerciseModal({
  exercise,
  onClose,
  onSaved,
}: {
  exercise: ExerciseDefinition;
  onClose: () => void;
  onSaved: (changes: ExerciseChanges) => void;
}) {
  const { data, updateExercise } = useStore();
  const [name, setName] = useState(exercise.name);
  const [category, setCategory] = useState(exercise.category);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const categories = [
    ...new Set([
      ...BUILT_IN_CATEGORIES.map((item) => item.name),
      ...data.customCategories.map((item) => item.name),
      ...data.exercises.map((item) => item.category),
      exercise.category,
    ]),
  ];
  const changed = name.trim() !== exercise.name || category !== exercise.category;
  const close = () => {
    if (!saving.current) onClose();
  };
  const save = async () => {
    if (saving.current || !changed) return;
    saving.current = true;
    setBusy(true);
    setError('');
    const changes = { name: name.trim(), category };
    try {
      await updateExercise(exercise, changes);
      onSaved(changes);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Could not save this exercise. Please try again.',
      );
      saving.current = false;
      setBusy(false);
    }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <SafeAreaView style={s.screen}>
        <View style={s.modalHead}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPress={close}
            style={fs.editorCancel}
          >
            <Text style={[s.link, busy && { opacity: 0.55 }]}>Cancel</Text>
          </Pressable>
          <Text style={s.modalTitle}>Edit exercise</Text>
          <View style={fs.editorCancel} />
        </View>
        <KeyboardAvoidingView
          style={s.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
            <View style={fs.editNotice}>
              <Ionicons name="information-circle-outline" size={21} color={C.blue} />
              <View style={s.flex}>
                <Text style={fs.editNoticeTitle}>One exercise, all your history</Text>
                <Text style={fs.editNoticeCopy}>
                  Changes apply to past workouts and drafts. Your sets, comments and dates stay
                  unchanged.
                </Text>
              </View>
            </View>
            <Text style={s.label}>EXERCISE NAME</Text>
            <TextInput
              accessibilityLabel="Exercise name"
              value={name}
              editable={!busy}
              onChangeText={(value) => {
                setName(value);
                setError('');
              }}
              style={s.input}
              placeholder="Exercise name"
              placeholderTextColor={C.muted}
              autoCorrect={false}
              autoCapitalize="words"
              returnKeyType="done"
            />
            <Text style={[s.label, fs.editGroupLabel]}>MUSCLE GROUP</Text>
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel="Muscle group"
              style={fs.editCategoryChoices}
            >
              {categories.map((item) => (
                <Pressable
                  key={item}
                  accessibilityRole="radio"
                  accessibilityLabel={item}
                  accessibilityState={{ checked: category === item, disabled: busy }}
                  aria-checked={category === item}
                  disabled={busy}
                  onPress={() => {
                    setCategory(item);
                    setError('');
                  }}
                  style={[fs.editCategoryChoice, category === item && fs.editCategoryActive]}
                >
                  <View
                    style={[
                      s.categorySwatch,
                      { backgroundColor: colorForCategory(item, data.customCategories) },
                    ]}
                  />
                  <Text style={[fs.editCategoryText, category === item && { color: C.white }]}>
                    {item}
                  </Text>
                </Pressable>
              ))}
            </View>
            {!!error && (
              <Text accessibilityRole="alert" style={fs.editError}>
                {error}
              </Text>
            )}
            <Button
              label={busy ? 'Saving…' : 'Save changes'}
              icon="checkmark"
              disabled={busy || !changed}
              onPress={() => void save()}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
