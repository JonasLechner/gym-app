import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, SafeAreaView, Text, View } from 'react-native';
import { C } from './src/theme';
import { s } from './src/styles';
import { StoreProvider, useStore } from './src/store';
import { ExercisesScreen } from './src/features/exercises/ExercisesScreen';
import { HistoryScreen } from './src/features/history/HistoryScreen';
import { MoreScreen } from './src/features/more/MoreScreen';
import { ProgressScreen } from './src/features/progress/ProgressScreen';
import { WorkoutScreen } from './src/features/workout/WorkoutScreen';

type Tab = 'Workout'|'History'|'Exercises'|'Progress'|'More';
const tabIcons: Record<Tab, keyof typeof Ionicons.glyphMap> = { Workout:'barbell', History:'calendar', Exercises:'list', Progress:'stats-chart', More:'ellipsis-horizontal' };
function Shell(){const {ready}=useStore();const [tab,setTab]=useState<Tab>('Workout');if(!ready)return <View style={[s.screen,s.center]}><Text style={s.loading}>LIFTNOTES</Text></View>;return <SafeAreaView style={s.screen}><KeyboardAvoidingView style={s.flex} behavior={Platform.OS==='ios'?'padding':undefined}>{tab==='Workout'&&<WorkoutScreen onSaved={()=>setTab('History')}/>}{tab==='History'&&<HistoryScreen/>}{tab==='Exercises'&&<ExercisesScreen/>}{tab==='Progress'&&<ProgressScreen/>}{tab==='More'&&<MoreScreen/>}</KeyboardAvoidingView><View style={s.tabs}>{(Object.keys(tabIcons) as Tab[]).map(t=><Pressable key={t} style={s.tab} onPress={()=>setTab(t)}><Ionicons name={tabIcons[t]} size={22} color={tab===t?C.blue:C.muted}/><Text style={[s.tabLabel,tab===t&&{color:C.blue}]}>{t}</Text></Pressable>)}</View></SafeAreaView>}
export default function App(){return <GestureHandlerRootView style={s.flex}><StoreProvider><StatusBar style="light"/><Shell/></StoreProvider></GestureHandlerRootView>}
