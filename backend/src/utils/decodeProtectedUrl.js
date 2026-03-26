export function decodeProtectedUrl(encodedUrl, key) {
  if (!encodedUrl || !key) {
    return null;
  }

  let value = encodedUrl.startsWith("#") ? encodedUrl.slice(1) : encodedUrl;

  // Sefon раскладывает base64-строку по символам ключа в обратном порядке.
  for (const symbol of [...key].reverse()) {
    value = value.split(symbol).reverse().join(symbol);
  }

  try {
    return Buffer.from(value, "base64").toString("utf8");
  } catch {
    return null;
  }
}

