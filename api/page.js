const fs = require("fs");
const path = require("path");

const SHARE_IMAGE =
  "https://res.cloudinary.com/dwryahwiu/image/upload/f_jpg,q_auto:good,c_fill,w_1200,h_630,g_auto:faces/v1789552912/album5_wzdwtw.jpg";

function parseInviteSearch(rawUrl) {
  const text = String(rawUrl || "");
  const qIndex = text.indexOf("?");
  const search = qIndex >= 0 ? text.slice(qIndex) : "";
  const normalized = search
    .replace(/^[?#&]+/, "")
    .replace(/\/+(?=(?:type|name|l2|wrap|open)=)/gi, "&")
    .replace(/\?/g, "&");
  return new URLSearchParams(normalized);
}

function headerQuery(req) {
  const invoke = req.headers && req.headers["x-invoke-query"];
  if (invoke) {
    try {
      const decoded = decodeURIComponent(String(invoke));
      const parsed = JSON.parse(decoded);
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      /* fall through */
    }
  }
  const uri =
    (req.headers &&
      (req.headers["x-forwarded-uri"] ||
        req.headers["x-invoke-path"] ||
        req.headers["x-vercel-original-path"])) ||
    "";
  if (String(uri).includes("?")) {
    return Object.fromEntries(parseInviteSearch(uri));
  }
  return {};
}

function queryValue(req, key) {
  const sources = [req.query || {}, headerQuery(req)];
  for (let i = 0; i < sources.length; i += 1) {
    let value = sources[i][key];
    if (Array.isArray(value)) value = value[0];
    if (value != null && String(value).trim()) return String(value);
  }
  return parseInviteSearch(req.url).get(key) || "";
}

function parseInviteType(req) {
  return (queryValue(req, "type") || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9].*$/, "");
}

function decodeInviteParam(value) {
  if (!value) return "";
  let text = String(value).replace(/\+/g, " ").trim();
  try {
    text = decodeURIComponent(text);
  } catch {
    return text;
  }
  return text.trim();
}

function guestInviteName(req) {
  return decodeInviteParam(queryValue(req, "name"))
    .replace(/~/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function coupleWeddingTitle(bride) {
  return bride
    ? "HOÀNG HẠNH & TRINH GIANG WEDDING"
    : "TRINH GIANG & HOÀNG HẠNH WEDDING";
}

function invitePageTitle(bride, guestName) {
  const wedding = coupleWeddingTitle(bride);
  return guestName ? `Kính mời ${guestName} | ${wedding}` : wedding;
}

function inviteShareTitle(bride, guestName) {
  return guestName ? `Kính mời ${guestName}` : coupleWeddingTitle(bride);
}

function inviteShareDescription(bride, guestName) {
  const wedding = coupleWeddingTitle(bride);
  return guestName ? `Kính mời ${guestName} tới dự lễ thành hôn` : wedding;
}

function isBrideInviteType(type) {
  return type === "nhagai29" || type === "nhagai30";
}

function escapeAttr(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function requestSearch(req) {
  const url = String(req.url || "");
  if (url.indexOf("?") >= 0) return url.slice(url.indexOf("?"));
  const q = Object.assign({}, headerQuery(req), req.query || {});
  const params = new URLSearchParams();
  Object.keys(q).forEach((key) => {
    const value = Array.isArray(q[key]) ? q[key][0] : q[key];
    if (value != null && String(value) !== "") params.set(key, String(value));
  });
  const search = params.toString();
  return search ? `?${search}` : "";
}

function shareMeta({ title, shareTitle, description, siteName, url, image }) {
  const t = escapeAttr(title);
  const st = escapeAttr(shareTitle);
  const d = escapeAttr(description);
  const s = escapeAttr(siteName);
  const u = escapeAttr(url);
  const i = escapeAttr(image);
  return `<!-- SHARE_META_START -->
<title>${t}</title>
<meta name="title" content="${st}"/>
<meta name="description" content="${d}"/>
<meta itemprop="name" content="${st}"/>
<meta itemprop="description" content="${d}"/>
<meta itemprop="image" content="${i}"/>
<meta property="og:type" content="website"/>
<meta property="og:site_name" content="${s}"/>
<meta property="og:title" content="${st}"/>
<meta property="og:description" content="${d}"/>
<meta property="og:url" content="${u}"/>
<meta property="og:locale" content="vi_VN"/>
<meta property="og:image" content="${i}"/>
<meta property="og:image:url" content="${i}"/>
<meta property="og:image:secure_url" content="${i}"/>
<meta property="og:image:type" content="image/jpeg"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
<meta property="og:image:alt" content="${st}"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${st}"/>
<meta name="twitter:description" content="${d}"/>
<meta name="twitter:image" content="${i}"/>
<link rel="canonical" href="${u}"/>
<!-- SHARE_META_END -->`;
}

module.exports = (req, res) => {
  const htmlPath = path.join(process.cwd(), "index.html");
  let html = fs.readFileSync(htmlPath, "utf8");
  const type = parseInviteType(req);
  const bride = isBrideInviteType(type);
  const guestName = guestInviteName(req);
  const title = invitePageTitle(bride, guestName);
  const shareTitle = inviteShareTitle(bride, guestName);
  const description = inviteShareDescription(bride, guestName);

  const host = String(
    req.headers["x-forwarded-host"] || req.headers.host || "thiepcuoigianghanh.vercel.app"
  )
    .split(",")[0]
    .trim();
  const origin = `https://${host}`;
  const search = requestSearch(req);
  const url = `${origin}/${search}`;

  html = html.replace(
    /<!-- SHARE_META_START -->[\s\S]*?<!-- SHARE_META_END -->/,
    shareMeta({
      title,
      shareTitle,
      description,
      siteName: "Giang & Hạnh",
      url,
      image: SHARE_IMAGE,
    })
  );

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
  res.setHeader("Accept-Ranges", "none");
  res.status(200).send(html);
};
