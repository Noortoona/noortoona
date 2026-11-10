import React,{useState} from 'react';
import {Platform,Pressable,Text,View} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import {useI18n} from './i18n';
import {theme} from './theme';

export function DateTimeField({label,value,mode,onChange}:{label:string;value:string;mode:'date'|'time';onChange:(v:string)=>void}){
 const {isRTL}=useI18n(),[open,setOpen]=useState(false);
 const date=mode==='date'?new Date((value||new Date().toISOString().slice(0,10))+'T12:00:00'):new Date('2000-01-01T'+(value||'20:00')+':00');
 return <View style={{gap:8}}><Text style={{textAlign:isRTL?'right':'left',color:theme.colors.ink}}>{label}</Text><Pressable accessibilityRole="button" accessibilityLabel={label} onPress={()=>setOpen(!open)} style={{borderWidth:1,borderColor:theme.colors.line,padding:14,borderRadius:14}}><Text style={{color:theme.colors.ink,textAlign:isRTL?'right':'left'}}>{value||(isRTL?'اختر':'Select')}</Text></Pressable>{open?<DateTimePicker value={Number.isNaN(date.getTime())?new Date():date} mode={mode} display={Platform.OS==='ios'?'spinner':'default'} is24Hour locale={isRTL?'ar-SA':'en-GB'} onChange={(e,d)=>{if(Platform.OS!=='ios')setOpen(false);if(e.type==='set'&&d)onChange(mode==='date'?`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`:`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`);}}/>:null}</View>;
}
