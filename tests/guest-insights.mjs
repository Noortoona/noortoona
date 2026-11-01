import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

test('guest insights provide read-only guidance for an empty event', async () => {
  const context = { window: {} };
  vm.runInNewContext(await readFile(new URL('../guest-insights.js', import.meta.url), 'utf8'), context);
  const { items, expected } = context.window.HALA_INSIGHTS.summarize({ capacity: 25 }, []);
  assert.equal(items.length, 1);
  assert.equal(items[0].key, 'empty');
  assert.equal(expected, 0);
});

test('guest insights distinguish failures, unanswered invitations, linked views and capacity', async () => {
  const context = { window: {} };
  vm.runInNewContext(await readFile(new URL('../guest-insights.js', import.meta.url), 'utf8'), context);
  const rows = [
    { rsvp_status: 'pending', phone: '' },
    { rsvp_status: 'declined', phone: '0500', whatsapp_status: 'failed' },
    { rsvp_status: 'accepted', phone: '0511', attendance_state: 'normal',
      companion_count: 2, children_count: 1, whatsapp_status: 'delivered', viewed_at: null },
    { rsvp_status: 'accepted', phone: '0522', attendance_state: 'waitlist',
      companion_count: 3, children_count: 0, whatsapp_status: 'read', viewed_at: '2026-11-01' }
  ];
  const result = context.window.HALA_INSIGHTS.summarize({ capacity: 4 }, rows);
  assert.equal(result.expected, 4, 'waitlisted companions must not count toward confirmed capacity');
  assert.equal(result.items.map(i => i.key).join(','), 'failed,pending,phone,declined,unopened,capacity');
  assert.equal(result.items.find(i => i.key === 'pending').filterValue, 'pending');
  assert.equal(result.items.find(i => i.key === 'unopened').filterValue, 'unviewed');
  assert.match(result.items.find(i => i.key === 'failed').detail, /لا تعِد الإرسال/);
});

test('guest insights do not mislabel the provider sent status as an opened invitation', async () => {
  const context = { window: {} };
  vm.runInNewContext(await readFile(new URL('../guest-insights.js', import.meta.url), 'utf8'), context);
  const report = context.window.HALA_INSIGHTS.summarize({}, [
    { rsvp_status: 'accepted', phone: '0511', whatsapp_status: 'sent', viewed_at: null },
    { rsvp_status: 'accepted', phone: '0522', whatsapp_status: 'read', viewed_at: '2026-11-01' },
  ]);
  assert.match(report.items.find(i => i.key === 'unopened').title, /^1 /);
  assert.ok(!report.items.some(i => i.key === 'failed'));
});
