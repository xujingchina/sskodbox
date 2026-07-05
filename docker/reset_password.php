<?php
/**
 * 重置管理员密码
 * 使用方法: docker-compose exec app php /var/www/kod/docker/reset_password.php <新密码>
 * 密码要求: 长度>=8, 包含数字/大写/小写/特殊字符 至少3类
 */
$_SERVER['argv'] = ['reset_password.php'];
$_SERVER['REQUEST_METHOD'] = 'CLI';
$_GET = array();
include_once '/var/www/kod/config/config.php';

if (empty($GLOBALS['config']['database']['DB_CHARSET'])) {
    $GLOBALS['config']['database']['DB_CHARSET'] = 'utf8';
}
think_config($GLOBALS['config']['databaseDefault']);
think_config($GLOBALS['config']['database']);

$newPass = $argv[1] ?? '';
if (!$newPass) {
    echo "用法: php /var/www/kod/docker/reset_password.php <新密码>\n";
    echo "密码要求: 长度>=8, 数字/大写/小写/特殊字符 至少3类\n";
    exit(1);
}

// 检查密码强度
$checks = 0;
$checks += preg_match('/[0-9]/', $newPass) ? 1 : 0;
$checks += preg_match('/[A-Z]/', $newPass) ? 1 : 0;
$checks += preg_match('/[a-z]/', $newPass) ? 1 : 0;
$checks += preg_match('/[^a-zA-Z0-9]/', $newPass) ? 1 : 0;
if (strlen($newPass) < 8 || $checks < 3) {
    echo "密码不符合强度要求: 长度>=8, 数字/大写/小写/特殊字符 至少3类\n";
    exit(1);
}

$admin = Model('User')->find(1);
if (!$admin) {
    echo "未找到管理员账号(userID=1)\n";
    exit(1);
}

// 直接更新密码（使用系统的 parsePass 方法）
$data = ['name' => $admin['name'], 'password' => $newPass];
$res = Model('User')->userEdit(1, $data);
if ($res) {
    echo "密码已更新。新密码: {$newPass}\n";
} else {
    echo "密码更新失败\n";
    exit(1);
}
