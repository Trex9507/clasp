/**
 * "2 minutes ago", with the exact timestamp on hover and in the accessible
 * name.
 *
 * Relative time alone is a trap when someone needs to quote it: "3 days ago"
 * is friendlier to read and useless in a bug report. Both
 * are rendered - the relative form visibly, the absolute form as the
 * element's title and its `dateTime`, which is what a screen reader and a
 * copy-paste both pick up.
 */

const DIVISIONS: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { amount: 60, unit: "second" },
  { amount: 60, unit: "minute" },
  { amount: 24, unit: "hour" },
  { amount: 7, unit: "day" },
  { amount: 4.34524, unit: "week" },
  { amount: 12, unit: "month" },
  { amount: Number.POSITIVE_INFINITY, unit: "year" },
]

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" })
const absolute = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
})

function formatRelative(value: string): string {
  const then = new Date(value)
  if (Number.isNaN(then.getTime())) return ""
  let duration = (then.getTime() - Date.now()) / 1000
  for (const division of DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return relative.format(Math.round(duration), division.unit)
    }
    duration /= division.amount
  }
  return ""
}

export function RelativeTime({ value, className }: { value: string; className?: string }) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const exact = absolute.format(date)
  return (
    <time dateTime={date.toISOString()} title={exact} className={className}>
      <span aria-hidden="true">{formatRelative(value)}</span>
      <span className="sr-only">{exact}</span>
    </time>
  )
}
