// Office schedule for the header's hours popover (pure; no React, no DOM).
// Input is /api/chat/config `schedule`: { timezone, days: [{ day, open, start, end }] } Mon→Sun.

const DAY_LABEL = { mon: 'Lun', tue: 'Mar', wed: 'Miy', thu: 'Huw', fri: 'Biy', sat: 'Sab', sun: 'Lin' }

function time12(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number)
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

/** [{ days: 'Lun–Biy', hours: '8:00 AM–5:00 PM' | 'Sarado' }], consecutive same-hours days grouped. */
export function formatSchedule(schedule) {
  const days = Array.isArray(schedule?.days) ? schedule.days : []
  const rows = []
  for (const d of days) {
    const hours = d.open && d.start && d.end ? `${time12(d.start)}–${time12(d.end)}` : 'Sarado'
    const last = rows[rows.length - 1]
    if (last && last.hours === hours) last.to = d.day
    else rows.push({ from: d.day, to: d.day, hours })
  }
  return rows.map(r => ({
    days: r.from === r.to ? DAY_LABEL[r.from] : `${DAY_LABEL[r.from]}–${DAY_LABEL[r.to]}`,
    hours: r.hours
  }))
}
