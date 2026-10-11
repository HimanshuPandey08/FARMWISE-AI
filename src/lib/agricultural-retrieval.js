
import * as cheerio from "cheerio";
import { PDFParse } from "pdf-parse";
import { selectAgriculturalSources } from "./agricultural-sources.js";

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_PDF_BYTES = 5 * 1024 * 1024;
const MAX_TEXT_LENGTH = 12000;
const MAX_PDF_TEXT_LENGTH = 15000;
const REQUEST_TIMEOUT_MS = 10000;

const DISEASE_OR_PEST_PATTERNS = [
  /\b(?:disease|pathogen|fungus|fungal|bacterial|virus|viral|infection|symptom|symptoms|infestation)\b/i,
  /\b(?:blight|rust|rot|mildew|wilt|canker|leaf\s*spot|smut|damping-off|blast|scab|anthracnose)\b/i,
  /\b(?:pest|borer|caterpillar|weevil|aphid|whitefly|hopper|mite|nematode|thrips|beetle|stem\s*borer)\b/i,
];

const TREATMENT_OR_MANAGEMENT_PATTERNS = [
  /\b(?:treatment|management|control|prevention|preventive|remedy|spray|spraying|application|dosage)\b/i,
  /\b(?:fungicide|insecticide|pesticide|biopesticide|bio-control|bioagent|bio-agent|seed\s*treatment)\b/i,
  /\b(?:cultural\s*practice|crop\s*protection|soil\s*drenching|foliar\s*spray|recommended\s*dose)\b/i,
];

const AGRONOMIC_PRACTICE_PATTERNS = [
  /\b(?:irrigation|fertilizer|fertilizer\s*application|manure|sowing|intercropping)\b/i,
  /\b(?:weed\s*management|pruning|transplanting|soil\s*health|field\s*sanitation)\b/i,
];

const DATE_AND_INDEX_PATTERNS = [
  /\b(?:\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})\b/g,
  /\b(?:\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{2,4})\b/gi,
  /\b(?:download|bulletin|issued?|issue\s*date|advisory\s*no|period|click\s*here|archive|pdf)\b/gi,
];

function isApprovedUrl(url, approvedDomains) {
  if (url.protocol !== "https:") return false;

  return approvedDomains.some(
    (domain) =>
      url.hostname === domain ||
      url.hostname.endsWith(`.${domain}`)
  );
}

export function isDatesOrIndexPage(page, source = null) {
  if (!page) return true;

  const url = page.url || "";
  const content = page.content || "";

  // The IIWBR crop advisory page is an index table of issue dates and download links.
  if (
    source?.id === "iiwbr" ||
    url.includes("iiwbr.org.in/crop-advisory") ||
    url.includes("/crop-advisory")
  ) {
    const treatmentMatches = TREATMENT_OR_MANAGEMENT_PATTERNS.filter((pattern) =>
      pattern.test(content)
    ).length;

    if (treatmentMatches === 0) {
      return true;
    }
  }

  // Count date and index indicators vs actionable management content.
  let dateAndIndexCount = 0;
  for (const pattern of DATE_AND_INDEX_PATTERNS) {
    const matches = content.match(pattern);
    if (matches) {
      dateAndIndexCount += matches.length;
    }
  }

  const hasDisease = DISEASE_OR_PEST_PATTERNS.some((p) => p.test(content));
  const hasTreatment = TREATMENT_OR_MANAGEMENT_PATTERNS.some((p) => p.test(content));

  // If the page is saturated with dates and download links without actionable treatment context.
  if (dateAndIndexCount >= 6 && (!hasDisease || !hasTreatment)) {
    return true;
  }

  // If the page contains multiple advisory links and date clusters without narrative treatment text.
  if (
    Array.isArray(page.advisoryLinks) &&
    page.advisoryLinks.length >= 3 &&
    dateAndIndexCount >= 4 &&
    !hasTreatment
  ) {
    return true;
  }

  return false;
}

export function isRelevantAgriculturalContent(
  content = "",
  { cropName = "", suspectedDiseases = [] } = {}
) {
  if (typeof content !== "string" || content.trim().length === 0) {
    return false;
  }

  const normalized = content.toLowerCase();

  let diseaseMatches = 0;
  for (const pattern of DISEASE_OR_PEST_PATTERNS) {
    if (pattern.test(normalized)) diseaseMatches++;
  }

  const diseases = Array.isArray(suspectedDiseases)
    ? suspectedDiseases
    : [suspectedDiseases];

  for (const disease of diseases) {
    if (
      disease &&
      typeof disease === "string" &&
      disease.trim().length > 2 &&
      normalized.includes(disease.toLowerCase().trim())
    ) {
      diseaseMatches += 2;
    }
  }

  let treatmentMatches = 0;
  for (const pattern of TREATMENT_OR_MANAGEMENT_PATTERNS) {
    if (pattern.test(normalized)) treatmentMatches++;
  }

  let agronomicMatches = 0;
  for (const pattern of AGRONOMIC_PRACTICE_PATTERNS) {
    if (pattern.test(normalized)) agronomicMatches++;
  }

  // Must have both disease/pest context and treatment/management actions.
  const hasPestOrDiseaseContext = diseaseMatches >= 1;
  const hasActionableGuidance =
    treatmentMatches >= 1 || treatmentMatches + agronomicMatches >= 2;
  const totalRelevantMatches =
    diseaseMatches + treatmentMatches + agronomicMatches;

  if (
    !hasPestOrDiseaseContext ||
    !hasActionableGuidance ||
    totalRelevantMatches < 3
  ) {
    return false;
  }

  return true;
}

function extractAdvisoryLinks($, pageUrl, approvedDomains) {
  return $("a[href]")
    .map((_, element) => {
      const href = $(element).attr("href");
      const title = $(element).text().trim();

      if (!href || !title) return null;

      try {
        const url = new URL(href, pageUrl);

        if (!isApprovedUrl(url, approvedDomains)) {
          return null;
        }

        return {
          title: title.slice(0, 200),
          url: url.href,
          isPdf: /\.pdf$/i.test(url.pathname),
        };
      } catch {
        return null;
      }
    })
    .get()
    .filter(Boolean)
    .slice(0, 100);
}

async function fetchSource(urlString, approvedDomains) {
  let url;

  try {
    url = new URL(urlString);
  } catch {
    return null;
  }

  if (!isApprovedUrl(url, approvedDomains)) return null;

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS
  );

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "error",
      headers: {
        Accept: "text/html",
        "User-Agent": "FarmWiseAI/1.0 agricultural research",
      },
    });

    if (!response.ok) return null;

    const contentType =
      response.headers.get("content-type") || "";

    if (!contentType.toLowerCase().includes("text/html")) {
      return null;
    }

    const contentLength = Number(
      response.headers.get("content-length") || 0
    );

    if (contentLength > MAX_RESPONSE_BYTES) return null;

    const html = await response.text();

    if (Buffer.byteLength(html, "utf8") > MAX_RESPONSE_BYTES) {
      return null;
    }

    const $ = cheerio.load(html);
    const advisoryLinks = extractAdvisoryLinks(
      $,
      url.href,
      approvedDomains
    );

    $(
      "script, style, nav, footer, header, noscript, iframe, form"
    ).remove();

    const title =
      $("title").first().text().trim() || url.hostname;

    const candidates = [
      $("article").first(),
      $("main").first(),
      $('[role="main"]').first(),
    ];

    let content = "";

    for (const element of candidates) {
      if (!element.length) continue;

      const text = element.text().replace(/\s+/g, " ").trim();

      if (text.length > content.length) {
        content = text;
      }
    }

    if (content.length < 500) {
      content = $("body").text().replace(/\s+/g, " ").trim();
    }

    if (content.length < 500) return null;

    return {
      title: title.slice(0, 300),
      publisher: url.hostname,
      url: url.href,
      content: content.slice(0, MAX_TEXT_LENGTH),
      advisoryLinks,
      retrievedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.warn(
      "Agricultural source retrieval failed:",
      urlString,
      error.message
    );

    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function rankAdvisoryPdf(link) {
  const text = `${link.title} ${link.url}`.toLowerCase();

  let score = 0;

  // Prefer advisory documents over unrelated PDFs.
  if (/advisory|crop-advisory|farm-advisory/.test(text)) {
    score += 20;
  }

  // Prefer English for the first MVP implementation.
  if (/english|advisory.*\.pdf/.test(text)) {
    score += 3;
  }

  if (/\b(hindi|h)\.pdf/.test(text)) {
    score -= 2;
  }

  // Prefer documents with a recognizable recent year.
  const yearMatch = text.match(/\b(20\d{2})\b/);

  if (yearMatch) {
    score += Number(yearMatch[1]) / 100;
  }

  return score;
}

async function fetchAndExtractPdf(
  link,
  approvedDomains
) {
  let url;

  try {
    url = new URL(link.url);
  } catch {
    return null;
  }

  if (!isApprovedUrl(url, approvedDomains)) return null;
  if (!/\.pdf$/i.test(url.pathname)) return null;

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS
  );

  let parser;

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "error",
      headers: {
        Accept: "application/pdf",
        "User-Agent": "FarmWiseAI/1.0 agricultural research",
      },
    });

    if (!response.ok) return null;

    const contentLength = Number(
      response.headers.get("content-length") || 0
    );

    if (contentLength > MAX_PDF_BYTES) return null;

    const declaredType = (
      response.headers.get("content-type") || ""
    ).toLowerCase();

    if (
      declaredType &&
      !declaredType.includes("application/pdf") &&
      !declaredType.includes("application/octet-stream")
    ) {
      return null;
    }

    const bytes = await response.arrayBuffer();
    const buffer = Buffer.from(bytes);

    if (buffer.length > MAX_PDF_BYTES) return null;

    // Verify the PDF signature instead of trusting the URL alone.
    if (buffer.subarray(0, 5).toString() !== "%PDF-") {
      return null;
    }

    parser = new PDFParse({ data: buffer });

    const result = await parser.getText();
    const content = (result.text || "")
      .replace(/\s+/g, " ")
      .trim();

    // Skip scanned/image-only PDFs that have insufficient text.
    if (content.length < 200) {
      console.warn(
        "PDF contains insufficient extractable text:",
        url.href
      );
      return null;
    }

    // Require meaningful agricultural advisory guidance to reject boilerplate-only PDFs.
    if (!isRelevantAgriculturalContent(content)) {
      console.warn(
        "PDF contains insufficient agricultural guidance:",
        url.href
      );
      return null;
    }

    return {
      title: link.title,
      publisher: url.hostname,
      url: url.href,
      content: content.slice(0, MAX_PDF_TEXT_LENGTH),
      retrievedAt: new Date().toISOString(),
      contentType: "agricultural-advisory-pdf",
    };
  } catch (error) {
    console.warn(
      "Agricultural PDF extraction failed:",
      link.url,
      error.message
    );

    return null;
  } finally {
    if (parser) {
      await parser.destroy().catch(() => {});
    }

    clearTimeout(timeout);
  }
}

async function retrievePdfAdvisory(
  page,
  source
) {
  const pdfLinks = page.advisoryLinks
    .filter((link) => link.isPdf)
    .sort(
      (a, b) => rankAdvisoryPdf(b) - rankAdvisoryPdf(a)
    );

  // Limit work and external requests for the MVP.
  for (const link of pdfLinks.slice(0, 3)) {
    const advisory = await fetchAndExtractPdf(
      link,
      source.approvedDomains
    );

    if (advisory) {
      return {
        sourceId: source.id,
        sourceName: source.name,
        ...advisory,
      };
    }
  }

  return null;
}

export async function retrieveAgriculturalSources({
  cropName,
  suspectedDiseases = [],
}) {
  const selectedSources = selectAgriculturalSources({
    cropName,
    suspectedDiseases,
  });

  const jobs = selectedSources.flatMap((source) =>
    source.urls.map(async (url) => {
      const page = await fetchSource(
        url,
        source.approvedDomains
      );

      if (!page) return [];

      const results = [];
      let pdfAdvisoryRetrieved = false;

      // The IIWBR page can list advisory dates without containing
      // the actual guidance. Retrieve a PDF for wheat/barley.
      if (
        source.id === "iiwbr" &&
        /\b(wheat|barley)\b/i.test(cropName || "")
      ) {
        const advisory = await retrievePdfAdvisory(
          page,
          source
        );

        if (advisory) {
          results.push(advisory);
          pdfAdvisoryRetrieved = true;
        }
      }

      // Webpage evidence criteria:
      // 1. If an advisory PDF was retrieved from this page, do not append the index page.
      // 2. Reject calendar/dates-only or archive-index pages.
      // 3. Must satisfy the conservative agricultural relevance filter.
      // 4. Must meet the 500-character content threshold.
      if (
        !pdfAdvisoryRetrieved &&
        !isDatesOrIndexPage(page, source) &&
        isRelevantAgriculturalContent(page.content, {
          cropName,
          suspectedDiseases,
        }) &&
        page.content.length >= 500
      ) {
        results.push({
          sourceId: source.id,
          sourceName: source.name,
          title: page.title,
          publisher: page.publisher,
          url: page.url,
          content: page.content,
          retrievedAt: page.retrievedAt,
          contentType: "agricultural-webpage",
        });
      }

      return results;
    })
  );

  const results = await Promise.all(jobs);

  return results.flat();
}
