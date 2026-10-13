/** Копирует текст в буфер обмена. Возвращает true при успехе. */
export const copyText = async (text: string): Promise<boolean> => {
    const value = String(text ?? '').trim();
    if (!value) return false;

    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(value);
            return true;
        }
    } catch {
        // fallback ниже
    }

    try {
        const ta = document.createElement('textarea');
        ta.value = value;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
    } catch {
        return false;
    }
};
