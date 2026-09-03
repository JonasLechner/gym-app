import { StyleSheet } from 'react-native';
import { C, radius } from '../../theme';

export const fs=StyleSheet.create({
  draggingCard:{opacity:.75,borderColor:C.blue,backgroundColor:C.raised},
  dragHistoryRow:{flexDirection:'row',alignItems:'center',gap:8},
  historyFilters:{gap:7,paddingBottom:16},
  noteInput:{minHeight:76,paddingTop:12,textAlignVertical:'top'},
  editSetBlock:{paddingVertical:6,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:C.line},
  commentInput:{height:40,marginLeft:40,marginTop:3,paddingHorizontal:9,borderRadius:7,backgroundColor:C.raised,color:C.text,fontSize:16},
  detail:{marginTop:14,borderTopColor:C.line,borderTopWidth:1,paddingTop:8},
  historyExercise:{paddingVertical:8},
  metricRow:{flexDirection:'row',gap:10,marginBottom:12},
  metric:{flex:1,backgroundColor:C.panel,borderRadius:radius.md,padding:15},
  metricValue:{fontSize:24,fontWeight:'900',color:C.text,marginBottom:4},
  dayToday:{borderWidth:1,borderColor:C.blue},
  noWorkout:{alignItems:'center',gap:4,paddingVertical:30}
});
