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
});

