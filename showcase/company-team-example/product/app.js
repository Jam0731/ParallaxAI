(function () {
  'use strict';
  const api = window.Ledgerleaf;
  const byId = id => document.getElementById(id);
  const fields = { total: 'total-hours', nonClient: 'non-client-hours', buffer: 'buffer-hours' };
  const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
  const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
  let state = api.starter();
  let saveMessage = 'Fictional example loaded. Your first change saves automatically in this browser.';
  let storageError = false;
  try {
    const saved = localStorage.getItem(api.STORAGE_KEY);
    if (saved !== null) {
      state = api.restore(saved);
      saveMessage = 'Restored your last saved scenario from this browser.';
    }
  } catch (error) {
    saveMessage = 'Saved data could not be restored. The fictional example is shown instead. Export anything you need before making changes; changes will replace the saved scenario.';
    storageError = true;
  }
  function notify(message, error) { const node = byId('notice'); node.textContent = message; node.classList.toggle('error', !!error); node.hidden = false; }
  function storageStatus() { byId('save-status').textContent = saveMessage; byId('save-status').classList.toggle('error', storageError); }
  function persist() {
    try { localStorage.setItem(api.STORAGE_KEY, JSON.stringify(state)); saveMessage = 'Saved in this browser. Incomplete values are saved too, so you can continue editing.'; storageError = false; }
    catch (error) { saveMessage = 'This browser could not save the scenario. Keep this tab open and export a copy before leaving.'; storageError = true; }
    storageStatus();
  }
  function setError(input, target, message) { input.setAttribute('aria-invalid', message ? 'true' : 'false'); target.textContent = message || ''; }
  function updateSummary() {
    const result = api.evaluate(state);
    Object.entries(fields).forEach(([key, id]) => setError(byId(id), byId(`${id}-error`), result.errors[key]));
    state.clients.forEach((client, index) => {
      const row = byId(`row-${index}`);
      const errors = result.errors[`client-${index}`] || {};
      ['name', 'hours', 'fee'].forEach(key => setError(row.querySelector(`[data-field="${key}"]`), row.querySelector(`[data-error="${key}"]`), errors[key]));
      row.querySelector('.remove-client').setAttribute('aria-label', `Remove ${client.name.trim() || `client ${index + 1}`}`);
    });
    const incompleteNames = Object.values(result.errors).some(value => typeof value === 'object' && value.name);
    const capacityError = byId('capacity-error');
    capacityError.textContent = result.errors.capacity || (incompleteNames ? 'Every client needs a name. Complete the highlighted fields before using this scenario.' : '');
    capacityError.hidden = !capacityError.textContent;
    // A complete result is shown only for a completely valid plan.
    const valid = result.valid;
    byId('available').textContent = valid ? `${number.format(result.available)} h` : '—';
    byId('committed').textContent = valid ? `${number.format(result.committed)} h` : '—';
    byId('remaining').textContent = valid ? `${number.format(Math.abs(result.remaining))} h` : '—';
    const over = valid && result.remaining < 0;
    byId('balance-label').textContent = over ? 'Overbooked by' : 'Remaining capacity';
    byId('balance-hint').textContent = !valid ? 'Complete or correct the highlighted fields' : over ? 'Reduce commitments or revise available hours' : result.remaining === 0 ? 'Fully allocated — no spare client hours' : 'Room for your next commitment';
    byId('balance-card').classList.toggle('over', over);
    byId('balance-card').classList.toggle('invalid', !valid);
    byId('revenue').textContent = valid ? money.format(result.monthlyFee) : '—';
    byId('effective').textContent = valid && result.effective !== null ? `${money.format(result.effective)} / h` : '—';
    byId('effective-note').textContent = !valid ? 'Complete or correct the highlighted fields first.' : result.committed === 0 ? 'Not defined: committed client hours are zero.' : 'Monthly fees ÷ committed client hours; before costs and tax';
    const fill = byId('capacity-fill');
    fill.style.width = valid ? `${result.available > 0 ? Math.min(100, result.committed / result.available * 100) : result.committed > 0 ? 100 : 0}%` : '0%';
    fill.classList.toggle('over', over);
    byId('capacity-caption').textContent = !valid ? 'This scenario is incomplete or inconsistent. Figures are withheld until it is valid.' : result.available === 0 ? (result.committed > 0 ? 'No client capacity is available; every committed hour is overbooked.' : 'No client hours are available or committed.') : `${number.format(result.committed / result.available * 100)}% of available client capacity committed${over ? ' — this month is overbooked.' : '.'}`;
    byId('scenario-label').textContent = state.origin === 'fictional-example' ? 'Fictional starter scenario' : state.origin === 'blank' ? 'Blank scenario' : 'Your local scenario';
    byId('scenario-description').textContent = state.origin === 'fictional-example' ? 'Example businesses and figures. Replace them with your own plan.' : 'Your current scenario. Check the save status below. No client information is sent anywhere.';
    byId('empty-clients').hidden = state.clients.length > 0;
  }
  function markEdited() { state.origin = 'custom'; byId('notice').hidden = true; persist(); updateSummary(); }
  function clientField(key, label, client, index) {
    const wrap = document.createElement('div'); wrap.className = 'client-field';
    const labelNode = document.createElement('label'); labelNode.htmlFor = `client-${index}-${key}`; labelNode.textContent = label;
    const input = document.createElement('input'); input.id = labelNode.htmlFor; input.type = 'text'; input.autocomplete = 'off'; input.value = client[key]; input.dataset.field = key; input.setAttribute('aria-describedby', `client-${index}-${key}-error`);
    if (key !== 'name') input.inputMode = 'decimal';
    const errorNode = document.createElement('small'); errorNode.id = `client-${index}-${key}-error`; errorNode.className = 'field-error'; errorNode.dataset.error = key;
    input.addEventListener('input', () => { client[key] = input.value; markEdited(); });
    wrap.append(labelNode, input, errorNode); return wrap;
  }
  function renderRows() {
    const rows = byId('client-rows'); rows.replaceChildren();
    state.clients.forEach((client, index) => {
      const row = document.createElement('div'); row.className = 'client-row'; row.id = `row-${index}`;
      row.append(clientField('name', `Client ${index + 1} name`, client, index), clientField('hours', `Client ${index + 1} hours / month`, client, index), clientField('fee', `Client ${index + 1} fee / month · USD`, client, index));
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'remove-client'; remove.textContent = '×';
      remove.addEventListener('click', () => { const removedName = client.name || `client ${index + 1}`; state.clients.splice(index, 1); state.origin = 'custom'; renderRows(); persist(); updateSummary(); byId('add-client').focus(); notify(`Removed ${removedName}.`); });
      row.append(remove); rows.append(row);
    });
  }
  function renderAll() { Object.entries(fields).forEach(([key, id]) => { byId(id).value = state[key]; }); renderRows(); updateSummary(); storageStatus(); }
  Object.entries(fields).forEach(([key, id]) => byId(id).addEventListener('input', () => { state[key] = byId(id).value; markEdited(); }));
  byId('add-client').addEventListener('click', () => {
    if (state.clients.length >= 1000) { notify('The local planner supports up to 1,000 client rows. Export and start another scenario if needed.', true); return; }
    state.clients.push({ id: `client-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, name: '', hours: '', fee: '' }); state.origin = 'custom'; renderRows(); persist(); updateSummary(); byId(`client-${state.clients.length - 1}-name`).focus();
  });
  byId('load-example').addEventListener('click', () => { state = api.starter(); renderAll(); persist(); notify('Loaded and saved the fictional starter. Your previous current scenario has been replaced. Moss is a prospect you can add yourself.'); });
  function reset() {
    state = api.blank();
    try { localStorage.removeItem(api.STORAGE_KEY); saveMessage = 'Saved scenario removed. This blank form will save when you make a change.'; storageError = false; }
    catch (error) { saveMessage = 'The form is blank, but this browser did not allow the saved scenario to be removed. Clear site data in browser settings if you need to erase it.'; storageError = true; }
    renderAll(); notify(storageError ? saveMessage : 'Started blank and removed Ledgerleaf’s saved scenario at this address. Other site data and downloaded exports were not removed.', storageError); byId('total-hours').focus();
  }
  byId('start-blank').addEventListener('click', reset);
  byId('reset-data').addEventListener('click', reset);
  byId('export-json').addEventListener('click', () => {
    const content = api.exportScenario(state, new Date().toISOString());
    const blob = new Blob([JSON.stringify(content, null, 2) + '\n'], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'ledgerleaf-scenario.json'; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify(content.calculation.valid ? 'Scenario JSON export requested. Check your browser’s downloads for ledgerleaf-scenario.json.' : 'Export requested with incomplete or invalid inputs clearly marked. Correct the highlighted fields before relying on the plan.');
  });
  renderAll();
})();
