<?php
/**
 * 重新初始化左侧目录树（系统路径）
 *
 * 使用方法:
 *   docker-compose exec app php /var/www/kod/docker/reset_tree.php
 *
 * 安全模式（默认）：只重置系统级路径（不影响用户文件）
 * 完整模式：php /var/www/kod/docker/reset_tree.php --all
 */
$_SERVER['argv'] = ['reset_tree.php'];
$_SERVER['REQUEST_METHOD'] = 'CLI';
$_GET = array();
include_once '/var/www/kod/config/config.php';

// 手动合并数据库配置（确保 charset 等默认值生效）
if (empty($GLOBALS['config']['database']['DB_CHARSET'])) {
    $GLOBALS['config']['database']['DB_CHARSET'] = 'utf8';
}
think_config($GLOBALS['config']['databaseDefault']);
think_config($GLOBALS['config']['database']);

$fullReset = in_array('--all', $_SERVER['argv'] ?? []);
$db = Model()->db();

echo "=== 重置左侧目录树 ===\n\n";

if ($fullReset) {
    // 完整模式：清空所有源数据
    echo "[完整模式] 清空所有 io_source 表数据...\n";
    $tables = ['io_source', 'io_source_auth', 'io_source_event', 'io_source_history', 'io_source_meta', 'io_source_recycle'];
    foreach ($tables as $table) {
        $db->execute("DELETE FROM `{$table}`");
        echo "  已清空: {$table}\n";
    }
} else {
    // 安全模式：只删系统路径根节点(targetType=0)，保留用户文件
    echo "[安全模式] 仅清理系统级路径...\n";

    // 找出系统根节点 id
    $roots = $db->query("SELECT sourceID FROM io_source WHERE targetType=0 AND parentID=0");
    $ids = array_column($roots, 'sourceID');

    if (!empty($ids)) {
        $idStr = implode(',', $ids);
        // 删除所有系统子节点
        $db->execute("DELETE FROM io_source WHERE parentLevel LIKE '%,{$idStr},%' OR sourceID IN ({$idStr})");
        $db->execute("DELETE FROM io_source_auth WHERE sourceID IN ({$idStr})");
        $db->execute("DELETE FROM io_source_meta WHERE sourceID IN ({$idStr})");
        echo "  已清理系统路径节点: " . count($ids) . " 个根节点及其子节点\n";
    } else {
        echo "  未找到系统路径根节点\n";
    }
}

// 重新初始化系统路径
echo "\n--- 调用 KodIO::initSystemPath() ---\n";
KodIO::initSystemPath();
echo "系统路径初始化完成\n";

// 重新初始化每个用户的路径
$users = Model('User')->select();
echo "\n--- 重新初始化用户路径 ---\n";
foreach ($users as $user) {
    if (empty($user['userID'])) continue;
    echo "  用户: {$user['name']} (ID:{$user['userID']})... ";
    try {
        KodUser::init($user['userID']);
        echo "OK\n";
    } catch (Exception $e) {
        echo "失败: " . $e->getMessage() . "\n";
    }
}

// 清理缓存
echo "\n--- 清理缓存 ---\n";
Cache::deleteAll();
echo "缓存已清理\n";

echo "\n=== 重置完成！请刷新页面 ===\n";
