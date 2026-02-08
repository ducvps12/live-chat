const { getPool } = require('../../infra/mysql/mysql');

const getWidgetBySiteKey = async (siteKey) => {
  const [rows] = await getPool().execute(
    `SELECT WidgetKey, WidgetId, WorkspaceKey, Name, Status, AllowedDomains, Theme, SiteKey
     FROM iam_Widgets WHERE SiteKey = ? AND Status = 1`,
    [siteKey]
  );
  return rows[0] || null;
};

module.exports = { getWidgetBySiteKey };
