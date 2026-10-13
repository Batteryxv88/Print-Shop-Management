const snmp = require('net-snmp');

const snmpVersion = (v) => {
    if (v === 2 || v === '2' || v === '2c') return snmp.Version2c;
    return snmp.Version1;
};

const getOidValue = (session, oid) =>
    new Promise((resolve, reject) => {
        if (!oid) {
            resolve(null);
            return;
        }
        session.get([oid], (error, varbinds) => {
            if (error) {
                reject(error);
                return;
            }
            const vb = varbinds && varbinds[0];
            if (!vb) {
                reject(new Error(`Пустой ответ SNMP для OID ${oid}`));
                return;
            }
            if (snmp.isVarbindError(vb)) {
                reject(new Error(snmp.varbindError(vb)));
                return;
            }
            const n = Number(vb.value);
            if (!Number.isFinite(n) || n < 0) {
                reject(
                    new Error(
                        `Некорректное значение SNMP ${JSON.stringify(vb.value)} для ${oid}`
                    )
                );
                return;
            }
            resolve(Math.round(n));
        });
    });

/**
 * Снимает счётчики с одного принтера по профилю OID.
 * @returns {{ values: object, raw: object }}
 */
const pollPrinter = async (ip, profile, snmpConfig) => {
    const session = snmp.createSession(ip, snmpConfig.community, {
        version: snmpVersion(snmpConfig.version),
        timeout: snmpConfig.timeoutMs || 5000,
        retries: snmpConfig.retries ?? 1,
    });

    try {
        const raw = {};
        const total = await getOidValue(session, profile.total);
        raw.total = total;

        let mono = null;
        let color = null;
        if (profile.mono) {
            mono = await getOidValue(session, profile.mono);
            raw.mono = mono;
        }
        if (profile.color) {
            color = await getOidValue(session, profile.color);
            raw.color = color;
        }

        if (!(total > 0)) {
            throw new Error('Общий счётчик пустой или 0');
        }

        const values = { total };
        if (mono != null) values.mono = mono;
        if (color != null) values.color = color;

        // Если есть только total и цветной режим — mono/color можно не заполнять;
        // web-форма для color требует mono+color, поэтому при их отсутствии
        // подставляем заглушку: mono=total, color=0 (или наоборот по желанию).
        // Лучше не подставлять ложные данные — пусть оператор правит вручную.
        // Но create требует все поля > 0 в UI. Для агента сохраняем то, что есть.

        return { values, raw };
    } finally {
        try {
            session.close();
        } catch {
            /* ignore */
        }
    }
};

module.exports = { pollPrinter };
