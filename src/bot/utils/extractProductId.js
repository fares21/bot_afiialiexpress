// extractProductId: version simple pour les liens longs AliExpress

async function extractProductId(rawUrl) {
  try {
    if (!rawUrl || typeof rawUrl !== 'string') {
      return null;
    }

    const normalized = rawUrl.trim();
    if (!/^https?:\/\//i.test(normalized)) {
      return null;
    }

    const urlObj = new URL(normalized);
    const host = urlObj.hostname.toLowerCase();

    // accepter uniquement les domaines AliExpress connus
    const isAliExpressHost =
      host.includes('aliexpress.com') ||
      host.includes('a.aliexpress.com') ||
      host.includes('m.aliexpress.com');

    if (!isAliExpressHost) {
      return null;
    }

    // exemple de chemin: /item/1005001234567890.html
    const pathParts = urlObj.pathname.split('/').filter(Boolean);

    const itemIndex = pathParts.indexOf('item');
    if (itemIndex !== -1 && pathParts[itemIndex + 1]) {
      const idPart = pathParts[itemIndex + 1];
      const match = idPart.match(/\d{6,}/);
      if (match) {
        return match[0];
      }
    }

    // fallback: chercher un nombre long dans toutes les parties du chemin
    for (const part of pathParts) {
      if (!part) continue;
      const match = part.match(/\d{6,}/);
      if (match) {
        return match[0];
      }
    }

    return null;
  } catch (err) {
    console.error('Erreur dans extractProductId:', err);
    return null;
  }
}

module.exports = extractProductId;
