export const extractLeadingMarker = (text = "") => {
  const clean = String(text ?? "").trim();
  return clean.match(/^\s*(\d+\.|[a-zA-Z]\.)\s*/)?.[1] ?? "";
};

export const stripLeadingMarker = (text = "") => {
  return String(text ?? "")
    .replace(/^\s*(\d+\.|[a-zA-Z]\.)\s*/i, "")
    .trim();
};

export const getComponentAcronym = (text = "") => {
  const clean = stripLeadingMarker(text).toUpperCase();

  if (clean.startsWith("PENGELUARAN KONSUMSI RUMAHTANGGA")) return "PKRT";
  if (clean.startsWith("PENGELUARAN KONSUMSI LNPRT")) return "LNPRT";
  if (clean.startsWith("PENGELUARAN KONSUMSI PEMERINTAH")) return "PKP";
  if (clean.startsWith("PEMBENTUKAN MODAL TETAP BRUTO")) return "PMTB";
  if (clean.startsWith("PERUBAHAN INVENTORI")) return "PI";
  if (clean.startsWith("EKSPOR BARANG DAN JASA")) return "EKSPOR";
  if (clean.startsWith("IMPOR BARANG DAN JASA")) return "IMPOR";

  return stripLeadingMarker(text);
};

export const resolveHeaderSource = (headerText = "") => {
  const acronym = getComponentAcronym(headerText);

  if (acronym === "PKRT") return "pkrt";
  if (acronym === "PKP") return "pkp";
  if (acronym === "PMTB") return "pmtb";
  if (acronym === "EKSPOR" || acronym === "IMPOR") return "eksim";

  return "";
};

export const shortenComponentLabel = (text = "") => {
  return getComponentAcronym(text);
};

export const formatComponentOptionLabel = (item) => {
  const deskripsi = String(item?.deskripsi ?? "").trim();
  const marker = extractLeadingMarker(deskripsi);

  if (/^\d+\.$/.test(marker)) {
    return shortenComponentLabel(deskripsi);
  }

  return deskripsi.replace(/^[a-z]\.\s*/i, "").trim();
};

export const buildPdbComponentMappings = (items = []) => {
  let currentHeaderText = "";
  let currentHeaderShort = "";
  let currentHeaderSource = "";

  return items.map((item) => {
    const rawDeskripsi = String(item?.deskripsi ?? "").trim();
    const marker = extractLeadingMarker(rawDeskripsi);
    const isHeader = /^\d+\.$/.test(marker);
    const isSub = /^[a-zA-Z]\.$/.test(marker);

    if (isHeader) {
      currentHeaderText = stripLeadingMarker(rawDeskripsi);
      currentHeaderShort = getComponentAcronym(rawDeskripsi);
      currentHeaderSource = resolveHeaderSource(rawDeskripsi);

      return {
        ...item,
        marker,
        isHeader: true,
        isSub: false,
        deskripsi: currentHeaderText,
        shortLabel: currentHeaderShort,
        fullLabel: currentHeaderText,
        parentHeaderText: currentHeaderText,
        parentHeaderShort: currentHeaderShort,
        mappedSource: currentHeaderSource,
      };
    }

    if (isSub) {
      const cleanSub = stripLeadingMarker(rawDeskripsi);

      return {
        ...item,
        marker,
        isHeader: false,
        isSub: true,
        deskripsi: cleanSub,
        shortLabel: cleanSub,
        fullLabel: cleanSub,
        parentHeaderText: currentHeaderText,
        parentHeaderShort: currentHeaderShort,
        mappedSource: currentHeaderSource,
      };
    }

    const cleanText = stripLeadingMarker(rawDeskripsi);

    return {
      ...item,
      marker,
      isHeader: false,
      isSub: false,
      deskripsi: cleanText,
      shortLabel: cleanText,
      fullLabel: cleanText,
      parentHeaderText: currentHeaderText,
      parentHeaderShort: currentHeaderShort,
      mappedSource: currentHeaderSource,
    };
  });
};

export const isAllowedByComponentRule = (item, ruleMode) => {
  const mode = String(ruleMode ?? "admin").toLowerCase();

  if (mode === "admin") return true;

  const source = String(item?.mappedSource ?? "").toLowerCase();

  if (mode === "xm") {
    return source === "eksim";
  }

  return source === mode;
};