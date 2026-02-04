let currentLang = localStorage.getItem('lang') || 'en';

function initTranslations() {
    document.addEventListener('DOMContentLoaded', () => {
        applyLanguage(currentLang);
        
        const langToggle = document.getElementById('langToggle');
        if (langToggle) {
            langToggle.textContent = currentLang === 'en' ? 'ES' : 'EN';
            langToggle.addEventListener('click', () => {
                currentLang = currentLang === 'en' ? 'es' : 'en';
                localStorage.setItem('lang', currentLang);
                applyLanguage(currentLang);
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


