/**
 * Smart Data Extraction Service
 * Automatically extracts phone numbers and emails from messages
 */

// Vietnamese phone number patterns
// Supports: 0xxx, +84xxx, 84xxx formats
// Valid prefixes: 03x, 05x, 07x, 08x, 09x
const PHONE_PATTERNS = [
    /(?:\+84|84|0)(?:3[2-9]|5[6|8|9]|7[0|6-9]|8[1-6|8|9]|9[0-9])\d{7}/g,
    /(?:\+84|84|0)(?:2[0-9])\d{8}/g, // Landline
];

// Email pattern
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Name pattern (Vietnamese names with diacritics)
const NAME_PATTERN = /(?:tên|name|tôi là|mình là|em là|anh là|chị là)\s*[:.]?\s*([A-Za-zÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠàáâãèéêìíòóôõùúăđĩũơƯẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼỀỂưạảấầẩẫậắằẳẵặẹẻẽềểỄỆỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪễệỉịọỏốồổỗộớờởỡợụủứừỬỮỰỲỴỶỸửữựỳỵỷỹ\s]{2,50})/gi;

/**
 * Extract contact information from a message
 * @param {string} text - Message text to analyze
 * @returns {Object} Extracted data
 */
function extractContactInfo(text) {
    if (!text || typeof text !== 'string') {
        return { phones: [], emails: [], names: [] };
    }

    const result = {
        phones: [],
        emails: [],
        names: []
    };

    // Extract phone numbers
    PHONE_PATTERNS.forEach(pattern => {
        const matches = text.match(pattern);
        if (matches) {
            matches.forEach(phone => {
                const normalized = normalizePhone(phone);
                if (!result.phones.includes(normalized)) {
                    result.phones.push(normalized);
                }
            });
        }
    });

    // Extract emails
    const emailMatches = text.match(EMAIL_PATTERN);
    if (emailMatches) {
        emailMatches.forEach(email => {
            const normalized = email.toLowerCase();
            if (!result.emails.includes(normalized)) {
                result.emails.push(normalized);
            }
        });
    }

    // Extract names
    const nameMatches = text.matchAll(NAME_PATTERN);
    for (const match of nameMatches) {
        if (match[1]) {
            const name = match[1].trim();
            if (name.length >= 2 && !result.names.includes(name)) {
                result.names.push(name);
            }
        }
    }

    return result;
}

/**
 * Normalize phone number to standard format
 * @param {string} phone - Raw phone number
 * @returns {string} Normalized phone (0xxxxxxxxx format)
 */
function normalizePhone(phone) {
    // Remove spaces and dashes
    let normalized = phone.replace(/[\s\-\.]/g, '');

    // Convert +84 or 84 to 0
    if (normalized.startsWith('+84')) {
        normalized = '0' + normalized.slice(3);
    } else if (normalized.startsWith('84') && normalized.length > 9) {
        normalized = '0' + normalized.slice(2);
    }

    return normalized;
}

/**
 * Check if text contains contact information
 * @param {string} text - Message text
 * @returns {boolean}
 */
function hasContactInfo(text) {
    const info = extractContactInfo(text);
    return info.phones.length > 0 || info.emails.length > 0;
}

/**
 * Merge extracted data with existing visitor data
 * @param {Object} existing - Existing visitor contact data
 * @param {Object} extracted - Newly extracted data
 * @returns {Object} Merged data
 */
function mergeContactData(existing, extracted) {
    const merged = {
        phone: existing.phone || extracted.phones[0] || null,
        email: existing.email || extracted.emails[0] || null,
        name: existing.name || extracted.names[0] || null,
        allPhones: [...new Set([...(existing.allPhones || []), ...extracted.phones])],
        allEmails: [...new Set([...(existing.allEmails || []), ...extracted.emails])]
    };

    return merged;
}

module.exports = {
    extractContactInfo,
    normalizePhone,
    hasContactInfo,
    mergeContactData
};
