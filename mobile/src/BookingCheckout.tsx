import * as SecureStore from 'expo-secure-store';
import React,{useEffect,useRef,useState} from 'react';
import {Alert,ScrollView,StyleSheet,Switch,Text,TextInput,View} from 'react-native';
import {useRouter} from 'expo-router';
import {api} from './api';
import {useAuth} from './auth';
import {normalizeDigits,normalizeSaudiPhone} from './input';
import {analyticsContext,attribution,bookingRetry,money,openSupport,rememberBooking,track,type Booking,type BookingQuote} from './prebooking';
import {BrandHeader,Card,PrimaryButton,Screen} from './ui';
import {theme} from './theme';
import {useI18n} from './i18n';
import {publicCatalog,type PublicCatalog} from './catalog';
import {PackagePicker} from './PackagePicker';
import {DateTimeField} from './DateTimeField';
type Event={title:string;occasion:string;event_date?:string;event_time?:string;city?:string;location?:string;package_name:string;template:string;design_json?:{supervisorPreference?:string;guestCount?:number}};
export default function BookingCheckout({eventId}:{eventId?:string}){
 const auth=useAuth(),router=useRouter(),{isRTL}=useI18n(),c=(ar:string,en:string)=>isRTL?ar:en;
 const [event,setEvent]=useState<Event|null>(null),[catalog,setCatalog]=useState<PublicCatalog|null>(null);
 const [guests,setGuests]=useState('100'),[packageCode,setPackageCode]=useState('hala_plus');
 const [name,setName]=useState(auth.user?.name||''),[phone,setPhone]=useState(auth.user?.phone||''),[email,setEmail]=useState(auth.user?.email||''),[coupon,setCoupon]=useState('');
 const [supervisor,setSupervisor]=useState(false),[preference,setPreference]=useState(''),[entrances,setEntrances]=useState('1'),[hours,setHours]=useState(''),[start,setStart]=useState(''),[city,setCity]=useState(''),[notes,setNotes]=useState('');
 const [consent,setConsent]=useState(false),[quote,setQuote]=useState<BookingQuote|null>(null),[busy,setBusy]=useState(false),[quoting,setQuoting]=useState(false),[error,setError]=useState(''),[booking,setBooking]=useState<Booking|null>(null),[ready,setReady]=useState(false);
 const lock=useRef(false),version=useRef(0);
 const form={guests,packageCode,name,phone,email,coupon,supervisor,preference,entrances,hours,start,city,notes,consent};
 const selection={eventId,packageCode,guestCount:Number(normalizeDigits(guests)),services:supervisor?['supervisor']:[],supervisorPreference:preference,entryDetails:{entrances:Number(normalizeDigits(entrances)),durationHours:Number(normalizeDigits(hours))||null,startTime:start,city,notes},referralCode:coupon.trim()};
 useEffect(()=>{
  let active=true;
  (async()=>{try{
   const owner=eventId?await SecureStore.getItemAsync(`hala.event.owner.${eventId}`):null;
   const [response,raw,stored,attr]=await Promise.all([api<{event:Event}>(`/api/dashboard?event=${encodeURIComponent(eventId||'')}`,{headers:owner?{'x-noortoona-owner-token':owner}:{}},auth.token),api<unknown>('/api/catalog'),SecureStore.getItemAsync(`hala.checkout.${eventId}`),attribution()]);
   if(!active)return;const cat=publicCatalog(raw);if(!cat)throw Error(c('تعذر تحميل الأسعار','Unable to load prices'));
   setCatalog(cat);setEvent(response.event);setPackageCode(cat.packages.find(p=>p.name===response.event.package_name)?.code||cat.packages[0].code);setGuests(String(response.event.design_json?.guestCount||100));setCity(response.event.city||'');setStart(String(response.event.event_time||'').slice(0,5));setCoupon(attr.referralCode||'');
   if(stored){const d=JSON.parse(stored);setGuests(d.guests||'100');setPackageCode(d.packageCode||'hala_plus');setName(d.name||'');setPhone(d.phone||'');setEmail(d.email||'');setCoupon(d.coupon||'');setSupervisor(Boolean(d.supervisor));setPreference(d.preference||'');setEntrances(d.entrances||'1');setHours(d.hours||'');setStart(d.start||'');setCity(d.city||'');setNotes(d.notes||'');setConsent(Boolean(d.consent));}
   setReady(true);
  }catch(e){if(active)setError(e instanceof Error?e.message:c('تعذر تحميل الحجز','Unable to load booking'));}})();
  return()=>{active=false};
 },[eventId,auth.token]);
 useEffect(()=>{if(ready)void SecureStore.setItemAsync(`hala.checkout.${eventId}`,JSON.stringify(form)).catch(()=>undefined);},[ready,JSON.stringify(form)]);
 const selectionKey=JSON.stringify(selection);
 useEffect(()=>{
  const current=++version.current;setQuote(null);if(!ready)return;
  const timer=setTimeout(()=>{setQuoting(true);setError('');api<{quote:BookingQuote}>('/api/bookings/quote',{method:'POST',body:selectionKey},auth.token).then(d=>{if(current===version.current){setQuote(d.quote);void track('price_viewed','/mobile/customer/payment',{packageCode:d.quote.packageCode});}}).catch(e=>{if(current===version.current)setError(e.message);}).finally(()=>{if(current===version.current)setQuoting(false);});},300);
  return()=>{clearTimeout(timer);version.current++};
 },[selectionKey,ready,auth.token]);
 async function submit(){
  if(lock.current||!quote||!eventId)return;
  const normalized=normalizeSaudiPhone(phone);if(name.trim().length<2||!normalized){setError(c('أدخل الاسم ورقم الجوال الصحيح.','Enter a valid name and mobile number.'));return;}
  if(supervisor&&(!preference||!city.trim()||!start||!Number(normalizeDigits(hours)))){setError(c('أكمل تفاصيل تنظيم الدخول.','Complete the entry organization details.'));return;}
  lock.current=true;setBusy(true);setError('');
  try{const retry=await bookingRetry(auth.user?.id||'guest',eventId);const d=await api<{booking:Booking;accessToken?:string}>('/api/bookings',{method:'POST',body:JSON.stringify({...selection,...retry,ownerToken:await SecureStore.getItemAsync(`hala.event.owner.${eventId}`),expectedTotal:quote.total,contact:{name:name.trim(),phone:normalized,email:email.trim()},attribution:await attribution(),...await analyticsContext(),marketingConsent:consent})},auth.token);setBooking(d.booking);await rememberBooking(d.booking.id,d.accessToken||retry.accessToken).catch(()=>undefined);await SecureStore.deleteItemAsync(`hala.checkout.${eventId}`).catch(()=>undefined);}
  catch(e){setError(e instanceof Error?e.message:c('تعذر الحفظ. أعد المحاولة.','Unable to save. Please retry.'));}finally{lock.current=false;setBusy(false);}
 }
 const align={textAlign:isRTL?'right' as const:'left' as const,writingDirection:isRTL?'rtl' as const:'ltr' as const};
 const input=(label:string,value:string,set:(v:string)=>void,numeric=false)=><View style={{gap:8}}><Text style={[styles.label,align]}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={set} keyboardType={numeric?'number-pad':'default'} style={[styles.input,align]}/></View>;
 if(booking)return <Screen><BrandHeader title={c('تم تسجيل طلب حجزك بنجاح! ✨','Your booking request was saved! ✨')}/><ScrollView contentContainerStyle={styles.body}><Card><Text style={styles.number}>{booking.booking_number}</Text><Text style={[styles.text,align]}>{c('تسجيل الطلب لا يعني إتمام الدفع أو اعتماد الحجز النهائي. سيتواصل معك فريق هلا لاستكمال الإجراءات.','This request is not paid or confirmed. HALA will contact you to complete the process.')}</Text><Text style={styles.heading}>{money(booking.total_amount)}</Text></Card><PrimaryButton label={c('عرض حجزي','View my booking')} onPress={()=>router.replace({pathname:'/customer/bookings' as never,params:{id:booking.id}})}/><PrimaryButton label={c('خدمة العملاء','Customer service')} secondary onPress={()=>void openSupport(booking.booking_number).catch(()=>Alert.alert(c('تعذر فتح واتساب','Unable to open WhatsApp')))}/></ScrollView></Screen>;
 return <Screen><BrandHeader title={c('تأكيد طلب الحجز','Review booking request')} subtitle={c('الأسعار والخدمات من خادم هلا','Prices and services from HALA')}/><ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
 {event?<Card><Text style={[styles.heading,align]}>{event.title}</Text><Text style={[styles.text,align]}>{[event.event_date,event.event_time,event.location].filter(Boolean).join(' • ')}</Text></Card>:null}
 <View style={styles.row}>{[100,250,500].map(n=><PrimaryButton key={n} label={String(n)} secondary onPress={()=>setGuests(String(n))}/>)}</View>
 {input(c('عدد المدعوين','Guest count'),guests,setGuests,true)}
 {catalog?<PackagePicker packages={catalog.packages} code={packageCode} count={Number(normalizeDigits(guests))} onSelect={setPackageCode}/>:null}
 <Text style={[styles.heading,align]}>{c('هل ترغب بإضافة خدمة تنظيم الدخول؟','Would you like to add entry organization?')}</Text>
 <View style={styles.row}><Switch value={supervisor} onValueChange={setSupervisor} accessibilityLabel={c('تنظيم الدخول','Entry organization')}/><Text style={[styles.flexText,align]}>{supervisor?c('نعم، أريد تنظيم الدخول.','Yes, add entry organization.'):c('لا، سأقوم بتنظيم الدخول بنفسي.','No, I will manage entry myself.')}</Text></View>
 {supervisor?<Card><Text style={[styles.heading,align]}>{c('من ترغب أن يستقبل ضيوفك؟','Who should welcome your guests?')}</Text>{[['male','مشرف','Male organizer'],['female','مشرفة','Female organizer'],['both','مشرف ومشرفة للمدخلين المنفصلين','Male and female organizers, separate entrances']].map(([v,ar,en])=><PrimaryButton key={v} secondary label={(preference===v?'✓ ':'')+c(ar,en)} onPress={()=>setPreference(v)}/>)}{input(c('عدد المداخل','Entrances'),entrances,setEntrances,true)}{input(c('المدينة','City'),city,setCity)}<DateTimeField label={c('وقت بدء الاستقبال','Reception start time')} value={start} mode="time" onChange={setStart}/>{input(c('مدة الخدمة بالساعات','Service duration in hours'),hours,setHours,true)}{input(c('ملاحظات العميل','Customer notes'),notes,setNotes)}<Text style={[styles.text,align]}>{c('سعر مبدئي حسب عدد المنظمين؛ تراجع المداخل والمدة والموقع والطاقة التشغيلية قبل تأكيد التوفر.','Indicative organizer-based price. Entrances, duration, location and capacity require review before availability is confirmed.')}</Text></Card>:null}
 {input(c('كود الخصم أو الإحالة','Discount or referral code'),coupon,setCoupon)}
 {quoting?<Text style={[styles.text,align]}>{c('جاري احتساب السعر…','Calculating price…')}</Text>:null}
 {quote?<Card><Text style={[styles.text,align]}>{c('الباقة','Package')}: {money(quote.baseAmount)}</Text><Text style={[styles.text,align]}>{c('تنظيم الدخول','Entry organization')}: {money(quote.addonAmount)}{quote.entry?` • ${quote.entry.organizers} ${c('منظم','organizer(s)')}`:''}</Text><Text style={[styles.text,align]}>{c('الخصم','Discount')}: {money(quote.discountAmount)}</Text><Text style={[styles.text,align]}>{c('الضريبة','Tax')}: {quote.taxStatus==='unconfigured'?c('بانتظار إعداد المنشأة — السعر مبدئي','Awaiting business configuration — indicative price'):quote.taxStatus==='not_registered'?c('غير مسجلة وفق الإعداد','Not registered per settings'):money(quote.taxAmount)}</Text><Text style={[styles.heading,align]}>{c('الإجمالي','Total')}: {money(quote.total)}</Text></Card>:null}
 {input(c('اسم العميل','Customer name'),name,setName)}{input(c('رقم الجوال','Mobile number'),phone,setPhone)}{input(c('البريد الإلكتروني — اختياري','Email — optional'),email,setEmail)}
 <View style={styles.row}><Switch value={consent} onValueChange={setConsent}/><Text style={[styles.flexText,align]}>{c('أوافق اختياريًا على أخبار وعروض هلا.','I optionally agree to HALA news and offers.')}</Text></View>
 {error?<Text style={[styles.error,align]} accessibilityRole="alert">{error}</Text>:null}
 <Text style={[styles.text,align]}>{c('سيُحفظ حجز مبدئي. سيتواصل فريق هلا لاستكمال الدفع والتأكيد؛ واتساب للمساعدة فقط.','A preliminary request is saved. HALA will contact you for payment and confirmation. WhatsApp is optional support.')}</Text>
 <PrimaryButton label={c('تأكيد طلب الحجز','Save booking request')} loading={busy} disabled={!quote||!ready||quoting} onPress={()=>void submit()}/><PrimaryButton label={c('اطلب عرض سعر مخصص','Request a custom quote')} secondary onPress={()=>router.push('/packages' as never)}/><PrimaryButton label={c('رجوع','Back')} secondary onPress={()=>router.back()}/>
 </ScrollView></Screen>;
}
export const styles=StyleSheet.create({body:{padding:20,gap:14,paddingBottom:50},text:{color:theme.colors.ink,lineHeight:24},flexText:{color:theme.colors.ink,lineHeight:24,flex:1},heading:{color:theme.colors.ink,fontSize:20,fontWeight:'800',marginVertical:8},label:{color:theme.colors.ink,fontWeight:'700'},input:{borderWidth:1,borderColor:theme.colors.line,borderRadius:14,backgroundColor:theme.colors.paper,color:theme.colors.ink,minHeight:50,paddingHorizontal:14},row:{flexDirection:'row',alignItems:'center',gap:8,flexWrap:'wrap'},error:{color:theme.colors.danger,lineHeight:23},number:{color:theme.colors.gold,fontSize:27,fontWeight:'900',textAlign:'center',paddingVertical:14}});
