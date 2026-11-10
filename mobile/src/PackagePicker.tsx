import React from 'react';
import {Pressable,Text,View} from 'react-native';
import {useI18n} from './i18n';
import {theme} from './theme';
import type {CatalogPackage} from './catalog';
import {money} from './prebooking';
export function PackagePicker({packages,code,count,onSelect}:{packages:CatalogPackage[];code:string;count:number;onSelect:(code:string)=>void}){
 const {isRTL}=useI18n();
 return <View style={{gap:12}}>{packages.map((p,index)=><Pressable key={p.code} accessibilityRole="radio" accessibilityState={{selected:p.code===code}} onPress={()=>onSelect(p.code)} style={{padding:18,gap:8,borderWidth:p.code===code?2:1,borderColor:p.code===code?theme.colors.gold:theme.colors.line,borderRadius:18,backgroundColor:theme.colors.paper}}><Text style={{fontSize:20,fontWeight:'800',color:theme.colors.ink,textAlign:isRTL?'right':'left'}}>{isRTL?p.name:p.nameEn}{p.recommended?(isRTL?' — موصى بها':' — Recommended'):''}</Text><Text style={{color:theme.colors.muted,textAlign:isRTL?'right':'left'}}>{isRTL?p.tagline:p.taglineEn}</Text><Text style={{color:theme.colors.ink,fontSize:22}}>{p.priceTiers?.[count]?money(p.priceTiers[count]):(isRTL?'عرض سعر مخصص':'Custom quote')} • {count} {isRTL?'مدعو':'guests'}</Text>{code===p.code?<View style={{gap:7}}>{packages.slice(0,index+1).flatMap(x=>x.features||[]).map(f=><Text key={f.id} style={{color:theme.colors.ink,textAlign:isRTL?'right':'left',lineHeight:23}}>✓ {isRTL?f.ar:f.en}{f.status==='external'?(isRTL?' — بانتظار التفعيل':' — Awaiting activation'):f.status==='assisted'?(isRTL?' — بمساعدة الفريق':' — Assisted service'):''}</Text>)}<Text style={{color:theme.colors.muted}}>{isRTL?'تنظيم الدخول إضافة مستقلة لكل الباقات.':'Entry organization is a separate add-on for every package.'}</Text></View>:null}</Pressable>)}</View>;
}
