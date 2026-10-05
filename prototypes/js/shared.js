// Shared JS untuk prototype checklist-shift v2

// Toast
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer') || createToastContainer();
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

function createToastContainer() {
  const container = document.createElement('div');
  container.id = 'toastContainer';
  container.className = 'toast-container';
  document.body.appendChild(container);
  return container;
}

// Accordion
document.addEventListener('click', (e) => {
  const trigger = e.target.closest('.accordion-trigger');
  if (trigger) {
    const item = trigger.closest('.accordion-item');
    item.classList.toggle('open');
  }
});

// Tabs
document.addEventListener('click', (e) => {
  const tab = e.target.closest('.tab');
  if (tab) {
    const tabs = tab.parentElement;
    tabs.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
  }
});

// Toggle
document.addEventListener('click', (e) => {
  const toggle = e.target.closest('.toggle');
  if (toggle) {
    toggle.classList.toggle('active');
  }
});

// Modal
function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('open');
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('open');
}

// Checklist checkbox
document.addEventListener('click', (e) => {
  const checkbox = e.target.closest('.checklist-checkbox');
  if (checkbox) {
    checkbox.classList.toggle('checked');
    const item = checkbox.closest('.checklist-item');
    if (item) item.classList.toggle('done');
  }
});

// PIN Input
document.addEventListener('input', (e) => {
  if (e.target.classList.contains('pin-digit')) {
    e.target.classList.add('filled');
    const next = e.target.nextElementSibling;
    if (next && next.classList.contains('pin-digit')) next.focus();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.target.classList.contains('pin-digit') && e.key === 'Backspace' && !e.target.value) {
    const prev = e.target.previousElementSibling;
    if (prev && prev.classList.contains('pin-digit')) prev.focus();
  }
});

// Keypad
document.addEventListener('click', (e) => {
  const key = e.target.closest('.keypad-key');
  if (key && !key.classList.contains('empty')) {
    const digits = document.querySelectorAll('.pin-digit');
    for (const d of digits) {
      if (!d.value) {
        d.value = key.textContent;
        d.classList.add('filled');
        const next = d.nextElementSibling;
        if (next && next.classList.contains('pin-digit')) next.focus();
        break;
      }
    }
  }
});

// Filter chips
document.addEventListener('click', (e) => {
  const chip = e.target.closest('.filter-chip');
  if (chip) {
    const group = chip.parentElement;
    group.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
  }
});
