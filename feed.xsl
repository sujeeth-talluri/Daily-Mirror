<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
<xsl:output method="html" encoding="UTF-8" indent="yes"/>

<xsl:template match="/rss/channel">
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title><xsl:value-of select="title"/></title>
<style>
  :root {
    --sky: #EDEEF3; --paper: #FBF8F0; --ink: #232A3D; --ink-soft: #5B6478;
    --gold: #B4872E; --clay: #A66C5B; --line: #DCDBE4;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--sky); color: var(--ink);
    font-family: Georgia, 'Times New Roman', serif; line-height: 1.6;
  }
  .wrap { max-width: 700px; margin: 0 auto; padding: 0 24px 60px; }
  .dawn-line { height: 4px; background: linear-gradient(90deg,#6B7394 0%,var(--gold) 55%,var(--clay) 100%); }
  header { text-align: center; padding: 48px 0 32px; border-bottom: 1px solid var(--line); margin-bottom: 32px; }
  h1 { font-size: 36px; margin: 0 0 10px; }
  .desc { color: var(--ink-soft); font-style: italic; margin: 0 0 16px; }
  .rss-note {
    font-family: monospace; font-size: 12px; color: var(--gold);
    text-transform: uppercase; letter-spacing: 0.04em;
    border: 1px solid var(--line); border-radius: 100px; padding: 6px 14px; display: inline-block;
  }
  .item {
    background: var(--paper); border: 1px solid var(--line); border-radius: 10px;
    padding: 20px 24px; margin-bottom: 14px;
  }
  .item h2 { font-size: 20px; margin: 0 0 6px; }
  .item h2 a { color: var(--ink); text-decoration: none; }
  .item h2 a:hover { color: var(--gold); }
  .item .date { font-family: monospace; font-size: 11px; color: var(--ink-soft); text-transform: uppercase; }
  .item .question { font-style: italic; color: var(--ink-soft); margin-top: 10px; }
</style>
</head>
<body>
<div class="dawn-line"></div>
<div class="wrap">
  <header>
    <h1><xsl:value-of select="title"/></h1>
    <p class="desc"><xsl:value-of select="description"/></p>
    <span class="rss-note">This is an RSS feed — subscribe with a feed reader app to get new entries automatically</span>
  </header>

  <xsl:for-each select="item">
    <div class="item">
      <div class="date"><xsl:value-of select="pubDate"/></div>
      <h2><a href="{link}"><xsl:value-of select="title"/></a></h2>
      <p class="question"><xsl:value-of select="description"/></p>
    </div>
  </xsl:for-each>
</div>
</body>
</html>
</xsl:template>
</xsl:stylesheet>
