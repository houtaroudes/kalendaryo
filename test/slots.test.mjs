/**
 * Tests for the pure booking logic. No DOM or network, so they run with plain
 * node and cover the part that is actually easy to get wrong: which start times
 * are offered for a given day.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  buildSlots,
  dateKeyLocal,
  labelOf,
  minutesOf,
  weekdayOf,
  upcomingDays,
  stampOf,
  minutesFromStamp,
} from '../src/lib/time.js'

test('time round trips', () => {
  assert.equal(minutesOf('09:30'), 570)
  assert.equal(labelOf(570), '9:30 AM')
  assert.equal(labelOf(0), '12:00 AM')
  assert.equal(labelOf(12 * 60), '12:00 PM')
  assert.equal(labelOf(18 * 60 + 5), '6:05 PM')
})

test('weekday and date keys are local, not UTC', () => {
  // 2026-10-05 is a Monday.
  assert.equal(weekdayOf('2026-10-05'), 1)
  assert.equal(weekdayOf('2026-10-04'), 0)
  assert.equal(dateKeyLocal(new Date(2026, 9, 5, 23, 30)), '2026-10-05')
})

test('stamp helpers agree', () => {
  assert.equal(stampOf('2026-10-05', 9 * 60 + 15), '2026-10-05T09:15')
  assert.equal(minutesFromStamp('2026-10-05T09:15'), 555)
})

test('upcoming days start today and stay ordered', () => {
  const days = upcomingDays(5, new Date(2026, 9, 5))
  assert.deepEqual(days, ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09'])
})

test('slots fill an open window on the right weekday', () => {
  const windows = [{ weekday: 1, start: '09:00', end: '12:00' }]
  const slots = buildSlots({ dateKey: '2026-10-05', windows, durationMinutes: 60 })
  assert.deepEqual(
    slots.map((s) => s.start),
    [540, 600, 660],
  )
  assert.equal(slots[0].label, '9:00 AM')
})

test('a closed weekday offers nothing', () => {
  const windows = [{ weekday: 1, start: '09:00', end: '18:00' }]
  assert.equal(buildSlots({ dateKey: '2026-10-04', windows, durationMinutes: 60 }).length, 0)
})

test('existing bookings remove only the overlapping starts', () => {
  const windows = [{ weekday: 1, start: '09:00', end: '13:00' }]
  const taken = [{ dateKey: '2026-10-05', start: 600, durationMinutes: 60 }]
  const slots = buildSlots({ dateKey: '2026-10-05', windows, durationMinutes: 60, taken })
  assert.deepEqual(
    slots.map((s) => s.start),
    [540, 660, 720],
  )
})

test('a booking on another day is ignored', () => {
  const windows = [{ weekday: 1, start: '09:00', end: '11:00' }]
  const taken = [{ dateKey: '2026-10-06', start: 540, durationMinutes: 60 }]
  const slots = buildSlots({ dateKey: '2026-10-05', windows, durationMinutes: 60, taken })
  assert.deepEqual(
    slots.map((s) => s.start),
    [540, 600],
  )
})

test('the last slot must finish before closing', () => {
  const windows = [{ weekday: 1, start: '09:00', end: '10:30' }]
  const slots = buildSlots({ dateKey: '2026-10-05', windows, durationMinutes: 60 })
  assert.deepEqual(
    slots.map((s) => s.start),
    [540],
  )
})

test('a custom step grid is respected', () => {
  const windows = [{ weekday: 1, start: '09:00', end: '11:00' }]
  const slots = buildSlots({ dateKey: '2026-10-05', windows, durationMinutes: 30, step: 15 })
  assert.deepEqual(
    slots.map((s) => s.start),
    [540, 555, 570, 585, 600, 615, 630],
  )
})
