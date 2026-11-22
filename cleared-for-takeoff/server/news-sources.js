'use strict';
/* News sources for the ticker. Add, remove or disable sources here.
   (Or point NEWS_SOURCES_FILE at a JSON file with the same fields to override this list.)

   Fields
     id        short unique id
     name      publisher name shown in the ticker (nameAr for Arabic items)
     tier      'uae' (UAE government and official), 'regional' or 'global'
     scope     'tech'    a technology publication: an item is relevant if its title or summary matches a topic
               'general' a general news outlet: the title itself must match a topic (stricter)
     lang      'en' or 'ar'
     site      the publisher's homepage (used for RSS autodiscovery)
     hosts     article links must be on these domains (subdomains allowed), so a feed can't point elsewhere
     feeds     official RSS/Atom feed URLs to try
     discover  also look for the feed the homepage itself declares (<link rel="alternate" type="application/rss+xml">)
     enabled   false to switch a source off; `status` and `note` then say why (shown by /api/news/sources)

   Only headlines, links, publisher names and dates are used: no article text is stored or shown,
   and every headline links to the publisher's own page. */
module.exports = [
  // UAE government and official sources
  { id: 'gdrfa', name: 'GDRFA Dubai', nameAr: 'إقامة دبي', tier: 'uae', scope: 'general', lang: 'en', site: 'https://www.gdrfad.gov.ae/en', hosts: ['gdrfad.gov.ae'], feeds: [], discover: true, enabled: true },
  { id: 'dmo', name: 'Dubai Media Office', nameAr: 'المكتب الإعلامي لحكومة دبي', tier: 'uae', scope: 'general', lang: 'en', site: 'https://www.mediaoffice.ae/en', hosts: ['mediaoffice.ae'], feeds: [], discover: true, enabled: true },
  { id: 'digitaldubai', name: 'Digital Dubai', nameAr: 'دبي الرقمية', tier: 'uae', scope: 'tech', lang: 'en', site: 'https://www.digitaldubai.ae', hosts: ['digitaldubai.ae'], feeds: [], discover: true, enabled: true },
  { id: 'wam', name: 'WAM', nameAr: 'وام', tier: 'uae', scope: 'general', lang: 'en', site: 'https://www.wam.ae/en', hosts: ['wam.ae'], feeds: [], discover: true, enabled: true },
  { id: 'wam-ar', name: 'WAM', nameAr: 'وام', tier: 'uae', scope: 'general', lang: 'ar', site: 'https://www.wam.ae/ar', hosts: ['wam.ae'], feeds: [], discover: true, enabled: true },
  { id: 'uae-portal', name: 'UAE Government Portal', nameAr: 'البوابة الرسمية لحكومة الإمارات', tier: 'uae', scope: 'general', lang: 'en', site: 'https://u.ae/en', hosts: ['u.ae'], feeds: [], discover: true, enabled: true },
  // Regional news
  { id: 'gulfnews', name: 'Gulf News', tier: 'regional', scope: 'general', lang: 'en', site: 'https://gulfnews.com', hosts: ['gulfnews.com'], feeds: ['https://gulfnews.com/feed'], discover: true, enabled: true },
  { id: 'khaleejtimes', name: 'Khaleej Times', tier: 'regional', scope: 'general', lang: 'en', site: 'https://www.khaleejtimes.com', hosts: ['khaleejtimes.com'], feeds: ['https://www.khaleejtimes.com/api/v1/collections/technology.rss', 'https://www.khaleejtimes.com/api/v1/collections/business.rss'], discover: true, enabled: true },
  { id: 'arabianbusiness', name: 'Arabian Business', tier: 'regional', scope: 'general', lang: 'en', site: 'https://www.arabianbusiness.com', hosts: ['arabianbusiness.com'], feeds: ['https://www.arabianbusiness.com/feed'], discover: true, enabled: true },
  // Global AI and emerging technology
  { id: 'mittr', name: 'MIT Technology Review', tier: 'global', scope: 'tech', lang: 'en', site: 'https://www.technologyreview.com', hosts: ['technologyreview.com'], feeds: ['https://www.technologyreview.com/feed/'], discover: true, enabled: true },
  { id: 'reuters', name: 'Reuters', tier: 'global', scope: 'general', lang: 'en', site: 'https://www.reuters.com/technology/', hosts: ['reuters.com'], feeds: [], discover: false, enabled: false,
    status: 'needs_license', note: 'Reuters publishes no public RSS feed. Headlines need a licensed Reuters feed or API (for example Reuters Connect); add its URL and credentials here once licensed.' },
  { id: 'techcrunch', name: 'TechCrunch', tier: 'global', scope: 'tech', lang: 'en', site: 'https://techcrunch.com', hosts: ['techcrunch.com'], feeds: ['https://techcrunch.com/category/artificial-intelligence/feed/', 'https://techcrunch.com/feed/'], discover: false, enabled: true },
  { id: 'biometricupdate', name: 'Biometric Update', tier: 'global', scope: 'tech', lang: 'en', site: 'https://www.biometricupdate.com', hosts: ['biometricupdate.com'], feeds: ['https://www.biometricupdate.com/feed'], discover: true, enabled: true },
  { id: 'fte', name: 'Future Travel Experience', tier: 'global', scope: 'tech', lang: 'en', site: 'https://www.futuretravelexperience.com', hosts: ['futuretravelexperience.com'], feeds: ['https://www.futuretravelexperience.com/feed/'], discover: true, enabled: true },
  { id: 'wef', name: 'World Economic Forum', tier: 'global', scope: 'tech', lang: 'en', site: 'https://www.weforum.org/stories/', hosts: ['weforum.org'], feeds: [], discover: true, enabled: true }
];
