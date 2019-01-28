(function($window, $) {
    var bg = browser.extension.getBackgroundPage(),
        keyCode = { enter: 13, tab: 9, up: 38, down: 40, ctrl: 17, n: 78, p: 80, space: 32 },
        SEC = 1000, MIN = SEC * 60, HOUR = MIN * 60, DAY = HOUR * 24, WEEK = DAY * 7;

    var escapeHTML = function (str) {
        var replacements = { "&": "&amp;", '"': "&quot;", "'": "&#39;", "<": "&lt;", ">": "&gt;" };
        return str.replace(/[&"'<>]/g, (m) => replacements[m]);
    }

    var getTimePassed = function (date) {
        var ret = { day: 0, hour: 0, min: 0, sec: 0, offset: -1 },
            offset = new Date() - date, r;
        if (offset <= 0) return ret;
        ret.offset = offset;
        ret.week = Math.floor(offset / WEEK); r = offset % WEEK;
        ret.day = Math.floor(offset / DAY); r = offset % DAY;
        ret.hour = Math.floor(r / HOUR); r = r % HOUR;
        ret.min = Math.floor(r / MIN); r = r % MIN;
        ret.sec = Math.floor(r / SEC);
        return ret;
    };

    var renderSavedTime = function (time) {
        var passed = getTimePassed(new Date(time)),
            dispStr = 'previously saved ',
            w = passed.week, d = passed.day, h = passed.hour;
        if (passed.offset > WEEK) {
            dispStr = dispStr.concat(passed.week, ' ', 'weeks ago');
        } else if (passed.offset > DAY) {
            dispStr = dispStr.concat(passed.day, ' ', 'days ago');
        } else if (passed.offset > HOUR) {
            dispStr = dispStr.concat(passed.hour, ' ', 'hours ago');
        } else {
            dispStr = dispStr.concat('just now');
        }
        return dispStr;
    };

    var $scope = {
        "loadingText": "Loading...",
        "userInfo": {},
        "pageInfo": {}
    };
    var $loading = $("#state-mask").hide();
    var $login = $("#login-window").hide();
    var $bookmark = $("#bookmark-window").hide();
    var $postform = $("#add-post-form").hide();
    var $autocomplete = $("#auto-complete").hide();

    var renderLoading = function(loadingText) {
        $scope.loadingText = loadingText || $scope.loadingText;
        if ($scope.isLoading === true) {
            $loading.text($scope.loadingText);
            $loading.show();
        } else {
            $loading.hide();
        }
    }
    renderLoading();

    var renderLoginPage = function() {
        console.log("rendering login page");
        $login.show();

        var $loginerr = $("#login-error");
        if ($scope.isLoginError === true) {
            $loginerr.show();
        } else {
            $loginerr.hide();
        }

        $("#login-btn").off("click").on("click", loginSubmit);
    }

    browser.runtime.onMessage.addListener(function(message){
        // console.log("receive message: " + JSON.stringify(message))
        if (message.type === "login-succeed") {
            $scope.isLoading = false;
            $scope.isLoginError = false;

            renderUserInfo();
            $loading.hide();
            renderBookmarkPage();
        } else if (message.type === "login-failed") {
            $scope.isLoading = false;
            $scope.isLoginError = true;

            $loading.hide();
            renderLoginPage();
        } else if (message.type === "logged-out") {
            $scope.isAnony = true;
            $scope.isLoading = false;
            $scope.isLoginError = false;

            $bookmark.hide();
            $loading.hide();
            renderLoginPage();
        } else if (message.type === "render-suggests") {
            $scope.suggests = message.data;
            renderSuggest();
        } else if (message.type === "render-page-info") {
            if (message.data) {
                browser.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                    tab = tabs[0];
                    pageInfo = message.data;
                    if (pageInfo.isSaved == false) {
                        pageInfo = {
                            url: tab.url,
                            title: tab.title,
                            tag: '',
                            desc: ''
                        };
                        pageInfo.shared = (localStorage[allprivateKey] !== 'true');
                        pageInfo.isSaved = false;
                    }
                    if (pageInfo.tag) {
                        pageInfo.tag = pageInfo.tag.concat(' ');
                    }
                    pageInfo.isPrivate = !pageInfo.shared;
                    pageInfo.toread = (localStorage[allreadlater] === 'true');
                    $scope.pageInfo = $.extend({}, pageInfo);
                    initAutoComplete();
                    console.log("get tag suggesting");
                    bg.getSuggest(tab.url);

                    $("#url").val(pageInfo.url);
                    $("#title").val(pageInfo.title);
                    $("#tag").val(pageInfo.tag);
                    if (!pageInfo.desc) {
                        chrome.tabs.sendMessage(
                            tab.id, {
                                method: 'getDescription'
                            },
                            function (response) {
                                if (typeof response !== 'undefined' &&
                                    response.data.length !== 0) {
                                    var desc = response.data;
                                    if (desc.length > maxDescLen) {
                                        desc = desc.slice(0, maxDescLen) + '...';
                                    }
                                    if (isBlockquote()) {
                                        desc = '<blockquote>' + desc + '</blockquote>';
                                    }
                                    pageInfo.desc = desc;
                                    $("#desc").val(pageInfo.desc);
                                }
                            }
                        );
                    } else {
                        $("#desc").val(pageInfo.desc);
                    }

                    if (pageInfo.isPrivate === true) {
                        $("#private").prop('checked', true);
                    }
                    if (pageInfo.toread === true) {
                        $("#toread").prop('checked', true);
                    }

                    renderError();

                    var $savetime = $(".alert-savetime").hide();
                    if (pageInfo.time) {
                        $savetime.text(renderSavedTime(pageInfo.time));
                        $savetime.show();
                    } else {
                        $savetime.hide();
                    }

                    if (pageInfo.isSaved === true) {
                        $("#opt-delete").off("click").on("click", function(){
                            $("#opt-cancel-delete").off("click").on("click", function(){
                                $("#opt-confirm").hide();
                                $("#opt-delete").show();
                                return false;
                            });

                            $("#opt-destroy").off("click").on("click", function(){
                                postDelete();
                                return false;
                            });

                            $("#opt-delete").hide();
                            $("#opt-confirm").show();
                            return false;
                        }).show();
                    }

                    $("#tag").off("change keyup paste").on("change keyup paste", function (e) {
                        var code = e.charCode ? e.charCode : e.keyCode;
                        if (code && $.inArray(code, [keyCode.enter, keyCode.tab, keyCode.up, keyCode.down,
                                keyCode.n, keyCode.p, keyCode.ctrl, keyCode.space]) === -1) {
                            $scope.pageInfo.tag = $("#tag").val();
                            renderSuggest();
                            showAutoComplete();
                        }
                    }).off("keydown").on("keydown", function (e) {
                        chooseTag(e);
                        renderSuggest();
                    });

                    $postform.off("submit").on("submit", function(){
                        postSubmit();
                        return false;
                    });

                    $scope.isLoading = false;
                    renderLoading();

                    $postform.show();

                    $("#tag").focus();
                });
            } else {
                console.log("query bookmark info error");
                $scope.loadingText = 'Query bookmark info error';
                $scope.isLoading = true;
                renderLoading();
            }
        } else if (message.type === "addpost-succeed") {
            $scope.isPostError = false;
            $window.close();
        } else if (message.type === "addpost-failed") {
            $scope.isLoading = false;
            $scope.isPostError = true;
            $scope.postErrorText = message.error
            renderError();
            renderLoading();
        } else if (message.type === "deletepost-succeed") {
            $scope.isPostError = false;
            $window.close();
        } else if (message.type === "deletepost-failed") {
            $scope.isLoading = false;
            $scope.isPostError = true;
            $scope.postErrorText = message.error
            renderError();
            renderLoading();
        }
    });

    var loginSubmit = function () {
        var authToken = $("#token").val();
        if (authToken) {
            $scope.loadingText = 'log in...';
            $scope.isLoading = true;
            $login.hide();
            renderLoading();
            bg.login(authToken);
            return false;
        }
    };

    var renderPageHeader = function() {
        $("#username").text($scope.userInfo.name);

        $(".logout a").on("click", function() {
            console.log("log out...");
            $scope.isLoading = true;
            $scope.loadingText = "Log out...";
            renderLoading();
            bg.logout();
        });
    };

    var renderError = function() {
        var $posterr = $(".alert-error").hide();
        if ($scope.isPostError === true) {
            $posterr.text($scope.postErrorText);
            $posterr.show();
            $postform.show();
        } else {
            $posterr.hide();
        }
    };

    var renderBookmarkPage = function () {
        console.log("rendering bookmark page");
        $bookmark.show();
        renderPageHeader();
        browser.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            var tab = tabs[0];
            if (tab.url.indexOf("http://") !== 0 && tab.url.indexOf("https://") !== 0) {
                console.log("invalid tab");
                $scope.loadingText = 'Please select a valid tab';
                $scope.isLoading = true;
                renderLoading();
                return;
            }

            $scope.loadingText = 'Loading bookmark...';
            $scope.isLoading = true;
            renderLoading();

            bg.getPageInfo(tab.url);
        });
    };

    var initAutoComplete = function () {
        var tags = bg.getTags();
        if (tags && tags.length) {
            $scope.allTags = tags;
        } else {
            $scope.allTags = [];
        }
    };

    var chooseTag = function (e) {
        var code = e.charCode ? e.charCode : e.keyCode;
        if (code && $.inArray(code, [keyCode.enter, keyCode.tab, keyCode.up, keyCode.down,
                keyCode.n, keyCode.p, keyCode.ctrl, keyCode.space]) !== -1) {
            if (code == keyCode.enter || code == keyCode.tab) {
                if ($scope.isShowAutoComplete) {
                    e.preventDefault();
                    // submit tag
                    var items = $scope.pageInfo.tag.split(' '),
                        tag = $scope.autoCompleteItems[$scope.activeItemIndex];
                    items.splice(items.length - 1, 1, tag.text);
                    $scope.pageInfo.tag = items.join(' ') + ' ';
                    $("#tag").val($scope.pageInfo.tag);
                    $scope.isShowAutoComplete = false;
                    renderAutoComplete();
                } else if (code == keyCode.enter) {
                    postSubmit();
                    return false;
                }
            } else if (code == keyCode.down ||
                (code == keyCode.n && e.ctrlKey == true)) {
                // move up one item
                e.preventDefault();
                var idx = $scope.activeItemIndex + 1;
                if (idx >= $scope.autoCompleteItems.length) {
                    idx = 0;
                }
                var newItems = $scope.autoCompleteItems.map(function (item) {
                    return { text: item.text, isActive: false };
                });
                $scope.autoCompleteItems = newItems;
                $scope.activeItemIndex = idx;
                $scope.autoCompleteItems[idx].isActive = true;
                renderAutoComplete();
            } else if (code == keyCode.up ||
                (code == keyCode.p && e.ctrlKey == true)) {
                // move down one item
                e.preventDefault();
                var idx = $scope.activeItemIndex - 1;
                if (idx < 0) {
                    idx = $scope.autoCompleteItems.length - 1;
                }
                var newItems = $scope.autoCompleteItems.map(function (item) {
                    return { text: item.text, isActive: false };
                });
                $scope.autoCompleteItems = newItems;
                $scope.activeItemIndex = idx;
                $scope.autoCompleteItems[idx].isActive = true;
                renderAutoComplete();
            } else if (code == keyCode.space) {
                $scope.isShowAutoComplete = false;
                renderAutoComplete();
            }
        }
    };

    var showAutoComplete = function () {
        var items = $scope.pageInfo.tag.split(' '),
            word = items[items.length - 1],
            MAX_SHOWN_ITEMS = 5;
        if (word) {
            word = word.toLowerCase();
            var allTags = $scope.allTags,
                shownCount = 0, autoCompleteItems = [];
            for (var i = 0, len = allTags.length; i < len && shownCount < MAX_SHOWN_ITEMS; i++) {
                var tag = allTags[i].toLowerCase();
                if (tag.indexOf(word) == 0 && $.inArray(tag, items) === -1) {
                    var item = { text: tag, isActive: false };
                    autoCompleteItems.push(item);
                    shownCount += 1;
                }
            }
            if (shownCount) {
                $scope.autoCompleteItems = autoCompleteItems.reverse();
                $scope.autoCompleteItems[0].isActive = true;
                $scope.activeItemIndex = 0;
                $scope.isShowAutoComplete = true;
                var tagEl = $('#tag'), pos = $('#tag').offset();
                pos.top = pos.top + tagEl.outerHeight();
                $autocomplete.css({ 'left': pos.left, 'top': pos.top });
            } else {
                $scope.isShowAutoComplete = false;
            }
        } else {
            $scope.isShowAutoComplete = false;
        }
        renderAutoComplete();
    };

    var renderAutoComplete = function() {
        if ($scope.isShowAutoComplete === true) {
            $("#auto-complete ul").html("");
            $.each($scope.autoCompleteItems, function (index, item) {
                var cls = "";
                if (item.isActive === true) {
                    cls = "active";
                }
                $("#auto-complete ul").append('<li class="' + cls + '">' + escapeHTML(item.text) + '</li>');
            });
            $autocomplete.show();
        } else {
            $autocomplete.hide();
        }
    }

    var renderSuggest = function() {
        if ($scope.suggests && $scope.suggests.length > 0) {
            $("#suggest").html("");
            $.each($scope.suggests, function (index, suggest) {
                var cls = "add-tag";
                if ($scope.pageInfo.tag.split(' ').indexOf(suggest) != -1) {
                    cls += " selected";
                }
                $("#suggest").append('<a href="#" class="' + cls + '">' + escapeHTML(suggest) + '</a>');
            });
            $("#suggest").append('<a href="#" class="add-all-tag">Add all</a>')
            $(".add-tag").off("click").on("click", function(){
                var tag = $(this).text();
                addTags([tag]);
                $(this).addClass("selected");
            });
            $(".add-all-tag").off("click").on("click", function(){
                addTags($scope.suggests);
            });
            $("#suggest-list").show();
        } else {
            $("#suggest-list").hide();
        }
    }

    var addTag = function (s) {
        var t = $scope.pageInfo.tag.trim();
        // skip if tag already added
        if ($.inArray(s, t.split(' ')) === -1) {
            $scope.pageInfo.tag = t + ' ' + s + ' ';
        }
        $("#tag").val($scope.pageInfo.tag);
    };

    var addTags = function (tags) {
        $.each(tags, function (index, tag) {
            addTag(tag);
        });
    };

    var postSubmit = function () {
        console.log("post new bookmark");
        $scope.isLoading = true;
        $scope.loadingText = 'Saving...';
        $postform.hide();
        $scope.isPostError = false;
        renderError();
        renderLoading();

        var info = {
            url: $("#url").val(),
            title: $("#title").val(),
            desc: $("#desc").val(),
            tag: $("#tag").val()
        };

        info.shared = $('#private').prop('checked') ? 'no' : 'yes';
        info.toread = $('#toread').prop('checked') ? 'yes' : 'no';
        bg.addPost(info);
    };

    var postDelete = function () {
        console.log("delete bookmark");
        $scope.isLoading = true;
        $scope.loadingText = 'Deleting...';
        $postform.hide();
        $scope.isPostError = false;
        renderError();
        renderLoading();
        browser.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            var tab = tabs[0];
            bg.deletePost(tab.url);
        });
    };

    $(".link").on("click", function() {
        var url = $(this).attr("href");
        browser.tabs.query({}, function (tabs) {
            index = tabs.length;
            browser.tabs.create({ url: url, index: index });
            $window.close();
        });
        return false;
    });

    $(".option").off("click").on("click", function () {
        browser.runtime.openOptionsPage();
    });

    var renderUserInfo = function() {
        var userInfo = bg.getUserInfo();
        $scope.userInfo = userInfo;
        $scope.isAnony = !userInfo || !userInfo.isChecked;
    }

    renderUserInfo();
    $scope.isLoading = false;
    if ($scope.isAnony) {
        renderLoading();
        renderLoginPage();
    } else {
        renderBookmarkPage();
    }
})(window, jQuery);