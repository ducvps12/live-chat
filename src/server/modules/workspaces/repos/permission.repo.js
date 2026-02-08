const { getPool } = require('../../../infra/mysql/mysql');
const AppError = require('../../../utils/AppError');

const getPermissionKeysByCodes = async (codes) => {
    if (!codes || codes.length === 0) return [];

    const placeholders = codes.map(() => '?').join(', ');
    const [rows] = await getPool().execute(
        `SELECT PermissionKey, Code FROM iam_Permissions WHERE Code IN (${placeholders})`,
        codes
    );

    const foundCodes = new Set(rows.map(r => r.Code));
    const missingCodes = codes.filter(code => !foundCodes.has(code));

    if (missingCodes.length > 0) {
        throw new AppError(`Permission seed misconfigured. Missing permissions: ${missingCodes.join(', ')}`, 500);
    }

    return rows.map(r => r.PermissionKey);
};

const getAllPermissions = async () => {
    const [rows] = await getPool().execute('SELECT * FROM iam_Permissions ORDER BY Code');
    return rows;
};

const findByCode = async (code) => {
    const [rows] = await getPool().execute(
        'SELECT * FROM iam_Permissions WHERE Code = ?',
        [code]
    );
    return rows[0] || null;
};

module.exports = { getPermissionKeysByCodes, getAllPermissions, findByCode };
