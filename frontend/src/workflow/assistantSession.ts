const STORAGE_PREFIX = 'cms_clinic_agent';

function removeMatchingKeys(storage: Storage) {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key && key.startsWith(STORAGE_PREFIX)) keys.push(key);
  }
  for (const key of keys) storage.removeItem(key);
}

export function clearAssistantHistory() {
  try {
    removeMatchingKeys(sessionStorage);
    removeMatchingKeys(localStorage);
  } catch {
    // storage can be blocked in private mode
  }
}
