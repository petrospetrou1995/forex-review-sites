let currentLang = localStorage.getItem('lang') || 'en';

let relativeTimeTimer;

function formatRelativeTimeFromNow(isoString, lang) {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    if (!Number.isFinite(diffMs)) return '';

    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 45) return lang === 'es' ? 'Ahora' : 'Just now';

    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) {
        return lang === 'es' ? `Hace ${diffMin} min` : `${diffMin} min ago`;
    }

    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) {
        const unit = lang === 'es' ? (diffHr === 1 ? 'hora' : 'horas') : (diffHr === 1 ? 'hour' : 'hours');
        return lang === 'es' ? `Hace ${diffHr} ${unit}` : `${diffHr} ${unit} ago`;
    }

    const diffDay = Math.floor(diffHr / 24);
    const unit = lang === 'es' ? (diffDay === 1 ? 'día' : 'días') : (diffDay === 1 ? 'day' : 'days');
    return lang === 'es' ? `Hace ${diffDay} ${unit}` : `${diffDay} ${unit} ago`;
}

function updateRelativeTimes() {
    const lang = currentLang || document.documentElement.lang || 'en';
    const nodes = document.querySelectorAll('time[data-relative-time]');
    if (!nodes.length) return;

    nodes.forEach((el) => {
        const dt = el.getAttribute('datetime');
        if (!dt) return;
        const label = formatRelativeTimeFromNow(dt, lang);
        if (!label) return;

        const showAbsolute = el.getAttribute('data-show-absolute') === 'true';
        if (!showAbsolute) {
            el.textContent = label;
            return;
        }

        const abs = dt.includes('T') ? dt.split('T')[0] : dt;
        el.textContent = `${label} · ${abs}`;
    });
}

function initRelativeTimes() {
    updateRelativeTimes();
    if (relativeTimeTimer) window.clearInterval(relativeTimeTimer);
    relativeTimeTimer = window.setInterval(updateRelativeTimes, 60000);
}

function setDailyToggleLabel(btn, expanded) {
    const en = expanded ? 'Show less' : 'Show more daily briefs';
    const es = expanded ? 'Ver menos' : 'Ver más resúmenes diarios';
    btn.setAttribute('data-en', en);
    btn.setAttribute('data-es', es);
    btn.textContent = currentLang === 'es' ? es : en;
    btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
}

function initDailyBriefsToggle() {
    const newsSection = document.getElementById('news');
    if (!newsSection) return;
    const grid = newsSection.querySelector('.grid');
    if (!grid) return;

    const btn = grid.querySelector('button[data-daily-toggle]');
    if (!btn) return;

    const items = Array.from(grid.querySelectorAll('[data-daily-news="true"]'));
    const DEFAULT_VISIBLE = 3;
    const hasOverflow = items.length > DEFAULT_VISIBLE;

    btn.classList.toggle('is-hidden', !hasOverflow);
    if (!hasOverflow) return;

    const apply = (expanded) => {
        items.forEach((el, idx) => {
            if (idx < DEFAULT_VISIBLE) {
                el.classList.remove('is-hidden');
                return;
            }
            el.classList.toggle('is-hidden', !expanded);
        });
        grid.setAttribute('data-daily-expanded', expanded ? 'true' : 'false');
        setDailyToggleLabel(btn, expanded);
    };

    const expanded = grid.getAttribute('data-daily-expanded') === 'true';
    apply(expanded);

    if (btn.getAttribute('data-bound') === 'true') return;
    btn.setAttribute('data-bound', 'true');
    btn.addEventListener('click', () => {
        const isExpandedNow = grid.getAttribute('data-daily-expanded') === 'true';
        apply(!isExpandedNow);
    });
}

function initTranslations() {
    document.addEventListener('DOMContentLoaded', () => {
        applyLanguage(currentLang);
        initDailyBriefsToggle();
        initRelativeTimes();
        
        const langToggle = document.getElementById('langToggle');
        if (langToggle) {
            langToggle.textContent = currentLang === 'en' ? 'ES' : 'EN';
            langToggle.addEventListener('click', () => {
                currentLang = currentLang === 'en' ? 'es' : 'en';
                localStorage.setItem('lang', currentLang);
                applyLanguage(currentLang);
                initDailyBriefsToggle();
                updateRelativeTimes();
                langToggle.textContent = currentLang === 'en' ? 'ES' : 'EN';
            });
        }
    });
}

function applyLanguage(lang) {
    document.querySelectorAll('[data-en]').forEach(element => {
        const text = element.getAttribute(`data-${lang}`);
        if (text) {
            if (element.tagName === 'INPUT' && element.hasAttribute('data-en-placeholder')) {
                element.placeholder = element.getAttribute(`data-${lang}-placeholder`);
            } else {
                element.textContent = text;
            }
        }
    });
    
    document.documentElement.lang = lang;
}

initTranslations();


