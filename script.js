(function () {
  'use strict';

  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('site-nav');

  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    nav.querySelectorAll('a').forEach(function(link) {
      link.addEventListener('click', function() {
        nav.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  var revealItems = document.querySelectorAll('.reveal');

  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -50px 0px' });
    
    revealItems.forEach(function (el) { observer.observe(el); });
  } else {
    revealItems.forEach(function (el) { el.classList.add('is-visible'); });
  }

  var sections = document.querySelectorAll('section[id]');
  var navLinks = document.querySelectorAll('.nav-links a');

  if (sections.length > 0 && navLinks.length > 0) {
    window.addEventListener('scroll', function () {
      var scrollY = window.pageYOffset;
      var currentSection = '';

      sections.forEach(function (section) {
        var sectionTop = section.offsetTop - 120; 
        var sectionHeight = section.offsetHeight;

        if (scrollY >= sectionTop && scrollY < sectionTop + sectionHeight) {
          currentSection = section.getAttribute('id');
        }
      });

      navLinks.forEach(function (link) {
        link.classList.remove('nav-active');
        if (link.getAttribute('href') === '#' + currentSection) {
          link.classList.add('nav-active');
        }
      });
    });
  }

  var form = document.getElementById('apply-form');
  if (!form) return;

  var status = document.getElementById('form-status');
  var submitBtn = document.getElementById('submit-btn');

  function isValidUrl(value) {
    try {
      var u = new URL(value);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch (e) {
      return false;
    }
  }

  var rules = {
    ign: function (el) {
      var v = el.value.trim();
      if (!v) return 'Enter your in-game name.';
      if (v.length < 2) return 'In-game name must be at least 2 characters.';
      return '';
    },
    discord: function (el) {
      var v = el.value.trim();
      if (!v) return 'Enter your Discord username.';
      return '';
    },
    platform: function (el) {
      return el.value ? '' : 'Choose the platform you create content on.';
    },
    channel: function (el) {
      var v = el.value.trim();
      if (!v) return 'Enter the URL of your channel.';
      if (!isValidUrl(v)) return 'Enter a full link starting with https://';
      return '';
    },
    best_content: function (el) {
      var v = el.value.trim();
      if (v && !isValidUrl(v)) return 'Enter a full link starting with https://, or leave this empty.';
      return '';
    },
    followers: function (el) {
      var v = el.value.trim();
      if (!v) return 'Enter your follower count. The minimum is 10,000.';
      if (Number(v) < 10000) return 'You need at least 10,000 followers to apply.';
      return '';
    },
    platform_other: function (el) {
      if (el.closest('.field').hidden) return '';
      return el.value.trim() ? '' : 'Tell us which platform you use.';
    },
    agree: function (el) {
      return el.checked ? '' : 'You must agree to the guidelines before applying.';
    }
  };

  function errorFor(el) {
    return document.getElementById(el.id + '-error') || document.getElementById('agree-error');
  }

  function setError(el, message) {
    var errorEl = errorFor(el);
    if (!errorEl) return;
    errorEl.textContent = message;
    if (message) {
      el.setAttribute('aria-invalid', 'true');
    } else {
      el.removeAttribute('aria-invalid');
    }
  }

  function validateField(el) {
    var rule = rules[el.name];
    if (!rule) return true;
    var message = rule(el);
    setError(el, message);
    return message === '';
  }

  var platformSelect = document.getElementById('platform');
  var otherWrap = document.getElementById('other-wrap');
  if (platformSelect && otherWrap) {
    platformSelect.addEventListener('change', function () {
      otherWrap.hidden = platformSelect.value !== 'other';
      if (otherWrap.hidden) {
        document.getElementById('platform-other').value = '';
        setError(document.getElementById('platform-other'), '');
      }
    });
  }

  form.querySelectorAll('input, select').forEach(function (el) {
    el.addEventListener('blur', function () { validateField(el); });
    el.addEventListener('input', function () {
      if (el.getAttribute('aria-invalid') === 'true') validateField(el);
    });
    el.addEventListener('change', function () { validateField(el); });
  });

  form.addEventListener('submit', function (event) {
    var firstInvalid = null;
    var allValid = true;

    form.querySelectorAll('input, select').forEach(function (el) {
      if (!validateField(el)) {
        allValid = false;
        if (!firstInvalid) firstInvalid = el;
      }
    });

    if (!allValid) {
      event.preventDefault();
      status.textContent = 'Please fix the highlighted fields.';
      firstInvalid.focus();
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.add('is-loading');
      submitBtn.querySelector('.btn-label').textContent = 'SUBMITTING';
    }
    status.textContent = '';
  });
})();

(function () {
  'use strict';

  var items = document.querySelectorAll('.faq details');
  if (!items.length) return;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var DURATION = 300;
  var EASING = 'cubic-bezier(0.2, 0.7, 0.3, 1)';

  items.forEach(function (d, i) {
    var summary = d.querySelector('summary');
    var answer = d.querySelector('p');
    if (!summary || !answer) return;

    var panel = document.createElement('div');
    panel.className = 'faq-panel';
    panel.id = 'faq-answer-' + (i + 1);
    panel.setAttribute('role', 'region');
    answer.parentNode.insertBefore(panel, answer);
    panel.appendChild(answer);

    summary.setAttribute('aria-controls', panel.id);
    summary.setAttribute('aria-expanded', d.open ? 'true' : 'false');

    var anim = null;
    var closing = false;

    function open() {
      if (anim) anim.cancel();
      closing = false;
      d.open = true;
      summary.setAttribute('aria-expanded', 'true');
      if (reduceMotion) return;

      var target = panel.scrollHeight;
      anim = panel.animate(
        [
          { height: '0px', opacity: 0 },
          { height: target + 'px', opacity: 1 }
        ],
        { duration: DURATION, easing: EASING }
      );
      anim.onfinish = function () { anim = null; };
    }

    function close() {
      if (anim) anim.cancel();
      closing = true;
      summary.setAttribute('aria-expanded', 'false');
      if (reduceMotion) {
        d.open = false;
        closing = false;
        return;
      }

      var start = panel.offsetHeight;
      anim = panel.animate(
        [
          { height: start + 'px', opacity: 1 },
          { height: '0px', opacity: 0 }
        ],
        { duration: DURATION, easing: EASING }
      );
      anim.onfinish = function () {
        anim = null;
        closing = false;
        d.open = false;
      };
    }

    summary.addEventListener('click', function (event) {
      event.preventDefault();
      if (closing || !d.open) {
        open();
      } else {
        close();
      }
    });
  });
})();