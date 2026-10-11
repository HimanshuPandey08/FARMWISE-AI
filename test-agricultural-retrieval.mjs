import assert from "node:assert";
import {
  isDatesOrIndexPage,
  isRelevantAgriculturalContent,
  retrieveAgriculturalSources,
} from "./src/lib/agricultural-retrieval.js";

// Helper to generate a minimal valid PDF Buffer with extractable text for testing
function createPdfBuffer(text) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let currentLine = "";

  for (const word of words) {
    if ((currentLine + " " + word).trim().length > 50) {
      if (currentLine) lines.push(currentLine.trim());
      currentLine = word;
    } else {
      currentLine += (currentLine ? " " : "") + word;
    }
  }
  if (currentLine) lines.push(currentLine.trim());

  const textCommands = lines
    .map((line) => `(${line.replace(/[()\\]/g, "\\$&")}) '`)
    .join("\n");

  const contentStream = `BT /F1 12 Tf 16 TL 72 712 Td\n${textCommands}\nET`;
  const streamLength = Buffer.byteLength(contentStream, "utf8");

  const objects = [
    `%PDF-1.4\n`,
    `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`,
    `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`,
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /Contents 4 0 R >>\nendobj\n`,
    `4 0 obj\n<< /Length ${streamLength} >>\nstream\n${contentStream}\nendstream\nendobj\n`,
  ];

  let xref = `xref\n0 5\n0000000000 65535 f \n`;
  let currentOffset = objects[0].length;
  for (let i = 1; i < objects.length; i++) {
    xref += `${String(currentOffset).padStart(10, "0")} 00000 n \n`;
    currentOffset += objects[i].length;
  }

  const startxref = currentOffset;
  const trailer = `trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF\n`;

  return Buffer.from(objects.join("") + xref + trailer, "utf8");
}

async function runTests() {
  console.log("Starting agricultural retrieval unit tests...\n");

  const originalFetch = globalThis.fetch;
  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      passed++;
      console.log(`PASS: ${name}`);
    } catch (err) {
      console.error(`FAIL: ${name}`);
      console.error(err);
    }
  }

  async function testAsync(name, fn) {
    total++;
    try {
      await fn();
      passed++;
      console.log(`PASS: ${name}`);
    } catch (err) {
      console.error(`FAIL: ${name}`);
      console.error(err);
    }
  }

  // --- UNIT TESTS FOR HELPER BOUNDARIES ---

  test("1A. Boundary: isDatesOrIndexPage identifies dates-only index structure", () => {
    const datesOnlyIndexPage = {
      title: "Crop Advisory | ICAR-IIWBR",
      url: "https://iiwbr.org.in/crop-advisory/",
      advisoryLinks: [
        { title: "Advisory 12-02-2024", url: "https://iiwbr.org.in/adv1.pdf", isPdf: true },
        { title: "Advisory 05-02-2024", url: "https://iiwbr.org.in/adv2.pdf", isPdf: true },
        { title: "Advisory 29-01-2024", url: "https://iiwbr.org.in/adv3.pdf", isPdf: true },
      ],
      content:
        "ICAR-IIWBR Crop Advisory Archive. Advisory issued for the period 12-02-2024 to 18-02-2024 Download PDF. " +
        "Advisory issued for the period 05-02-2024 to 11-02-2024 Download PDF. " +
        "Advisory issued for the period 29-01-2024 to 04-02-2024 Download PDF. " +
        "Advisory issued for the period 22-01-2024 to 28-01-2024 Download PDF. " +
        "Advisory issued for the period 15-01-2024 to 21-01-2024 Download PDF. " +
        "All bulletins archived for farmer reference. Click here for previous years archives.",
    };

    assert.strictEqual(
      isDatesOrIndexPage(datesOnlyIndexPage, { id: "iiwbr" }),
      true,
      "IIWBR page must be identified as an index page"
    );
    assert.strictEqual(
      isRelevantAgriculturalContent(datesOnlyIndexPage.content),
      false,
      "Dates-only index text must fail agricultural relevance"
    );
  });

  test("2A. Boundary: isRelevantAgriculturalContent retains authentic agronomic guidance", () => {
    const authenticAdvisory =
      "Advisory for Tomato Crop Management: Early blight fungal disease caused by Alternaria solani " +
      "has been observed in lower leaf canopies. Initial symptoms appear as brown concentric circular rings on leaves. " +
      "Recommended management: Spray Mancozeb 75 WP at a dosage of 2 grams per litre of water or Chlorothalonil 75 WP. " +
      "Avoid overhead sprinkler irrigation to reduce leaf wetness and fungal spore germination. " +
      "Ensure field sanitation by removing diseased foliage to control secondary pathogen transmission. " +
      "For sucking pests such as aphids and whitefly, spray Neem oil 1500 ppm at 3 ml per litre.";

    assert.ok(authenticAdvisory.length >= 500, "Advisory text meets length threshold");
    assert.strictEqual(
      isRelevantAgriculturalContent(authenticAdvisory, {
        cropName: "tomato",
        suspectedDiseases: ["early blight"],
      }),
      true,
      "Authentic advisory text must satisfy relevance filter"
    );
  });

  // --- END-TO-END TESTS OF EXPORTED RETRIEVAL BEHAVIOR ---

  await testAsync("1B. Exported retrieval: IIWBR dates-only advisory index is excluded from evidence", async () => {
    // Mock fetch: IIWBR returns an index page with advisory dates and no working PDF
    globalThis.fetch = async (url) => {
      const urlStr = String(url);
      if (urlStr.includes("iiwbr.org.in")) {
        const indexHtml = `
          <!DOCTYPE html>
          <html>
            <head><title>ICAR-IIWBR Crop Advisory</title></head>
            <body>
              <main>
                <h1>Crop Advisory Bulletins</h1>
                <p>Advisory issued for the period 12-02-2024 to 18-02-2024 Download PDF</p>
                <p>Advisory issued for the period 05-02-2024 to 11-02-2024 Download PDF</p>
                <p>Advisory issued for the period 29-01-2024 to 04-02-2024 Download PDF</p>
                <p>Advisory issued for the period 22-01-2024 to 28-01-2024 Download PDF</p>
                <p>Advisory issued for the period 15-01-2024 to 21-01-2024 Download PDF</p>
                <p>Advisory issued for the period 08-01-2024 to 14-01-2024 Download PDF</p>
                <p>All bulletins archived for reference. Click here for past bulletins archive.</p>
              </main>
            </body>
          </html>
        `;
        return new Response(indexHtml, {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }
      return new Response("Not found", { status: 404 });
    };

    const results = await retrieveAgriculturalSources({
      cropName: "wheat",
      suspectedDiseases: ["yellow rust"],
    });

    const iiwbrWebpages = results.filter(
      (item) => item.sourceId === "iiwbr" && item.contentType === "agricultural-webpage"
    );

    assert.strictEqual(
      iiwbrWebpages.length,
      0,
      "IIWBR dates-only index page must NOT be included in evidence"
    );
  });

  await testAsync("2B. Exported retrieval: Relevant agricultural advisory webpage is retained", async () => {
    const advisoryArticleHtml = `
      <!DOCTYPE html>
      <html>
        <head><title>ICAR Agro-Advisory for Tomato</title></head>
        <body>
          <article>
            <h1>Tomato Disease and Pest Advisory</h1>
            <p>
              Early blight fungal infection caused by Alternaria solani has been reported across several fields.
              Symptoms manifest as dark brown spots with characteristic concentric rings on the foliage and stems.
              Recommended management: Apply foliar spray of Mancozeb 75 WP at a dosage of 2.5 g per litre of water
              or Chlorothalonil 75 WP at 2 g per litre. Repeat application after 10 days if humid weather persists.
              Maintain proper field sanitation, remove diseased lower leaves, and avoid excessive sprinkler irrigation
              to prevent fungal pathogen development and secondary disease transmission.
              For aphid pest infestation, spray Neem oil at 3 ml per litre to control vectors.
            </p>
          </article>
        </body>
      </html>
    `;

    globalThis.fetch = async (url) => {
      const urlStr = String(url);
      if (urlStr.includes("icar.gov.in")) {
        return new Response(advisoryArticleHtml, {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }
      return new Response("Not found", { status: 404 });
    };

    const results = await retrieveAgriculturalSources({
      cropName: "tomato",
      suspectedDiseases: ["early blight"],
    });

    const icarWebpages = results.filter(
      (item) => item.sourceId === "icar" && item.contentType === "agricultural-webpage"
    );

    assert.ok(icarWebpages.length > 0, "Relevant advisory webpage must be retained in results");
    assert.ok(
      icarWebpages[0].content.includes("Mancozeb"),
      "Retained webpage must contain treatment guidance"
    );
  });

  await testAsync("3. Exported retrieval: Successfully extracted relevant PDF is retained (and index page excluded)", async () => {
    const pdfGuidanceText =
      "Wheat Advisory Bulletin: Monitor fields for yellow rust fungal disease symptoms. " +
      "If yellow stripe pustules appear on wheat leaves, spray Propiconazole 25 EC at a dosage of 0.1% (1 ml per litre) immediately. " +
      "For aphid pest infestation exceeding threshold level, apply Thiamethoxam 25 WG at 100 grams per hectare. " +
      "Ensure timely irrigation during flowering stage and avoid nitrogen over-fertilization to prevent severe disease spread.";

    const validPdfBuffer = createPdfBuffer(pdfGuidanceText);

    const indexHtmlWithPdfLink = `
      <!DOCTYPE html>
      <html>
        <head><title>ICAR-IIWBR Crop Advisory</title></head>
        <body>
          <main>
            <h1>ICAR-IIWBR Crop Advisory Portal and Weekly Bulletins</h1>
            <p>Welcome to the ICAR - Indian Institute of Wheat and Barley Research advisory repository.</p>
            <p>All farmers and stakeholders can download current and archived advisories below:</p>
            <a href="https://iiwbr.org.in/advisory-wheat-2024.pdf">Crop Advisory for Wheat 2024 English</a>
            <p>Previous advisory issued for 05-02-2024 to 11-02-2024 Download PDF.</p>
            <p>Previous advisory issued for 29-01-2024 to 04-02-2024 Download PDF.</p>
            <p>Previous advisory issued for 22-01-2024 to 28-01-2024 Download PDF.</p>
            <p>Previous advisory issued for 15-01-2024 to 21-01-2024 Download PDF.</p>
            <p>Previous advisory issued for 08-01-2024 to 14-01-2024 Download PDF.</p>
            <p>Archived bulletins are maintained for research and agronomic reference across all zones.</p>
          </main>
        </body>
      </html>
    `;

    globalThis.fetch = async (url) => {
      const urlStr = String(url);
      if (urlStr.endsWith(".pdf")) {
        return new Response(validPdfBuffer, {
          status: 200,
          headers: {
            "content-type": "application/pdf",
            "content-length": String(validPdfBuffer.length),
          },
        });
      }
      if (urlStr.includes("iiwbr.org.in")) {
        return new Response(indexHtmlWithPdfLink, {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }
      return new Response("Not found", { status: 404 });
    };

    const results = await retrieveAgriculturalSources({
      cropName: "wheat",
      suspectedDiseases: ["yellow rust"],
    });

    const pdfResults = results.filter(
      (item) => item.sourceId === "iiwbr" && item.contentType === "agricultural-advisory-pdf"
    );
    const indexWebpages = results.filter(
      (item) => item.sourceId === "iiwbr" && item.contentType === "agricultural-webpage"
    );

    assert.ok(pdfResults.length > 0, "Relevant extracted PDF must be retained in results");
    assert.ok(
      pdfResults[0].content.includes("Propiconazole"),
      "Extracted PDF must contain verified agronomic treatment guidance"
    );
    assert.strictEqual(
      indexWebpages.length,
      0,
      "Index page must NOT be appended when advisory PDF extraction succeeds"
    );
  });

  await testAsync("4. Exported retrieval: PDF with insufficient text or boilerplate-only is rejected", async () => {
    // 4A: Scanned / empty PDF with < 200 characters
    const shortPdfBuffer = createPdfBuffer("Cover page - Crop Advisory 2024.");

    // 4B: Boilerplate-only PDF with >= 200 characters of legal disclaimers and no agronomic guidance
    const boilerplatePdfText =
      "ICAR-IIWBR Publication Information and Legal Disclaimer. All intellectual property rights reserved. " +
      "No part of this publication may be reproduced, stored in a retrieval system, or transmitted in any form " +
      "without prior written permission of the Director. Published at Karnal, Haryana. Printed by the government press. " +
      "For official communications, send correspondence to the Director at the administrative campus address.";
    const boilerplatePdfBuffer = createPdfBuffer(boilerplatePdfText);

    const indexHtml = `
      <!DOCTYPE html>
      <html>
        <head><title>IIWBR</title></head>
        <body>
          <main>
            <a href="https://iiwbr.org.in/boilerplate-advisory.pdf">Disclaimer Advisory PDF</a>
          </main>
        </body>
      </html>
    `;

    globalThis.fetch = async (url) => {
      const urlStr = String(url);
      if (urlStr.endsWith(".pdf")) {
        return new Response(boilerplatePdfBuffer, {
          status: 200,
          headers: {
            "content-type": "application/pdf",
            "content-length": String(boilerplatePdfBuffer.length),
          },
        });
      }
      if (urlStr.includes("iiwbr.org.in")) {
        return new Response(indexHtml, {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }
      return new Response("Not found", { status: 404 });
    };

    const results = await retrieveAgriculturalSources({
      cropName: "wheat",
      suspectedDiseases: ["yellow rust"],
    });

    const pdfResults = results.filter(
      (item) => item.sourceId === "iiwbr" && item.contentType === "agricultural-advisory-pdf"
    );

    assert.strictEqual(
      pdfResults.length,
      0,
      "Boilerplate-only PDF must be rejected and not included in evidence"
    );
  });

  await testAsync("5. Exported retrieval: Unavailable source does not crash retrieval", async () => {
    // Mock network failure / timeout
    globalThis.fetch = async () => {
      throw new TypeError("fetch failed: connection timeout / DNS error");
    };

    const results = await retrieveAgriculturalSources({
      cropName: "wheat",
      suspectedDiseases: ["rust"],
    });

    assert.ok(
      Array.isArray(results),
      "Result must resolve safely to an array without throwing an unhandled exception"
    );
    assert.strictEqual(results.length, 0, "Failed sources safely produce empty results array");
  });

  // Restore fetch
  globalThis.fetch = originalFetch;

  console.log(`\nTest results: ${passed}/${total} passed.`);
  if (passed !== total) {
    process.exit(1);
  }
}

runTests();
