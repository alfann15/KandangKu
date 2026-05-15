import { Metadata } from 'next';

export function generatePageMetadata(
  title: string,
  description: string,
  path: string = '/'
): Metadata {
  const url = `https://kandangku.app${path}`;

  return {
    title: `${title} | KandangKu`,
    description,
    openGraph: {
      title,
      description,
      url,
      type: 'website',
      siteName: 'KandangKu',
      locale: 'id_ID',
      images: [
        {
          url: 'https://kandangku.app/og-image.png',
          width: 1200,
          height: 630,
          alt: 'KandangKu',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['https://kandangku.app/og-image.png'],
    },
    alternates: {
      canonical: url,
    },
  };
}

export const SEO_CONFIG = {
  baseUrl: 'https://kandangku.alfan-dev.online',
  siteName: 'KandangKu',
  description: 'Aplikasi Point of Sale dan manajemen inventaris khusus untuk penjualan ayam hidup',
  locale: 'id_ID',
  ogImage: 'https://kandangku.alfan-dev.online/og-image.png',
};
