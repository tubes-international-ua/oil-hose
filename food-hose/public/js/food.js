document.addEventListener('DOMContentLoaded', function () {
  // Conversion events for GTM, same names as on the main LP
  window.dataLayer = window.dataLayer || [];

  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  // Mobile nav, same behaviour as the composite-hose landing
  var burger = document.getElementById('burger');
  var mobnav = document.getElementById('mobnav');
  if (burger && mobnav) {
    burger.addEventListener('click', function () {
      var open = mobnav.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    mobnav.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        mobnav.classList.remove('is-open');
        burger.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // Lead form: same contract as the composite-hose landing (POST /api/lead, see src/index.js)
  var form = document.getElementById('lead-form');
  if (form) initLeadForm(form);

  // Delegated clicks: also works for buttons rendered later by food-product.js
  document.addEventListener('click', function (e) {
    var tel = e.target.closest('a[href^="tel:"]');
    if (tel) {
      window.dataLayer.push({ event: 'phone_click', phone_number: tel.getAttribute('href').slice(4) });
    }

    // "Ask price" buttons prefill the request form with the product name and open it in a modal
    var btn = e.target.closest('[data-product]');
    var message = document.getElementById('f-msg');
    if (btn && message) {
      message.value = 'Цікавить: ' + btn.dataset.product;
      if (openFormModal()) e.preventDefault();
    }
  });

  var filters = document.querySelectorAll('.filters button');
  var products = document.querySelectorAll('.product');
  var emptyResult = document.querySelector('.empty-result');
  if (!filters.length) return;

  // Show only products whose data-category list contains the selected filter
  function applyFilter(category) {
    var visible = 0;
    filters.forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.filter === category);
    });
    products.forEach(function (product) {
      var match = category === 'all' || product.dataset.category.split(' ').indexOf(category) !== -1;
      product.hidden = !match;
      if (match) visible++;
    });
    emptyResult.style.display = visible ? 'none' : 'block';
  }

  filters.forEach(function (btn) {
    btn.addEventListener('click', function () {
      history.replaceState(null, '', location.pathname + location.search + (btn.dataset.filter === 'all' ? '' : '#' + btn.dataset.filter));
      applyFilter(btn.dataset.filter);
    });
  });

  // Allow deep links like /catalog#milk from the landing page
  function filterFromHash() {
    var hash = location.hash.slice(1);
    var exists = Array.prototype.some.call(filters, function (btn) {
      return btn.dataset.filter === hash;
    });
    applyFilter(exists ? hash : 'all');
  }

  window.addEventListener('hashchange', filterFromHash);
  filterFromHash();
});

// Moves the page's only .formcard into a <dialog> and back on close, so ids and handlers stay as they are
var formModal;
function openFormModal() {
  var card = document.querySelector('.formcard');
  if (!card || typeof HTMLDialogElement !== 'function') return false;

  if (!formModal) {
    var slot = document.createComment('formcard');
    card.parentNode.insertBefore(slot, card);

    formModal = document.createElement('dialog');
    formModal.className = 'modal';
    formModal.setAttribute('aria-label', 'Запитати ціну');
    formModal.innerHTML = '<button type="button" class="modal__close" aria-label="Закрити">' +
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button>';
    document.body.appendChild(formModal);

    formModal.querySelector('.modal__close').addEventListener('click', function () { formModal.close(); });
    // Click on the backdrop (outside the card) closes the modal
    formModal.addEventListener('click', function (e) { if (e.target === formModal) formModal.close(); });
    formModal.addEventListener('close', function () { slot.parentNode.insertBefore(card, slot.nextSibling); });
  }

  if (!formModal.open) {
    formModal.appendChild(card);
    formModal.showModal();
  }
  var name = document.getElementById('f-name');
  if (name && document.getElementById('form-wrap').style.display !== 'none') name.focus();
  window.dataLayer.push({ event: 'form_open', form_name: document.getElementById('lead-form').getAttribute('data-form-name') });
  return true;
}

function initLeadForm(form) {
  var d = document;
  var formName = form.getAttribute('data-form-name');
  var phone = d.getElementById('f-phone');
  var consent = d.getElementById('f-consent');
  var submitBtn = d.getElementById('submit-btn');
  var formWrap = d.getElementById('form-wrap');
  var success = d.getElementById('form-success');
  var dl = function (o) { window.dataLayer.push(o); };

  // Phone input: normalize to +380 XX XXX XX XX
  function formatPhone(value) {
    var digits = value.replace(/\D/g, '');
    if (digits.indexOf('380') === 0) digits = digits.slice(3);
    if (digits.length > 9 && digits.indexOf('380') === 0) digits = digits.slice(3);
    if (digits.indexOf('0') === 0) digits = digits.slice(1);
    digits = digits.slice(0, 9);
    var out = '+380';
    if (digits.length) out += ' ' + digits.slice(0, 2);
    if (digits.length > 2) out += ' ' + digits.slice(2, 5);
    if (digits.length > 5) out += ' ' + digits.slice(5, 7);
    if (digits.length > 7) out += ' ' + digits.slice(7, 9);
    return out;
  }
  phone.addEventListener('focus', function () { if (!phone.value) phone.value = '+380 '; });
  phone.addEventListener('input', function () { phone.value = formatPhone(phone.value); setError(phone, false); });
  phone.addEventListener('blur', function () { if (phone.value.replace(/\D/g, '') === '380') phone.value = ''; });

  function setError(el, on) {
    el.setAttribute('aria-invalid', on ? 'true' : 'false');
    var msg = d.querySelector('[data-error-for="' + el.id + '"]');
    if (msg) msg.classList.toggle('is-visible', on);
  }
  // Same rules as the Worker validates server-side
  var rules = {
    'f-name': function (v) { return v.trim().length >= 2; },
    'f-city': function (v) { return v.trim().length >= 2; },
    'f-phone': function (v) { return v.replace(/\D/g, '').length === 12; },
    'f-email': function (v) { return /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(v.trim()); }
  };
  Object.keys(rules).forEach(function (id) {
    var el = d.getElementById(id);
    el.addEventListener('blur', function () { if (el.value) setError(el, !rules[id](el.value)); });
    el.addEventListener('input', function () { if (el.getAttribute('aria-invalid') === 'true') setError(el, false); });
  });
  consent.addEventListener('change', function () { if (consent.checked) setError(consent, false); });

  function validate() {
    var first = null;
    Object.keys(rules).forEach(function (id) {
      var el = d.getElementById(id), ok = rules[id](el.value);
      setError(el, !ok);
      if (!ok && !first) first = el;
    });
    setError(consent, !consent.checked);
    if (!consent.checked && !first) first = consent;
    return first;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (d.getElementById('f-hpx').value) { dl({ event: 'form_honeypot' }); return; }

    var invalid = validate();
    if (invalid) { invalid.focus(); dl({ event: 'form_error' }); return; }

    var product = d.getElementById('f-product');
    var message = d.getElementById('f-msg').value.trim();
    if (product && product.value) message = 'Продукт: ' + product.value + (message ? '\n' + message : '');

    var data = {
      name: d.getElementById('f-name').value.trim(),
      city: d.getElementById('f-city').value.trim(),
      phone: phone.value.trim(),
      email: d.getElementById('f-email').value.trim(),
      message: message,
      consent: true,
      form_name: formName,
      page_url: window.location.href,
      // Ad attribution carried over from the landing URL
      utm: (function () {
        var p = new URLSearchParams(window.location.search), o = {};
        ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid'].forEach(function (k) {
          if (p.get(k)) o[k] = p.get(k);
        });
        return o;
      })()
    };

    var label = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Надсилаємо...';

    function done() {
      dl({ event: 'generate_lead', form_name: formName, lead_city: data.city, value: 1, currency: 'UAH' });
      formWrap.style.display = 'none';
      success.classList.add('is-visible');
      if (success.scrollIntoView) success.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    function fail() {
      submitBtn.disabled = false;
      submitBtn.textContent = label;
      alert('Не вдалося надіслати заявку. Зателефонуйте, будь ласка: +380 32 245 93 41');
    }

    fetch('/api/lead', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
    }).then(function (r) { r.ok ? done() : fail(); }).catch(fail);
  });
}
