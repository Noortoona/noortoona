import {Contact,ContactField,requestPermissionsAsync} from 'expo-contacts';
// Open only on an explicit tap. Only the selected contact is read; nothing is uploaded here.
export async function selectPhoneContact(){
 const permission=await requestPermissionsAsync();
 if(!permission.granted)throw new Error('لم يُمنح إذن جهات الاتصال. يمكنك الإدخال يدويًا. / Contacts permission denied. Enter the guest manually.');
 const contact=await Contact.presentPicker();if(!contact)return null;
 const details=await contact.getDetails([ContactField.FULL_NAME,ContactField.PHONES]);
 return {name:details.fullName||'',phone:details.phones?.find(p=>p.number)?.number||''};
}
