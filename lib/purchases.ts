import type { Attendee, EventSettings, Order } from './types'

export type PurchaseGroup = {
  key: string
  orderId: string | null
  name: string
  phone: string | null
  tickets: Attendee[]
  cancelledAt: string | null
  cancelReason: string | null
  usedCount: number
  paidCount: number
  unitPrice: number
  total: number
  paid: boolean
  createdAt: string | null
}

export function isCancelled(attendee: Attendee) {
  return Boolean(attendee.cancelled_at)
}

export function groupPurchases(attendees: Attendee[], settings: EventSettings): PurchaseGroup[] {
  const groups = new Map<string, Attendee[]>()

  for (const attendee of attendees) {
    const key = attendee.order_id ? `order:${attendee.order_id}` : `ticket:${attendee.id}`
    const list = groups.get(key)
    if (list) list.push(attendee)
    else groups.set(key, [attendee])
  }

  const result: PurchaseGroup[] = []

  for (const [key, rawTickets] of groups) {
    const tickets = [...rawTickets].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
    const first = tickets[0]
    const cancelled = tickets
      .map((ticket) => ticket.cancelled_at)
      .filter((value): value is string => Boolean(value))
      .sort()
    const unitPrice = Number(first.unit_price ?? settings.price)
    const total = tickets.reduce(
      (sum, ticket) => sum + Number(ticket.unit_price ?? settings.price),
      0
    )

    result.push({
      key,
      orderId: first.order_id || null,
      name: first.name,
      phone: first.phone || null,
      tickets,
      cancelledAt: cancelled.length ? cancelled[cancelled.length - 1] : null,
      cancelReason: tickets.find((ticket) => ticket.cancel_reason)?.cancel_reason || null,
      usedCount: tickets.filter((ticket) => ticket.used).length,
      paidCount: tickets.filter((ticket) => ticket.paid).length,
      unitPrice,
      total,
      paid: tickets.every((ticket) => ticket.paid),
      createdAt: tickets
        .map((ticket) => ticket.created_at)
        .filter((value): value is string => Boolean(value))
        .sort()[0] || null,
    })
  }

  return result.sort((a, b) => {
    if (Boolean(a.cancelledAt) !== Boolean(b.cancelledAt)) {
      return a.cancelledAt ? 1 : -1
    }
    const dateA = a.createdAt || ''
    const dateB = b.createdAt || ''
    return dateB.localeCompare(dateA)
  })
}

export function groupToOrder(group: PurchaseGroup): Order | null {
  if (!group.orderId) return null

  return {
    id: group.orderId,
    buyer_name: group.name,
    phone: group.phone,
    quantity: group.tickets.length,
    unit_price: group.unitPrice,
    total: group.total,
    paid: group.paid,
    cancelled_at: group.cancelledAt,
    cancel_reason: group.cancelReason,
    created_at: group.createdAt || undefined,
  }
}

export function groupMatchesQuery(group: PurchaseGroup, query: string) {
  const needle = query.trim().toLowerCase()
  if (!needle) return true

  return (
    group.name.toLowerCase().includes(needle) ||
    (group.phone || '').toLowerCase().includes(needle) ||
    (group.orderId || '').toLowerCase().includes(needle) ||
    group.tickets.some((ticket) => ticket.id.toLowerCase().includes(needle))
  )
}

export function formatDateTime(value?: string | null) {
  if (!value) return ''
  try {
    const date = new Date(value)
    return new Intl.DateTimeFormat('es-PE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date)
  } catch {
    return value
  }
}
