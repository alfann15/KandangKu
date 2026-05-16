export function StructuredData() {
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'KandangKu',
    url: 'https://kandangku.alfan-dev.online',
    logo: 'https://kandangku.alfan-dev.online/logo.png',
    description: 'Aplikasi Point of Sale dan manajemen inventaris khusus untuk penjualan ayam hidup',
    sameAs: [],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'Customer Support',
      availableLanguage: ['id', 'en'],
    },
  };

  const softwareSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'KandangKu',
    description: 'Aplikasi Point of Sale dan manajemen inventaris untuk penjualan ayam hidup',
    url: 'https://kandangku.alfan-dev.online',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'IDR',
    },

  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
      />
    </>
  );
}
