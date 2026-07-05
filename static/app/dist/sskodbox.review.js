(function() {
    'use strict';

    var LANG = {
        reviewDone: '\u6821\u5BF9\u5B8C\u6210',
        unreviewed: '\u672A\u6821\u5BF9',
        reviewed: '\u5DF2\u6821\u5BF9',
        selectFirst: '\u8BF7\u5148\u9009\u62E9\u6587\u4EF6',
        noFile: '\u8BF7\u9009\u62E9\u6587\u4EF6\uFF08\u4E0D\u652F\u6301\u6587\u4EF6\u5939\uFF09',
        done: '\u6821\u5BF9\u5B8C\u6210\uFF1A',
        error: '\u8BF7\u6C42\u5931\u8D25',
    };

    var CSS = {
        badge: 'font-size:11px;margin-left:6px;font-weight:600;',
        unreviewed: 'color:#9E9E9E;',
        reviewed: 'color:#4CAF50;',
    };

    function getCSRF() {
        var m = document.cookie.match(/CSRF_TOKEN=([^;]+)/);
        return m ? m[1] : '';
    }

    function apiUrl(action, params) {
        var host = window.API_HOST || '/index.php?';
        return host + action + '&' + (params || '') + '&CSRF_TOKEN=' + getCSRF();
    }

    function getSelectedFiles() {
        var files = [];
        $('.file.item-select').each(function() {
            var item = $(this).data('fileItem');
            if (item) files.push(item);
        });
        if (!files.length) {
            $('.file.hover').each(function() {
                var item = $(this).data('fileItem');
                if (item) files.push(item);
            });
        }
        return files;
    }

    function doReview() {
        var files = getSelectedFiles();
        if (!files.length) {
            Tips.tips(LANG.selectFirst, 'warning');
            return;
        }
        var paths = [];
        for (var i = 0; i < files.length; i++) {
            if (!files[i].isFolder && files[i].path) {
                paths.push(files[i].path);
            }
        }
        if (!paths.length) {
            Tips.tips(LANG.noFile, 'warning');
            return;
        }
        var completed = 0;
        var failed = 0;
        for (var j = 0; j < paths.length; j++) {
            (function(path) {
                var url = apiUrl('explorer/review/setStatus',
                    'path=' + encodeURIComponent(path) +
                    '&status=' + encodeURIComponent(LANG.reviewed));
                $.get(url, function(res) {
                    if (res && res.code) {
                        completed++;
                    } else {
                        failed++;
                    }
                    if (completed + failed === paths.length) {
                        try {
                            if (window.app && window.app.pathAction) {
                                window.app.pathAction.pathRefresh();
                            }
                        } catch(e) {}
                        Tips.tips(LANG.done + completed + '/' + paths.length, 'success');
                        updateBadges();
                    }
                }).fail(function() {
                    failed++;
                    if (completed + failed === paths.length) {
                        Tips.tips(LANG.error, 'error');
                    }
                });
            })(paths[j]);
        }
    }

    function updateBadges() {
        $('.file .info .name').each(function() {
            var $name = $(this);
            var $item = $name.closest('.file');
            var fileItem = $item.data('fileItem');
            if (!fileItem) return;
            var meta = fileItem.metaInfo || {};
            var status = meta.reviewStatus || LANG.unreviewed;
            var $badge = $name.find('.review-badge');
            if ($badge.length) {
                $badge.text('[' + status + ']');
                $badge.css('color', status === LANG.reviewed ? '#4CAF50' : '#9E9E9E');
            } else {
                var color = status === LANG.reviewed ? '#4CAF50' : '#9E9E9E';
                $name.append(
                    '<span class="review-badge" style="font-size:11px;margin-left:6px;font-weight:600;color:' +
                    color + ';">[' + status + ']</span>');
            }
        });
    }

    function initToolbarButton() {
        var timer = setInterval(function() {
            var $btn = $('.kod-toolbar-current .toolbar-item button[data-action="download"]');
            if (!$btn.length) return;
            clearInterval(timer);
            var $container = $btn.closest('.toolbar-item');
            if (!$container.length || $('.review-btn-container').length) return;
            var $newBtn = $(
                '<div class="toolbar-item review-btn-container">' +
                '<button class="toolbar-icon" data-action="review-done" title="' + LANG.reviewDone + '">' +
                '<span class="font-icon ri-check-line"></span>' +
                '</button>' +
                '</div>');
            $container.after($newBtn);
            $newBtn.on('click', 'button[data-action="review-done"]', function(e) {
                e.stopPropagation();
                doReview();
            });
        }, 500);
    }

    function initContextMenuItem() {
        $(document).on('mouseenter.contextReview', '.context-menu-list:visible', function() {
            var $menu = $(this);
            if ($menu.find('.review-menu-item').length) return;
            var $downloadItem = $menu.find('.context-menu-item.download');
            if (!$downloadItem.length) return;
            var $item = $(
                '<li class="context-menu-item review-menu-item">' +
                '<span><span class="font-icon ri-check-line"></span> ' + LANG.reviewDone + '</span>' +
                '</li>');
            $downloadItem.after($item);
            $item.on('click', function() {
                $menu.hide();
                doReview();
            });
        });
    }

    var badgeTimer = null;

    function initBadges() {
        badgeTimer = setInterval(updateBadges, 2000);
    }

    $(document).ready(function() {
        if (typeof Tips === 'undefined') {
            setTimeout(init, 1000);
        } else {
            init();
        }
    });

    function init() {
        initToolbarButton();
        initContextMenuItem();
        initBadges();
    }

})();
