// Smooth scrolling for anchor links
document.addEventListener('DOMContentLoaded', function() {
    // Add smooth scrolling behavior via CSS
    if (!document.getElementById('smooth-scroll-style')) {
        const style = document.createElement('style');
        style.id = 'smooth-scroll-style';
        style.textContent = 'html { scroll-behavior: smooth; }';
        document.head.appendChild(style);
    }
    
    // Handle anchor link clicks with offset for fixed headers
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href !== '#' && href.length > 1) {
                const targetId = href.substring(1);
                const targetElement = document.getElementById(targetId);
                
                if (targetElement) {
                    e.preventDefault();
                    // Calculate offset based on header height
                    const header = document.querySelector('header, .header, .dashboard-header, .top-header');
                    const headerHeight = header ? header.offsetHeight : 80;
                    const elementPosition = targetElement.getBoundingClientRect().top;
                    const offsetPosition = elementPosition + window.pageYOffset - headerHeight;

                    window.scrollTo({
                        top: offsetPosition,
                        behavior: 'smooth'
                    });
                }
            }
        });
    });

    // Mobile menu toggle (site1 header)
    const toggle = document.getElementById('menuToggle');
    const nav = document.getElementById('primaryNav');
    if (toggle && nav) {
        const setExpanded = (expanded) => {
            toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        };

        setExpanded(false);

        toggle.addEventListener('click', () => {
            nav.classList.toggle('active');
            setExpanded(nav.classList.contains('active'));
        });

        // Close menu when a nav link is clicked (mobile UX).
        nav.addEventListener('click', (e) => {
            const target = e.target;
            if (!(target instanceof Element)) return;
            if (target.closest('a')) {
                nav.classList.remove('active');
                setExpanded(false);
            }
        });

        // Close menu on outside click (mobile UX).
        document.addEventListener('click', (e) => {
            const target = e.target;
            if (!(target instanceof Element)) return;
            if (target === toggle || toggle.contains(target)) return;
            if (target === nav || nav.contains(target)) return;
            if (nav.classList.contains('active')) {
                nav.classList.remove('active');
                setExpanded(false);
            }
        });
    }
});

