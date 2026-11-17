// Phone reminders: the native side of db.planReminders. Gild has no server,
// so reminders are local notifications scheduled on the device itself, then
// rescheduled whenever the data changes (and every time the app opens).
// Nothing leaves the phone. In a browser every function here does nothing.
import { LocalNotifications } from '@capacitor/local-notifications'
import { isNativeApp } from './deviceStore.js'

// 'granted' | 'denied' | 'prompt' | 'unsupported'
export async function reminderPermission() {
  if (!isNativeApp) return 'unsupported'
  try {
    const { display } = await LocalNotifications.checkPermissions()
    return display === 'granted' ? 'granted' : display === 'denied' ? 'denied' : 'prompt'
  } catch {
    return 'unsupported'
  }
}

export async function askReminderPermission() {
  if (!isNativeApp) return 'unsupported'
  try {
    const { display } = await LocalNotifications.requestPermissions()
    return display === 'granted' ? 'granted' : 'denied'
  } catch {
    return 'denied'
  }
}

// Replaces everything Gild has pending with `plan` ([{ id, at, title, body }]).
// Never asks for permission itself: without it, it quietly does nothing.
// Returns how many were scheduled.
export async function syncReminders(plan) {
  if (!isNativeApp) return 0
  if ((await reminderPermission()) !== 'granted') return 0
  const pending = await LocalNotifications.getPending()
  if (pending.notifications.length) {
    await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) })
  }
  if (!plan.length) return 0
  await LocalNotifications.schedule({
    notifications: plan.map((p) => ({ id: p.id, title: p.title, body: p.body, schedule: { at: p.at, allowWhileIdle: true } }))
  })
  return plan.length
}
