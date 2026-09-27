import type { ExerciseEntry, Workout } from '../../types';

export function completedCopySources(workouts:Workout[],targetDate:string):Workout[] {
 return workouts.filter(w=>!w.draft&&w.date<targetDate);
}

export function previousCompletedWorkout(workouts:Workout[],name:string,date:string):Workout|undefined {
 return workouts.filter(w=>!w.draft&&w.date<date&&w.exercises.some(e=>e.name===name)).sort((a,b)=>b.date.localeCompare(a.date))[0];
}

export function removesLastSetFromCompletedWorkout(existing:Workout|undefined,current:ExerciseEntry[],next:ExerciseEntry[]):boolean {
 return !!existing&&!existing.draft&&current.some(e=>e.sets.length>0)&&!next.some(e=>e.sets.length>0);
}
