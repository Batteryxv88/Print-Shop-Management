/**
 * Схема коллекций Appwrite — зеркало Firestore.
 * Вложенные массивы/объекты → строковые поля *Json (UTF-8 JSON).
 */

/** @typedef {'string'|'integer'|'double'|'boolean'|'datetime'} AttrKind */

/**
 * @typedef {Object} AttrDef
 * @property {string} key
 * @property {AttrKind} type
 * @property {boolean} [required]
 * @property {number} [size] — для string
 * @property {number} [min] — для integer
 * @property {number} [max]
 * @property {boolean} [array]
 */

/**
 * @typedef {Object} IndexDef
 * @property {string} key
 * @property {string[]} attributes
 * @property {'key'|'fulltext'} [type]
 * @property {('ASC'|'DESC')[]} [orders]
 */

/**
 * @typedef {Object} CollectionDef
 * @property {string} id
 * @property {string} name
 * @property {AttrDef[]} attributes
 * @property {IndexDef[]} [indexes]
 */

/** @type {CollectionDef[]} */
export const collections = [
    {
        id: 'Printers',
        name: 'Printers',
        attributes: [
            { key: 'name', type: 'string', required: true, size: 255 },
            { key: 'model', type: 'string', required: true, size: 255 },
            { key: 'ip', type: 'string', size: 64 },
            { key: 'serialNumber', type: 'string', size: 128 },
            { key: 'colorMode', type: 'string', size: 16 },
            { key: 'colorsJson', type: 'string', size: 2000 },
            { key: 'optionsJson', type: 'string', size: 16000 },
        ],
        indexes: [{ key: 'by_name', attributes: ['name'], type: 'key' }],
    },
    {
        id: 'Parts',
        name: 'Parts',
        attributes: [
            { key: 'partN', type: 'string', size: 128 },
            { key: 'section', type: 'string', size: 255 },
            { key: 'partName', type: 'string', size: 512 },
            { key: 'quantity', type: 'integer', min: 0 },
            { key: 'partLife', type: 'string', size: 64 },
            { key: 'model', type: 'string', size: 255 },
            { key: 'installedQty', type: 'integer', min: 0 },
            { key: 'source', type: 'string', size: 32 },
            { key: 'optionModel', type: 'string', size: 255 },
            { key: 'costCategory', type: 'string', size: 32 },
        ],
        indexes: [
            { key: 'by_model', attributes: ['model'], type: 'key' },
            { key: 'by_partN', attributes: ['partN'], type: 'key' },
        ],
    },
    {
        id: 'TonersStorage',
        name: 'TonersStorage',
        attributes: [
            { key: 'color', type: 'string', size: 32 },
            { key: 'qty', type: 'integer', min: 0 },
            { key: 'model', type: 'string', size: 255 },
        ],
        indexes: [{ key: 'by_model', attributes: ['model'], type: 'key' }],
    },
    {
        id: 'Toners',
        name: 'Toners history',
        attributes: [
            { key: 'color', type: 'string', size: 32 },
            { key: 'man', type: 'string', size: 255 },
            { key: 'counter', type: 'string', size: 64 },
            { key: 'date', type: 'string', size: 64 },
            { key: 'machine', type: 'string', size: 255 },
            { key: 'totalCost', type: 'double' },
            { key: 'unitPriceAvg', type: 'double' },
            { key: 'movementId', type: 'string', size: 64 },
        ],
        indexes: [
            { key: 'by_date', attributes: ['date'], type: 'key' },
            { key: 'by_machine', attributes: ['machine'], type: 'key' },
        ],
    },
    {
        id: 'UsedParts',
        name: 'UsedParts',
        attributes: [
            { key: 'date', type: 'string', size: 64 },
            { key: 'man', type: 'string', size: 255 },
            { key: 'partN', type: 'string', size: 128 },
            { key: 'partName', type: 'string', size: 512 },
            { key: 'quantity', type: 'integer', min: 0 },
            { key: 'section', type: 'string', size: 255 },
            { key: 'serviceLife', type: 'integer', min: 0 },
            { key: 'percent', type: 'double' },
            { key: 'machine', type: 'string', size: 255 },
            { key: 'totalCost', type: 'double' },
            { key: 'unitPriceAvg', type: 'double' },
            { key: 'movementId', type: 'string', size: 64 },
            { key: 'costCategory', type: 'string', size: 32 },
            { key: 'economyAmount', type: 'double' },
            { key: 'factoryLife', type: 'integer', min: 0 },
            { key: 'actualLife', type: 'integer', min: 0 },
        ],
        indexes: [{ key: 'by_date', attributes: ['date'], type: 'key' }],
    },
    {
        id: 'Materials',
        name: 'Materials',
        attributes: [
            { key: 'name', type: 'string', size: 255 },
            { key: 'type', type: 'string', size: 128 },
            { key: 'form', type: 'string', size: 16 },
            { key: 'materialType', type: 'string', size: 128 },
            { key: 'subtype', type: 'string', size: 128 },
            { key: 'thickness', type: 'string', size: 64 },
            { key: 'note', type: 'string', size: 2000 },
            { key: 'adhesive', type: 'string', size: 128 },
            { key: 'metersPerRoll', type: 'double' },
            { key: 'density', type: 'string', size: 64 },
            { key: 'format', type: 'string', size: 64 },
            { key: 'color', type: 'string', size: 64 },
            { key: 'coating', type: 'string', size: 128 },
            { key: 'qty', type: 'integer', min: 0 },
            { key: 'status', type: 'string', size: 32 },
        ],
    },
    {
        id: 'Laminations',
        name: 'Laminations',
        attributes: [
            { key: 'name', type: 'string', size: 255 },
            { key: 'type', type: 'string', size: 128 },
            { key: 'subtype', type: 'string', size: 128 },
            { key: 'sub_type', type: 'string', size: 128 },
            { key: 'thickness', type: 'string', size: 64 },
            { key: 'note', type: 'string', size: 2000 },
            { key: 'qty', type: 'integer', min: 0 },
            { key: 'status', type: 'string', size: 32 },
            { key: 'title', type: 'string', size: 255 },
        ],
    },
    {
        id: 'KnivesHolders',
        name: 'KnivesHolders',
        attributes: [
            { key: 'type', type: 'string', size: 128 },
            { key: 'sub_type', type: 'string', size: 128 },
            { key: 'qty', type: 'integer', min: 0 },
        ],
    },
    {
        id: 'users',
        name: 'users',
        attributes: [
            { key: 'email', type: 'string', required: true, size: 320 },
            { key: 'displayName', type: 'string', size: 255 },
            { key: 'role', type: 'string', size: 64 },
            { key: 'createdAt', type: 'integer', min: 0 },
            { key: 'authUserId', type: 'string', size: 64 },
        ],
        indexes: [{ key: 'by_email', attributes: ['email'], type: 'key' }],
    },
    {
        id: 'StockLots',
        name: 'StockLots',
        attributes: [
            { key: 'type', type: 'string', size: 32 },
            { key: 'stockId', type: 'string', size: 64 },
            { key: 'partN', type: 'string', size: 128 },
            { key: 'partName', type: 'string', size: 512 },
            { key: 'color', type: 'string', size: 32 },
            { key: 'model', type: 'string', size: 255 },
            { key: 'costCategory', type: 'string', size: 32 },
            { key: 'qtyInitial', type: 'integer', min: 0 },
            { key: 'qtyLeft', type: 'integer', min: 0 },
            { key: 'unitPrice', type: 'double' },
            { key: 'currency', type: 'string', size: 8 },
            { key: 'purchasedAt', type: 'string', size: 64 },
            { key: 'supplier', type: 'string', size: 255 },
            { key: 'comment', type: 'string', size: 2000 },
            { key: 'createdBy', type: 'string', size: 255 },
            { key: 'createdAt', type: 'string', size: 64 },
            { key: 'machine', type: 'string', size: 255 },
        ],
        indexes: [
            { key: 'by_stockId', attributes: ['stockId'], type: 'key' },
            { key: 'by_qtyLeft', attributes: ['qtyLeft'], type: 'key' },
        ],
    },
    {
        id: 'StockMovements',
        name: 'StockMovements',
        attributes: [
            { key: 'kind', type: 'string', size: 32 },
            { key: 'type', type: 'string', size: 32 },
            { key: 'stockId', type: 'string', size: 64 },
            { key: 'partN', type: 'string', size: 128 },
            { key: 'partName', type: 'string', size: 512 },
            { key: 'color', type: 'string', size: 32 },
            { key: 'model', type: 'string', size: 255 },
            { key: 'costCategory', type: 'string', size: 32 },
            { key: 'qty', type: 'integer', min: 0 },
            { key: 'totalCost', type: 'double' },
            { key: 'unitPriceAvg', type: 'double' },
            { key: 'date', type: 'string', size: 64 },
            { key: 'machine', type: 'string', size: 255 },
            { key: 'man', type: 'string', size: 255 },
            { key: 'lotsJson', type: 'string', size: 65000 },
            { key: 'relatedId', type: 'string', size: 64 },
            { key: 'comment', type: 'string', size: 2000 },
            { key: 'supplier', type: 'string', size: 255 },
            { key: 'economyAmount', type: 'double' },
            { key: 'factoryLife', type: 'integer', min: 0 },
            { key: 'actualLife', type: 'integer', min: 0 },
            { key: 'writeoffReason', type: 'string', size: 32 },
            { key: 'reversed', type: 'boolean' },
            { key: 'reversedAt', type: 'string', size: 64 },
            { key: 'reversedBy', type: 'string', size: 255 },
            { key: 'stornoMovementId', type: 'string', size: 64 },
        ],
        indexes: [
            { key: 'by_date', attributes: ['date'], type: 'key' },
            { key: 'by_kind_date', attributes: ['kind', 'date'], type: 'key' },
            {
                key: 'by_writeoffReason',
                attributes: ['writeoffReason'],
                type: 'key',
            },
            { key: 'by_kind', attributes: ['kind'], type: 'key' },
        ],
    },
    {
        id: 'CounterReadings',
        name: 'CounterReadings',
        attributes: [
            { key: 'periodKey', type: 'string', required: true, size: 16 },
            { key: 'completedAt', type: 'string', size: 64 },
            { key: 'userId', type: 'string', size: 64 },
            { key: 'userName', type: 'string', size: 255 },
            { key: 'note', type: 'string', size: 2000 },
            { key: 'printersJson', type: 'string', size: 65000 },
            { key: 'updatedAt', type: 'string', size: 64 },
            { key: 'updatedByName', type: 'string', size: 255 },
        ],
        indexes: [
            { key: 'by_periodKey', attributes: ['periodKey'], type: 'key' },
        ],
    },
    {
        id: 'MaterialUsages',
        name: 'MaterialUsages',
        attributes: [
            { key: 'kind', type: 'string', size: 32 },
            { key: 'stockId', type: 'string', size: 64 },
            { key: 'name', type: 'string', size: 255 },
            { key: 'qty', type: 'integer', min: 0 },
            { key: 'date', type: 'string', size: 64 },
            { key: 'man', type: 'string', size: 255 },
            { key: 'note', type: 'string', size: 2000 },
            { key: 'movementId', type: 'string', size: 64 },
            { key: 'totalCost', type: 'double' },
            { key: 'unitPriceAvg', type: 'double' },
        ],
        indexes: [{ key: 'by_date', attributes: ['date'], type: 'key' }],
    },
    {
        id: 'quantityToOrder',
        name: 'quantityToOrder',
        attributes: [
            { key: 'PartN', type: 'string', size: 128 },
            { key: 'PartName', type: 'string', size: 512 },
            { key: 'qty', type: 'integer', min: 0 },
            { key: 'use', type: 'boolean' },
        ],
    },
    {
        id: 'Forms',
        name: 'Forms',
        attributes: [
            { key: 'name', type: 'string', size: 255 },
            { key: 'payloadJson', type: 'string', size: 65000 },
        ],
    },
    {
        id: 'AppSettings',
        name: 'AppSettings',
        attributes: [
            { key: 'settingsKey', type: 'string', required: true, size: 64 },
            { key: 'counterReadingDay', type: 'integer', min: 0, max: 31 },
            { key: 'paperStockEnabled', type: 'boolean' },
            { key: 'laminationStockEnabled', type: 'boolean' },
            { key: 'paperFormMode', type: 'string', size: 16 },
            { key: 'catalogJson', type: 'string', size: 65000 },
        ],
        indexes: [
            { key: 'by_settingsKey', attributes: ['settingsKey'], type: 'key' },
        ],
    },
];

/** Документы-заглушки настроек (создаёт setup) */
export const seedSettingsDocs = [
    {
        settingsKey: 'main',
        paperStockEnabled: true,
        laminationStockEnabled: true,
        paperFormMode: 'both',
        catalogJson: '',
    },
    {
        settingsKey: 'materialCatalog',
        catalogJson: JSON.stringify({
            paperTypes: ['Бумага', 'Плёнка'],
            paperSubtypes: ['С тиснением', 'С покрытием', 'Металлизированная'],
            adhesives: ['Акрил', 'Каучук'],
            thicknesses: [],
            densities: [],
            formats: ['SRA3', 'A3', 'A4'],
            colors: [],
            coatings: [],
            laminationTypes: ['Глянцевая', 'Матовая'],
            laminationSubtypes: [],
        }),
    },
];
