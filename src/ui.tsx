import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { s } from './styles';
import { C } from './theme';

export const fmt=(value:number)=>Number.isInteger(value)?String(value):value.toFixed(1);

export function WeightInput({value,onChange,style}:{value:number;onChange:(value:number)=>void;style?:any}){
  const [text,setText]=useState(fmt(value));
  const [focused,setFocused]=useState(false);
  useEffect(()=>{if(!focused)setText(fmt(value))},[value,focused]);
  const update=(next:string)=>{setText(next);if(!/[.,]$/.test(next)){const parsed=Number(next.replace(',','.'));if(Number.isFinite(parsed))onChange(parsed)}};
  const finish=()=>{setFocused(false);const parsed=Number(text.replace(',','.'));if(Number.isFinite(parsed)){onChange(parsed);setText(fmt(parsed))}else setText(fmt(value))};
  return <TextInput keyboardType="decimal-pad" selectTextOnFocus value={text} onFocus={()=>setFocused(true)} onChangeText={update} onBlur={finish} style={style}/>;
}

export function Button({label,onPress,kind='primary',icon,disabled=false}:{label:string;onPress:()=>void;kind?:'primary'|'ghost'|'danger';icon?:keyof typeof Ionicons.glyphMap;disabled?:boolean}){
  return <Pressable disabled={disabled} onPress={onPress} style={({pressed})=>[s.button,kind==='ghost'&&s.buttonGhost,kind==='danger'&&s.buttonDanger,(pressed||disabled)&&{opacity:.55}]}>{icon&&<Ionicons name={icon} size={18} color={kind==='ghost'?C.blue:C.white}/>}<Text style={[s.buttonText,kind==='ghost'&&{color:C.blue}]}>{label}</Text></Pressable>;
}

export function confirmAction(title:string,message:string,onConfirm:()=>void){
  if(Platform.OS==='web'){if((globalThis as any).confirm(`${title}\n\n${message}`))onConfirm();return}
  Alert.alert(title,message,[{text:'Cancel',style:'cancel'},{text:'Delete',style:'destructive',onPress:onConfirm}]);
}

export function Header({title,action}:{title:string;action?:React.ReactNode}){return <View style={s.header}><View><Text style={s.brand}>LIFTNOTES</Text><Text style={s.title}>{title}</Text></View>{action}</View>}
export function Empty({icon,title,copy}:{icon:keyof typeof Ionicons.glyphMap;title:string;copy:string}){return <View style={s.empty}><Ionicons name={icon} size={38} color={C.blue}/><Text style={s.emptyTitle}>{title}</Text><Text style={s.emptyCopy}>{copy}</Text></View>}
