import { Helmet } from 'react-helmet-async';

const SITE_NAME = 'Мир шахмат';
const SITE_URL = 'https://мир-шахмат.рф';
const DEFAULT_IMAGE = 'https://cdn.poehali.dev/projects/da0c042d-2017-4baf-94fb-5da234e7b163/bucket/5cb279c6-66b4-4693-bc8b-8649fcf4b0a8.png';

interface SeoProps {
  title: string;
  description: string;
  path?: string;
  image?: string;
  noindex?: boolean;
}

export default function Seo({ title, description, path = '/', image = DEFAULT_IMAGE, noindex = false }: SeoProps) {
  const fullTitle = title.includes(SITE_NAME) ? title : `${title} — ${SITE_NAME}`;
  const canonical = `${SITE_URL}${path}`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />
      <meta name="robots" content={noindex ? 'noindex, nofollow' : 'index, follow'} />

      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={image} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
    </Helmet>
  );
}
