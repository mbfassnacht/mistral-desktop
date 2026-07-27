export function greetingKey(date: Date = new Date()): string {
  const hour = date.getHours()
  if (hour < 5) return 'chat.greetingNight'
  if (hour < 12) return 'chat.greetingMorning'
  if (hour < 18) return 'chat.greetingAfternoon'
  if (hour < 22) return 'chat.greetingEvening'
  return 'chat.greetingNight'
}
