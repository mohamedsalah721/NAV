import { createClient } from "@sanity/client";

export const SANITY_CONFIG = {
  projectId: import.meta.env.VITE_SANITY_PROJECT_ID || "a4ru0yl4",
  dataset: import.meta.env.VITE_SANITY_DATASET || "production",
  apiVersion: import.meta.env.VITE_SANITY_API_VERSION || "2024-01-01",
  useCdn: true,
  token: import.meta.env.VITE_SANITY_WRITE_TOKEN || "",
};

export const sanityClient = createClient({
  projectId: SANITY_CONFIG.projectId,
  dataset: SANITY_CONFIG.dataset,
  apiVersion: SANITY_CONFIG.apiVersion,
  useCdn: SANITY_CONFIG.useCdn,
  token: SANITY_CONFIG.token,
});

/**
 * Fetch saved calculations from Sanity CMS
 */
export async function fetchSanityCalculations() {
  try {
    const query = `*[_type == "savedCalculation"] | order(_createdAt desc) {
      _id,
      name,
      calculatorType,
      inputs,
      results,
      createdAt,
      _createdAt
    }`;
    const docs = await sanityClient.fetch(query);
    return docs.map((doc) => ({
      id: doc._id,
      sanityId: doc._id,
      name: doc.name,
      calculatorType: doc.calculatorType,
      inputs: doc.inputs ? JSON.parse(doc.inputs) : {},
      results: doc.results ? JSON.parse(doc.results) : {},
      date: new Date(doc.createdAt || doc._createdAt).getTime(),
      syncedToSanity: true,
    }));
  } catch (err) {
    console.warn("Sanity fetch warning (falling back to local storage):", err.message);
    return null;
  }
}

/**
 * Save a new calculation document to Sanity CMS
 */
export async function saveToSanity(name, calculatorType, inputs, results) {
  if (!SANITY_CONFIG.token) {
    console.info("Sanity read-only mode active (add VITE_SANITY_WRITE_TOKEN for remote mutation).");
    return null;
  }
  try {
    const doc = {
      _type: "savedCalculation",
      name,
      calculatorType,
      inputs: JSON.stringify(inputs),
      results: JSON.stringify(results),
      createdAt: new Date().toISOString(),
    };
    const created = await sanityClient.create(doc);
    return created._id;
  } catch (err) {
    console.error("Sanity save error:", err.message);
    return null;
  }
}

/**
 * Delete a calculation document from Sanity CMS
 */
export async function deleteFromSanity(sanityId) {
  if (!SANITY_CONFIG.token || !sanityId) return false;
  try {
    await sanityClient.delete(sanityId);
    return true;
  } catch (err) {
    console.error("Sanity delete error:", err.message);
    return false;
  }
}
