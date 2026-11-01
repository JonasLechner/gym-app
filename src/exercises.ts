import { canonicalExercise } from './categories';
import type { AppData, ExerciseDefinition, ExerciseEntry, Workout } from './types';

export const exerciseNameKey = (name: string) => name.trim().toLowerCase();
export type ExerciseLookup = Map<string, ExerciseDefinition>;
export type ExerciseChanges = Pick<ExerciseDefinition, 'name' | 'category'>;

/** Old names remain attached to one definition, never pooled with other variants. */
export function exerciseLookup(definitions: ExerciseDefinition[]): ExerciseLookup {
  const lookup = new Map(definitions.map((exercise) => [exerciseNameKey(exercise.name), exercise]));
  for (const exercise of definitions) {
    for (const alias of exercise.aliases ?? []) {
      const key = exerciseNameKey(alias);
      if (!lookup.has(key)) lookup.set(key, exercise);
    }
  }
  return lookup;
}

/** Explicit edits take precedence over legacy FitNotes name/category corrections. */
export function exerciseFields(
  name: string,
  category: string,
  lookup: ExerciseLookup,
): ExerciseChanges {
  const direct = lookup.get(exerciseNameKey(name));
  if (direct?.customized) return { name: direct.name, category: direct.category };
  const fixed = canonicalExercise(name, category);
  const canonical = lookup.get(exerciseNameKey(fixed.name));
  return canonical?.customized ? { name: canonical.name, category: canonical.category } : fixed;
}

/** Reconcile an old autosave against the latest definitions without touching any sets. */
export function reconcileWorkoutExercises(workout: Workout, lookup: ExerciseLookup): Workout {
  let changed = false;
  const exercises = workout.exercises.map((entry): ExerciseEntry => {
    let definition = lookup.get(exerciseNameKey(entry.name));
    if (!definition?.customized)
      definition = lookup.get(exerciseNameKey(canonicalExercise(entry.name, entry.category).name));
    if (
      !definition?.customized ||
      (entry.name === definition.name && entry.category === definition.category)
    )
      return entry;
    changed = true;
    return { ...entry, name: definition.name, category: definition.category };
  });
  return changed ? { ...workout, exercises } : workout;
}

/** Rename/reclassify all occurrences, preserving definition, workout, entry and set identities. */
export function withEditedExercise(data: AppData, id: string, changes: ExerciseChanges): AppData {
  const original = data.exercises.find((exercise) => exercise.id === id);
  if (!original)
    throw new Error('This exercise no longer exists. Reload the app before editing it again.');
  const name = changes.name.trim();
  const category = changes.category.trim();
  if (!name) throw new Error('Enter an exercise name.');
  if (!category) throw new Error('Choose a muscle group.');
  const key = exerciseNameKey(name);
  if (
    data.exercises.some(
      (exercise) =>
        exercise.id !== id &&
        [exercise.name, ...(exercise.aliases ?? [])].some(
          (value) => exerciseNameKey(value) === key,
        ),
    )
  )
    throw new Error(
      'An exercise already uses this name or used it before. Choose a different name.',
    );

  const oldNames = new Set([original.name, ...(original.aliases ?? [])].map(exerciseNameKey));
  if (
    data.workouts.some((workout) =>
      workout.exercises.some(
        (entry) =>
          exerciseNameKey(entry.name) === key && !oldNames.has(exerciseNameKey(entry.name)),
      ),
    )
  )
    throw new Error('Another exercise in your workouts uses this name. Choose a different name.');
  if (name === original.name && category === original.category) return data;

  const aliases = new Map<string, string>();
  for (const previous of [...(original.aliases ?? []), original.name]) {
    const previousKey = exerciseNameKey(previous);
    if (previousKey !== key) aliases.set(previousKey, previous.trim());
  }
  const { aliases: _previousAliases, ...definition } = original;
  const edited: ExerciseDefinition = {
    ...definition,
    name,
    category,
    customized: true,
    ...(aliases.size ? { aliases: [...aliases.values()] } : {}),
  };
  const exercises = data.exercises
    .map((exercise) => (exercise.id === id ? edited : exercise))
    .sort((a, b) => a.name.localeCompare(b.name));
  const lookup = exerciseLookup([edited]);
  return {
    ...data,
    exercises,
    workouts: data.workouts.map((workout) => reconcileWorkoutExercises(workout, lookup)),
  };
}
