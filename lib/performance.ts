// Performance monitoring untuk Web Vitals
export function reportWebVitals(metric: any) {
  if (typeof window !== 'undefined') {
    // Log ke console di development
    if (process.env.NODE_ENV === 'development') {
      console.log(`${metric.name}:`, metric.value);
    }

    // Kirim ke analytics service (opsional)
    // Contoh: sendToAnalytics(metric);
  }
}

// Lazy load non-critical resources
export function lazyLoadResource(src: string, type: 'script' | 'link' = 'script') {
  if (typeof window === 'undefined') return;

  if (type === 'script') {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    document.body.appendChild(script);
  } else if (type === 'link') {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = src;
    document.head.appendChild(link);
  }
}

// Prefetch DNS untuk external resources
export function prefetchDns(domain: string) {
  if (typeof window === 'undefined') return;

  const link = document.createElement('link');
  link.rel = 'dns-prefetch';
  link.href = `//${domain}`;
  document.head.appendChild(link);
}

// Preconnect untuk critical external resources
export function preconnect(url: string) {
  if (typeof window === 'undefined') return;

  const link = document.createElement('link');
  link.rel = 'preconnect';
  link.href = url;
  document.head.appendChild(link);
}
