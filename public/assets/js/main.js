(function(){
  'use strict';

  // Lead handler lives in the Worker — see src/index.js
  var ENDPOINT = '/api/lead';

  var d = document;
  var form = d.getElementById('lead-form');
  var formWrap = d.getElementById('form-wrap');
  var success = d.getElementById('form-success');
  var submitBtn = d.getElementById('submit-btn');
  var phone = d.getElementById('f-phone');
  var consent = d.getElementById('f-consent');

  // Every page carrying the form declares its own name so leads stay attributable
  var formName = form.getAttribute('data-form-name') || 'composite_hoses_landing';

  d.getElementById('year').textContent = new Date().getFullYear();

  function dl(o){ (window.dataLayer = window.dataLayer || []).push(o); }

  /* ---- mobile nav ---- */
  var burger = d.getElementById('burger'), mobnav = d.getElementById('mobnav');
  burger.addEventListener('click', function(){
    var open = mobnav.classList.toggle('is-open');
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  mobnav.querySelectorAll('a').forEach(function(a){
    a.addEventListener('click', function(){
      mobnav.classList.remove('is-open');
      burger.setAttribute('aria-expanded','false');
    });
  });

  /* ---- track phone clicks as a paid-traffic conversion signal ---- */
  d.querySelectorAll('[data-track-call]').forEach(function(el){
    el.addEventListener('click', function(){
      dl({event:'phone_click', phone_number:(el.getAttribute('href')||'').replace('tel:','')});
    });
  });

  /* ---- cross-section diagram: highlight the hovered layer ---- */
  var rings = d.querySelectorAll('#xsec .ring');
  var layerItems = d.querySelectorAll('#layers .layer');
  function highlight(n){
    rings.forEach(function(r){
      var on = r.getAttribute('data-ring') === String(n);
      r.style.stroke = on ? '#e30613' : '';
      r.style.opacity = (n && !on) ? '.3' : '1';
    });
    layerItems.forEach(function(li){
      li.classList.toggle('is-active', li.getAttribute('data-layer') === String(n));
    });
  }
  layerItems.forEach(function(li){
    var n = li.getAttribute('data-layer');
    li.addEventListener('mouseenter', function(){ highlight(n); });
    li.addEventListener('mouseleave', function(){ highlight(null); });
  });
  rings.forEach(function(r){
    r.style.transition = 'stroke .18s, opacity .18s';
    r.style.cursor = 'pointer';
    r.addEventListener('mouseenter', function(){ highlight(r.getAttribute('data-ring')); });
    r.addEventListener('mouseleave', function(){ highlight(null); });
  });

  /* ---- phone input: normalize to +380 XX XXX XX XX ---- */
  function formatPhone(value){
    var digits = value.replace(/\D/g,'');
    if(digits.indexOf('380') === 0){ digits = digits.slice(3); }
    // a full +380 number typed or pasted over the prefill repeats the country code
    if(digits.length > 9 && digits.indexOf('380') === 0){ digits = digits.slice(3); }
    // the field is prefilled with +380, so people still type the local 0 (050...)
    if(digits.indexOf('0') === 0){ digits = digits.slice(1); }
    digits = digits.slice(0,9);
    var out = '+380';
    if(digits.length) out += ' ' + digits.slice(0,2);
    if(digits.length > 2) out += ' ' + digits.slice(2,5);
    if(digits.length > 5) out += ' ' + digits.slice(5,7);
    if(digits.length > 7) out += ' ' + digits.slice(7,9);
    return out;
  }
  phone.addEventListener('focus', function(){ if(!phone.value) phone.value = '+380 '; });
  phone.addEventListener('input', function(){ phone.value = formatPhone(phone.value); setError(phone,false); });
  phone.addEventListener('blur', function(){ if(phone.value.replace(/\D/g,'') === '380') phone.value = ''; });

  /* ---- validation ---- */
  function setError(el, on){
    el.setAttribute('aria-invalid', on ? 'true' : 'false');
    var msg = d.querySelector('[data-error-for="' + el.id + '"]');
    if(msg) msg.classList.toggle('is-visible', on);
  }
  var rules = {
    'f-name':  function(v){ return v.trim().length >= 2; },
    'f-city':  function(v){ return v.trim().length >= 2; },
    'f-phone': function(v){ return v.replace(/\D/g,'').length === 12; },
    'f-email': function(v){ return /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(v.trim()); }
  };
  Object.keys(rules).forEach(function(id){
    var el = d.getElementById(id);
    el.addEventListener('blur', function(){ if(el.value) setError(el, !rules[id](el.value)); });
    el.addEventListener('input', function(){ if(el.getAttribute('aria-invalid') === 'true') setError(el,false); });
  });
  consent.addEventListener('change', function(){ if(consent.checked) setError(consent,false); });

  function validate(){
    var first = null;
    Object.keys(rules).forEach(function(id){
      var el = d.getElementById(id), ok = rules[id](el.value);
      setError(el, !ok);
      if(!ok && !first) first = el;
    });
    setError(consent, !consent.checked);
    if(!consent.checked && !first) first = consent;
    return first;
  }

  form.addEventListener('submit', function(e){
    e.preventDefault();

    // silently drop bot submissions caught by the honeypot
    if(d.getElementById('f-hpx').value){ dl({event:'form_honeypot'}); return; }

    var invalid = validate();
    if(invalid){ invalid.focus(); dl({event:'form_error'}); return; }

    var data = {
      name: d.getElementById('f-name').value.trim(),
      city: d.getElementById('f-city').value.trim(),
      phone: phone.value.trim(),
      email: d.getElementById('f-email').value.trim(),
      message: d.getElementById('f-msg').value.trim(),
      consent: true,
      form_name: formName,
      page_url: window.location.href,
      // ad attribution carried over from the landing URL
      utm: (function(){
        var p = new URLSearchParams(window.location.search), o = {};
        ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','gclid'].forEach(function(k){
          if(p.get(k)) o[k] = p.get(k);
        });
        return o;
      })()
    };

    submitBtn.disabled = true;
    submitBtn.textContent = 'Надсилаємо...';

    function done(){
      dl({event:'generate_lead', form_name:formName, lead_city:data.city, value:1, currency:'UAH'});
      formWrap.style.display = 'none';
      success.classList.add('is-visible');
      if(success.scrollIntoView) success.scrollIntoView({behavior:'smooth', block:'center'});
    }
    function fail(){
      submitBtn.disabled = false;
      submitBtn.textContent = 'Отримати прорахунок';
      alert('Не вдалося надіслати заявку. Зателефонуйте, будь ласка: +380 32 245 93 41');
    }

    if(!ENDPOINT){
      console.warn('ENDPOINT is not set — submission is simulated.', data);
      setTimeout(done, 400);
      return;
    }
    fetch(ENDPOINT, {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data)
    }).then(function(r){ r.ok ? done() : fail(); }).catch(fail);
  });
})();
