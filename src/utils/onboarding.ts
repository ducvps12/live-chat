/**
 * Onboarding validation and utility helpers
 */

/**
 * Validate email format
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
};

/**
 * Parse email list from textarea input
 * Splits by comma or newline, trims, dedupes, validates
 */
export const parseEmailList = (
  input: string
): { valid: string[]; invalid: string[] } => {
  const emails = input
    .split(/[,\n]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);

  // Dedupe
  const unique = [...new Set(emails)];

  const valid: string[] = [];
  const invalid: string[] = [];

  unique.forEach((email) => {
    if (isValidEmail(email)) {
      valid.push(email);
    } else {
      invalid.push(email);
    }
  });

  return { valid, invalid };
};

/**
 * Validate domain format (supports localhost, 127.0.0.1, and wildcard)
 */
export const isValidDomain = (domain: string): boolean => {
  const trimmed = domain.trim().toLowerCase();
  
  // Wildcard allows all (for development)
  if (trimmed === '*') {
    return true;
  }
  
  // Localhost with optional port
  if (/^localhost(:\d+)?$/.test(trimmed)) {
    return true;
  }
  
  // IP address with optional port (127.0.0.1:5500)
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(trimmed)) {
    return true;
  }

  // Domain pattern: subdomain.domain.tld or domain.tld with optional port
  const domainRegex = /^([a-z0-9-]+\.)*[a-z0-9-]+\.[a-z]{2,}(:\d+)?$/;
  return domainRegex.test(trimmed);
};

/**
 * Validate hex color
 */
export const isValidHexColor = (color: string): boolean => {
  return /^#([0-9A-Fa-f]{3}){1,2}$/.test(color);
};

/**
 * Normalize workspace name
 * - Trim leading/trailing whitespace
 * - Collapse multiple spaces to single space
 */
export const normalizeWorkspaceName = (name: string): string => {
  return name.trim().replace(/\s+/g, ' ');
};

/**
 * Validate workspace name
 */
export const validateWorkspaceName = (
  name: string
): { valid: boolean; error?: string } => {
  const normalized = normalizeWorkspaceName(name);

  if (!normalized) {
    return { valid: false, error: 'Tên workspace không được để trống' };
  }

  if (normalized.length < 3) {
    return { valid: false, error: 'Tên workspace phải có ít nhất 3 ký tự' };
  }

  if (normalized.length > 255) {
    return { valid: false, error: 'Tên workspace không được quá 255 ký tự' };
  }

  return { valid: true };
};

/**
 * Copy text to clipboard with fallback
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // Fallback for non-HTTPS or older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      const result = document.execCommand('copy');
      document.body.removeChild(textArea);
      return result;
    }
  } catch {
    return false;
  }
};

/**
 * Local storage key for onboarding state
 */
export const ONBOARDING_STORAGE_KEY = 'nemark.onboarding';

/**
 * Inbox settings storage key (per workspace)
 */
export const getInboxSettingsKey = (workspaceId: string) => 
  `nemark.inboxSettings.${workspaceId}`;
