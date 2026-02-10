let currentLang = localStorage.getItem('lang') || 'en';

function initTranslations() {
    document.addEventListener('DOMContentLoaded', () => {
        applyLanguage(currentLang);
        initRelativeTimes();
        
        const langToggle = document.getElementById('langToggle');
        if (langToggle) {
            langToggle.textContent = currentLang === 'en' ? 'ES' : 'EN';
            langToggle.addEventListener('click', () => {
                currentLang = currentLang === 'en' ? 'es' : 'en';
                localStorage.setItem('lang', currentLang);
                applyLanguage(currentLang);
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

function formatRelativeTimeFromNow(date, lang) {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    if (!Number.isFinite(diffMs)) return '';

    const diffMinutes = Math.max(0, Math.round(diffMs / 60000));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 60) {
        if (lang === 'es') return `hace ${diffMinutes} min`;
        return `${diffMinutes} min ago`;
    }
    if (diffHours < 24) {
        if (lang === 'es') return `hace ${diffHours} h`;
        return `${diffHours} hours ago`;
    }
    if (diffDays < 7) {
        if (lang === 'es') return `hace ${diffDays} días`;
        return `${diffDays} days ago`;
    }
    const diffWeeks = Math.floor(diffDays / 7);
    if (diffWeeks < 5) {
        if (lang === 'es') return `hace ${diffWeeks} semana${diffWeeks === 1 ? '' : 's'}`;
        return `${diffWeeks} week${diffWeeks === 1 ? '' : 's'} ago`;
    }
    const diffMonths = Math.floor(diffDays / 30);
    if (lang === 'es') return `hace ${diffMonths} mes${diffMonths === 1 ? '' : 'es'}`;
    return `${diffMonths} month${diffMonths === 1 ? '' : 's'} ago`;
}

function updateRelativeTimes() {
    const lang = currentLang || 'en';
    document.querySelectorAll('time[data-relative-time="true"]').forEach((el) => {
        const dt = el.getAttribute('datetime');
        if (!dt) return;
        const date = new Date(dt);
        if (Number.isNaN(date.getTime())) return;
        const formatted = formatRelativeTimeFromNow(date, lang);
        if (formatted) el.textContent = formatted;
    });
}

function initRelativeTimes() {
    updateRelativeTimes();
    window.setInterval(updateRelativeTimes, 60 * 1000);
}

function formatReviewCount(count, lang) {
    const n = Number.isFinite(count) ? count : 0;
    if (lang === 'es') {
        return `(${n} ${n === 1 ? 'reseña' : 'reseñas'})`;
    }
    return `(${n} ${n === 1 ? 'review' : 'reviews'})`;
}

function initReviewCounts() {
    const reviewsSection = document.getElementById('reviews');
    if (!reviewsSection) return;

    reviewsSection.querySelectorAll('.review-block').forEach((block) => {
        const items = block.querySelectorAll('.review-item');
        if (!items.length) return;
        const countEl = block.querySelector('.review-count');
        if (!countEl) return;

        const n = items.length;
        const en = formatReviewCount(n, 'en');
        const es = formatReviewCount(n, 'es');
        countEl.setAttribute('data-en', en);
        countEl.setAttribute('data-es', es);
        countEl.textContent = currentLang === 'es' ? es : en;
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initReviewCounts();
    const langToggle = document.getElementById('langToggle');
    langToggle?.addEventListener('click', () => setTimeout(initReviewCounts, 0));
});


