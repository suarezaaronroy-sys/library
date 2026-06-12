Drop the existing grimoire HTML files here unchanged:

    001-asmc-crm-engine.html ... 011-organizational-physics.html

They have no front matter, so Jekyll copies them verbatim — their
embedded CSS/JS and merge-tag examples ({{...}}) are safe from Liquid.
The library pages link to them via _data/grimoires.yml.
