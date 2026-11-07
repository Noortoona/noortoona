/* Hala web contact import: processes selected device/file contacts locally until the owner confirms. */
(function () {
  'use strict';

  function normalizePhone(raw) {
    let digits = String(raw || '')
      .replace(/[\u0660-\u0669]/g, digit => String(digit.charCodeAt(0) - 0x0660))
      .replace(/[\u06f0-\u06f9]/g, digit => String(digit.charCodeAt(0) - 0x06f0))
      .replace(/[^0-9]/g, '');
    if (digits.startsWith('00')) digits = digits.slice(2);
    if (digits.length === 10 && digits.startsWith('05')) digits = '966' + digits.slice(1);
    if (digits.length === 9 && digits.startsWith('5')) digits = '966' + digits;
    return digits;
  }

  function unescapeVCard(value) {
    return String(value || '').replace(/\\([nN,;\\])/g, (_, ch) => ch.toLowerCase() === 'n' ? ' ' : ch).trim();
  }

  function rowsFromContacts(list) {
    if (!Array.isArray(list)) return [];
    const guests = [];
    for (const contact of list) {
      const name = (Array.isArray(contact.name) ? contact.name[0] : contact.name) || '';
      const telephones = Array.isArray(contact.tel) ? contact.tel : [];
      for (const telephone of telephones) {
        guests.push({name: String(name).trim(), phone: String(telephone).trim()});
      }
    }
    return guests;
  }

  function parseVCard(text) {
    if (typeof text !== 'string' || text.length > 12_000_000) throw new Error('الملف كبير جدًا');
    const physical = text.replace(/\r\n?/g, '\n').split('\n');
    const lines = [];
    for (const line of physical) {
      if (/^[ \t]/.test(line) && lines.length) lines[lines.length - 1] += line.slice(1);
      else lines.push(line);
    }

    const guests = [];
    let current = null;
    for (const line of lines) {
      if (/^BEGIN:VCARD\s*$/i.test(line)) { current = {name: '', alternate: '', phones: []}; continue; }
      if (!current) continue;
      if (/^END:VCARD\s*$/i.test(line)) {
        const name = current.name || current.alternate;
        for (const phone of current.phones) guests.push({name, phone});
        current = null;
        continue;
      }
      const separator = line.indexOf(':');
      if (separator < 1) continue;
      const key = line.slice(0, separator).split(';')[0].split('.').pop().toUpperCase();
      const value = unescapeVCard(line.slice(separator + 1));
      if (key === 'FN') current.name = value;
      if (key === 'N' && !current.alternate) {
        const names = value.split(';');
        current.alternate = [names[1], names[0]].filter(Boolean).join(' ').trim();
      }
      if (key === 'TEL') current.phones.push(value.replace(/^tel:/i, ''));
    }
    return guests;
  }

  function uniqueNewGuests(candidates, existingGuests, max = 1000) {
    const existing = new Set((existingGuests || []).map(guest => normalizePhone(guest.phone)).filter(Boolean));
    const result = [];
    const seen = new Set();
    for (const guest of candidates || []) {
      const name = String(guest.name || '').trim().slice(0, 150);
      const phone = normalizePhone(guest.phone);
      if (!name || !phone || phone.length < 9 || phone.length > 15 || existing.has(phone) || seen.has(phone)) continue;
      seen.add(phone);
      result.push({name, phone});
      if (result.length >= max) break;
    }
    return result;
  }

  function supported() {
    return typeof navigator !== 'undefined' && window.isSecureContext &&
      navigator.contacts && typeof navigator.contacts.select === 'function';
  }

  async function pick() {
    if (!supported()) throw new Error('المتصفح لا يدعم اختيار جهات الاتصال مباشرة. استخدم ملف جهات الاتصال.');
    // Calling select immediately is required for browsers that require a user gesture.
    const selected = await navigator.contacts.select(['name', 'tel'], {multiple: true});
    return rowsFromContacts(selected);
  }

  window.HALA_WEB_CONTACTS = Object.freeze({
    normalizePhone, parseVCard, rowsFromContacts, uniqueNewGuests, supported, pick
  });
})();
