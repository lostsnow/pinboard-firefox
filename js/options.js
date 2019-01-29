$(function() {
    // localStorage only stores string values
    $('#no-ping').attr('checked', localStorage[nopingKey] === 'true')
    .click(function () {
        var value = $(this).is(':checked');
        localStorage[nopingKey] = value;
    });
    $('#all-private').attr('checked', localStorage[allprivateKey] === 'true')
    .click(function () {
        var value = $(this).is(':checked');
        localStorage[allprivateKey] = value;
    });
    $('#all-readlater').attr('checked', localStorage[allreadlater] === 'true')
    .click(function () {
        var value = $(this).is(':checked');
        localStorage[allreadlater] = value;
    });
    $('#use-blockquote').attr('checked', isBlockquote())
    .click(function () {
        var value = $(this).is(':checked');
        localStorage[noblockquoteKey] = !value;
    });
    $('#no-page-action').attr('checked', localStorage[nopageaction] === 'true')
    .click(function () {
        var value = $(this).is(':checked');
        localStorage[nopageaction] = value;
    });
});
