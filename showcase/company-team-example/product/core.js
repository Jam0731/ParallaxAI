(function (root) {
  'use strict';
  const STORAGE_KEY = 'ledgerleaf.scenario.v1';
  function starter() {
    return { schemaVersion: 1, currency: 'USD', origin: 'fictional-example', total: '120', nonClient: '24', buffer: '12', clients: [
      { id: 'acorn', name: 'Acorn', hours: '36', fee: '2160' },
      { id: 'fieldline', name: 'Fieldline', hours: '24', fee: '1800' },
      { id: 'north-leaf', name: 'North Leaf', hours: '18', fee: '1260' }
    ] };
  }
  function blank() { return { schemaVersion: 1, currency: 'USD', origin: 'blank', total: '', nonClient: '', buffer: '', clients: [] }; }
  function parseAmount(raw, label) {
    if (typeof raw !== 'string' || raw.trim() === '') return { error: `${label} is required. Enter 0 if none.` };
    const trimmed = raw.trim();
    if (/^-/.test(trimmed)) return { error: `${label} cannot be negative.` };
    if (!/^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(trimmed)) return { error: `${label} must be a number with up to two decimal places.` };
    const amount = Number(trimmed);
    if (!Number.isFinite(amount) || amount > 1000000) return { error: `${label} must be no more than 1,000,000.` };
    return { value: Math.round(amount * 100) };
  }
  function evaluate(state) {
    const errors = {};
    const total = parseAmount(state.total, 'Total hours');
    const nonClient = parseAmount(state.nonClient, 'Non-client hours');
    const buffer = parseAmount(state.buffer, 'Buffer hours');
    if (total.error) errors.total = total.error;
    if (nonClient.error) errors.nonClient = nonClient.error;
    if (buffer.error) errors.buffer = buffer.error;
    let available = null;
    if (!total.error && !nonClient.error && !buffer.error) {
      if (nonClient.value + buffer.value > total.value) errors.capacity = 'Non-client work plus buffer exceeds total working hours. Reduce those hours or increase total hours before using this plan.';
      else available = (total.value - nonClient.value - buffer.value) / 100;
    }
    let committedHundredths = 0;
    let feeCents = 0;
    let hoursValid = true;
    let feesValid = true;
    state.clients.forEach((client, index) => {
      const row = {};
      if (typeof client.name !== 'string' || client.name.trim() === '') row.name = 'Client name is required.';
      const hours = parseAmount(client.hours, 'Client hours');
      const fee = parseAmount(client.fee, 'Monthly fee');
      if (hours.error) { row.hours = hours.error; hoursValid = false; } else committedHundredths += hours.value;
      if (fee.error) { row.fee = fee.error; feesValid = false; } else feeCents += fee.value;
      if (Object.keys(row).length) errors[`client-${index}`] = row;
    });
    // Missing names also leave the complete scenario invalid, even when some numbers are computable.
    const valid = Object.keys(errors).length === 0;
    const committed = hoursValid ? committedHundredths / 100 : null;
    const monthlyFee = feesValid ? feeCents / 100 : null;
    const remaining = available !== null && committed !== null ? Math.round((available - committed) * 100) / 100 : null;
    const effective = committed !== null && committed > 0 && monthlyFee !== null ? monthlyFee / committed : null;
    return { valid, errors, available, committed, monthlyFee, remaining, effective };
  }
  function restore(raw) {
    const state = JSON.parse(raw);
    if (!state || state.schemaVersion !== 1 || state.currency !== 'USD' || !['fictional-example', 'blank', 'custom'].includes(state.origin) || !['total', 'nonClient', 'buffer'].every(key => typeof state[key] === 'string') || !Array.isArray(state.clients) || state.clients.length > 1000) throw new Error('Unsupported scenario format.');
    const ids = new Set();
    state.clients.forEach(client => {
      if (!client || !['id', 'name', 'hours', 'fee'].every(key => typeof client[key] === 'string') || ids.has(client.id) || client.id.length > 100) throw new Error('Unsupported client data.');
      ids.add(client.id);
    });
    // Only copy the supported schema, preserving typed values and names as literal strings.
    return { schemaVersion: 1, currency: 'USD', origin: state.origin, total: state.total, nonClient: state.nonClient, buffer: state.buffer, clients: state.clients.map(({id,name,hours,fee}) => ({id,name,hours,fee})) };
  }
  function exportScenario(state, date) {
    return { product: 'Ledgerleaf', productVersion: '1.0.1', exportedAt: date, scenario: state, calculation: evaluate(state), notes: ['All fees are monthly USD revenue, not profit.', 'Raw input values are preserved. A scenario with validation errors is incomplete and must not be used as an approved capacity plan.', 'JSON import is not supported in this version. This file is a readable backup or handoff.'] };
  }
  const api = { STORAGE_KEY, starter, blank, parseAmount, evaluate, restore, exportScenario };
  root.Ledgerleaf = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
