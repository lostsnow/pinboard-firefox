// {url: {title, desc, tag, time, isSaved, isSaving}}
var pages = {}, _userInfo;

var login = function (token) {
    // test auth
    var path = mainPath + 'user/api_token',
        jqxhr = $.ajax({
            url: path,
            data: { format: 'json', auth_token: token },
            type: 'GET',
            timeout: REQ_TIME_OUT,
            dataType: 'json',
            crossDomain: true,
            contentType: 'text/plain'
        });
    jqxhr.always(function (data) {
        if (data.result) {
            // success
            _userInfo.authToken = token;
            _userInfo.name = token.split(':')[0];
            _userInfo.isChecked = true;
            localStorage[namekey] = _userInfo.name;
            localStorage[authTokenKey] = token;
            localStorage[checkedkey] = true;

            browser.runtime.sendMessage({
                type: "login-succeed"
            });
            _getTags();
        } else {
            // login error
            browser.runtime.sendMessage({
                type: "login-failed"
            });
        }
    });
    jqxhr.fail(function (data) {
        if (data.statusText == 'timeout') {
            browser.runtime.sendMessage({
                type: "login-failed"
            });
        }
    });
};

var logout = function () {
    _userInfo.isChecked = false;
    localStorage.removeItem(checkedkey);
    localStorage.removeItem(namekey);
    localStorage.removeItem(authTokenKey);
    localStorage.removeItem(nopingKey);
    browser.runtime.sendMessage({
        type: "logged-out"
    });
};

var getUserInfo = function () {
    if (!_userInfo) {
        if (localStorage[checkedkey]) {
            _userInfo = {
                isChecked: localStorage[checkedkey],
                authToken: localStorage[authTokenKey],
                name: localStorage[namekey],
            };
        } else {
            _userInfo = {
                isChecked: false,
                authToken: '',
                name: ''
            };
        }
    }
    return _userInfo;
};

// for popup.html to acquire page info
// if there is no page info at local then get it from server
var getPageInfo = function (url) {
    if (!url || (url.indexOf('https://') !== 0 && url.indexOf('http://') !== 0)) {
        return { url: url, isSaved: false };
    }
    var pageInfo = pages[url];
    if (pageInfo) {
        browser.runtime.sendMessage({
            type: "render-page-info",
            data: pageInfo
        });
        return;
    }
    // download now
    var cb = function () {
        updateSelectedTabExtIcon();
    };
    queryPinState({ url: url, ready: cb });
};

var isQuerying = false;
var queryPinState = function (info) {
    var userInfo = getUserInfo(),
        url = info.url,
        handler = function (data) {
            isQuerying = false;
            var posts = data.posts,
                pageInfo = { isSaved: false };
            if (posts.length) {
                var post = posts[0];
                pageInfo = {
                    url: post.href,
                    title: post.description,
                    desc: post.extended,
                    tag: post.tags,
                    time: post.time,
                    shared: post.shared == 'no' ? false : true,
                    toread: post.toread == 'yes' ? true : false,
                    isSaved: true
                };
            }

            browser.runtime.sendMessage({
                type: "render-page-info",
                data: pageInfo
            });
            pages[url] = pageInfo;
            info.ready && info.ready(pageInfo);
        };
    if ((info.isForce || !isQuerying) && userInfo && userInfo.isChecked &&
        info.url && (url.indexOf('https://') === 0 || url.indexOf('http://') === 0)) {
        isQuerying = true;
        var settings = {
            url: mainPath + 'posts/get',
            type: 'GET',
            data: { url: url, format: 'json' },
            // timeout: REQ_TIME_OUT,
            dataType: 'json',
            crossDomain: true,
            contentType: 'text/plain'
        };
        settings.data.auth_token = userInfo.authToken;
        var jqxhr = $.ajax(settings);
        jqxhr.always(handler);
        jqxhr.fail(function (data) {
            isQuerying = false;
            if (data.statusText == 'timeout') {
                delete pages[url];
            }
            browser.runtime.sendMessage({
                type: "render-page-info"
            });
        });
    }
};

var updateSelectedTabExtIcon = function () {
    browser.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        var tab = tabs[0];
        var pageInfo = pages[tab.url];
        var iconPath = noIcon;
        if (pageInfo && pageInfo.isSaved) {
            iconPath = yesIcon;
        } else if (pageInfo && pageInfo.isSaving) {
            iconPath = savingIcon;
        }
        browser.browserAction.setIcon(
            { path: iconPath, tabId: tab.id });
        browser.pageAction.setIcon(
            { path: iconPath, tabId: tab.id });
    });
};

var addPost = function (info) {
    var userInfo = getUserInfo();
    if (userInfo && userInfo.isChecked && info.url && info.title) {
        var desc = info.desc;
        if (desc.length > maxDescLen) {
            desc = desc.slice(0, maxDescLen) + '...'
        }
        var path = mainPath + 'posts/add',
            data = {
                description: info.title, url: info.url,
                extended: desc, tags: info.tag, format: 'json'
            };
        info.shared && (data['shared'] = info.shared);
        info.toread && (data['toread'] = info.toread);
        var settings = {
            url: path,
            type: 'GET',
            timeout: REQ_TIME_OUT,
            dataType: 'json',
            crossDomain: true,
            data: data,
            contentType: 'text/plain'
        };
        settings.data.auth_token = userInfo.authToken;
            jqxhr = $.ajax(settings);
        jqxhr.always(function (data) {
            var resCode = data.result_code;
            if (resCode == 'done') {
                // done
                pages[info.url] = { isSaved: true };
                updateSelectedTabExtIcon();
                queryPinState({ url: info.url, isForce: true });
                browser.runtime.sendMessage({
                    type: "addpost-succeed"
                });
            } else {
                // error
                pages[info.url] = { isSaved: false };
                updateSelectedTabExtIcon();
                browser.runtime.sendMessage({
                    type: "addpost-failed",
                    error: 'Add failed: ' + data.result_code
                });
            }
        });
        jqxhr.fail(function (data) {
            pages[info.url] = { isSaved: false };
            updateSelectedTabExtIcon();
            browser.runtime.sendMessage({
                type: "addpost-failed",
                error: 'Add failed: ' + data.statusText
            });
        });
        // change icon state
        pages[info.url] = { isSaving: true };
        updateSelectedTabExtIcon();
    }
};

var deletePost = function (url) {
    var userInfo = getUserInfo();
    if (userInfo && userInfo.isChecked && url) {
        var path = mainPath + 'posts/delete';
        var settings = {
            url: path,
            type: 'GET',
            timeout: REQ_TIME_OUT,
            dataType: 'json',
            crossDomain: true,
            data: { url: url, format: 'json' },
            contentType: 'text/plain'
        };
        settings.data.auth_token = userInfo.authToken;
            jqxhr = $.ajax(settings);
        jqxhr.always(function (data) {
            var resCode = data.result_code;
            if (resCode == 'done' || resCode == 'item not found') {
                delete pages[url];
                updateSelectedTabExtIcon();
                browser.runtime.sendMessage({
                    type: "deletepost-succeed"
                });
            } else {
                browser.runtime.sendMessage({
                    type: "deletepost-failed",
                    error: 'Delete failed: ' + data.result_code
                });
            }
        });
        jqxhr.fail(function (data) {
            browser.runtime.sendMessage({
                type: "deletepost-failed",
                error: 'Delete failed: ' + data.statusText
            });
        });
    }
};

var getSuggest = function (url) {
    var userInfo = getUserInfo();
    if (userInfo && userInfo.isChecked && url) {
        var path = mainPath + 'posts/suggest';
        var settings = {
            url: path,
            type: 'GET',
            data: { url: url, format: 'json' },
            // timeout: REQ_TIME_OUT,
            dataType: 'json',
            crossDomain: true,
            contentType: 'text/plain'
        };
        settings.data.auth_token = userInfo.authToken;
        var jqxhr = $.ajax(settings);
        jqxhr.always(function (data) {
            var popularTags = [], recommendedTags = [];
            if (data) {
                if (data[0]) {
                    popularTags = data[0].popular;
                }
                if (data[1]) {
                    recommendedTags = data[1].recommended;
                }
            }
            // default to popluar tags, add new recommended tags
            var suggests = popularTags.slice();
            $.each(recommendedTags, function (index, tag) {
                if (popularTags.indexOf(tag) === -1) {
                    suggests.push(tag);
                }
            });
            browser.runtime.sendMessage({
                type: "render-suggests",
                data: suggests
            });
        });
    }
};

var _tags = [], _tagsWithCount = {};
// acquire all user tags from server refresh _tags
var _getTags = function () {
    var userInfo = getUserInfo();
    if (userInfo && userInfo.isChecked && userInfo.authToken) {
        var path = mainPath + 'tags/get',
            settings = {
                url: path,
                type: 'GET',
                data: { format: 'json' },
                timeout: REQ_TIME_OUT,
                dataType: 'json',
                crossDomain: true,
                contentType: 'text/plain'
            };
        settings.data.auth_token = userInfo.authToken;
        var jqxhr = $.ajax(settings);
        jqxhr.always(function (data) {
            if (data) {
                var sortTags = [];
                for (var t in data) {
                    sortTags.push([t, data[t]]);
                }
                sortTags.sort(function (a, b) {
                    return b[1] - a[1];
                })

                for (var i in sortTags) {
                    _tags.push(sortTags[i][0]);
                }
            }
        });
    }
};
_getTags();

var getTags = function () {
    return _tags;
};
var getTagsWithCount = function () {
    return _tagsWithCount;
};

// query at first time extension loaded
browser.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    var tab = tabs[0];
    if (localStorage[nopingKey] === 'true') {
        return;
    }
    console.log("query tab pin state on loaded");
    attemptPageAction(tab);
    queryPinState({
        url: tab.url,
        ready: function (pageInfo) {
            if (pageInfo && pageInfo.isSaved) {
                browser.browserAction.setIcon(
                    { path: yesIcon, tabId: tab.id });
                browser.pageAction.setIcon(
                    { path: yesIcon, tabId: tab.id });
            } else {
                browser.browserAction.setIcon({path: noIcon, tabId: tab.id});
                browser.pageAction.setIcon({path: noIcon, tabId: tab.id});
            }
        }
    });
});

browser.tabs.onUpdated.addListener(function (id, changeInfo, tab) {
    if (localStorage[nopingKey] === 'true') {
        return;
    }
    if (changeInfo.url) {
        var url = changeInfo.url;
        if (!pages.hasOwnProperty(url)) {
            console.log("query tab pin state on updated");
            browser.browserAction.setIcon({ path: noIcon, tabId: tab.id });
            attemptPageAction(tab);
            queryPinState({
                url: url,
                ready: function (pageInfo) {
                    if (pageInfo && pageInfo.isSaved) {
                        browser.browserAction.setIcon(
                            { path: yesIcon, tabId: tab.id });
                        browser.pageAction.setIcon(
                            { path: yesIcon, tabId: tab.id });
                    } else {
                        browser.browserAction.setIcon({path: noIcon, tabId: tab.id});
                        browser.pageAction.setIcon({path: noIcon, tabId: tab.id});
                    }
                }
            });
        }
    }
    console.log("set tab pin state on opening");
    var url = changeInfo.url || tab.url;
    attemptPageAction(tab);
    if (pages[url] && pages[url].isSaved) {
        browser.browserAction.setIcon({ path: yesIcon, tabId: tab.id });
        browser.pageAction.setIcon({ path: yesIcon, tabId: tab.id });
    }
});

browser.tabs.onActivated.addListener(function (activeInfo) {
    if (localStorage[nopingKey] === 'true') {
        return;
    }
    browser.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        var tab = tabs[0];
        var url = tab.url;
        if (!pages.hasOwnProperty(url)) {
            console.log("query tab pin state on actived");
            attemptPageAction(tab);
            queryPinState({
                url: url,
                ready: function (pageInfo) {
                    if (pageInfo && pageInfo.isSaved) {
                        browser.browserAction.setIcon(
                            { path: yesIcon, tabId: tab.id });
                        browser.pageAction.setIcon(
                            { path: yesIcon, tabId: tab.id });
                    } else {
                        browser.browserAction.setIcon({path: noIcon, tabId: tab.id});
                        browser.pageAction.setIcon({path: noIcon, tabId: tab.id});
                    }
                }
            });
        }
    });
});

/*
Attempt to create a page action on this tab.
Do not show if options checkbox is checked or this is an invalid tab.
*/
function attemptPageAction(tab) {
    browser.pageAction.hide(tab.id);
    if (localStorage[nopageaction] !== 'true' && (tab.url.indexOf("http://") !== -1 || tab.url.indexOf("https://") !== -1)) {
        browser.pageAction.show(tab.id);
    }
}