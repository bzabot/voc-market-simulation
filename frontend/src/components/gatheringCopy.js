import { money } from '../format'

export function gatheringReason(e) {
  const { reason, trigger, wanted_cents: wanted, heavy } = e
  if (reason === 'held') return 'Both sides were already there.'
  if (reason === 'rose' && trigger?.kind === 'dropped') {
    return `The plaque rose until ${trigger.name} dropped out.`
  }
  if (reason === 'rose' && trigger?.kind === 'entered') {
    return `The plaque rose until ${trigger.name} would sell.`
  }
  if (reason === 'rose' && trigger?.kind === 'priced_out') {
    return `The plaque rose until ${trigger.name} could not pay.`
  }
  if (reason === 'fell' && trigger?.kind === 'dropped') {
    return `The plaque fell until ${trigger.name} dropped out.`
  }
  if (reason === 'fell' && trigger?.kind === 'entered') {
    return `The plaque fell until ${trigger.name} would buy.`
  }
  if (reason === 'fell' && trigger?.kind === 'priced_out') {
    return `The plaque fell until ${trigger.name} could not pay.`
  }
  if (reason === 'none' && wanted != null) {
    const side = heavy === 'sellers' ? 'Sellers' : 'Buyers'
    return `${side} would not follow to ${money(wanted)}.`
  }
  if (reason === 'none') return 'No one came to the plaque.'
  return null
}
