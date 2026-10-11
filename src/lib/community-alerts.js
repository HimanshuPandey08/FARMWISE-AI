import { db } from "./mongodb.js";
import { ObjectId } from "mongodb";
import { getCommunityIntelligence, normalizeGeographicArea, normalizeCropName } from "./community-intelligence.js";

// Cooldown tracker for on-demand alert generation per user (in-memory map of userId -> timestamp)
const lastRefreshMap = new Map();
const REFRESH_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Ensures indexes exist on the community_alerts collection.
 */
let indexesCreated = false;
export async function ensureAlertIndexes() {
  if (indexesCreated) return;
  try {
    const collection = db.collection("community_alerts");
    await collection.createIndex(
      { userId: 1, signalKey: 1 },
      { unique: true, name: "user_signal_unique" }
    );
    await collection.createIndex(
      { userId: 1, isDismissed: 1, createdAt: -1 },
      { name: "user_active_alerts" }
    );
    await collection.createIndex(
      { expiresAt: 1 },
      { expireAfterSeconds: 0, name: "alert_ttl" }
    );
    indexesCreated = true;
  } catch (err) {
    console.warn("[CommunityAlerts] Index creation notice:", err.message);
  }
}

/**
 * Derives a user's known geographic area and grown crops from their recent diagnosis history.
 */
export async function getUserAgronomicProfile(userId) {
  if (!userId) return { areas: [], crops: [] };

  const recentUserDiagnoses = await db
    .collection("diagnoses")
    .find(
      { userId: String(userId) },
      {
        projection: { cropName: 1, location: 1, createdAt: 1 },
        sort: { createdAt: -1 },
        limit: 20,
      }
    )
    .toArray();

  const areasSet = new Set();
  const cropsSet = new Set();

  for (const doc of recentUserDiagnoses) {
    const area = normalizeGeographicArea(doc.location);
    if (area) areasSet.add(area);

    const crop = normalizeCropName(doc.cropName);
    if (crop && crop !== "Unknown Crop") cropsSet.add(crop);
  }

  return {
    areas: Array.from(areasSet),
    crops: Array.from(cropsSet),
  };
}

/**
 * Generates or updates relevant location-based alerts for an authenticated user.
 */
export async function refreshUserAlerts(userId) {
  if (!userId) return [];
  await ensureAlertIndexes();

  const now = Date.now();
  const lastRefresh = lastRefreshMap.get(String(userId)) || 0;
  if (now - lastRefresh < REFRESH_COOLDOWN_MS) {
    // Return existing alerts without re-scanning full database
    return getUserAlertsFromDb(userId);
  }
  lastRefreshMap.set(String(userId), now);

  // 1. Get user profile (areas and crops)
  const profile = await getUserAgronomicProfile(userId);
  if (profile.areas.length === 0 && profile.crops.length === 0) {
    return getUserAlertsFromDb(userId);
  }

  // 2. Query community signals for past 14 days
  const intelligence = await getCommunityIntelligence({ timeRangeDays: 14 });
  const activeSignals = (intelligence.signals || []).filter(
    (s) => s.status === "watch" || s.status === "elevated_signal"
  );

  const collection = db.collection("community_alerts");
  const alertsToUpsert = [];

  for (const signal of activeSignals) {
    const matchesArea = profile.areas.length === 0 || profile.areas.includes(signal.area);
    const matchesCrop = profile.crops.length === 0 || profile.crops.includes(signal.crop);

    // Only alert if the signal is relevant to the user's area or crops
    if (!matchesArea && !matchesCrop) continue;

    const signalKey = `${signal.area}::${signal.crop}::${signal.disease}::${signal.timeWindowDays}`;
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14-day expiry

    const title =
      signal.status === "elevated_signal"
        ? `Elevated ${signal.disease} Warning in ${signal.area}`
        : `Crop Disease Watch: ${signal.disease} in ${signal.area}`;

    const message =
      signal.status === "elevated_signal"
        ? `Elevated ${signal.crop} disease pattern reported in ${signal.area} during the past ${signal.timeWindowDays} days. Multiple independent farmer reports contributed to this signal. This is an early community advisory, not confirmation of an outbreak. Please inspect your crops.`
        : `A persistent ${signal.disease} watch has been noted for ${signal.crop} in ${signal.area} over the past ${signal.timeWindowDays} days. Early surveillance is advised.`;

    alertsToUpsert.push({
      userId: String(userId),
      signalKey,
      title,
      crop: signal.crop,
      disease: signal.disease,
      area: signal.area,
      status: signal.status,
      evidenceLevel: signal.evidenceLevel,
      trend: signal.trend,
      reportCount: signal.reportCount,
      message,
      recommendations: signal.recommendations,
      expiresAt,
    });
  }

  // Upsert alerts (preserves existing isRead / isDismissed state if already present)
  for (const alertData of alertsToUpsert) {
    await collection.updateOne(
      { userId: alertData.userId, signalKey: alertData.signalKey },
      {
        $set: {
          title: alertData.title,
          crop: alertData.crop,
          disease: alertData.disease,
          area: alertData.area,
          status: alertData.status,
          evidenceLevel: alertData.evidenceLevel,
          trend: alertData.trend,
          reportCount: alertData.reportCount,
          message: alertData.message,
          recommendations: alertData.recommendations,
          expiresAt: alertData.expiresAt,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          isRead: false,
          isDismissed: false,
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );
  }

  return getUserAlertsFromDb(userId);
}

/**
 * Fetches user alerts directly from MongoDB.
 */
async function getUserAlertsFromDb(userId) {
  const collection = db.collection("community_alerts");
  const alerts = await collection
    .find({
      userId: String(userId),
      isDismissed: false,
    })
    .sort({ createdAt: -1 })
    .limit(30)
    .toArray();

  return alerts.map((doc) => ({
    _id: doc._id.toString(),
    title: doc.title,
    crop: doc.crop,
    disease: doc.disease,
    area: doc.area,
    status: doc.status,
    evidenceLevel: doc.evidenceLevel,
    trend: doc.trend,
    reportCount: doc.reportCount,
    message: doc.message,
    recommendations: doc.recommendations || [],
    isRead: Boolean(doc.isRead),
    createdAt: doc.createdAt ? doc.createdAt.toISOString() : null,
    expiresAt: doc.expiresAt ? doc.expiresAt.toISOString() : null,
  }));
}

/**
 * Marks an alert as read by ID for the authenticated user.
 */
export async function markAlertAsRead(userId, alertId) {
  if (!userId || !alertId) return false;
  let objectId;
  try {
    objectId = new ObjectId(String(alertId));
  } catch {
    return false;
  }

  const result = await db.collection("community_alerts").updateOne(
    { _id: objectId, userId: String(userId) },
    { $set: { isRead: true, updatedAt: new Date() } }
  );

  return result.matchedCount > 0;
}

/**
 * Dismisses an alert by ID for the authenticated user.
 */
export async function dismissAlert(userId, alertId) {
  if (!userId || !alertId) return false;
  let objectId;
  try {
    objectId = new ObjectId(String(alertId));
  } catch {
    return false;
  }

  const result = await db.collection("community_alerts").updateOne(
    { _id: objectId, userId: String(userId) },
    { $set: { isDismissed: true, updatedAt: new Date() } }
  );

  return result.matchedCount > 0;
}
