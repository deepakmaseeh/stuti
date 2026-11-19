/* global CMS, h, createClass */
// Song preview for Decap CMS: the three layers stacked, styled by /admin/preview.css (the site's lyric CSS).
// Plain script on purpose: Decap provides CMS, h (React.createElement) and createClass as globals.
// Text only: React escapes everything, nothing is rendered as HTML.
(function () {
  const LANG = { songs_hi: 'hi', songs_ta: 'ta', songs_te: 'te', songs_pa: 'pa', songs_en: 'en' };

  CMS.registerPreviewStyle('/admin/preview.css');

  function songPreview(lang) {
    return createClass({
      render() {
        const d = this.props.entry.get('data').toJS();
        const title = d.title || {};
        const layers = d.layers || {};
        const rights = (d.rights && d.rights.status) || 'permission_pending';
        const chorusAfter = d.display && d.display.chorusAfterEachVerse;
        const sections = d.sections || [];
        const warnings = [];
        if (d.publish && rights !== 'public_domain' && rights !== 'licensed' && rights !== 'demo') {
          warnings.push('Publish is on, but rights are "' + rights + '". This song will fail the checks.');
        }
        if (layers.roman === 'draft') warnings.push('Roman layer: draft');
        if (layers.en === 'draft') warnings.push('English layer: draft');

        const romanTag = lang === 'en' ? 'en' : lang + '-Latn';
        const hasChorus = sections.some((s) => s.type === 'chorus' || s.type === 'refrain');
        const out = [];
        sections.forEach((s, i) => {
          const isChorus = s.type === 'chorus' || s.type === 'refrain';
          out.push(
            h(
              'section',
              { key: 's' + i, className: 'sec' + (isChorus ? ' sec--chorus' : '') },
              h('h2', { className: 'sec__label' }, s.label || ''),
              (s.lines || []).map((l, j) =>
                h(
                  'p',
                  { key: j, className: 'line' },
                  h('span', { className: 'n', lang }, l.n || ''),
                  l.r ? h('span', { className: 'r', lang: romanTag }, l.r) : null,
                  l.e ? h('span', { className: 'e', lang: 'en' }, l.e) : null,
                ),
              ),
            ),
          );
          if (chorusAfter && hasChorus && s.type === 'verse') {
            out.push(h('p', { key: 'c' + i, className: 'chorus-marker' }, '↻ Chorus'));
          }
        });

        return h(
          'article',
          null,
          h(
            'div',
            { className: 'pv-nums' },
            (d.numbers || []).map((x, i) =>
              h('span', { key: i, className: 'pv-num' }, (x.book || '?') + ' ' + (x.number || '')),
            ),
          ),
          h('h1', { className: 'pv-title', lang }, title.native || '(no title yet)'),
          h('p', { className: 'pv-sub' }, [title.roman, title.en].filter(Boolean).join(' · ')),
          warnings.map((w, i) => h('p', { key: i, className: 'pv-warn' }, w)),
          h('div', { className: 'lyrics' }, out),
        );
      },
    });
  }

  Object.keys(LANG).forEach((name) => CMS.registerPreviewTemplate(name, songPreview(LANG[name])));
})();
