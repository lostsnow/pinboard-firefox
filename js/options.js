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
    $('#no-page-action').attr('checked', localStorage[nopageaction] === 'true')
    .click(function () {
        var value = $(this).is(':checked');
        localStorage[nopageaction] = value;
    });
    $('#tag-filter').val(localStorage[tagfilterkey])
    $('#tag-filter-save').click(function () {
        var value = $('#tag-filter').val();
        localStorage[tagfilterkey] = value;
    });
});
