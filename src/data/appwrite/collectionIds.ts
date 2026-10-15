/**
 * Имена коллекций Appwrite = имена коллекций Firestore (1:1).
 * Используются адаптером и скриптом setup.
 */
export const APPWRITE_DATABASE_ID = 'print_shop';

export const APPWRITE_COLLECTIONS = {
    printers: 'Printers',
    parts: 'Parts',
    tonersStorage: 'TonersStorage',
    tonersHistory: 'Toners',
    usedParts: 'UsedParts',
    materials: 'Materials',
    laminations: 'Laminations',
    knivesHolders: 'KnivesHolders',
    users: 'users',
    stockLots: 'StockLots',
    stockMovements: 'StockMovements',
    counterReadings: 'CounterReadings',
    materialUsages: 'MaterialUsages',
    quantityToOrder: 'quantityToOrder',
    forms: 'Forms',
    appSettings: 'AppSettings',
} as const;

/** Поля JSON (массивы/объекты Firestore) хранятся строкой */
export const APPWRITE_JSON_FIELDS = {
    printerOptions: 'optionsJson',
    printerColors: 'colorsJson',
    movementLots: 'lotsJson',
    counterPrinters: 'printersJson',
    materialCatalogLists: 'catalogJson',
} as const;
