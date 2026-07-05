(function() {
    'use strict';

    var LANG = {
        reviewDone:  '\u6821\u5BF9\u5B8C\u6210',
        unreviewed:  '\u672A\u6821\u5BF9',
        reviewed:    '\u5DF2\u6821\u5BF9',
        selectFirst: '\u8BF7\u5148\u9009\u62E9\u6587\u4EF6',
        noFile:      '\u8BF7\u9009\u62E9\u6587\u4EF6\uFF08\u4E0D\u652F\u6301\u6587\u4EF6\u5939\uFF09',
        done:        '\u6821\u5BF9\u5B8C\u6210\uFF1A',
        error:       '\u8BF7\u6C42\u5931\u8D25',
    };

    var CSS = {
        badge: 'font-size:11px;margin-left:6px;font-weight:600;',
        unreviewed: 'color:#9E9E9E;',
        reviewed: 'color:#4CAF50;',
    };

    function wait(condition, callback, interval) {
        interval = interval || 300;
        var timer = setInterval(function() {
            if (condition()) {
                clearInterval(timer);
                callback();
            }
        }, interval);
    }

    function apiUrl(action, params) {
        var host = window.API_HOST || '/index.php?';
        var sep = host.indexOf('?') >= 0 ? '' : '?';
        return host + sep + action + '&' + (params || '') + '&CSRF_TOKEN=' + (window.CSRF_TOKEN || '');
    }

    function getSelectedFiles() {
        var files = [];
        try {
            var app = window.app || $('body').data('app');
            if (app && app.root && app.root.select && app.root.select.fileLight) {
                files = app.root.select.fileLight.listSelect || [];
            }
        } catch(e) {}
        if (!files.length) {
            $('.file.item-select').each(function() {
                var item = $(this).data('fileItem');
                if (item) files.push(item);
            });
        }
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
            if (typeof Tips !== 'undefined') { Tips.tips(LANG.selectFirst, 'warning'); }
            else { alert(LANG.selectFirst); }
            return;
        }
        var paths = [];
        for (var i = 0; i < files.length; i++) {
            if (!files[i].isFolder && files[i].path) {
                paths.push(files[i].path);
            }
        }
        if (!paths.length) {
            if (typeof Tips !== 'undefined') { Tips.tips(LANG.noFile, 'warning'); }
            else { alert(LANG.noFile); }
            return;
        }
        var completed = 0;
        var failed = 0;
        for (var j = 0; j < paths.length; j++) {
            (function(path) {
                var url = apiUrl('explorer/review/setStatus', 'path=' + encodeURIComponent(path) + '&status=' + encodeURIComponent(LANG.reviewed));
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
                        if (typeof Tips !== 'undefined') {
                            Tips.tips(LANG.done + completed + '/' + paths.length, 'success');
                        } else {
                            alert(LANG.done + completed + '/' + paths.length);
                        }
                        updateBadges();
                    }
                }).fail(function() {
                    failed++;
                    if (completed + failed === paths.length) {
                        if (typeof Tips !== 'undefined') {
                            Tips.tips(LANG.error, 'error');
                        } else {
                            alert(LANG.error);
                        }
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
            var status = (fileItem.metaInfo && fileItem.metaInfo.reviewStatus) || LANG.unreviewed;
            var $badge = $name.find('.review-badge');
            if ($badge.length) {
                $badge.text('[' + status + ']');
                $badge.attr('style', CSS.badge + (status === LANG.reviewed ? CSS.reviewed : CSS.unreviewed));
            } else {
                var color = status === LANG.reviewed ? '#4CAF50' : '#9E9E9E';
                $name.append('<span class="review-badge" style="' + CSS.badge + 'color:' + color + ';">[' + status + ']</span>');
            }
        });
    }

    function initToolbarButton() {
        wait(function() {
            return $('.kod-toolbar-current .toolbar-item button[data-action="download"]').length > 0;
        }, function() {
            var $downloadBtn = $('.kod-toolbar-current .toolbar-item button[data-action="download"]');
            var $container = $downloadBtn.closest('.toolbar-item');
            if ($container.length && !$('.review-btn-container').length) {
                var $btn = $(
                    '<div class="toolbar-item review-btn-container">' +
                        '<button class="toolbar-icon" data-action="review-done" title="' + LANG.reviewDone + '">' +
                            '<span class="font-icon ri-check-line"></span>' +
                        '</button>' +
                    '</div>'
                );
                $container.after($btn);
                $btn.on('click', 'button[data-action="review-done"]', function(e) {
                    e.stopPropagation();
                    doReview();
                });
            }
        });
    }

    function initContextMenuItem() {
        $(document).on('mouseenter', '.context-menu-list:visible', function() {
            var $menu = $(this);
            if ($menu.find('.review-menu-item').length) return;
            var $downloadItem = $menu.find('.context-menu-item.download');
            if (!$downloadItem.length) return;
            var $item = $(
                '<li class="context-menu-item review-menu-item">' +
                    '<span><span class="font-icon ri-check-line"></span> ' + LANG.reviewDone + '</span>' +
                '</li>'
            );
            $downloadItem.after($item);
            $item.on('click', function() {
                $menu.hide();
                doReview();
            });
        });
    }

    function initStatusDisplay() {
        setInterval(updateBadges, 1500);
    }

    wait(function() {
        return typeof $ !== 'undefined' && typeof window.API_HOST !== 'undefined';
    }, function() {
        initToolbarButton();
        initContextMenuItem();
        initStatusDisplay();
    });
})();
