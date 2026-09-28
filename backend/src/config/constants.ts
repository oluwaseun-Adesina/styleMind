export const MAX_IMAGE_BASE64_CHARS = 4_500_000;

// Stored wardrobe thumbnail (data URL). Clients resize to ~400px JPEG (~25KB).
export const MAX_ITEM_IMAGE_CHARS = 300_000;

// Bulk wardrobe save and bulk photo scan limits.
export const MAX_BULK_ITEMS = 50;
export const MAX_BULK_ANALYZE_IMAGES = 10;
export const BULK_ANALYZE_CONCURRENCY = 3;
