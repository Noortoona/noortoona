import * as SecureStore from 'expo-secure-store';
import {api} from './api';
const key=(user:string,event:string)=>`hala.checkin.${user}.${event}`;
export async function pendingScans(user:string,event:string):Promise<string[]>{return JSON.parse(await SecureStore.getItemAsync(key(user,event))||'[]');}
export async function queueScan(user:string,event:string,code:string){
 const pending=await pendingScans(user,event);if(!pending.includes(code))pending.push(code);
 if(pending.length>100)throw Error('قائمة التحقق المعلقة ممتلئة. أعد الاتصال أولًا. / Reconnect before scanning more guests.');
 await SecureStore.setItemAsync(key(user,event),JSON.stringify(pending));return pending.length;
}
// Pending scans are never shown as admitted. Server QR locking resolves cross-device duplicates.
export async function syncScans(user:string,event:string,token:string){
 const pending=await pendingScans(user,event),results=[];
 for(const code of [...pending]){
  const result=await api<{alreadyCheckedIn:boolean;guest?:{name:string}}>('/api/check-in',{method:'POST',body:JSON.stringify({eventId:event,code})},token);
  pending.splice(pending.indexOf(code),1);await SecureStore.setItemAsync(key(user,event),JSON.stringify(pending));results.push(result);
 }
 return results;
}
