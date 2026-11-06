/* Ros Reborn V2 Creator Program: application page
   Validation, error messages, and submission states.
   Loaded only by apply.html. */
(function () {
  'use strict';

  // Set this to your backend route when it exists, for example:
  //   var APPLY_ENDPOINT = '/apply';
  // While it is empty, nothing is sent and no "saved" message is shown.
  // With Laravel, the route also needs the CSRF token (the _token field).
  var APPLY_ENDPOINT = '';

  var form = document.getElementById('apply-form');
  if (!form) return;

  var statusEl = document.getElementById('form-status');
  var submitBtn = document.getElementById('submit-btn');
  var platformSel = document.getElementById('platform');
  var otherWrap = document.getElementById('other-wrap');
  var submitting = false;

  function isUrl(value) {
    try {
      var u = new URL(value);
      return (u.protocol === 'https:' || u.protocol === 'http:') && u.hostname.indexOf('.') > 0;
    } catch (e) {
      return false;
    }
  }

  function isWhole(value) {
    return /^\d+$/.test(value);
  }

  function val(id) {
    return document.getElementById(id).value.trim();
  }

  // Each rule returns an error message, or '' when the field is valid.
  var RULES = {
    'ign': function (el) {
      var v = el.value.trim();
      if (!v) return 'Enter your in-game name.';
      if (v.length < 2) return 'In-game name must be at least 2 characters.';
      if (v.length > 32) return 'In-game name must be 32 characters or fewer.';
      return '';
    },
    'discord': function (el) {
      var v = el.value.trim();
      if (!v) return 'Enter your Discord username.';
      if (v.length < 2) return 'Discord username must be at least 2 characters.';
      return '';
    },
    'platform': function (el) {
      return el.value ? '' : 'Choose the platform you create content on.';
    },
    'platform-other': function (el) {
      if (otherWrap.hidden) return '';
      return el.value.trim() ? '' : 'Tell us which platform you use.';
    },
    'channel': function (el) {
      var v = el.value.trim();
      if (!v) return 'Enter the link to your channel.';
      if (!isUrl(v)) return 'Enter a full link starting with https://';
      return '';
    },
    'followers': function (el) {
      var v = el.value.trim();
      if (!v) return 'Enter your follower count. The minimum is 10,000.';
      if (!isWhole(v) || Number(v) < 10000) return 'You need at least 10,000 followers to apply.';
      return '';
    },
    'views': function (el) {
      var v = el.value.trim();
      if (!v) return '';
      if (/^-/.test(v)) return 'Average video views cannot be negative.';
      if (!isWhole(v)) return 'Enter a whole number, such as 2500.';
      return '';
    },
    'best-content': function (el) {
      var v = el.value.trim();
      if (!v) return '';
      return isUrl(v) ? '' : 'Enter a full link starting with https://, or leave this empty.';
    },
    'agree': function (el) {
      return el.checked ? '' : 'You must agree to the guidelines before applying.';
    }
  };

  var FIELD_IDS = Object.keys(RULES);

  function setError(el, message) {
    var errorEl = document.getElementById(el.id + '-error');
    if (errorEl) errorEl.textContent = message;
    el.setAttribute('aria-invalid', message ? 'true' : 'false');
    var box = el.closest('.field, .agree-row');
    if (box) box.classList.toggle('has-error', !!message);
  }

  function check(id) {
    var el = document.getElementById(id);
    if (!el || el.closest('[hidden]')) return true;
    var message = RULES[id](el);
    setError(el, message);
    return message === '';
  }

  function clearAll() {
    FIELD_IDS.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) setError(el, '');
    });
  }

  function setStatus(type, message) {
    statusEl.className = 'form-status' + (type ? ' is-' + type : '');
    statusEl.textContent = message;
  }

  function setBusy(busy) {
    submitBtn.disabled = busy;
    submitBtn.classList.toggle('is-loading', busy);
  }

  function payload() {
    var data = {
      ign: val('ign'),
      discord: val('discord'),
      platform: val('platform'),
      channel: val('channel'),
      followers: val('followers'),
      views: val('views'),
      best_content: val('best-content'),
      additional_notes: val('additional-notes'),    
      agree: document.getElementById('agree').checked
    };
    if (data.platform === 'other') data.platform_other = val('platform-other');
    return data;
  }

  // Validate as the user leaves a field, and clear the message once it's fixed
  FIELD_IDS.forEach(function (id) {
    var el = document.getElementById(id);
    if (!el) return;
    var isChoice = el.tagName === 'SELECT' || el.type === 'checkbox';
    el.addEventListener(isChoice ? 'change' : 'blur', function () { check(id); });
    el.addEventListener('input', function () {
      if (el.getAttribute('aria-invalid') === 'true') check(id);
    });
  });

  // Show or hide the "Platform name" field
  if (platformSel && otherWrap) {
    platformSel.addEventListener('change', function () {
      otherWrap.hidden = platformSel.value !== 'other';
      if (otherWrap.hidden) {
        var other = document.getElementById('platform-other');
        other.value = '';
        setError(other, '');
      }
    });
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    if (submitting) return;

    var firstInvalid = null;
    FIELD_IDS.forEach(function (id) {
      if (!check(id) && !firstInvalid) firstInvalid = document.getElementById(id);
    });

    if (firstInvalid) {
      setStatus('error', 'Please fix the highlighted fields.');
      firstInvalid.focus();
      return;
    }

    // No backend yet: be honest, and send nothing
    if (!APPLY_ENDPOINT) {
      setStatus('info', 'Your details look good, but online submission is not connected yet, so nothing has been sent. Please contact the Ros Reborn team on Discord to apply for now.');
      return;
    }

    submitting = true;
    setBusy(true);
    setStatus('info', 'Sending your application...');

    fetch(APPLY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload())
    })
      .then(function (res) {
        if (!res.ok) throw new Error('Server responded with ' + res.status);
        // Confirmed success: stay disabled so the same application can't be sent twice
        submitBtn.classList.remove('is-loading');
        setStatus('success', 'Application received. The Ros Reborn team will review it and get back to you.');
        form.reset();
        otherWrap.hidden = true;
        clearAll();
      })
      .catch(function () {
        submitting = false;
        setBusy(false);
        setStatus('error', 'We could not send your application. Please check your connection and try again.');
      });
  });
})();