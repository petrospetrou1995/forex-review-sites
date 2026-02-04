// Translation system
let currentLang = localStorage.getItem('lang') || 'en';

const translations = {
    en: {},
    es: {}
};

// Initialize translations
function initTranslations() {
    document.addEventListener('DOMContentLoaded', () => {
        applyLanguage(currentLang);
        initReviewCounts();
        initReviewViewMore();
        
        // Language toggle button
        const langToggle = document.getElementById('langToggle');
        if (langToggle) {
            langToggle.textContent = currentLang === 'en' ? 'ES' : 'EN';
            langToggle.addEventListener('click', () => {
                currentLang = currentLang === 'en' ? 'es' : 'en';
                localStorage.setItem('lang', currentLang);
                applyLanguage(currentLang);
                initReviewCounts();
                syncReviewViewMoreButtons();
                langToggle.textContent = currentLang === 'en' ? 'ES' : 'EN';
            });
        }
    });
}

function applyLanguage(lang) {
    // Update all elements with data-en and data-es attributes
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
    
    // Update HTML lang attribute
    document.documentElement.lang = lang;
}

initTranslations();

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

    reviewsSection.querySelectorAll('.card-panel').forEach((panel) => {
        const reviews = panel.querySelectorAll('.review-card');
        if (!reviews.length) return;
        const countEl = panel.querySelector('.review-count');
        if (!countEl) return;

        const n = reviews.length;
        const en = formatReviewCount(n, 'en');
        const es = formatReviewCount(n, 'es');
        countEl.setAttribute('data-en', en);
        countEl.setAttribute('data-es', es);
        countEl.textContent = currentLang === 'es' ? es : en;
    });
}

function setViewMoreButtonState(button, expanded) {
    const en = expanded ? 'View less' : 'View more reviews';
    const es = expanded ? 'Ver menos' : 'Ver más reseñas';
    button.setAttribute('data-en', en);
    button.setAttribute('data-es', es);
    button.textContent = currentLang === 'es' ? es : en;
    button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
}

function syncReviewViewMoreButtons() {
    document.querySelectorAll('button[data-review-toggle]').forEach((btn) => {
        const panel = btn.closest('.card-panel');
        if (!panel) return;
        const expanded = panel.getAttribute('data-reviews-expanded') === 'true';
        setViewMoreButtonState(btn, expanded);
    });
}

function initReviewViewMore() {
    const reviewsSection = document.getElementById('reviews');
    if (!reviewsSection) return;

    const DEFAULT_VISIBLE = 2;

    reviewsSection.querySelectorAll('.card-panel').forEach((panel) => {
        const reviews = Array.from(panel.querySelectorAll('.review-card'));
        if (reviews.length <= DEFAULT_VISIBLE) {
            const btn = panel.querySelector('button[data-review-toggle]');
            btn?.classList.add('is-hidden');
            return;
        }

        // If HTML already hides some items, preserve that state.
        const expanded = panel.getAttribute('data-reviews-expanded') === 'true';
        if (!expanded) {
            reviews.forEach((el, idx) => {
                if (idx >= DEFAULT_VISIBLE) el.classList.add('is-hidden');
            });
        }

        const btn = panel.querySelector('button[data-review-toggle]');
        if (!btn) return;
        setViewMoreButtonState(btn, expanded);

        if (btn.getAttribute('data-bound') === 'true') return;
        btn.setAttribute('data-bound', 'true');

        btn.addEventListener('click', () => {
            const isExpandedNow = panel.getAttribute('data-reviews-expanded') === 'true';
            const nextExpanded = !isExpandedNow;

            panel.setAttribute('data-reviews-expanded', nextExpanded ? 'true' : 'false');
            reviews.forEach((el, idx) => {
                if (idx < DEFAULT_VISIBLE) return;
                el.classList.toggle('is-hidden', !nextExpanded);
            });
            setViewMoreButtonState(btn, nextExpanded);
        });
    });
}


