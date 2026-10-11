function activationHistory(prohibition) {
  return prohibition?.activationByDate && typeof prohibition.activationByDate === 'object'
    ? prohibition.activationByDate
    : {}
}

export function isProhibitionActiveOn(prohibition, dateKey) {
  if (!prohibition || typeof dateKey !== 'string' || !dateKey) return false

  const history = activationHistory(prohibition)
  if (Object.prototype.hasOwnProperty.call(history, dateKey)) return history[dateKey] === true

  const previousDate = Object.keys(history)
    .filter(date => date < dateKey && typeof history[date] === 'boolean')
    .sort()
    .at(-1)

  return previousDate ? history[previousDate] : false
}

export function prohibitionsActiveOn(prohibitions, dateKey) {
  return [...(prohibitions || [])]
    .filter(prohibition => isProhibitionActiveOn(prohibition, dateKey))
    .sort((a, b) => (a.order || 0) - (b.order || 0) || String(a.title || '').localeCompare(String(b.title || ''), 'ru'))
}

export function setProhibitionActiveOn(prohibition, dateKey, active) {
  return {
    ...prohibition,
    activationByDate: {
      ...activationHistory(prohibition),
      [dateKey]: Boolean(active)
    }
  }
}

export function isProhibitionViolatedOn(prohibition, dateKey) {
  return Boolean(prohibition?.violationsByDate?.[dateKey])
}

export function setProhibitionViolationOn(prohibition, dateKey, violated) {
  const violationsByDate = { ...(prohibition?.violationsByDate || {}) }
  if (violated) violationsByDate[dateKey] = true
  else delete violationsByDate[dateKey]

  return { ...prohibition, violationsByDate }
}
