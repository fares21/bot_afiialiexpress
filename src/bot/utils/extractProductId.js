const axios = require('axios');

/**
 * Résout un lien court AliExpress du type:
 *   https://s.click.aliexpress.com/e/_EvNVadI
 * en suivant les redirections jusqu'à obtenir l'URL finale du produit.
 */
async function resolveShortLink(shortUrl) {
  try {
    const response = await axios.get(shortUrl, {
      maxRedirects: 10,
      timeout: 10000,
      validateStatus: (status) => status >= 200 && status < 400
    });

    const finalUrl =
      (response.request &&
        response.request.res &&
        response.request.res.responseUrl) ||
      response.config.url;

    return finalUrl;
  } catch (error) {
    if (error.response && error.response.headers && error.response.headers.location) {
      return error.response.headers.location;
    }

    console.error('Erreur lors de la résolution du lien court AliExpress:', error.message);
    throw error;
  }
}

/**
 * Tente d'extraire un productId à partir des query params.
 */
function extractProductIdFromQuery(urlObj) {
  const params = urlObj.searchParams;
  const keys = ['productId', 'itemId', 'objId', 'sku_id', 'spm', 'pdp_npi'];

  for (const key of keys) {
    if (params.has(key)) {
      const val = params.get(key);
      if (!val) continue;
      const match = val.match(/\d{6,}/);
      if (match) {
        return match[0];
      }
    }
  }

  return null;
}

/**
 * Extrait le productId d'une URL AliExpress.
 * - Supporte les liens longs: https://ar.aliexpress.com/item/1005008774372288.html
 * - Supporte les liens courts: https://s.click.aliexpress.com/e/xxxxxx (via resolveShortLink)
 */
async function extractProductId(rawUrl) {
  try {
    if (!rawUrl || typeof rawUrl !== 'string') {
      return null;
    }

    let normalized = rawUrl.trim();
    if (!/^https?:\/\//i.test(normalized)) {
      return null;
    }

    let urlObj = new URL(normalized);
    let host = urlObj.hostname.toLowerCase();

    const isAliExpressHost =
      host.includes('aliexpress.com') ||
      host.includes('a.aliexpress.com') ||
      host.includes('m.aliexpress.com') ||
      host.includes('s.click.aliexpress.com');

    if (!isAliExpressHost) {
      return null;
    }

    // 1) Si lien court s.click.aliexpress.com -> on le résout d'abord
    if (host.includes('s.click.aliexpress.com')) {
      console.log('Lien court AliExpress détecté, résolution en cours...');
      try {
        const resolvedUrl = await resolveShortLink(normalized);
        console.log('Lien court résolu en:', resolvedUrl);
        normalized = resolvedUrl;
        urlObj = new URL(normalized);
        host = urlObj.hostname.toLowerCase();
      } catch (err) {
        console.error('Echec de la résolution du lien court:', err.message);
        return null;
      }
    }

    // 2) A ce stade, on a toujours une URL AliExpress "classique" (ar/fr/www/m...aliexpress.com)
    const pathParts = urlObj.pathname.split('/').filter(Boolean);

    // Cas typique: /item/1005008774372288.html
    const itemIndex = pathParts.indexOf('item');
    if (itemIndex !== -1 && pathParts[itemIndex + 1]) {
      const idPart = pathParts[itemIndex + 1];
      const match = idPart.match(/\d{6,}/);
      if (match) {
        return match[0];
      }
    }

    // Cas fallback: chercher un nombre dans toutes les parties du path
    for (const part of pathParts) {
      if (!part) continue;
      const match = part.match(/\d{6,}/);
      if (match) {
        return match[0];
      }
    }

    // 3) Tentative via les query params (productId, itemId, objId, etc.)
    const fromQuery = extractProductIdFromQuery(urlObj);
    if (fromQuery) {
      return fromQuery;
    }

    return null;
  } catch (err) {
    console.error('Erreur dans extractProductId:', err.message);
    return null;
  }
}

module.exports = extractProductId;
