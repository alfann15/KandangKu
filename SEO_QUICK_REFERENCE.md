# 🎯 SEO Quick Reference Guide

## Immediate Actions (Sebelum Deploy)

### 1. Verify Files Exist
```bash
# Check robots.txt
ls -la public/robots.txt

# Check manifest.json
ls -la public/manifest.json

# Check sitemap generation
npm run build  # Should generate sitemap.xml
```

### 2. Test Locally
```bash
npm run dev

# Visit these URLs:
# - http://localhost:3000/robots.txt
# - http://localhost:3000/sitemap.xml
# - http://localhost:3000/manifest.json
```

### 3. Verify Metadata
```bash
# Open DevTools (F12)
# Check <head> section untuk:
# - <title>
# - <meta name="description">
# - <meta property="og:*">
# - <script type="application/ld+json">
```

## After Deployment

### 1. Google Search Console (Priority: HIGH)
```
1. Go to: https://search.google.com/search-console
2. Add property: https://kandangku.alfan-dev.online
3. Verify ownership (DNS/HTML file/Google Analytics)
4. Submit sitemap: https://kandangku.alfan-dev.online/sitemap.xml
5. Request indexing for homepage
6. Monitor: Coverage, Performance, Enhancements
```

### 2. Bing Webmaster Tools (Priority: MEDIUM)
```
1. Go to: https://www.bing.com/webmasters
2. Add site: https://kandangku.alfan-dev.online
3. Verify ownership
4. Submit sitemap
5. Monitor indexing status
```

### 3. Google Analytics 4 (Priority: HIGH)
```
1. Create GA4 property
2. Add tracking code to layout.tsx
3. Set up conversion goals
4. Monitor: Users, Sessions, Bounce Rate
```

### 4. Monitor Core Web Vitals
```
# Use PageSpeed Insights
https://pagespeed.web.dev/?url=https://kandangku.alfan-dev.online

# Target scores:
- Performance: 90+
- Accessibility: 90+
- Best Practices: 90+
- SEO: 90+
```

## Common SEO Tasks

### Add New Page with SEO
```typescript
// app/new-page/page.tsx
import { generatePageMetadata } from '@/lib/seo';

export const metadata = generatePageMetadata(
  'Page Title',
  'Page description',
  '/new-page'
);

export default function NewPage() {
  return (
    <main>
      <h1>Page Title</h1>
      {/* content */}
    </main>
  );
}
```

### Add Structured Data
```typescript
// Use StructuredData component
import { StructuredData } from '@/components/structured-data';

export default function Page() {
  return (
    <>
      <StructuredData />
      {/* page content */}
    </>
  );
}
```

### Optimize Images
```typescript
// Use OptimizedImage component
import { OptimizedImage } from '@/components/optimized-image';

export default function Page() {
  return (
    <OptimizedImage
      src="/image.png"
      alt="Description"
      width={400}
      height={300}
      priority={false}  // Set true for above-the-fold images
    />
  );
}
```

## SEO Monitoring Dashboard

### Weekly Checklist
- [ ] Check Google Search Console for errors
- [ ] Monitor Core Web Vitals
- [ ] Check keyword rankings
- [ ] Review organic traffic in GA4
- [ ] Check for crawl errors

### Monthly Checklist
- [ ] Analyze top performing pages
- [ ] Review search queries
- [ ] Check backlinks
- [ ] Audit internal links
- [ ] Update content if needed

### Quarterly Checklist
- [ ] Full SEO audit
- [ ] Competitor analysis
- [ ] Update SEO strategy
- [ ] Review and update metadata
- [ ] Check for broken links

## Troubleshooting

### Pages Not Indexed
```
1. Check robots.txt - ensure page is not blocked
2. Check sitemap.xml - ensure page is included
3. Check Search Console - request indexing
4. Check for noindex meta tag
5. Wait 1-2 weeks for re-crawl
```

### Low Rankings
```
1. Check keyword relevance
2. Improve content quality
3. Add internal links
4. Improve page speed
5. Get backlinks
6. Check for technical issues
```

### Poor Core Web Vitals
```
1. Optimize images (use OptimizedImage component)
2. Reduce JavaScript
3. Improve server response time
4. Use caching
5. Minimize layout shifts
```

## Useful Commands

```bash
# Build and test
npm run build
npm run start

# Check for TypeScript errors
npm run lint

# Generate Prisma client
npm run db:generate

# View Prisma Studio
npm run prisma:studio
```

## Important URLs

```
Production:
- Homepage: https://kandangku.alfan-dev.online
- Robots: https://kandangku.alfan-dev.online/robots.txt
- Sitemap: https://kandangku.alfan-dev.online/sitemap.xml
- Manifest: https://kandangku.alfan-dev.online/manifest.json

Tools:
- Google Search Console: https://search.google.com/search-console
- Google Analytics: https://analytics.google.com
- PageSpeed Insights: https://pagespeed.web.dev
- Schema Validator: https://validator.schema.org
- Bing Webmaster: https://www.bing.com/webmasters
```

## Key Metrics to Track

| Metric | Target | Tool |
|--------|--------|------|
| LCP (Largest Contentful Paint) | < 2.5s | PageSpeed Insights |
| FID (First Input Delay) | < 100ms | PageSpeed Insights |
| CLS (Cumulative Layout Shift) | < 0.1 | PageSpeed Insights |
| Organic Traffic | ↑ | Google Analytics |
| Keyword Rankings | ↑ | SEMrush/Ahrefs |
| Click-Through Rate | ↑ | Search Console |
| Bounce Rate | ↓ | Google Analytics |
| Pages Indexed | ↑ | Search Console |

## SEO Best Practices

✅ DO:
- Use descriptive titles (50-60 chars)
- Write compelling meta descriptions (150-160 chars)
- Use semantic HTML
- Optimize images
- Create quality content
- Build internal links
- Mobile-first design
- Fast page speed
- Use structured data
- Monitor analytics

❌ DON'T:
- Keyword stuffing
- Duplicate content
- Broken links
- Poor mobile experience
- Slow page speed
- Hidden text
- Cloaking
- Buying links
- Ignoring analytics
- Neglecting security

---

**Last Updated**: 2026-05-15
**Status**: ✅ Ready for Production
