const { getPool } = require('../infra/mysql/mysql');

/**
 * Image Repository for MySQL metadata
 */

const createImage = async (imageData) => {
    const { filename, mongoDbId, userId, fileSize, mimeType } = imageData;

    const [result] = await getPool().execute(
        'INSERT INTO iam_Images (Filename, MongoDbId, UserId, FileSize, MimeType) VALUES (?, ?, ?, ?, ?)',
        [filename, mongoDbId, userId, fileSize, mimeType]
    );

    const [rows] = await getPool().execute('SELECT * FROM iam_Images WHERE ImageId = ?', [result.insertId]);
    return rows[0];
};

const findById = async (imageId) => {
    const [rows] = await getPool().execute('SELECT * FROM iam_Images WHERE ImageId = ?', [imageId]);
    return rows[0];
};

const findByMongoId = async (mongoDbId) => {
    const [rows] = await getPool().execute('SELECT * FROM iam_Images WHERE MongoDbId = ?', [mongoDbId]);
    return rows[0];
};

const findByUserId = async (userId, limit = 50) => {
    const [rows] = await getPool().execute(
        'SELECT * FROM iam_Images WHERE UserId = ? ORDER BY CreatedAt DESC LIMIT ?',
        [userId, limit]
    );
    return rows;
};

const searchByFilename = async (filename) => {
    const [rows] = await getPool().execute(
        'SELECT * FROM iam_Images WHERE Filename LIKE ? ORDER BY CreatedAt DESC',
        [`%${filename}%`]
    );
    return rows;
};

const deleteById = async (imageId) => {
    await getPool().execute('DELETE FROM iam_Images WHERE ImageId = ?', [imageId]);
};

module.exports = {
    createImage,
    findById,
    findByMongoId,
    findByUserId,
    searchByFilename,
    deleteById,
};
