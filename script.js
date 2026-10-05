(function () {
  'use strict';

  var TZ = 'Australia/Sydney';
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // Opening hours per weekday (0 = Sunday), in minutes after midnight.
  function hoursFor(day) {
    return { open: day === 0 ? 7 * 60 + 30 : 6 * 60 + 30, close: 15 * 60 };
  }

  /* ---------- Sydney time helpers ---------- */
  function sydneyNow() {
    var parts = {};
    new Intl.DateTimeFormat('en-AU', {
      timeZone: TZ, weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(new Date()).forEach(function (p) { parts[p.type] = p.value; });
    return {
      day: DAYS.indexOf(parts.weekday),
      minutes: (parseInt(parts.hour, 10) % 24) * 60 + parseInt(parts.minute, 10),
      iso: parts.year + '-' + parts.month + '-' + parts.day
    };
  }

  function fmt(mins) {
    var h = Math.floor(mins / 60), m = mins % 60;
    var suffix = h >= 12 ? 'pm' : 'am';
    var h12 = h % 12 || 12;
    return h12 + (m ? ':' + String(m).padStart(2, '0') : '') + suffix;
  }
  function range(s) { return fmt(s.open) + '–' + fmt(s.close); }

  /* ---------- Hero "today" status ---------- */
  function renderStatus() {
    var el = document.getElementById('today-hours');
    if (!el) return;
    var now = sydneyNow();
    var today = hoursFor(now.day);
    var openNow = now.minutes >= today.open && now.minutes < today.close;
    var text = now.minutes >= today.close
      ? 'Closed now · Open tomorrow ' + range(hoursFor((now.day + 1) % 7))
      : 'Open today ' + range(today);

    el.textContent = '';
    var dot = document.createElement('span');
    dot.className = 'dot' + (openNow ? '' : ' dot--closed');
    dot.setAttribute('aria-hidden', 'true');
    el.appendChild(dot);
    el.appendChild(document.createTextNode(text));
    el.title = openNow ? 'Open now' : 'Closed right now';

    // Highlight today's rows in the hours table.
    document.querySelectorAll('.hours tr[data-days]').forEach(function (row) {
      var days = row.getAttribute('data-days').split(',').map(Number);
      row.classList.toggle('is-today', days.indexOf(now.day) !== -1);
    });
  }

  /* ---------- Concept banner ---------- */
  function initBanner() {
    var banner = document.getElementById('concept-banner');
    if (!banner) return;
    try { if (sessionStorage.getItem('ww-banner-dismissed') === '1') banner.hidden = true; } catch (e) {}
    banner.querySelector('button').addEventListener('click', function () {
      banner.hidden = true;
      try { sessionStorage.setItem('ww-banner-dismissed', '1'); } catch (e) {}
      document.querySelector('.brand').focus();
    });
  }

  /* ---------- Mobile nav ---------- */
  function initNav() {
    var toggle = document.querySelector('.nav__toggle');
    var menu = document.getElementById('nav-menu');
    if (!toggle || !menu) return;

    function setOpen(open) {
      toggle.setAttribute('aria-expanded', String(open));
      menu.classList.toggle('is-open', open);
    }
    toggle.addEventListener('click', function () {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });
    menu.addEventListener('click', function (e) {
      if (e.target.closest('a')) setOpen(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.classList.contains('is-open')) { setOpen(false); toggle.focus(); }
    });
    document.addEventListener('click', function (e) {
      if (menu.classList.contains('is-open') && !e.target.closest('.nav')) setOpen(false);
    });
    window.matchMedia('(min-width: 960px)').addEventListener('change', function () { setOpen(false); });
  }

  /* ---------- Forms ---------- */
  function parseISODate(value) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  function prettyDate(d) {
    return d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });
  }
  function markInvalid(input, invalid) {
    if (invalid) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
    return invalid;
  }

  function initCatering(todayIso) {
    var form = document.getElementById('catering-form');
    if (!form) return;
    var err = document.getElementById('cat-error');
    form.elements.date.min = todayIso;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = form.elements.name.value.trim();
      var email = form.elements.email.value.trim();
      var guests = parseInt(form.elements.guests.value, 10);
      var date = parseISODate(form.elements.date.value);
      var problems = [];

      if (markInvalid(form.elements.name, !name)) problems.push('your name');
      if (markInvalid(form.elements.email, !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) problems.push('a valid email');
      if (markInvalid(form.elements.date, !date)) problems.push('the event date');
      if (markInvalid(form.elements.guests, !(guests > 0 && guests <= 1000))) problems.push('the number of guests');

      if (problems.length) {
        err.textContent = 'Please add ' + problems.join(', ') + '.';
        err.hidden = false;
        form.querySelector('[aria-invalid="true"]').focus();
        return;
      }
      err.hidden = true;

      var subject = 'Catering enquiry: ' + prettyDate(date) + ', ' + guests + ' guests';
      var body = [
        'Hi Wooden Whisk team,',
        '',
        'I would like to enquire about catering.',
        '',
        'Name: ' + name,
        'Email: ' + email,
        'Event date: ' + prettyDate(date),
        'Guests: ' + guests,
        '',
        form.elements.message.value.trim() || '(No extra details yet)',
        '',
        'Thanks!'
      ].join('\n');

      window.location.href = 'mailto:sales@woodenwhisk.com.au' +
        '?subject=' + encodeURIComponent(subject) +
        '&body=' + encodeURIComponent(body);
    });
  }

  function initBooking(now) {
    var todayIso = now.iso;
    var form = document.getElementById('booking-form');
    if (!form) return;
    var out = document.getElementById('booking-result');
    var dateInput = form.elements.date;
    dateInput.min = todayIso;

    // Default to the coming Saturday for weekend brunch.
    var d = parseISODate(todayIso);
    do { d.setDate(d.getDate() + 1); } while (d.getDay() !== 6);
    dateInput.value = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var date = parseISODate(dateInput.value);
      out.className = 'booking__result';

      if (!date || dateInput.value < todayIso) {
        markInvalid(dateInput, true);
        out.classList.add('is-error');
        out.textContent = 'Please choose a date from today onwards.';
        return;
      }
      var slot = form.elements.time.value.split(':');
      if (dateInput.value === todayIso && +slot[0] * 60 + +slot[1] <= sydneyNow().minutes) {
        markInvalid(dateInput, false);
        out.classList.add('is-error');
        out.textContent = 'That time has already passed today. Please pick a later time or another day.';
        return;
      }
      markInvalid(dateInput, false);
      var time = form.elements.time.options[form.elements.time.selectedIndex].text;
      var guests = form.elements.guests.value;
      out.classList.add('is-ok');
      out.textContent = 'Demo only: ' + prettyDate(date) + ' at ' + time + ' for ' + guests +
        (guests === '1' ? ' guest' : ' guests') + '. With a live booking system this table would be confirmed instantly.';
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var now = sydneyNow();
    renderStatus();
    setInterval(renderStatus, 60 * 1000);
    initBanner();
    initNav();
    initCatering(now.iso);
    initBooking(now);
  });
})();
